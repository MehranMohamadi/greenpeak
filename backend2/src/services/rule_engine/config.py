from pathlib import Path
from typing import Any, Literal

import yaml
from pydantic import BaseModel, ConfigDict, Field

from ..greenpeak_config import CONFIG_ROOT, stable_hash


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class RuleInput(StrictModel):
    indicator_id: str
    feature: str


class Condition(StrictModel):
    operator: Literal["gt", "gte", "lt", "lte", "between", "eq"]
    value: Any


class Rule(StrictModel):
    rule_id: str
    enabled: bool
    inputs: list[RuleInput] = Field(min_length=1)
    condition: Condition
    score_effect: float
    rationale: str


class RuleSet(StrictModel):
    rule_set_id: str
    version: str
    enabled: bool
    subject_id: str
    rules: list[Rule]


def load_domain_rule_sets(root: Path = CONFIG_ROOT / "rules" / "domains") -> dict[str, RuleSet]:
    values = {}
    for path in sorted(root.glob("*.yaml")):
        with path.open(encoding="utf-8") as handle:
            item = RuleSet.model_validate(yaml.safe_load(handle))
        if item.subject_id in values:
            raise ValueError(f"duplicate domain rule set: {item.subject_id}")
        values[item.subject_id] = item
    return values


def rule_set_hash(value: RuleSet) -> str:
    return stable_hash(value)
