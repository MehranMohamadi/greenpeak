from __future__ import annotations

from datetime import UTC, date, datetime
from hashlib import sha256
import json
from copy import deepcopy
from typing import Any
from uuid import uuid4

from pydantic import ValidationError

from ..greenpeak_config import load_registry
from ..rate_features.job import code_version
from .prompts import load_prompt
from .schemas import DomainNarrative, IndicatorNarrative, MarketNarrative, resolve_factor_evidence

ANALYSIS_VERSION = "0.5.0"
MODELS = {"indicator": IndicatorNarrative, "domain": DomainNarrative, "market": MarketNarrative}


def _validate_stored(level: str, document: dict):
    """Read pre-0.3 narratives without exposing their deprecated pseudo-scores."""
    allowed_fields = MODELS[level].model_fields
    return MODELS[level].model_validate({key: value for key, value in document.items() if key in allowed_fields})


def domain_indicator_ids(domain_id: str, indicators: dict) -> list[str]:
    return [
        item.indicator_id
        for item in indicators.values()
        if item.enabled and item.llm.enabled and item.llm.include_in_domain_analysis
        and item.classification.primary_domain == domain_id
    ]


def input_hash(level: str, subject_id: str, as_of: date, evidence: dict, prompt_hash: str, provider, versions: dict) -> str:
    payload = {"level": level, "subject_id": subject_id, "as_of": as_of.isoformat(), "evidence": evidence, "prompt_hash": prompt_hash, "provider": provider.provider_id, "model": provider.model_id, "versions": versions}
    return "sha256:" + sha256(json.dumps(payload, ensure_ascii=False, sort_keys=True, default=str, separators=(",", ":")).encode("utf-8")).hexdigest()


def _analyze(repository, provider, level: str, subject_id: str, as_of: date, evidence: dict[str, Any], coverage: dict, data_as_of: date | None, force: bool):
    prompt = load_prompt(level)
    versions = evidence.get("versions", {})
    digest = input_hash(level, subject_id, as_of, evidence, prompt.hash, provider, versions)
    if not force:
        existing = repository.find_reusable(level, digest, provider.model_id)
        if existing:
            return _validate_stored(level, existing), "reused"
    metadata = {
        "level": level, "subject_id": subject_id, "as_of_date": as_of, "data_as_of": data_as_of,
        "analysis_version": ANALYSIS_VERSION, "analysis_generated_at": datetime.now(UTC), "coverage": coverage,
        "provenance": {"prompt_version": prompt.version, "prompt_hash": prompt.hash, "model": provider.model_id, "provider": provider.provider_id, "input_hash": digest, "code_version": code_version()},
        "revision_id": str(uuid4()),
    }
    request = {"contract_level": level, "output_contract": MODELS[level].model_json_schema(), "evidence": evidence, "coverage": coverage}
    validation_error = None
    for attempt in range(2):
        generated = provider.generate_json(prompt.content, request)
        # Failover may have changed the actual provider/model after the cache lookup.
        digest = input_hash(level, subject_id, as_of, evidence, prompt.hash, provider, versions)
        metadata["provenance"].update(model=provider.model_id, provider=provider.provider_id, input_hash=digest)
        allowed_fields = MODELS[level].model_fields
        generated = {key: value for key, value in generated.items() if key in allowed_fields}
        if level == "market":
            # Source excerpts are copied from actual input by Python, never
            # accepted from the model as purported source material.
            generated["factor_source_evidence"] = {}
        try:
            value = MODELS[level].model_validate(
                {**generated, **metadata},
                context={"validate_market_factors": level == "market", "evidence": evidence},
            )
            break
        except ValidationError as exc:
            validation_error = exc
            if attempt == 1:
                existing = repository.find_reusable(level, digest, provider.model_id)
                if existing:
                    return _validate_stored(level, existing), "reused_after_validation_error"
                raise
            request = {
                **request,
                "validation_feedback": {
                    "instruction": "Correct the JSON so it matches the output contract exactly.",
                    "errors": [
                        {"location": list(item["loc"]), "type": item["type"], "message": item["msg"]}
                        for item in validation_error.errors(include_input=False)
                    ],
                },
            }
    if level == "market":
        for item in [*value.market_drivers, *value.market_potentials, *value.risk_monitor]:
            for reference in item.evidence_refs:
                source = resolve_factor_evidence(evidence, reference)
                source_id = sha256(json.dumps(source, sort_keys=True, default=str, ensure_ascii=False).encode("utf-8")).hexdigest()
                value.factor_source_evidence[source_id] = deepcopy(source)
    repository.save(level, value.model_dump(mode="json"))
    return value, "generated"


