from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field


class ModelPreference(BaseModel):
    model_config = ConfigDict(extra='forbid')
    id: str = Field(pattern=r'^[a-f0-9]{24}$')
    daily_token_limit: Annotated[int, Field(strict=True, ge=1, le=10**12)] | None = None


class UpdateLLMConfiguration(BaseModel):
    model_config = ConfigDict(extra='forbid')
    expected_revision: int = Field(ge=0, strict=True)
    models: list[ModelPreference] = Field(max_length=32)


class ReportedQuota(BaseModel):
    observed_at: datetime
    limit_tokens: int | None = None
    remaining_tokens: int | None = None
    limit_requests: int | None = None
    remaining_requests: int | None = None


class ModelUsage(ModelPreference):
    provider: str
    model: str
    priority: int
    requests: int
    failed_requests: int
    input_tokens: int | None
    output_tokens: int | None
    total_tokens: int | None
    unmetered_requests: int
    estimated_remaining_tokens: int | None
    reported_quota: ReportedQuota | None


class LLMOverview(BaseModel):
    revision: int
    day: date
    timezone: Literal['UTC']
    tracking_since: datetime
    models: list[ModelUsage]


class ModelConnectionResult(BaseModel):
    id: str
    provider: str
    model: str
    status: Literal['succeeded', 'failed']
    error_code: Literal['timeout', 'access_denied', 'quota_exhausted', 'rate_limited',
                        'provider_unavailable', 'connection_failed', 'invalid_response'] | None
    http_status: int | None
    elapsed_ms: int = Field(ge=0)
