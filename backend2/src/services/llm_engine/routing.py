"""Ordered provider failover with cooldowns shared by local API workers."""

from contextlib import contextmanager
from email.utils import parsedate_to_datetime
from hashlib import sha256
import math
from pathlib import Path
import sqlite3
import time

import httpx

from .provider import DisabledProvider, OpenAICompatibleProvider


DIRECT_URLS = {
    "gemini": "https://generativelanguage.googleapis.com/v1beta/openai",
    "groq": "https://api.groq.com/openai/v1",
    "mistral": "https://api.mistral.ai/v1",
}


def llm_is_configured(settings):
    if settings.greenpeak_llm_providers:
        return all(item.api_key.get_secret_value().strip() and item.model for item in settings.greenpeak_llm_providers)
    return bool(settings.greenpeak_llm_provider == "openai-compatible"
                and settings.greenpeak_llm_api_key and settings.greenpeak_llm_model)


def retry_delay(response, now):
    """Respect provider retry hints; unknown quota errors are probed after 60s."""
    header = response.headers.get("retry-after", "")
    try:
        delay = float(header)
    except ValueError:
        try:
            delay = parsedate_to_datetime(header).timestamp() - now
        except (ValueError, TypeError, OverflowError):
            delay = None
    if delay is None:
        try:
            body = response.json()
            error = body.get("error", {}) if isinstance(body, dict) else {}
            details = error.get("details", []) if isinstance(error, dict) else []
            for detail in details:
                if isinstance(detail, dict) and str(detail.get("@type", "")).endswith("google.rpc.RetryInfo"):
                    delay = float(str(detail.get("retryDelay", "")).removesuffix("s"))
                    break
        except (ValueError, TypeError):
            pass
    return max(1, delay) if delay is not None and math.isfinite(delay) else 60


def is_quota_error(response):
    if response.status_code != 403:
        return False
    try:
        body = response.json()
        error = body.get("error", {}) if isinstance(body, dict) else {}
        return isinstance(error, dict) and any(error.get(key) in {
            "insufficient_quota", "insufficient_user_quota", "quota_exceeded",
        } for key in ("code", "type"))
    except (ValueError, TypeError):
        return False


class ProviderRouter:
    def __init__(self, providers, db_path):
        self.providers = providers
        self._selected = providers[0]
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as db:
            db.execute("CREATE TABLE IF NOT EXISTS provider_cooldowns (identity TEXT PRIMARY KEY, retry_at REAL NOT NULL)")
        now = time.time()
        self._selected = next((p for p in providers if self._retry_at(p) <= now), providers[0])

    @property
    def provider_id(self):
        return self._selected.provider_id

    @property
    def model_id(self):
        return self._selected.model_id

    @contextmanager
    def _connect(self):
        db = sqlite3.connect(self.db_path, timeout=10)
        try:
            with db:
                yield db
        finally:
            db.close()

    def _identity(self, provider):
        return sha256("\0".join((provider.provider_id, provider.base_url,
                                provider.model_id, provider.api_key)).encode()).hexdigest()

    def _retry_at(self, provider):
        with self._connect() as db:
            row = db.execute("SELECT retry_at FROM provider_cooldowns WHERE identity=?",
                             (self._identity(provider),)).fetchone()
        return row[0] if row else 0

    def _cooldown(self, provider, retry_at):
        with self._connect() as db:
            db.execute("INSERT INTO provider_cooldowns VALUES (?, ?) ON CONFLICT(identity) "
                       "DO UPDATE SET retry_at=MAX(retry_at, excluded.retry_at)",
                       (self._identity(provider), retry_at))

    def generate_json(self, system_prompt, evidence):
        last_error = None
        earliest_retry = None
        for provider in self.providers:
            now = time.time()
            retry_at = self._retry_at(provider)
            if retry_at > now:
                earliest_retry = min(earliest_retry or retry_at, retry_at)
                continue
            try:
                result = provider.generate_json(system_prompt, evidence)
            except httpx.HTTPStatusError as exc:
                status = exc.response.status_code
                # Invalid prompts and permission errors must remain visible.
                if status not in {402, 429, 500, 502, 503, 504} and not is_quota_error(exc.response):
                    raise
                failed_at = time.time()
                retry_at = failed_at + retry_delay(exc.response, failed_at)
                self._cooldown(provider, retry_at)
                earliest_retry = min(earliest_retry or retry_at, retry_at)
                last_error = exc
            except httpx.TransportError as exc:
                self._cooldown(provider, time.time() + 30)
                last_error = exc
            else:
                self._selected = provider
                return result
        if last_error is not None:
            raise last_error
        response = httpx.Response(429, headers={"Retry-After": str(max(1, math.ceil((earliest_retry or time.time() + 60) - time.time())))},
                                  json={"error": {"code": "rate_limit_exceeded"}},
                                  request=httpx.Request("POST", "https://llm-router.invalid"))
        raise httpx.HTTPStatusError("All configured LLM providers are cooling down", request=response.request, response=response)


def create_llm_provider(settings, timeout=60):
    if settings.greenpeak_llm_providers:
        providers = []
        for item in settings.greenpeak_llm_providers:
            base_url = item.base_url or DIRECT_URLS.get(item.provider_id)
            if not base_url or not base_url.startswith("https://"):
                raise ValueError("LLM provider requires an HTTPS base URL")
            provider = OpenAICompatibleProvider(item.api_key.get_secret_value(), item.model, base_url, timeout)
            provider.provider_id = item.provider_id
            providers.append(provider)
        return ProviderRouter(providers, settings.greenpeak_llm_router_db_path)
    if llm_is_configured(settings):
        return OpenAICompatibleProvider(settings.greenpeak_llm_api_key, settings.greenpeak_llm_model,
                                        settings.greenpeak_llm_base_url, timeout)
    return DisabledProvider()
