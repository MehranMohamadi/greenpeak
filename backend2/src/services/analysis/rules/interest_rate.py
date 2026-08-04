"""Illustrative deterministic rule for the federal funds rate."""

from ....models.analysis_schemas import PreparedAnalysisContext, Signal

MEDIUM_RATE_THRESHOLD = 0.03
HIGH_RATE_THRESHOLD = 0.05


class InterestRateRule:
    """Technical example only; this is not investment advice or a final economic model."""

    rule_id = "interest_rate_environment"

    def evaluate(self, context: PreparedAnalysisContext) -> list[Signal]:
        metric = next(
            (item for item in context.normalized_items if item.get("type") == "metric" and item.get("id") == "fed_funds_rate"),
            None,
        )
        if metric is None:
            return []

        rate = metric["normalized_value"]
        if rate >= HIGH_RATE_THRESHOLD:
            direction, severity = "risk", "high"
        elif rate >= MEDIUM_RATE_THRESHOLD:
            direction, severity = "neutral", "medium"
        else:
            direction, severity = "bullish", "low"

        return [Signal(
            rule_id=self.rule_id,
            category="monetary_policy",
            direction=direction,
            severity=severity,
            confidence=1.0,
            message=f"Federal funds rate is {metric['display_value']}.",
            evidence_ids=["fed_funds_rate"],
            metrics={"percent": metric["value"], "decimal": rate},
        )]
