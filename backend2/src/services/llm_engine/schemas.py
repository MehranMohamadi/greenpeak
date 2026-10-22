from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationInfo, model_validator


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


class MarketFactorDetails(StrictModel):
    mechanism_fa: str = ""
    horizon_fa: str = ""
    evidence_summary_fa: str = ""
    limitations_fa: str = ""
    review_summary_fa: str = ""
    change_status: Literal["new", "ongoing", "changed", "unknown"] = "unknown"
    distinct_aspect_fa: str = ""


class MarketImpactItem(MarketFactorDetails):
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


class MarketRiskItem(MarketFactorDetails):
    risk_id: str
    title_fa: str
    status: Literal["active", "watch", "inactive", "unknown"] = "unknown"
    severity: Literal["low", "medium", "high", "unknown"] = "unknown"
    why_active_fa: str
    escalation_conditions_fa: str
    easing_conditions_fa: str
    evidence_refs: list[str] = Field(default_factory=list)
    duration: Literal["short_term", "medium_term", "long_term", "unknown"] = "unknown"


class MarketPotentialItem(MarketFactorDetails):
    title_fa: str
    detail_fa: str
    evidence_refs: list[str] = Field(default_factory=list)
    duration: Literal["medium_term", "long_term", "unknown"] = "unknown"


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
    current_market_move_fa: str = ""
    current_analysis_fa: str = ""
    short_term_outlook_fa: str = ""
    medium_term_outlook_fa: str = ""
    summary_points_fa: list[str] = Field(default_factory=list, max_length=5)
    positive_drivers: list[dict[str, Any] | str] = Field(default_factory=list)
    negative_drivers: list[dict[str, Any] | str] = Field(default_factory=list)
    cross_domain_conflicts: list[dict[str, Any] | str] = Field(default_factory=list)
    key_risks: list[dict[str, Any] | str] = Field(default_factory=list)
    what_changed_fa: str = ""
    watch_next_fa: list[str] = Field(default_factory=list)
    status_summary: MarketStatusSummary = Field(default_factory=MarketStatusSummary)
    market_drivers: list[MarketImpactItem] = Field(default_factory=list)
    market_potentials: list[MarketPotentialItem] = Field(default_factory=list)
    market_conflicts: list[MarketConflictItem] = Field(default_factory=list)
    risk_monitor: list[MarketRiskItem] = Field(default_factory=list)
    important_changes: list[MarketChangeItem] = Field(default_factory=list)
    systemic_synthesis_fa: str = ""
    glance_summary: MarketGlanceSummary = Field(default_factory=MarketGlanceSummary)
    factor_classification_version: Literal["1.0.0"] | None = None
    factor_empty_reasons: dict[Literal["supportive", "challenging", "potentials", "risks"], str] = Field(default_factory=dict)
    factor_source_evidence: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def validate_generated_market_factors(self, info: ValidationInfo):
        # Historical snapshots remain readable. Enforce this contract when
        # generating new content, before the job can persist it.
        if not (info.context or {}).get("validate_market_factors"):
            return self
        if self.factor_classification_version != "1.0.0":
            raise ValueError("factor_classification_version must be 1.0.0")
        if self.positive_drivers or self.negative_drivers or self.key_risks:
            raise ValueError("Use structured factors only; leave legacy driver/risk lists empty")
        groups = {"supportive": [], "challenging": [], "potentials": self.market_potentials, "risks": self.risk_monitor}
        for item in self.market_drivers:
            if item.sentiment not in {"risk_on", "risk_off"} or item.duration == "unknown":
                raise ValueError("Every market driver needs explicit risk_on/risk_off sentiment and a known duration")
            groups["supportive" if item.sentiment == "risk_on" else "challenging"].append(item)
        seen = {}
        evidence = info.context.get("evidence", {})
        for category, items in groups.items():
            if not items and not self.factor_empty_reasons.get(category, "").strip():
                raise ValueError(f"Provide an evidence-based empty reason for {category}")
            for item in items:
                required = ["title_fa", "mechanism_fa", "horizon_fa", "evidence_summary_fa"]
                required.append("why_it_matters_fa" if category in {"supportive", "challenging"} else "detail_fa" if category == "potentials" else "why_active_fa")
                if category in {"potentials", "risks"}:
                    required += ["limitations_fa", "review_summary_fa"]
                if any(not getattr(item, name).strip() for name in required):
                    raise ValueError(f"Incomplete explanation, mechanism, horizon or review in {category}")
                if item.change_status == "unknown":
                    raise ValueError(f"Explicit new/ongoing/changed status is required in {category}")
                if category == "potentials" and item.duration == "unknown":
                    raise ValueError("Market potentials must have an explicit medium_term or long_term duration")
                if category == "risks" and (item.duration == "unknown" or item.status not in {"active", "watch"}):
                    raise ValueError("Governing risks must be active/watch with a known duration")
                if not item.evidence_refs or any(not _factor_evidence_exists(evidence, ref) for ref in item.evidence_refs):
                    raise ValueError(f"Factors in {category} must cite non-empty supplied evidence using JSON Pointers; prior factors alone are not evidence")
                key = "".join(char for char in item.title_fa.casefold() if char.isalnum())
                for other_category, other in seen.get(key, []):
                    if (category == other_category or not item.distinct_aspect_fa.strip()
                            or not other.distinct_aspect_fa.strip()
                            or item.distinct_aspect_fa.strip() == other.distinct_aspect_fa.strip()):
                        raise ValueError("Repeated factors need distinct mechanisms/aspects in different categories")
                seen.setdefault(key, []).append((category, item))
        return self

    @model_validator(mode="after")
    def require_horizon_analysis_for_current_version(self):
        if self.analysis_version != "0.5.0":
            return self
        required_text = {
            "current_market_move_fa": self.current_market_move_fa,
            "current_analysis_fa": self.current_analysis_fa,
            "short_term_outlook_fa": self.short_term_outlook_fa,
            "medium_term_outlook_fa": self.medium_term_outlook_fa,
        }
        missing = [name for name, value in required_text.items() if not value.strip()]
        if missing:
            raise ValueError(f"missing horizon analysis fields: {', '.join(missing)}")
        if len(self.summary_points_fa) != 5 or any(not item.strip() for item in self.summary_points_fa):
            raise ValueError("summary_points_fa must contain exactly five non-empty items")
        return self


