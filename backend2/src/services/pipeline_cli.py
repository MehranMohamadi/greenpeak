"""Manual GreenPeak feature -> rule -> LLM orchestration entry point."""

import argparse
from datetime import UTC, date, datetime
import json

from pymongo import MongoClient

from ..core.config import get_settings
from .llm_engine.job import run_llm_pipeline
from .llm_engine.provider import DisabledProvider, OpenAICompatibleProvider
from .llm_engine.repository import MongoNarrativeRepository
from .rate_features.config import DEFINITIONS
from .rate_features.job import run_feature_job
from .rate_features.repository import MongoFeatureRepository
from .rule_engine.config import load_domain_rule_sets
from .rule_engine.engine import evaluate_rule_set
from .rule_engine.repository import MongoRuleRepository


def _provider(settings):
    if settings.greenpeak_llm_provider == "openai-compatible":
        return OpenAICompatibleProvider(settings.greenpeak_llm_api_key, settings.greenpeak_llm_model, settings.greenpeak_llm_base_url)
    return DisabledProvider()


def main() -> int:
    parser = argparse.ArgumentParser(description="Run the ordered GreenPeak analysis pipeline")
    parser.add_argument("run", nargs="?")
    parser.add_argument("--as-of", default="latest")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--force-llm", action="store_true")
    args = parser.parse_args()
    as_of = date.today() if args.as_of == "latest" else date.fromisoformat(args.as_of)
    settings = get_settings(); client = MongoClient(settings.mongodb_url, serverSelectionTimeoutMS=5000)
    feature_repository = MongoFeatureRepository(client, settings.mongodb_database)
    output = {"as_of_date": as_of.isoformat(), "dry_run": args.dry_run, "stages": {}, "errors": []}
    try:
        snapshots, feature_run = run_feature_job(feature_repository, list(DEFINITIONS), as_of, not args.dry_run)
        output["stages"]["features"] = feature_run.model_dump(mode="json")
        feature_map = {item["indicator_id"]: item for item in snapshots}
        rule_repository = MongoRuleRepository(client, settings.mongodb_database)
        if not args.dry_run:
            rule_repository.ensure_indexes()
        rule_results = []
        for rule_set in load_domain_rule_sets().values():
            result = evaluate_rule_set(rule_set, feature_map, as_of)
            result["calculated_at"] = datetime.now(UTC).isoformat()
            rule_results.append(result)
            if not args.dry_run:
                rule_repository.save(result)
        market_rule = {"level": "market", "subject_id": "sp500", "as_of_date": as_of.isoformat(), "status": "not_configured", "score": None, "scale": {"min": 0, "neutral": 5, "max": 10}, "coverage_ratio": 0, "rule_config_version": "0.1.0", "rule_config_hash": "not_configured", "contributions": [], "missing_inputs": [], "calculated_at": datetime.now(UTC).isoformat()}
        rule_results.append(market_rule)
        if not args.dry_run:
            rule_repository.save(market_rule)
        output["stages"]["rules"] = rule_results
        if args.dry_run:
            output["stages"]["llm"] = {"status": "planned", "message": "Dry-run does not call or persist LLM output."}
        elif feature_run.status != "failed":
            provider = _provider(settings)
            if provider.provider_id == "disabled":
                output["stages"]["llm"] = {"status": "not_configured"}
            else:
                output["stages"]["llm"] = run_llm_pipeline(feature_repository, MongoNarrativeRepository(client, settings.mongodb_database), provider, as_of, args.force_llm)
        print(json.dumps(output, ensure_ascii=False, indent=2, default=str))
        return 1 if feature_run.status == "failed" else 2 if feature_run.status == "partial" or output["errors"] else 0
    except Exception as exc:
        output["errors"].append(type(exc).__name__)
        print(json.dumps(output, ensure_ascii=False, indent=2, default=str))
        return 1
    finally:
        client.close()


if __name__ == "__main__":
    raise SystemExit(main())
