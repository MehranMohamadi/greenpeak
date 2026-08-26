import os
from datetime import date

os.environ["DEBUG"] = "false"

from src.services.greenpeak_config import load_registry
from src.services.llm_engine.job import _analyze, domain_indicator_ids
from src.services.llm_engine.prompts import load_prompt
from src.services.llm_engine.provider import decode_json_content
from src.services.llm_engine.schemas import DomainNarrative


class FakeProvider:
    provider_id = "fake"
    model_id = "fake-v1"
    calls = 0

    def generate_json(self, prompt, evidence):
        self.calls += 1
        assert "Rule Engine score" in prompt
        assert "rule_score" not in str(evidence).lower()
        return {"current_state_fa": "وضعیت فعلی", "what_changed_fa": "تغییر محدود", "interpretation_fa": "تفسیر محتاطانه", "key_facts": [{"fact": "واقعیت", "evidence_ref": "feature:current_value_pct"}], "ambiguities_fa": [], "risks_to_interpretation_fa": [], "watch_next_fa": ["داده بعدی"], "narrative_fa": "روایت فارسی", "llm_shadow_score": 5, "llm_confidence": 50, "evidence_refs": ["feature:current_value_pct"], "warnings": []}


class MemoryRepository:
    def __init__(self): self.values = []
    def find_reusable(self, level, input_hash, model):
        return next((item for item in self.values if item["provenance"]["input_hash"] == input_hash and item["provenance"]["model"] == model), None)
    def save(self, level, document): self.values.append(document)


class InvalidThenValidProvider(FakeProvider):
    def __init__(self):
        self.calls = 0

    def generate_json(self, prompt, evidence):
        self.calls += 1
        if self.calls == 1:
            return {}
        return {
            "current_state_fa": "current state",
            "what_changed_fa": "limited change",
            "interpretation_fa": "cautious interpretation",
            "key_facts": [],
            "ambiguities_fa": [],
            "risks_to_interpretation_fa": [],
            "watch_next_fa": [],
            "narrative_fa": "test narrative",
            "llm_shadow_score": 5,
            "llm_confidence": 50,
            "evidence_refs": [],
            "warnings": [],
        }


class AlwaysInvalidProvider(FakeProvider):
    def __init__(self):
        self.calls = 0

    def generate_json(self, prompt, evidence):
        self.calls += 1
        return {}


def test_persian_prompts_load_as_utf8():
    prompt = load_prompt("indicator")
    assert prompt.version == "0.2.0+0.2.0"
    assert "Persian" in prompt.content


def test_domain_contract_and_prompt_include_compact_dashboard_analysis():
    schema = DomainNarrative.model_json_schema()["properties"]
    assert {"stance_label_fa", "key_insights_fa", "outlook_items"} <= set(schema)
    prompt = load_prompt("domain")
    assert prompt.version == "0.2.0+0.3.0"
    assert "monetary_liquidity" in prompt.content
    assert "outlook_items" in prompt.content


def test_related_indicators_are_included_in_domain_analysis_evidence():
    indicators = load_registry()[2]
    monetary_ids = domain_indicator_ids("monetary_liquidity", indicators)
    assert "federal_funds_rate" in monetary_ids
    assert "us_10y_treasury_yield" in monetary_ids


def test_compatible_provider_accepts_fenced_json():
    assert decode_json_content("```json\n{\"ok\": true}\n```") == {"ok": True}


def test_llm_result_is_reused_by_input_hash_and_force_regenerates():
    repository, provider = MemoryRepository(), FakeProvider()
    coverage = {"status": "full", "ratio": 1, "configured_count": 1, "available_count": 1, "missing_inputs": []}
    first, first_status = _analyze(repository, provider, "indicator", "federal_funds_rate", date(2026, 8, 16), {"features": {"current_value_pct": 5}, "versions": {}}, coverage, date(2026, 8, 14), False)
    second, second_status = _analyze(repository, provider, "indicator", "federal_funds_rate", date(2026, 8, 16), {"features": {"current_value_pct": 5}, "versions": {}}, coverage, date(2026, 8, 14), False)
    assert first.narrative_fa == "روایت فارسی" and second.narrative_fa == first.narrative_fa
    assert first_status == "generated" and second_status == "reused" and provider.calls == 1
    _analyze(repository, provider, "indicator", "federal_funds_rate", date(2026, 8, 16), {"features": {"current_value_pct": 5}, "versions": {}}, coverage, date(2026, 8, 14), True)
    assert provider.calls == 2


def test_llm_validation_error_is_retried_once_before_persisting():
    repository, provider = MemoryRepository(), InvalidThenValidProvider()
    coverage = {"status": "full", "ratio": 1, "configured_count": 1, "available_count": 1, "missing_inputs": []}
    value, status = _analyze(repository, provider, "indicator", "federal_funds_rate", date(2026, 8, 26), {"versions": {}}, coverage, date(2026, 8, 26), True)
    assert status == "generated"
    assert value.current_state_fa == "current state"
    assert provider.calls == 2
    assert len(repository.values) == 1


def test_forced_invalid_generation_reuses_matching_saved_analysis():
    repository = MemoryRepository()
    coverage = {"status": "full", "ratio": 1, "configured_count": 1, "available_count": 1, "missing_inputs": []}
    arguments = (repository, FakeProvider(), "indicator", "federal_funds_rate", date(2026, 8, 26), {"versions": {}}, coverage, date(2026, 8, 26))
    first, _ = _analyze(*arguments, False)
    invalid_provider = AlwaysInvalidProvider()
    reused, status = _analyze(repository, invalid_provider, "indicator", "federal_funds_rate", date(2026, 8, 26), {"versions": {}}, coverage, date(2026, 8, 26), True)
    assert status == "reused_after_validation_error"
    assert reused.revision_id == first.revision_id
    assert invalid_provider.calls == 2
    assert len(repository.values) == 1
