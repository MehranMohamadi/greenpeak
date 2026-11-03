"""Two bounded JSON model calls: select read-only evidence, then explain it."""

import json
import logging

import httpx
from pydantic import ValidationError

from ..llm_engine.provider import InvalidLLMResponse
from ..llm_engine.prompts import default_prompt, load_text_prompt
from ..llm_engine.routing import generate_validated_json

from .schemas import Answer, RetrievalPlan
from .store import ChatError, now_iso


logger = logging.getLogger(__name__)


def provider_http_failure(exc):
    """Classify provider failures without returning its body or credentials."""
    status = exc.response.status_code
    quota = False
    if status in {402, 403, 429}:
        try:
            payload = exc.response.json()
        except ValueError:
            payload = {}
        error = payload.get("error", payload) if isinstance(payload, dict) else {}
        if isinstance(error, dict):
            description = " ".join(str(error.get(key, ""))[:500] for key in ("code", "type", "message")).lower()
        else:
            description = str(error)[:500].lower()
        quota = status == 402 or any(marker in description for marker in (
            "insufficient_quota", "insufficient_user_quota", "insufficient quota", "insufficient credit", "insufficient balance",
            "quota exceeded", "quota_exceeded", "credit exhausted",
        ))
    if quota:
        return ChatError("CHAT_PROVIDER_QUOTA", "اعتبار یا سهمیهٔ سرویس مدل کافی نیست؛ مدیر سایت باید اعتبار سرویس را شارژ یا محدودیت سهمیه را رفع کند.", 503)
    if status in {401, 403}:
        return ChatError("CHAT_PROVIDER_ACCESS_DENIED", "سرویس مدل دسترسی را رد کرد؛ مدیر سایت باید کلید و مجوز دسترسی به مدل را بررسی کند.", 503)
    if status == 429:
        return ChatError("CHAT_PROVIDER_RATE_LIMIT", "سرویس مدل موقتاً درخواست‌های زیادی دریافت کرده است؛ کمی بعد دوباره تلاش کنید.", 429)
    return ChatError("CHAT_PROVIDER_UNAVAILABLE", "سرویس مدل در دسترس نیست؛ دوباره تلاش کنید.", 502)


PLANNER_PROMPT = default_prompt("chat_planner").content

ANSWER_PROMPT = default_prompt("chat_answer").content


def generate_reply(provider, data, user_id, conversation, request, history):
    context = {
        "scope": conversation["scope"], "page_path": request.page_path,
        "current_time_utc": now_iso(),
        "messages": [{"role": item["role"], "content": item["content"][:3000]} for item in history]
                    + [{"role": "user", "content": request.content}],
    }
    stage = "planning"
    try:
        plan = generate_validated_json(provider, load_text_prompt("chat_planner").content, {
            **context, "catalog": data.catalog(), "output_contract": RetrievalPlan.model_json_schema(),
        }, RetrievalPlan.model_validate)
        evidence = []
        seen = set()
        for retrieval in plan.requests:
            identity = (retrieval.kind, retrieval.subject, retrieval.symbol, retrieval.order)
            if identity in seen:
                continue
            seen.add(identity)
            try:
                evidence.append(data.retrieve(retrieval, user_id, conversation))
            except httpx.HTTPError:
                evidence.append({"kind": retrieval.kind, "status": "unavailable"})
        # Refuse excessive context rather than silently truncating JSON or financial fields.
        if len(json.dumps(evidence, ensure_ascii=False, default=str)) > 65000:
            raise ChatError("CHAT_CONTEXT_TOO_LARGE", "سؤال را به یک شاخص یا بخش کوچک‌تر از حساب محدود کنید.", 422)
        stage = "answer"
        available = {source["id"] for source in data.sources}

        def validate_answer(value):
            answer = Answer.model_validate(value)
            # Citations must belong to this request, including after failover.
            if any(ref not in available for ref in answer.evidence_refs):
                raise InvalidLLMResponse("Unknown evidence reference")
            return answer

        answer = generate_validated_json(provider, load_text_prompt("chat_answer").content, {
            **context, "evidence": evidence,
            "premium_analysis_allowed": getattr(data, "premium_analysis_allowed", False),
            "output_contract": Answer.model_json_schema(),
        }, validate_answer)
        return {"id": str(request.request_id) + ":assistant", "role": "assistant", "content": answer.answer_fa,
                "created_at": now_iso(), "sources": data.sources, "attachments": data.attachments}
    except ChatError:
        raise
    except httpx.HTTPStatusError as exc:
        failure = provider_http_failure(exc)
        logger.warning("Chat provider failed stage=%s status=%s code=%s", stage, exc.response.status_code, failure.code)
        raise failure from exc
    except httpx.TimeoutException as exc:
        raise ChatError("CHAT_PROVIDER_TIMEOUT", "دریافت پاسخ طول کشید؛ دوباره تلاش کنید.", 504) from exc
    except (httpx.HTTPError, ValidationError, ValueError, KeyError, IndexError, TypeError) as exc:
        raise ChatError("CHAT_PROVIDER_UNAVAILABLE", "پاسخ معتبر از دستیار دریافت نشد؛ دوباره تلاش کنید.", 502) from exc
