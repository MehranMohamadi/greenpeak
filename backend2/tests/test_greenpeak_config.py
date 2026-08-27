from pathlib import Path
import json
import os

import pytest

os.environ["DEBUG"] = "false"

from src.services.greenpeak_config import CONFIG_ROOT, load_registry, stable_hash


def test_registry_loads_utf8_and_has_eight_domains():
    domains, templates, indicators = load_registry()
    assert len(domains.domains) == 8
    assert {
        "us_10y_treasury_yield",
        "federal_funds_rate",
        "fed_balance_sheet",
        "sofr_rate",
        "real_interest_rate_10y",
    } <= set(indicators)
    assert len(indicators) == 30
    assert "وجوه فدرال" in indicators["federal_funds_rate"].display.name_fa
    assert "daily_interest_rate" in templates


def test_config_hash_is_stable_and_utf8_json_round_trips():
    _, _, indicators = load_registry()
    item = indicators["us_10y_treasury_yield"]
    assert stable_hash(item) == stable_hash(item)
    encoded = json.dumps(item.model_dump(mode="json"), ensure_ascii=False).encode("utf-8")
    assert json.loads(encoded.decode("utf-8"))["display"]["name_fa"] == item.display.name_fa


def test_unknown_config_key_fails(tmp_path: Path):
    root = tmp_path / "greenpeak"
    (root / "feature_templates").mkdir(parents=True)
    (root / "indicators").mkdir()
    for relative in ("domains.yaml", "feature_templates/daily_interest_rate.yaml"):
        source = CONFIG_ROOT / relative
        (root / relative).write_bytes(source.read_bytes())
    bad = (CONFIG_ROOT / "indicators/federal_funds_rate.yaml").read_text(encoding="utf-8") + "\nexecutable: eval('bad')\n"
    (root / "indicators/federal_funds_rate.yaml").write_text(bad, encoding="utf-8")
    load_registry.cache_clear()
    with pytest.raises(ValueError):
        load_registry(root)
    load_registry.cache_clear()
