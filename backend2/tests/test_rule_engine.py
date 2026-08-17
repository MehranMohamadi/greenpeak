import os
from datetime import date

os.environ["DEBUG"] = "false"

from src.services.rule_engine.config import Condition, Rule, RuleInput, RuleSet
from src.services.rule_engine.engine import evaluate_rule_set


def rule_set(enabled=True):
    return RuleSet(rule_set_id="test", version="0.1.0", enabled=True, subject_id="monetary_liquidity", rules=[Rule(rule_id="r1", enabled=enabled, inputs=[RuleInput(indicator_id="federal_funds_rate", feature="delta_90d_bp")], condition=Condition(operator="gt", value=40), score_effect=-0.4, rationale="test")])


def test_disabled_rules_are_not_configured():
    result = evaluate_rule_set(rule_set(False), {}, date(2026, 8, 16))
    assert result["status"] == "not_configured"
    assert result["score"] is None


def test_rule_trace_and_missing_input():
    fired = evaluate_rule_set(rule_set(), {"federal_funds_rate": {"features": {"delta_90d_bp": 50}}}, date(2026, 8, 16))
    assert fired["score"] == 4.6
    assert fired["contributions"][0]["fired"] is True
    missing = evaluate_rule_set(rule_set(), {}, date(2026, 8, 16))
    assert missing["status"] == "partial"
    assert missing["contributions"][0]["fired"] is False
