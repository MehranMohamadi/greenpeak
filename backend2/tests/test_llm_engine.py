import os
from datetime import date

os.environ["DEBUG"] = "false"

from src.services.llm_engine.job import _analyze
from src.services.llm_engine.prompts import load_prompt
from src.services.llm_engine.provider import decode_json_content


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


def test_persian_prompts_load_as_utf8():
    prompt = load_prompt("indicator")
    assert prompt.version == "0.1.0+0.1.0"
    assert "Persian" in prompt.content


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
