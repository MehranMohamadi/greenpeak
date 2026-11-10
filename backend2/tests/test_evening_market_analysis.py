"""Evening market generation reuses stored domains and refreshes only market context."""

from datetime import date

import pytest

from src.services import persisted_analysis
from src.services.llm_engine.job import _analyze, run_llm_pipeline
from test_corporate_valuation_analysis import DOMAIN, Provider, Repository


def test_evening_generation_uses_dated_domains_and_new_context_without_features():
    repository = Repository()
    day = date(2026, 11, 9)
    _analyze(repository, Provider(), "domain", DOMAIN, date(2026, 11, 8), {},
             {"status": "full", "ratio": 1, "configured_count": 10, "available_count": 10},
             date(2026, 11, 6), True)
    domain_before = repository.documents[0]

    class MarketProvider(Provider):
        def generate_json(self, prompt, request):
            assert request["contract_level"] == "market"
            return super().generate_json(prompt, request)

    provider = MarketProvider()
    for session in ("afternoon", "evening"):
        context = {"sp500_session_move": {"observed_session": session}}
        result = run_llm_pipeline(None, repository, provider, day, force=True,
                                  horizontal_evidence=context, market_only=True)
        assert result["indicator"] == []
        assert result["domain"] == [{"subject_id": DOMAIN, "status": "reused"}]
        assert result["market"]["status"] == "generated"
        evidence = provider.market_request["evidence"]
        assert evidence["horizontal_evidence"] == context
        assert evidence["domain_narratives"][0]["as_of_date"] == "2026-11-08"
        assert evidence["versions"]["market_schedule_slot"] == "market-evening"
    assert repository.documents[0] == domain_before
    assert [level for level, document in repository.documents] == ["domain", "market", "market"]
    market = repository.latest("market", "sp500")
    assert market["coverage"]["status"] == "provisional"
    assert market["data_as_of"] == "2026-11-06"


@pytest.mark.parametrize("future_domain", [False, True])
def test_evening_generation_does_not_invent_missing_or_future_domain_evidence(future_domain):
    repository = Repository()
    if future_domain:
        _analyze(repository, Provider(), "domain", DOMAIN, date(2026, 11, 10), {},
                 {"status": "full", "ratio": 1, "configured_count": 1, "available_count": 1}, None, True)
    result = run_llm_pipeline(None, repository, Provider(), date(2026, 11, 9), market_only=True)
    assert result["market"] is None
    assert "market:domain_narratives_missing" in result["errors"]


def test_persisted_evening_run_fetches_fresh_context_and_never_rebuilds_raw_features(monkeypatch):
    calls = []
    monkeypatch.setattr(persisted_analysis, "MongoNarrativeRepository", lambda *args: "narratives")
    monkeypatch.setattr(persisted_analysis, "run_feature_job", lambda *a, **kw: pytest.fail("Market refresh must not rebuild rate features"))
    monkeypatch.setattr(persisted_analysis, "build_market_analysis_context", lambda *a: {"fresh": True})

    def pipeline(features, narratives, provider, as_of, **kwargs):
        calls.append((features, narratives, kwargs))
        return {"market": {"status": "generated"}, "errors": []}

    monkeypatch.setattr(persisted_analysis, "run_llm_pipeline", pipeline)
    result = persisted_analysis.run_persisted_market_analysis(object(), "test", object(), date(2026, 11, 9))
    assert calls == [(None, "narratives", {"force": True, "market_only": True, "horizontal_evidence": {"fresh": True}})]
    assert result["errors"] == []
    assert result["llm"]["market"]["status"] == "generated"
