"""Factor generation contracts; all observations below are synthetic fixtures."""

import os
from copy import deepcopy
from datetime import date
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError

os.environ["DEBUG"] = "false"

from src.services.llm_engine import job
from src.services.llm_engine.schemas import MarketNarrative


@pytest.fixture
def evidence():
    return {"domain_narratives": [{"subject_id": f"sample-{i}", "narrative_fa": f"شواهد آزمایشی {i}"} for i in range(4)]}


@pytest.fixture
def factors():
    def common(index):
        return {"title_fa": f"عامل آزمایشی {index}", "mechanism_fa": "سازوکار اثر بر سودآوری شرکت‌های شاخص",
                "horizon_fa": "روزها تا هفته‌ها" if index < 2 else "چند سال",
                "evidence_summary_fa": "شرح منبع و تاریخ مشاهده در داده آزمایشی",
                "evidence_refs": [f"/domain_narratives/{index}"], "change_status": "ongoing"}

    return {
        "market_story_fa": "داستان بازار", "narrative_fa": "روایت بازار",
        "current_market_move_fa": "تیتر\nوضعیت شاخص", "current_analysis_fa": "جریان بازار",
        "short_term_outlook_fa": "کوتاه‌مدت", "medium_term_outlook_fa": "میان‌مدت",
        "summary_points_fa": ["یک", "دو", "سه", "چهار", "پنج"],
        "factor_classification_version": "1.0.0",
        "market_drivers": [
            {**common(0), "metric": "positive", "why_it_matters_fa": "حمایت جاری از شاخص",
             "sentiment": "risk_on", "duration": "short_term", "reversal_conditions_fa": "تغییر شواهد"},
            {**common(1), "metric": "negative", "why_it_matters_fa": "فشار جاری بر شاخص",
             "sentiment": "risk_off", "duration": "short_term", "reversal_conditions_fa": "تغییر شواهد"},
        ],
        "market_potentials": [{**common(2), "detail_fa": "ظرفیت افزایش بهره‌وری شرکت‌ها",
            "duration": "long_term", "limitations_fa": "هزینه تحقق و عدم تضمین رشد قیمت",
            "review_summary_fa": "شواهد همچنان معتبرند؛ داده قابل‌مقایسه جدید موجود نیست"}],
        "risk_monitor": [{**common(3), "risk_id": "structural-risk", "status": "watch",
            "duration": "long_term", "why_active_fa": "تهدید پایدار سودآوری",
            "limitations_fa": "وجود شواهد مخالف", "review_summary_fa": "شدت تهدید طبق داده آزمایشی تغییری نکرده است",
            "escalation_conditions_fa": "تشدید فشار", "easing_conditions_fa": "کاهش فشار"}],
    }


def generate(factors, evidence, provider=None):
    repository = SimpleNamespace(values=[], find_reusable=Mock(return_value=None))
    repository.save = lambda level, value: repository.values.append(value)
    provider = provider or SimpleNamespace(provider_id="fake", model_id="fake", generate_json=Mock(return_value=factors))
    coverage = {"status": "full", "ratio": 1, "configured_count": 1, "available_count": 1, "missing_inputs": []}
    result = job._analyze(repository, provider, "market", "sp500", date(2026, 10, 15), evidence, coverage, date(2026, 10, 14), True)
    return result, repository, provider


def test_all_four_categories_survive_generation_storage_and_public_endpoint(monkeypatch, factors, evidence):
    from src.api.v1.endpoints import analysis

    (snapshot, status), repository, _ = generate(factors, evidence)
    assert status == "generated"
    assert snapshot.market_drivers[0].sentiment == "risk_on"
    assert snapshot.market_drivers[1].sentiment == "risk_off"
    assert snapshot.market_potentials[0].duration == "long_term"
    assert snapshot.risk_monitor[0].status == "watch"
    monkeypatch.setattr(analysis, "_latest", lambda *args: analysis._validated_response(repository.values[0], MarketNarrative, "test"))
    monkeypatch.setattr(analysis, "next_scheduled_analysis_at", lambda: None)
    app = FastAPI()
    app.include_router(analysis.router, prefix="/api/v1")
    response = TestClient(app).get("/api/v1/market/analysis/latest")
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["factor_classification_version"] == "1.0.0"
    assert "factor_source_evidence" not in data
    for key in ("market_drivers", "market_potentials", "risk_monitor"):
        assert data[key] == snapshot.model_dump(mode="json")[key]
    assert data["current_analysis_fa"] == factors["current_analysis_fa"]
    assert "medium_term_outlook_fa" not in data
    assert data["premium_analysis_locked"] is True