def _factor_evidence_exists(evidence: dict, reference: str) -> bool:
    return resolve_factor_evidence(evidence, reference) is not None


def resolve_factor_evidence(evidence: dict, reference: str) -> dict | None:
    """Resolve a factor citation against the exact evidence sent to the model."""
    if not reference.startswith("/") or reference.startswith("/previous_market_factors"):
        return None
    tokens = reference[1:].split("/")
    if len(tokens) < 2 or tokens[0] not in {"domain_narratives", "horizontal_evidence", "retained_factor_evidence"} or any(
        token in {"warnings", "provenance", "coverage", "versions", "generated_at", "revision_id"}
        for token in tokens
    ):
        return None
    if tokens[0] == "horizontal_evidence" and not (
        tokens[1] == "sp500_session_move"
        or tokens[1] in {"recent_market_news", "upcoming_us_events", "observed_indicators"} and len(tokens) >= 3
        or tokens[1] == "current_market_context" and len(tokens) >= 4 and tokens[2] == "released_us_events"
    ):
        return None
    value = evidence
    try:
        for token in tokens:
            token = token.replace("~1", "/").replace("~0", "~")
            if isinstance(value, list):
                if not token.isdigit():
                    return None
                value = value[int(token)]
            elif isinstance(value, dict):
                value = value[token]
            else:
                return None
        return value if isinstance(value, dict) and value else None
    except (KeyError, IndexError, ValueError):
        return None
