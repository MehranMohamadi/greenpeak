"""Schemas for the deterministic analysis preparation pipeline."""

from datetime import datetime
from enum import Enum
from math import isfinite
from typing import Annotated, Any, Literal, Optional, Union

from pydantic import BaseModel, Field, field_validator


class Unit(str, Enum):
    PERCENT = "percent"
    DECIMAL = "decimal"
    BASIS_POINT = "basis_point"
    INDEX = "index"
    USD = "usd"


def ensure_finite(value: Any) -> Any:
    if isinstance(value, float) and not isfinite(value):
        raise ValueError("numeric values must be finite")
    return value


class MetricInput(BaseModel):
    type: Literal["metric"] = "metric"
    id: str
    title: str
    value: float
    unit: Unit
    timestamp: datetime
    source: Optional[str] = None

    _finite_value = field_validator("value", mode="before")(ensure_finite)


class TimeSeriesPoint(BaseModel):
    timestamp: datetime
    value: float

    _finite_value = field_validator("value", mode="before")(ensure_finite)


class TimeSeriesInput(BaseModel):
    type: Literal["time_series"] = "time_series"
    id: str
    title: str
    unit: Unit
    frequency: Optional[str] = None
    source: Optional[str] = None
    points: list[TimeSeriesPoint] = Field(default_factory=list)


class NewsInput(BaseModel):
    type: Literal["news"] = "news"
    id: str
    title: str
    published_at: datetime
    source: str
    summary: Optional[str] = None
    url: Optional[str] = None
    symbols: list[str] = Field(default_factory=list)


class Importance(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class CalendarEventInput(BaseModel):
    type: Literal["calendar_event"] = "calendar_event"
    id: str
    title: str
    scheduled_at: datetime
    importance: Importance
    country: Optional[str] = None
    actual: Optional[float] = None
    forecast: Optional[float] = None
    previous: Optional[float] = None
    unit: Optional[str] = None
    source: Optional[str] = None

    _finite_values = field_validator("actual", "forecast", "previous", mode="before")(ensure_finite)


AnalysisItem = Annotated[
    Union[MetricInput, TimeSeriesInput, NewsInput, CalendarEventInput],
    Field(discriminator="type"),
]


class AnalysisRequest(BaseModel):
    market: str = "SP500"
    as_of: datetime
    items: list[AnalysisItem] = Field(default_factory=list)


class NormalizedMetric(BaseModel):
    type: Literal["metric"] = "metric"
    id: str
    title: str
    value: float
    normalized_value: float
    display_value: str
    unit: Unit
    timestamp: datetime
    source: Optional[str] = None


class Signal(BaseModel):
    rule_id: str
    category: str
    direction: Literal["bullish", "bearish", "neutral", "risk"]
    severity: Literal["low", "medium", "high"]
    confidence: float = Field(ge=0, le=1)
    message: str
    evidence_ids: list[str] = Field(default_factory=list)
    metrics: dict[str, Any] = Field(default_factory=dict)


class PreparedAnalysisContext(BaseModel):
    market: str
    as_of: datetime
    normalized_items: list[dict[str, Any]] = Field(default_factory=list)
    features: dict[str, dict[str, Any]] = Field(default_factory=dict)
    signals: list[Signal] = Field(default_factory=list)
    data_quality: dict[str, Any] = Field(default_factory=dict)


class AnalysisResponse(BaseModel):
    data: PreparedAnalysisContext
    metadata: dict[str, Any] = Field(default_factory=dict)