@pytest.mark.parametrize("field,value", [("sentiment", "unknown"), ("sentiment", "mixed"), ("duration", "long_term")])
def test_short_term_factors_cannot_be_saved_with_unknown_direction_or_structural_horizon(factors, evidence, field, value):
    factors["market_drivers"][0][field] = value
    with pytest.raises(ValidationError, match="explicit risk_on/risk_off"):
        generate(factors, evidence)


@pytest.mark.parametrize("group,field", [("market_drivers", "mechanism_fa"), ("market_drivers", "horizon_fa"),
    ("market_drivers", "evidence_summary_fa"), ("market_potentials", "limitations_fa"),
    ("risk_monitor", "review_summary_fa")])
def test_each_factor_needs_explanation_and_long_term_review(factors, evidence, group, field):
    factors[group][0].pop(field)
    with pytest.raises(ValidationError, match="Incomplete"):
        generate(factors, evidence)


@pytest.mark.parametrize("ref", ["/domain_narratives/99", "/previous_market_factors/market_potentials/0",
    "/horizontal_evidence/warnings/0", "/horizontal_evidence/recent_market_news/0", "invented-source"])
def test_missing_empty_or_circular_evidence_is_rejected(factors, evidence, ref):
    evidence["previous_market_factors"] = {"market_potentials": [{"title_fa": "عامل قبلی"}]}
    evidence["horizontal_evidence"] = {"warnings": ["unavailable"], "recent_market_news": [None]}
    factors["market_drivers"][0]["evidence_refs"] = [ref]
    with pytest.raises(ValidationError, match="must cite non-empty supplied evidence"):
        generate(factors, evidence)


def test_empty_categories_have_reasons_instead_of_forced_factors(factors):
    for key in ("market_drivers", "market_potentials", "risk_monitor"):
        factors[key] = []
    with pytest.raises(ValidationError, match="empty reason"):
        generate(factors, {})
    reasons = {key: "شواهد کافی برای ثبت عامل معتبر موجود نیست." for key in ("supportive", "challenging", "potentials", "risks")}
    factors["factor_empty_reasons"] = reasons
    (snapshot, _), _, _ = generate(factors, {})
    assert snapshot.factor_empty_reasons == reasons
    assert snapshot.market_drivers == snapshot.market_potentials == snapshot.risk_monitor == []


@pytest.mark.parametrize("group,field,value", [("market_potentials", "duration", "unknown"),
    ("risk_monitor", "duration", "unknown"), ("risk_monitor", "status", "inactive"),
    ("risk_monitor", "change_status", "unknown")])
def test_structural_categories_require_an_explicit_horizon_and_current_review(factors, evidence, group, field, value):
    factors[group][0][field] = value
    with pytest.raises(ValidationError):
        generate(factors, evidence)


def test_duplicate_opportunity_and_threat_need_independent_aspects_and_evidence(factors, evidence):
    opportunity, risk = factors["market_potentials"][0], factors["risk_monitor"][0]
    risk["title_fa"] = opportunity["title_fa"]
    with pytest.raises(ValidationError, match="Repeated factors"):
        generate(factors, evidence)
    opportunity["distinct_aspect_fa"] = "بهره‌وری؛ شواهد مستقل"
    risk["distinct_aspect_fa"] = "هزینه سرمایه؛ شواهد مستقل"
    generate(factors, evidence)
    risk["evidence_refs"] = opportunity["evidence_refs"]
    with pytest.raises(ValidationError, match="Repeated factors"):
        generate(factors, evidence)


def test_generation_repairs_an_incomplete_factor_before_saving(factors, evidence):
    invalid = deepcopy(factors)
    invalid["market_drivers"][0].pop("sentiment")
    provider = SimpleNamespace(provider_id="fake", model_id="fake", generate_json=Mock(side_effect=[invalid, factors]))
    (_, status), repository, _ = generate(factors, evidence, provider)
    assert status == "generated" and len(repository.values) == 1
    assert provider.generate_json.call_count == 2
    retry = provider.generate_json.call_args.args[1]
    assert "sentiment" in retry["validation_feedback"]["errors"][0]["message"]