def previous_market_factors(repository, as_of: date) -> dict | None:
    """Bounded prior output for reassessment, never independent source evidence."""
    previous = repository.latest("market", "sp500")
    if not previous:
        return None
    previous_date = date.fromisoformat(str(previous["as_of_date"])[:10])
    if previous_date > as_of:
        return None
    return {"as_of_date": previous_date.isoformat(), "source_evidence": previous.get("factor_source_evidence", {}), **{
        name: previous.get(name, [])[:12]
        for name in ("market_drivers", "market_potentials", "risk_monitor", "positive_drivers", "negative_drivers", "key_risks")
    }}


def run_llm_pipeline(
    feature_repository,
    narrative_repository,
    provider,
    as_of: date,
    force: bool = False,
    horizontal_evidence: dict[str, Any] | None = None,
) -> dict:
    """Run indicator -> domain -> market analysis from persisted upstream snapshots only."""
    domains, _, indicators = load_registry()
    narrative_repository.ensure_indexes()
    run_id = str(uuid4())
    results: dict[str, Any] = {"run_id": run_id, "as_of_date": as_of.isoformat(), "indicator": [], "domain": [], "market": None, "errors": []}
    indicator_outputs = {}
    for indicator_id, config in indicators.items():
        if not config.enabled or not config.llm.enabled:
            continue
        feature = feature_repository.snapshot_for_as_of(indicator_id, as_of)
        if not feature:
            results["errors"].append(f"{indicator_id}:feature_snapshot_missing")
            continue
        anchor = date.fromisoformat(feature["source"]["latest_observation_date"][:10]) if isinstance(feature["source"]["latest_observation_date"], str) else feature["source"]["latest_observation_date"]
        evidence = {"indicator": config.model_dump(mode="json"), "feature_snapshot": feature, "versions": {"definition_version": config.definition_version, "feature_version": feature["feature_version"], "feature_config_version": feature.get("provenance", {}).get("feature_config_version")}}
        coverage = {"status": "full", "ratio": 1, "configured_count": 1, "available_count": 1, "missing_inputs": []}
        try:
            value, status = _analyze(narrative_repository, provider, "indicator", indicator_id, as_of, evidence, coverage, anchor, force)
            indicator_outputs[indicator_id] = value
            results["indicator"].append({"subject_id": indicator_id, "status": status})
        except Exception as exc:
            results["errors"].append(f"{indicator_id}:{type(exc).__name__}")

    domain_outputs = {}
    for domain in domains.domains:
        configured = domain_indicator_ids(domain.id, indicators)
        available = [indicator_outputs[item] for item in configured if item in indicator_outputs]
        if not available:
            continue
        coverage_target = max(domain.expected_indicator_count, len(configured))
        ratio = len(available) / coverage_target
        missing_inputs = sorted(set(configured) - set(indicator_outputs))
        if len(configured) < domain.expected_indicator_count:
            missing_inputs.append("unregistered_domain_indicators")
        coverage = {"status": "full" if ratio == 1 else "partial", "ratio": ratio, "configured_count": coverage_target, "available_count": len(available), "missing_inputs": missing_inputs}
        evidence = {"domain": domain.model_dump(mode="json"), "indicator_narratives": [item.model_dump(mode="json") for item in available], "horizontal_evidence": {"news_narratives": [], "events_calendar": []}, "versions": {"domain_config_version": domains.config_version}}
        try:
            value, status = _analyze(narrative_repository, provider, "domain", domain.id, as_of, evidence, coverage, max((item.data_as_of for item in available if item.data_as_of), default=None), force)
            domain_outputs[domain.id] = value
            results["domain"].append({"subject_id": domain.id, "status": status})
        except Exception as exc:
            results["errors"].append(f"{domain.id}:{type(exc).__name__}")

    if domain_outputs:
        ratio = len(domain_outputs) / len(domains.domains)
        coverage = {"status": "full" if ratio == 1 else "provisional", "ratio": ratio, "configured_count": len(domains.domains), "available_count": len(domain_outputs), "missing_inputs": sorted({item.id for item in domains.domains} - set(domain_outputs))}
        evidence = {
            "domain_narratives": [item.model_dump(mode="json") for item in domain_outputs.values()],
            "horizontal_evidence": horizontal_evidence or {
                "sp500_session_move": None,
                "recent_market_news": [],
                "upcoming_us_events": [],
                "warnings": ["horizontal_evidence_unavailable"],
            },
            "versions": {"domain_config_version": domains.config_version},
        }
        try:
            evidence["previous_market_factors"] = previous_market_factors(narrative_repository, as_of)
            evidence["retained_factor_evidence"] = (evidence["previous_market_factors"] or {}).pop("source_evidence", {})
            value, status = _analyze(narrative_repository, provider, "market", "sp500", as_of, evidence, coverage, max((item.data_as_of for item in domain_outputs.values() if item.data_as_of), default=None), force)
            results["market"] = {"subject_id": "sp500", "status": status}
        except Exception as exc:
            results["errors"].append(f"sp500:{type(exc).__name__}")
    narrative_repository.save_run({**results, "created_at": datetime.now(UTC), "provider": provider.provider_id, "model": provider.model_id})
    return results
