"""Group 4 synthesizes the same ten indicators shown by the frontend."""

import os
from datetime import date
from types import SimpleNamespace

os.environ["DEBUG"] = "false"

import pytest
from fastapi.testclient import TestClient

from src.services.greenpeak_config import load_registry
from src.services.llm_engine.job import domain_indicator_ids, run_llm_pipeline

DOMAIN = "corporate_fundamentals_valuation"
INDICATORS = {
    "sp500_eps", "revenue_growth", "profit_margins", "return_on_assets",
    "valuation_pe_ratio", "forward_pe_ratio", "price_to_book_ratio",
    "price_to_sales_ratio", "peg_ratio", "valuation_dividend_yield",
}


class Repository:
    def __init__(self):
        self.documents = []

    def ensure_indexes(self):
        pass

    def find_reusable(self, *args):
        return None

    def save(self, level, document):
        self.documents.append((level, document))

    def latest(self, level, subject_id):
        return next((document for stored_level, document in reversed(self.documents)
                     if stored_level == level and document["subject_id"] == subject_id), None)

    def save_run(self, document):
        self.run = document


class Provider:
    provider_id = "fixture"
    model_id = "fixture-model"

    def generate_json(self, prompt, request):
        level = request["contract_level"]
        if level == "indicator":
            return {"narrative_fa": "روایت آزمایشی شاخص", "current_state_fa": "وضعیت آزمایشی",
                    "what_changed_fa": "تغییر آزمایشی", "interpretation_fa": "تفسیر آزمایشی"}
        if level == "domain":
            self.domain_request = request
            assert DOMAIN in prompt
            return {"narrative_fa": "جمع‌بندی مشترک سودآوری و ارزش‌گذاری",
                    "dominant_story_fa": "ارزیابی مشترک بنیادها و نسبت‌های ارزش‌گذاری"}
        self.market_request = request
        return {"narrative_fa": "روایت آزمایشی بازار", "market_story_fa": "داستان آزمایشی",
                "current_market_move_fa": "حرکت آزمایشی", "current_analysis_fa": "تحلیل آزمایشی",
                "short_term_outlook_fa": "عدم قطعیت", "medium_term_outlook_fa": "عدم قطعیت",
                "summary_points_fa": ["اول", "دوم", "سوم", "چهارم", "پنجم"],
                "factor_classification_version": "1.0.0",
                "factor_empty_reasons": {key: "دادهٔ کافی در این آزمون وجود ندارد."
                                         for key in ("supportive", "challenging", "potentials", "risks")}}


@pytest.mark.parametrize("missing", [None, "return_on_assets"])
def test_one_persisted_group_covers_both_chart_families_and_reports_missing_history(missing):
    domains, _, indicators = load_registry()
    domain = next(item for item in domains.domains if item.id == DOMAIN)
    assert domain.expected_indicator_count == 10
    assert set(domain_indicator_ids(DOMAIN, indicators)) == INDICATORS
    assert not {"corporate_fundamentals", "valuation"} & {item.id for item in domains.domains}

    def feature(indicator_id, as_of):
        if indicator_id not in INDICATORS or indicator_id == missing:
            return None
        return {"source": {"latest_observation_date": "2026-10-30"}, "feature_version": "fixture"}

    repository, provider = Repository(), Provider()
    run_llm_pipeline(SimpleNamespace(snapshot_for_as_of=feature), repository, provider, date(2026, 11, 3))
    generated = [document for level, document in repository.documents if level == "domain"]
    assert len(generated) == 1
    assert generated[0]["subject_id"] == DOMAIN
    supplied = {item["subject_id"] for item in provider.domain_request["evidence"]["indicator_narratives"]}
    assert supplied == INDICATORS - ({missing} if missing else set())
    assert generated[0]["coverage"] == {
        "status": "partial" if missing else "full", "configured_count": 10,
        "available_count": 9 if missing else 10, "ratio": 0.9 if missing else 1,
        "missing_inputs": [missing] if missing else [],
    }
    assert [item["subject_id"] for item in provider.market_request["evidence"]["domain_narratives"]] == [DOMAIN]


def test_unified_domain_endpoint_reads_its_own_snapshot_and_health_remains_available(monkeypatch):
    import src.main as main
    from src.api.v1.endpoints import analysis
    from src.api.v1.endpoints.auth import require_debug_access, require_premium_analysis
    from src.services.llm_engine.job import _analyze

    repository = Repository()
    _analyze(repository, Provider(), "domain", DOMAIN, date(2026, 11, 3), {},
             {"status": "full", "ratio": 1, "configured_count": 10, "available_count": 10},
             date(2026, 10, 30), True)
    monkeypatch.setattr(analysis, "MongoClient", lambda *args, **kwargs: SimpleNamespace(close=lambda: None))
    monkeypatch.setattr(analysis, "MongoNarrativeRepository", lambda *args: repository)
    monkeypatch.setattr(analysis, "_local_cache", lambda settings: None)
    for factory in ("create_daily_analysis_scheduler", "create_news_scheduler",
                    "create_official_sentiment_scheduler", "create_work_task_notification_scheduler",
                    "create_support_notification_scheduler"):
        monkeypatch.setattr(main, factory, lambda: None)
    app = main.create_app()
    app.dependency_overrides[require_premium_analysis] = lambda: None
    app.dependency_overrides[require_debug_access] = lambda: False
    with TestClient(app) as client:
        assert client.get("/health").status_code == 200
        response = client.get(f"/api/v1/domains/{DOMAIN}/analysis/latest")
        assert response.status_code == 200
        assert response.json()["data"]["subject_id"] == DOMAIN
        assert response.json()["data"]["coverage"]["status"] == "full"
        assert client.get("/api/v1/domains/valuation/analysis/latest").status_code == 404


def test_eps_features_use_the_same_monthly_real_series_as_the_chart_without_raw_writes():
    from src.services.corporate_fundamentals import load_multpl_sp500_real_eps
    from src.services.rate_features.builder import build_snapshot
    from src.services.rate_features.config import get_definition
    from src.services.rate_features.repository import MongoFeatureRepository

    definition = get_definition("sp500_eps")
    assert definition["definition_version"] == "3.0"
    assert definition["data"]["frequency"] == "monthly"
    assert definition["source"]["series_id"] == "MULTPL_SP500_REAL_EPS_TTM"
    # Any collection access or write would fail on this database placeholder.
    repository = MongoFeatureRepository({"fixture": object()}, "fixture")
    as_of = date(2026, 5, 31)
    frame = repository.load_observations(definition, as_of)
    expected = [point for point in load_multpl_sp500_real_eps().points if point.date <= as_of.isoformat()]
    assert frame.value_pct.tolist() == [point.value for point in expected]
    assert frame.observation_date.tolist() == [date.fromisoformat(point.date) for point in expected]
    assert set(frame.source_provider) == {"Multpl"}
    assert set(frame.source_series_id) == {"MULTPL_SP500_REAL_EPS_TTM"}
    snapshot, _ = build_snapshot(definition, frame, as_of, "fixture", "fixture")
    assert snapshot.source.latest_observation_date == date.fromisoformat(expected[-1].date)
    assert snapshot.current.value == expected[-1].value
