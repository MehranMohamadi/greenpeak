"""Public contracts for daily cross-market comparisons."""
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ComparisonRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    symbols: list[str] = Field(min_length=1, max_length=8)
    period: Literal["1M", "3M", "6M", "1Y", "3Y", "5Y", "MAX"] = "1Y"
    view: Literal["performance", "relationship"] = "performance"
    currency: Literal["USD", "IRR"] = "USD"

    @model_validator(mode="after")
    def validate_selection(self):
        if len(set(self.symbols)) != len(self.symbols):
            raise ValueError("Duplicate symbols are not allowed")
        if self.view == "relationship" and len(self.symbols) != 2:
            raise ValueError("A relationship requires exactly two symbols")
        return self


class ComparisonPoint(BaseModel):
    date: str
    value: float


class RelationshipAxis(BaseModel):
    symbol_id: str
    label: str
    unit: str
    currency: str | None


class RelationshipPoint(BaseModel):
    date: str
    x: float
    y: float


class RelationshipPlot(BaseModel):
    x_axis: RelationshipAxis
    y_axis: RelationshipAxis
    points: list[RelationshipPoint]


class ComparisonSeries(BaseModel):
    id: str
    label: str
    kind: str
    currency: str | None
    return_basis: str
    unit: str
    source: str
    source_url: str
    source_series_id: str
    note: str = ""
    status: Literal["available", "stale", "unavailable"]
    reason: str | None = None
    retrieved_at: str | None = None
    history_start: str | None = None
    observation_date: str | None = None
    observations: int = 0
    change_pct: float | None = None
    change_bp: float | None = None
    data: list[ComparisonPoint] = Field(default_factory=list)


class ComparisonResponse(BaseModel):
    schema_version: str = "1.1.0"
    period: str
    view: str
    currency: str
    status: Literal["available", "partial", "unavailable", "incompatible"]
    requested_start: str | None = None
    requested_end: str
    start_date: str | None = None
    end_date: str | None = None
    common_observations: int = 0
    series: list[ComparisonSeries]
    relationship: RelationshipPlot | None = None
    ranking: list[str] = Field(default_factory=list)
    correlation: float | None = None
    correlation_samples: int = 0
    correlation_method: str = "Pearson on consecutive common-date simple returns; rates use basis-point changes"
    correlation_reason: str | None = None
    summary_fa: str
    warnings: list[str] = Field(default_factory=list)
    fx_source: str | None = None
    fx_observation_date: str | None = None
