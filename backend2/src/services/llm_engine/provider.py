from __future__ import annotations

import json
from typing import Any, Protocol

import httpx


def decode_json_content(content: str) -> dict[str, Any]:
    """Accept strict JSON and common fenced JSON from compatible providers."""
    value = content.strip()
    if value.startswith("```"):
        lines = value.splitlines()
        if lines and lines[0].strip().lower() in {"```", "```json"}:
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        value = "\n".join(lines).strip()
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        start, end = value.find("{"), value.rfind("}")
        if start < 0 or end <= start:
            raise
        parsed = json.loads(value[start:end + 1])
    if not isinstance(parsed, dict):
        raise ValueError("LLM response must be a JSON object")
    return parsed


class LLMProvider(Protocol):
    provider_id: str
    model_id: str
    def generate_json(self, system_prompt: str, evidence: dict[str, Any]) -> dict[str, Any]: ...


class DisabledProvider:
    provider_id = "disabled"
    model_id = ""

    def generate_json(self, system_prompt: str, evidence: dict[str, Any]) -> dict[str, Any]:
        raise RuntimeError("LLM provider is not configured")


class OpenAICompatibleProvider:
    provider_id = "openai-compatible"

    def __init__(self, api_key: str, model: str, base_url: str, timeout: float = 60):
        if not api_key or not model:
            raise ValueError("LLM API key and model are required")
        self.model_id = model
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    def generate_json(self, system_prompt: str, evidence: dict[str, Any]) -> dict[str, Any]:
        response = httpx.post(
            f"{self.base_url}/chat/completions",
            headers={"Authorization": f"Bearer {self.api_key}"},
            json={"model": self.model_id, "response_format": {"type": "json_object"}, "messages": [{"role": "system", "content": system_prompt}, {"role": "user", "content": json.dumps(evidence, ensure_ascii=False, default=str)}]},
            timeout=self.timeout,
        )
        response.raise_for_status()
        return decode_json_content(response.json()["choices"][0]["message"]["content"])