def test_old_snapshots_remain_readable_without_inventing_classification(factors, evidence):
    (_, _), repository, _ = generate(factors, evidence)
    old = deepcopy(repository.values[0])
    old.pop("factor_classification_version")
    old["market_drivers"][0].pop("sentiment")
    old["risk_monitor"][0].pop("duration")
    loaded = MarketNarrative.model_validate(old)
    assert loaded.factor_classification_version is None
    assert loaded.market_drivers[0].sentiment == "unknown"
    assert loaded.risk_monitor[0].duration == "unknown"


def test_sources_are_retained_from_actual_input_and_can_be_reassessed_without_new_news(factors, evidence):
    factors["factor_source_evidence"] = {"fabricated": {"claim": "must not be accepted"}}
    (first, _), _, _ = generate(factors, evidence)
    assert list(first.factor_source_evidence.values()) == evidence["domain_narratives"]
    items = [*factors["market_drivers"], *factors["market_potentials"], *factors["risk_monitor"]]
    for item, source_id in zip(items, first.factor_source_evidence):
        item["evidence_refs"] = [f"/retained_factor_evidence/{source_id}"]
    retained = {"retained_factor_evidence": first.factor_source_evidence, "horizontal_evidence": {"recent_market_news": []}}
    (reviewed, _), _, _ = generate(factors, retained)
    assert reviewed.factor_source_evidence == first.factor_source_evidence
    assert reviewed.market_potentials[0].change_status == "ongoing"


def test_prior_factor_review_is_bounded_and_cannot_use_future_output():
    prior = {"as_of_date": "2026-10-14", "market_potentials": [{"title_fa": str(i)} for i in range(20)], "other_section": "excluded"}
    repository = SimpleNamespace(latest=Mock(return_value=prior))
    result = job.previous_market_factors(repository, date(2026, 10, 15))
    assert len(result["market_potentials"]) == 12
    assert "other_section" not in result
    assert len(prior["market_potentials"]) == 20
    assert job.previous_market_factors(repository, date(2026, 10, 13)) is None
    repository.latest.return_value = None
    assert job.previous_market_factors(repository, date(2026, 10, 15)) is None


def test_pipeline_supplies_previous_factors_for_review_without_copying_other_sections(monkeypatch):
    day = date(2026, 10, 15)
    prior = {"as_of_date": "2026-10-14", "market_potentials": [{"title_fa": "پتانسیل قبلی"}], "current_analysis_fa": "excluded",
             "factor_source_evidence": {"source-id": {"source_url": "https://example.com/source", "published_at": "2026-09-01"}}}
    repository = SimpleNamespace(ensure_indexes=Mock(), save_run=Mock(), latest=Mock(return_value=prior))
    domain = SimpleNamespace(id="test-domain", expected_indicator_count=1, model_dump=lambda **kwargs: {})
    config = SimpleNamespace(indicator_id="test-indicator", enabled=True, definition_version="1", model_dump=lambda **kwargs: {},
        llm=SimpleNamespace(enabled=True, include_in_domain_analysis=True),
        classification=SimpleNamespace(primary_domain="test-domain"))
    monkeypatch.setattr(job, "load_registry", lambda: (SimpleNamespace(domains=[domain], config_version="1"), {}, {"test-indicator": config}))
    features = SimpleNamespace(snapshot_for_as_of=Mock(return_value={"source": {"latest_observation_date": "2026-10-14"}, "feature_version": "1"}))
    inputs = {}

    def analyze(repo, provider, level, subject, as_of, evidence, coverage, data_as_of, force):
        inputs[level] = evidence
        return SimpleNamespace(data_as_of=day, model_dump=lambda **kwargs: {"subject_id": subject}), "generated"

    monkeypatch.setattr(job, "_analyze", analyze)
    result = job.run_llm_pipeline(features, repository, SimpleNamespace(provider_id="fake", model_id="fake"), day, horizontal_evidence={"recent_market_news": []})
    assert result["errors"] == []
    assert inputs["market"]["previous_market_factors"]["market_potentials"] == prior["market_potentials"]
    assert "current_analysis_fa" not in inputs["market"]["previous_market_factors"]
    assert inputs["market"]["retained_factor_evidence"] == prior["factor_source_evidence"]
    assert "previous_market_factors" not in inputs["domain"]
