from datetime import date
from typing import Any

from .config import RuleSet, rule_set_hash

OPERATORS = {
    "gt": lambda actual, expected: actual > expected,
    "gte": lambda actual, expected: actual >= expected,
    "lt": lambda actual, expected: actual < expected,
    "lte": lambda actual, expected: actual <= expected,
    "eq": lambda actual, expected: actual == expected,
    "between": lambda actual, expected: expected[0] <= actual <= expected[1],
}


def evaluate_rule_set(rule_set: RuleSet, features: dict[str, dict[str, Any]], as_of: date) -> dict[str, Any]:
    enabled = [rule for rule in rule_set.rules if rule.enabled]
    if not rule_set.enabled or not enabled:
        return {"level": "domain", "subject_id": rule_set.subject_id, "as_of_date": as_of.isoformat(), "status": "not_configured", "score": None, "scale": {"min": 0, "neutral": 5, "max": 10}, "coverage_ratio": 0, "rule_config_version": rule_set.version, "rule_config_hash": rule_set_hash(rule_set), "contributions": [], "missing_inputs": []}
    contributions, missing = [], []
    for rule in enabled:
        refs, values = [], []
        for item in rule.inputs:
            value = features.get(item.indicator_id, {}).get("features", {}).get(item.feature)
            refs.append(f"feature:{item.indicator_id}:{item.feature}")
            if value is None:
                missing.append(refs[-1])
            values.append(value)
        fired = not any(value is None for value in values) and OPERATORS[rule.condition.operator](values[0], rule.condition.value)
        contributions.append({"rule_id": rule.rule_id, "fired": fired, "effect": rule.score_effect if fired else 0, "evidence": {"refs": refs, "values": values}, "rationale": rule.rationale})
    coverage = (len(enabled) - len({item.split(":", 3)[-1] for item in missing})) / len(enabled)
    score = max(0, min(10, 5 + sum(item["effect"] for item in contributions)))
    return {"level": "domain", "subject_id": rule_set.subject_id, "as_of_date": as_of.isoformat(), "status": "ok" if not missing else "partial", "score": score, "scale": {"min": 0, "neutral": 5, "max": 10}, "coverage_ratio": max(0, coverage), "rule_config_version": rule_set.version, "rule_config_hash": rule_set_hash(rule_set), "contributions": contributions, "missing_inputs": missing}
