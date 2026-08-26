import os
from datetime import date

os.environ["DEBUG"] = "false"

from src.services import persisted_analysis


class FakeFeatureRun:
    status = "success"
    errors = []

    def model_dump(self, mode="python"):
        return {"status": self.status, "errors": self.errors, "mode": mode}


class FakeRuleRepository:
    def __init__(self, client, database):
        self.saved = []

    def ensure_indexes(self):
        pass

    def save(self, value):
        self.saved.append(value)


def test_persisted_analysis_builds_current_features_before_llm(monkeypatch):
    calls = {}

    def fake_feature_job(repository, indicator_ids, as_of, write):
        calls["feature_job"] = {"ids": indicator_ids, "as_of": as_of, "write": write}
        return [{"indicator_id": "federal_funds_rate"}], FakeFeatureRun()

    def fake_llm_pipeline(feature_repository, narrative_repository, provider, as_of, force):
        calls["llm"] = {"as_of": as_of, "force": force, "provider": provider}
        return {"indicator": [], "domain": [], "market": None, "errors": []}

    monkeypatch.setattr(persisted_analysis, "MongoFeatureRepository", lambda client, database: object())
    monkeypatch.setattr(persisted_analysis, "MongoNarrativeRepository", lambda client, database: object())
    monkeypatch.setattr(persisted_analysis, "MongoRuleRepository", FakeRuleRepository)
    monkeypatch.setattr(persisted_analysis, "run_feature_job", fake_feature_job)
    monkeypatch.setattr(persisted_analysis, "load_domain_rule_sets", lambda: {})
    monkeypatch.setattr(persisted_analysis, "run_llm_pipeline", fake_llm_pipeline)

    target = date(2026, 8, 26)
    provider = object()
    result = persisted_analysis.run_persisted_analysis(object(), "test", provider, target, force_llm=True)

    assert calls["feature_job"]["as_of"] == target
    assert calls["feature_job"]["write"] is True
    assert set(calls["feature_job"]["ids"]) == set(persisted_analysis.DEFINITIONS)
    assert calls["llm"] == {"as_of": target, "force": True, "provider": provider}
    assert result["as_of_date"] == "2026-08-26"
    assert result["errors"] == []
