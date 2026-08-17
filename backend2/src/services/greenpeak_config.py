"""Strict, human-editable GreenPeak configuration loading."""

from __future__ import annotations

from functools import lru_cache
from hashlib import sha256
import json
from pathlib import Path
from typing import Any

import yaml
from pydantic import BaseModel, ConfigDict, Field, model_validator

CONFIG_ROOT = Path(__file__).resolve().parents[3] / "config" / "greenpeak"


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Domain(StrictModel):
    id: str
    name_en: str
    name_fa: str
    expected_indicator_count: int = Field(ge=1)


class DomainsConfig(StrictModel):
    config_version: str
    domains: list[Domain]

    @model_validator(mode="after")
    def unique_ids(self):
        ids = [item.id for item in self.domains]
        if len(ids) != len(set(ids)):
            raise ValueError("duplicate domain IDs")
        return self


class Display(StrictModel):
    name_en: str
    name_fa: str
    unit: str


class Source(StrictModel):
    provider: str
    series_id: str
    frequency: str


class Classification(StrictModel):
    primary_domain: str
    related_domains: list[str] = Field(default_factory=list)


class LLMOptions(StrictModel):
    enabled: bool = True
    include_in_domain_analysis: bool = True


class IndicatorConfig(StrictModel):
    indicator_id: str
    definition_version: str
    enabled: bool
    display: Display
    source: Source
    raw_indicator: str
    classification: Classification
    feature_template: str
    feature_overrides: dict[str, Any]
    semantics: dict[str, Any]
    llm: LLMOptions


class FeatureTemplate(StrictModel):
    template_id: str
    feature_config_version: str
    calendar_offsets_days: list[int]
    zscore_window_days: int
    percentile_window_days: int
    slope_window_days: int
    volatility_window_days: int
    trend_threshold_bp: float
    stale_after_calendar_days: int
    minimum_observation_counts: dict[str, int]
    required_features: list[str]
    optional_features: list[str]


def stable_hash(value: Any) -> str:
    payload = value.model_dump(mode="json") if isinstance(value, BaseModel) else value
    return sha256(json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()


def _read_yaml(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        value = yaml.safe_load(handle)
    if not isinstance(value, dict):
        raise ValueError(f"Configuration must be an object: {path}")
    return value


@lru_cache
def load_registry(root: Path = CONFIG_ROOT) -> tuple[DomainsConfig, dict[str, FeatureTemplate], dict[str, IndicatorConfig]]:
    domains = DomainsConfig.model_validate(_read_yaml(root / "domains.yaml"))
    templates = {item.template_id: item for path in sorted((root / "feature_templates").glob("*.yaml")) for item in [FeatureTemplate.model_validate(_read_yaml(path))]}
    indicators: dict[str, IndicatorConfig] = {}
    domain_ids = {item.id for item in domains.domains}
    for path in sorted((root / "indicators").glob("*.yaml")):
        item = IndicatorConfig.model_validate(_read_yaml(path))
        if item.indicator_id in indicators:
            raise ValueError(f"duplicate indicator ID: {item.indicator_id}")
        if item.classification.primary_domain not in domain_ids:
            raise ValueError(f"unknown primary domain: {item.classification.primary_domain}")
        unknown_related = set(item.classification.related_domains) - domain_ids
        if unknown_related:
            raise ValueError(f"unknown related domains: {sorted(unknown_related)}")
        if item.feature_template not in templates:
            raise ValueError(f"unknown feature template: {item.feature_template}")
        indicators[item.indicator_id] = item
    return domains, templates, indicators
