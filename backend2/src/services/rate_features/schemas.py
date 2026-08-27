"""Validated contracts for rate feature snapshots and job runs."""

from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator


class SnapshotSource(BaseModel):
    provider: str
    series_id: str
    latest_observation_date: date


class SnapshotCurrent(BaseModel):
    value: float
    unit: str
    # Kept during the schema 1.x transition for existing rate-card consumers.
    value_pct: float | None = None

    @model_validator(mode="before")
    @classmethod
    def upgrade_rate_current(cls, value):
        if isinstance(value, dict) and "value" not in value and value.get("value_pct") is not None:
            return {**value, "value": value["value_pct"], "unit": value.get("unit", "percent")}
        return value


class SnapshotState(BaseModel):
    direction_90d: Literal["rising", "falling", "stable", "unknown"]
    materiality_threshold: float
    materiality_threshold_unit: str
    materiality_threshold_bp: float | None = None
    direction_horizon_days: int = 90
    state_is_experimental: bool = True

    @model_validator(mode="before")
    @classmethod
    def upgrade_rate_state(cls, value):
        if isinstance(value, dict) and "materiality_threshold" not in value:
            threshold = value.get("materiality_threshold_bp")
            return {**value, "materiality_threshold": threshold, "materiality_threshold_unit": "bp"}
        return value


class SnapshotQuality(BaseModel):
    status: Literal["ok", "stale", "insufficient_history", "invalid"]
    freshness_days: int
    missing_ratio_1y: float = Field(ge=0, le=1)
    observation_count_1y: int = Field(ge=0)
    flags: list[str] = Field(default_factory=list)


class IndicatorFeatureSnapshot(BaseModel):
    indicator_id: str
    schema_version: str
    feature_version: str
    definition_version: str
    as_of_date: date
    calculated_at: datetime
    run_id: str
    source: SnapshotSource
    current: SnapshotCurrent
    features: dict[str, float | None]
    feature_reasons: dict[str, str] = Field(default_factory=dict)
    derived_features: dict[str, Any] = Field(default_factory=dict)
    state: SnapshotState
    quality: SnapshotQuality
    semantics: dict[str, Any]
    llm_context: dict[str, Any]
    provenance: dict[str, Any]


class FeatureRun(BaseModel):
    run_id: str
    started_at: datetime
    finished_at: datetime
    status: Literal["success", "partial", "failed"]
    requested_indicators: list[str]
    feature_version: str
    code_version: str
    counts: dict[str, int]
    warnings: list[str] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)
