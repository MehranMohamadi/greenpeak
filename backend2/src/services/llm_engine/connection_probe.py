"""Test one configured model directly without failover or preference changes."""

from time import perf_counter
from typing import Literal

import httpx
from pydantic import BaseModel, ConfigDict, ValidationError

from .control import configured_models
from .provider import InvalidLLMResponse
from .routing import ProviderRouter, create_llm_provider


class UnknownModel(ValueError):
    pass


class ProbeReply(BaseModel):
    model_config = ConfigDict(extra='forbid')
    status: Literal['ok']


def probe_connection(settings, model_id):
    if model_id not in {model['id'] for model in configured_models(settings)}:
        raise UnknownModel('Model is not configured')
    router = create_llm_provider(settings)
    providers = router.providers if isinstance(router, ProviderRouter) else [router]
    provider = next((item for item in providers if item.usage_key == model_id), None)
    if provider is None:
        raise UnknownModel('Model is not configured')

    result = {'id': model_id, 'provider': provider.provider_id, 'model': provider.model_id,
              'status': 'succeeded', 'error_code': None, 'http_status': None}
    started = perf_counter()
    try:
        reply = provider.generate_json('Connectivity test. Return only this JSON object: {"status":"ok"}.',
                                       {'output_contract': ProbeReply.model_json_schema()})
        ProbeReply.model_validate(reply)
        result['http_status'] = 200
    except httpx.TimeoutException:
        result.update(status='failed', error_code='timeout')
    except httpx.HTTPStatusError as exc:
        status = exc.response.status_code
        code = ('access_denied' if status in {401, 403} else 'quota_exhausted' if status == 402
                else 'rate_limited' if status == 429 else 'provider_unavailable')
        result.update(status='failed', error_code=code, http_status=status)
    except httpx.HTTPError:
        result.update(status='failed', error_code='connection_failed')
    except (InvalidLLMResponse, ValidationError):
        result.update(status='failed', error_code='invalid_response', http_status=200)
    result['elapsed_ms'] = round((perf_counter() - started) * 1000)
    return result
