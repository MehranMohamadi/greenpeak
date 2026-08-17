from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Coverage(StrictModel):
    status: Literal["full", "partial", "provisional"]
    ratio: float = Field(ge=0, le=1)
    configured_count: int = Field(ge=0)
    available_count: int = Field(ge=0)
    missing_inputs: list[str] = Field(default_factory=list)


class Provenance(StrictModel):
    prompt_version: str
    prompt_hash: str
    model: str
    provider: str
    input_hash: str
    code_version: str


class NarrativeBase(StrictModel):
    level: Literal["indicator", "domain", "market"]
    subject_id: str
    as_of_date: date
    data_as_of: date | None = None
    analysis_version: str = "0.1.0"
    analysis_generated_at: datetime
    narrative_fa: str
    llm_shadow_score: float = Field(ge=0, le=10)
    llm_confidence: int = Field(ge=0, le=100)
    coverage: Coverage
    evidence_refs: list[str] = Field(default_factory=list)
    provenance: Provenance
    warnings: list[str] = Field(default_factory=list)
    revision_id: str


class IndicatorNarrative(NarrativeBase):
    level: Literal["indicator"] = "indicator"
    current_state_fa: str
    what_changed_fa: str
    interpretation_fa: str
    key_facts: list[dict[str, Any]] = Field(default_factory=list)
    ambiguities_fa: list[str] = Field(default_factory=list)
    risks_to_interpretation_fa: list[str] = Field(default_factory=list)
    watch_next_fa: list[str] = Field(default_factory=list)


class DomainNarrative(NarrativeBase):
    level: Literal["domain"] = "domain"
    dominant_story_fa: str
    top_drivers: list[dict[str, Any] | str] = Field(default_factory=list)
    supporting_evidence: list[dict[str, Any] | str] = Field(default_factory=list)
    conflicting_evidence: list[dict[str, Any] | str] = Field(default_factory=list)
    risks_fa: list[str] = Field(default_factory=list)
    watch_next_fa: list[str] = Field(default_factory=list)


class MarketNarrative(NarrativeBase):
    level: Literal["market"] = "market"
    market_story_fa: str
    positive_drivers: list[dict[str, Any] | str] = Field(default_factory=list)
    negative_drivers: list[dict[str, Any] | str] = Field(default_factory=list)
    cross_domain_conflicts: list[dict[str, Any] | str] = Field(default_factory=list)
    key_risks: list[dict[str, Any] | str] = Field(default_factory=list)
    what_changed_fa: str = ""
    watch_next_fa: list[str] = Field(default_factory=list)
