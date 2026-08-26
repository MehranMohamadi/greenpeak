"""Build current deterministic inputs, then generate and persist LLM analysis."""

from datetime import UTC, date, datetime

from .llm_engine.job import run_llm_pipeline
from .llm_engine.repository import MongoNarrativeRepository
from .rate_features.config import DEFINITIONS
from .rate_features.job import run_feature_job
from .rate_features.repository import MongoFeatureRepository
from .rule_engine.config import load_domain_rule_sets
from .rule_engine.engine import evaluate_rule_set
from .rule_engine.repository import MongoRuleRepository


def run_persisted_analysis(client, database: str, provider, as_of: date, force_llm: bool = True) -> dict:
    """Run feature -> rule -> LLM stages against the shared server store."""
    feature_repository = MongoFeatureRepository(client, database)
    snapshots, feature_run = run_feature_job(feature_repository, list(DEFINITIONS), as_of, write=True)
    if feature_run.status == "failed":
        raise RuntimeError("Current feature snapshots could not be built")

    feature_map = {item["indicator_id"]: item for item in snapshots}
    rule_repository = MongoRuleRepository(client, database)
    rule_repository.ensure_indexes()
    rule_results = []
    for rule_set in load_domain_rule_sets().values():
        result = evaluate_rule_set(rule_set, feature_map, as_of)
        result["calculated_at"] = datetime.now(UTC).isoformat()
        rule_repository.save(result)
        rule_results.append(result)

    market_rule = {
        "level": "market",
        "subject_id": "sp500",
        "as_of_date": as_of.isoformat(),
        "status": "not_configured",
        "score": None,
        "scale": {"min": 0, "neutral": 5, "max": 10},
        "coverage_ratio": 0,
        "rule_config_version": "0.1.0",
        "rule_config_hash": "not_configured",
        "contributions": [],
        "missing_inputs": [],
        "calculated_at": datetime.now(UTC).isoformat(),
    }
    rule_repository.save(market_rule)
    rule_results.append(market_rule)

    llm_result = run_llm_pipeline(
        feature_repository,
        MongoNarrativeRepository(client, database),
        provider,
        as_of,
        force=force_llm,
    )
    return {
        "as_of_date": as_of.isoformat(),
        "features": feature_run.model_dump(mode="json"),
        "rules": rule_results,
        "llm": llm_result,
        "errors": [*feature_run.errors, *llm_result["errors"]],
    }
