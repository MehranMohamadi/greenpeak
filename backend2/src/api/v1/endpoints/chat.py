"""Private conversation API; every operation requires the authenticated owner."""

from functools import lru_cache
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response

from ....core.config import get_settings
from ....services.chat.data import ChatData
from ....services.chat.engine import generate_reply
from ....services.chat.schemas import ConversationCreate, MessageRequest
from ....services.chat.store import ChatError, ChatStore
from ....services.llm_engine.provider import OpenAICompatibleProvider
from .auth import require_user


def no_store(response: Response):
    response.headers["Cache-Control"] = "no-store"


router = APIRouter(prefix="/chat", tags=["GreenPeak Assistant"], dependencies=[Depends(no_store)])
User = Annotated[dict, Depends(require_user)]


@lru_cache(maxsize=1)
def chat_store():
    settings = get_settings()
    try:
        return ChatStore(settings.greenpeak_chat_db_path, settings.greenpeak_chat_retention_days, settings.greenpeak_chat_daily_limit)
    except ChatError as exc:
        raise failure(exc) from exc


def chat_data():
    data = ChatData(get_settings())
    try:
        yield data
    finally:
        data.close()


def failure(exc):
    return HTTPException(exc.status, detail={"code": exc.code, "message": exc.message}, headers={"Cache-Control": "no-store"})


def chat_provider():
    settings = get_settings()
    if settings.greenpeak_llm_provider != "openai-compatible" or not settings.greenpeak_llm_api_key or not settings.greenpeak_llm_model:
        raise HTTPException(503, detail={"code": "CHAT_NOT_CONFIGURED", "message": "دستیار هنوز فعال نشده است؛ تنظیمات مدل باید توسط مدیر سایت تکمیل شود."})
    return OpenAICompatibleProvider(settings.greenpeak_llm_api_key, settings.greenpeak_llm_model, settings.greenpeak_llm_base_url, timeout=60)


@router.get("/status")
def chat_status(user: User):
    settings = get_settings()
    return {"configured": bool(settings.greenpeak_llm_provider == "openai-compatible" and settings.greenpeak_llm_api_key and settings.greenpeak_llm_model),
            "retention_days": settings.greenpeak_chat_retention_days}


@router.get("/accounts")
def accounts(user: User, data: Annotated[ChatData, Depends(chat_data)]):
    try:
        return {"accounts": data.accounts(user["id"])}
    except ChatError as exc:
        raise failure(exc) from exc


@router.get("/conversations")
def conversations(user: User, store: Annotated[ChatStore, Depends(chat_store)]):
    try:
        return {"conversations": store.list(user["id"])}
    except ChatError as exc:
        raise failure(exc) from exc


@router.post("/conversations", status_code=201)
def create_conversation(body: ConversationCreate, user: User, store: Annotated[ChatStore, Depends(chat_store)], data: Annotated[ChatData, Depends(chat_data)]):
    try:
        if body.scope == "account":
            data.connection(user["id"], body.connection_id)
        return store.create(user["id"], body.scope, body.connection_id)
    except ChatError as exc:
        raise failure(exc) from exc


@router.get("/conversations/{conversation_id}")
def conversation(conversation_id: UUID, user: User, store: Annotated[ChatStore, Depends(chat_store)]):
    try:
        return store.get(user["id"], str(conversation_id))
    except ChatError as exc:
        raise failure(exc) from exc


@router.delete("/conversations/{conversation_id}", status_code=204)
def delete_conversation(conversation_id: UUID, user: User, store: Annotated[ChatStore, Depends(chat_store)]):
    try:
        store.delete(user["id"], str(conversation_id))
    except ChatError as exc:
        raise failure(exc) from exc


@router.post("/conversations/{conversation_id}/messages")
def send_message(conversation_id: UUID, body: MessageRequest, user: User, store: Annotated[ChatStore, Depends(chat_store)], data: Annotated[ChatData, Depends(chat_data)]):
    lease = None
    try:
        # Resolve ownership before model configuration, calls or private retrieval.
        conversation = store.get(user["id"], str(conversation_id))
        if conversation["scope"] == "account":
            data.connection(user["id"], conversation["connection_id"])
        row, lease, cached, history = store.acquire(user["id"], str(conversation_id), body)
        if cached is not None:
            return cached
        provider = chat_provider()
        answer = generate_reply(provider, data, user["id"], row, body, history)
        # Recheck revocation before persisting or returning account-derived content.
        if row["scope"] == "account":
            data.connection(user["id"], row["connection_id"])
        store.complete(user["id"], str(conversation_id), lease, body, answer)
        lease = None
        return answer
    except ChatError as exc:
        raise failure(exc) from exc
    finally:
        if lease:
            try:
                store.release(user["id"], str(conversation_id), lease)
            except ChatError:
                # The original failure remains useful; the timed lease expires automatically.
                pass
