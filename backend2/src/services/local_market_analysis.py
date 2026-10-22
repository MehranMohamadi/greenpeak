"""Explicit local-only market refresh; no ETL, Mongo writes or notifications."""
from datetime import UTC, datetime
from zoneinfo import ZoneInfo
import argparse
import json

from ..core.config import get_settings
from .data_service import DataService
from .llm_engine.job import _analyze
from .llm_engine.local_cache import LocalNarrativeCache
from .llm_engine.routing import create_llm_provider, llm_is_configured
from .market_analysis_context import build_market_analysis_context
from .news.sources import fetch_rss


class _NoMongo:
    def __getitem__(self, _):
        raise RuntimeError("Mongo access is disabled in local refresh")


class _LocalRepository:
    def __init__(self, cache):
        self.cache = cache

    def find_reusable(self, level, digest, model):
        old = self.cache.latest(level, "sp500")
        if old and old.get("provenance", {}).get("input_hash") == digest and old.get("provenance", {}).get("model") == model:
            return old
        return None

    def save(self, level, value):
        self.cache.save(level, "sp500", value)


def collect_local_evidence(settings, now=None):
    current = now or datetime.now(UTC)
    day = current.astimezone(ZoneInfo("Asia/Tehran")).date()
    context = build_market_analysis_context(_NoMongo(), "local-only", day, now=current)
    try:
        news = fetch_rss(settings.greenpeak_cnbc_rss_url, "cnbc_rss", timeout=12)
        context["recent_market_news"] = [
            {"title": item.title, "summary": item.summary, "published_at": item.published_at.isoformat(), "source_url": str(item.url), "source": "CNBC RSS"}
            for item in sorted(news, key=lambda item: item.published_at, reverse=True)
            if 0 <= (current - item.published_at).total_seconds() <= 7 * 86400
        ][:12]
        if context["recent_market_news"]:
            context["warnings"] = [warning for warning in context["warnings"] if warning != "recent_market_news_unavailable"]
    except Exception:
        context["warnings"].append("local_public_news_unavailable")
    service = DataService()
    service.mongodb = None  # Use existing documented file/public fallbacks only.
    methods = {
        "federal_funds_rate": "get_dff_data", "us_10y_treasury_yield": "get_10year_data",
        "fed_balance_sheet": "get_walcl_data", "money_supply": "get_m2_data",
        "credit_spread": "get_credit_spread_data", "consumer_prices": "get_cpi_data",
        "unemployment": "get_unrate_data", "economic_output": "get_gdp_data",
    }
    observations = []
    for indicator, method in methods.items():
        try:
            payload = getattr(service, method)(limit=4, end_date=day.isoformat()).model_dump(mode="json")
            if not payload["data"]:
                continue
            metadata = payload["metadata"]
            observations.append({"indicator": indicator, "observations": payload["data"],
                "metadata": {key: metadata.get(key) for key in ("source", "source_provider", "source_url", "description", "unit", "frequency", "latest_date", "latest_observation_date", "fred_series") if metadata.get(key) is not None},
                "usage": "Dated source observations; historical levels are not same-session causal evidence"})
        except Exception:
            context["warnings"].append(f"local_observation_unavailable:{indicator}")
    context["observed_indicators"] = observations
    return {"domain_narratives": [], "horizontal_evidence": context, "versions": {"local_market_context": "1.0.0"}}


def refresh_local_market(*, settings=None, provider=None, evidence=None, now=None):
    settings = settings or get_settings()
    if settings.environment != "development":
        raise RuntimeError("Local market refresh is development-only")
    if provider is None and not llm_is_configured(settings):
        raise RuntimeError("LLM_NOT_CONFIGURED")
    current = now or datetime.now(UTC)
    day = current.astimezone(ZoneInfo("Asia/Tehran")).date()
    cache = LocalNarrativeCache(settings.analysis_local_db_path)
    inputs = evidence if evidence is not None else collect_local_evidence(settings, current)
    previous = cache.latest("market", "sp500")
    if previous:
        inputs = {**inputs, "retained_factor_evidence": previous.get("factor_source_evidence", {}),
                  "previous_market_factors": {key: previous.get(key, []) for key in ("market_drivers", "market_potentials", "risk_monitor")}}
    available = len(inputs.get("horizontal_evidence", {}).get("observed_indicators", []))
    coverage = {"status": "provisional", "ratio": 0, "configured_count": 11, "available_count": 0,
                "missing_inputs": ["local_mode_uses_dated_observations_and_public_context_without_generated_domain_narratives"]}
    value, status = _analyze(_LocalRepository(cache), provider or create_llm_provider(settings), "market", "sp500", day,
        inputs, coverage, None, True)
    return {"status": status, "analysis_generated_at": value.analysis_generated_at.isoformat(), "as_of_date": value.as_of_date.isoformat(),
            "observation_groups": available, "supportive": sum(item.sentiment == "risk_on" for item in value.market_drivers),
            "challenging": sum(item.sentiment == "risk_off" for item in value.market_drivers),
            "potentials": len(value.market_potentials), "risks": len(value.risk_monitor)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--evidence-only", action="store_true", help="Inspect source availability without invoking the model")
    args = parser.parse_args()
    try:
        settings = get_settings()
        if settings.environment != "development":
            raise RuntimeError("development_only")
        if args.evidence_only:
            context = collect_local_evidence(settings)["horizontal_evidence"]
            result = {"session_available": bool(context.get("sp500_session_move")), "news_count": len(context.get("recent_market_news", [])),
                      "observation_groups": len(context.get("observed_indicators", [])), "warnings": context.get("warnings", [])}
        else:
            result = refresh_local_market(settings=settings)
        print(json.dumps(result, ensure_ascii=False))
    except Exception as exc:
        # Never echo provider payloads, connection strings or exception text.
        response = getattr(exc, "response", None)
        print(json.dumps({"status": "failed", "error_code": type(exc).__name__, "http_status": getattr(response, "status_code", None)}))
        raise SystemExit(1) from None


if __name__ == "__main__":
    main()
