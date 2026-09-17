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
    analysis_version: str = "0.3.0"
    analysis_generated_at: datetime
    narrative_fa: str
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


class DomainOutlookItem(StrictModel):
    label_fa: str
    value_fa: str
    tone: Literal["positive", "warning", "negative", "neutral", "info"] = "neutral"


class DomainNarrative(NarrativeBase):
    level: Literal["domain"] = "domain"
    stance_label_fa: str = ""
    key_insights_fa: list[str] = Field(default_factory=list)
    outlook_items: list[DomainOutlookItem] = Field(default_factory=list)
    dominant_story_fa: str
    top_drivers: list[dict[str, Any] | str] = Field(default_factory=list)
    supporting_evidence: list[dict[str, Any] | str] = Field(default_factory=list)
    conflicting_evidence: list[dict[str, Any] | str] = Field(default_factory=list)
    risks_fa: list[str] = Field(default_factory=list)
    watch_next_fa: list[str] = Field(default_factory=list)


class MarketImpactItem(StrictModel):
    metric: str
    title_fa: str
    current: str | None = None
    previous: str | None = None
    forecast: str | None = None
    change_fa: str | None = None
    why_it_matters_fa: str
    impact: Literal["low", "medium", "high", "unknown"] = "unknown"
    sentiment: Literal["risk_on", "neutral", "risk_off", "mixed", "unknown"] = "unknown"
    duration: Literal["short_term", "medium_term", "long_term", "unknown"] = "unknown"
    reversal_conditions_fa: str
    evidence_refs: list[str] = Field(default_factory=list)


class MarketRiskItem(StrictModel):
    risk_id: str
    title_fa: str
    status: Literal["active", "watch", "inactive", "unknown"] = "unknown"
    severity: Literal["low", "medium", "high", "unknown"] = "unknown"
    why_active_fa: str
    escalation_conditions_fa: str
    easing_conditions_fa: str
    evidence_refs: list[str] = Field(default_factory=list)


class MarketConflictItem(StrictModel):
    title_fa: str
    supportive_signal_fa: str
    pressuring_signal_fa: str
    current_balance_fa: str
    reversal_condition_fa: str
    evidence_refs: list[str] = Field(default_factory=list)


class MarketChangeItem(StrictModel):
    metric: str
    label_fa: str
    previous: str | None = None
    current: str | None = None
    change_fa: str
    market_meaning_fa: str
    tone: Literal["positive", "negative", "neutral", "mixed"] = "neutral"
    evidence_refs: list[str] = Field(default_factory=list)


class MarketStatusSummary(StrictModel):
    market_condition: Literal["favorable", "mixed", "challenging", "unknown"] = "unknown"
    risk_level: Literal["low", "medium", "high", "unknown"] = "unknown"
    sentiment: Literal["risk_on", "neutral", "risk_off", "mixed", "unknown"] = "unknown"
    change_intensity: Literal["low", "medium", "high", "unknown"] = "unknown"
    confidence_level: Literal["low", "medium", "high", "unknown"] = "unknown"


class MarketGlanceSummary(StrictModel):
    supportive_fa: list[str] = Field(default_factory=list)
    pressuring_fa: list[str] = Field(default_factory=list)
    uncertainty_fa: list[str] = Field(default_factory=list)
    regime_shifters_fa: list[str] = Field(default_factory=list)


class MarketNarrative(NarrativeBase):
    level: Literal["market"] = "market"
    market_story_fa: str
    positive_drivers: list[dict[str, Any] | str] = Field(default_factory=list)
    negative_drivers: list[dict[str, Any] | str] = Field(default_factory=list)
    cross_domain_conflicts: list[dict[str, Any] | str] = Field(default_factory=list)
    key_risks: list[dict[str, Any] | str] = Field(default_factory=list)
    what_changed_fa: str = ""
    watch_next_fa: list[str] = Field(default_factory=list)
    status_summary: MarketStatusSummary = Field(default_factory=MarketStatusSummary)
    market_drivers: list[MarketImpactItem] = Field(default_factory=list)
    market_conflicts: list[MarketConflictItem] = Field(default_factory=list)
    risk_monitor: list[MarketRiskItem] = Field(default_factory=list)
    important_changes: list[MarketChangeItem] = Field(default_factory=list)
    systemic_synthesis_fa: str = ""
    glance_summary: MarketGlanceSummary = Field(default_factory=MarketGlanceSummary)
