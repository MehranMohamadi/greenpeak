"""Contracts for the distinct Yahoo/Cboe Treasury yield series."""

from datetime import date
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class YahooTreasuryObservation(BaseModel):
    model_config = ConfigDict(extra="forbid")
    date: date
    value: float = Field(strict=True, ge=0, allow_inf_nan=False)


class YahooTreasuryPreviewRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    source_series_id: Literal["^TNX"] = "^TNX"
    observations: list[YahooTreasuryObservation] = Field(min_length=1, max_length=30000)


class YahooTreasuryPreviewResponse(BaseModel):
    ok: Literal[True] = True
    data: dict[str, Any]
