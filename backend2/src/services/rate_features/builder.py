"""Build validated, explainable feature snapshots."""

import hashlib
import json
import platform
from datetime import UTC, date, datetime, timedelta
from typing import Any

import pandas as pd

from .cleaning import clean_observations
from .config import DEFINITION_VERSION, FEATURE_VERSION, SCHEMA_VERSION
from .engine import calculate_fed_change, calculate_rate_features
from .schemas import IndicatorFeatureSnapshot


def config_hash(definition: dict) -> str:
    value = json.dumps(definition, ensure_ascii=False, sort_keys=True, default=str).encode("utf-8")
    return "sha256:" + hashlib.sha256(value).hexdigest()


def build_snapshot(definition: dict, raw_frame: pd.DataFrame, as_of_date: date, run_id: str, code_version: str, calculated_at: datetime | None = None) -> tuple[IndicatorFeatureSnapshot | None, pd.DataFrame]:
    clean, adapter_flags, received_count = clean_observations(raw_frame, as_of_date)
    if clean.empty:
        return None, clean
    features, reasons, direction = calculate_rate_features(clean, definition["feature_config"], as_of_date)
    derived: dict[str, Any] = {}
    if definition["indicator_id"] == "federal_funds_rate":
        derived, derived_reasons = calculate_fed_change(clean, as_of_date)
        reasons.update(derived_reasons)

    latest = clean.iloc[-1]
    freshness = (as_of_date - latest.observation_date).days
    one_year_received = raw_frame[
        raw_frame.observation_date.notna() & (raw_frame.observation_date >= as_of_date - timedelta(days=365)) & (raw_frame.observation_date <= as_of_date)
    ]
    valid_1y = clean[clean.observation_date >= as_of_date - timedelta(days=365)]
    invalid_count = max(0, len(one_year_received) - int(one_year_received.is_valid.sum()))
    missing_ratio = invalid_count / len(one_year_received) if len(one_year_received) else 0.0
    quality_flags = adapter_flags + sorted(set(reasons.values()))
    if freshness > definition["feature_config"]["stale_after_calendar_days"]:
        status = "stale"; quality_flags.append("stale_data")
    elif reasons:
        status = "insufficient_history"
    else:
        status = "ok"

    facts = [
        {"field": name, "value": features[name], "unit": unit, "available": features[name] is not None}
        for name, unit in (("current_value_pct", "percent"), ("delta_90d_bp", "bp"), ("zscore_365d", None))
    ]
    facts.append({"field": "quality_status", "value": status, "unit": None, "available": True})
    delta = features.get("delta_90d_bp")
    delta_text = "ناموجود" if delta is None else f"{delta:.2f}"
    summary = f"در تاریخ {as_of_date.isoformat()} مقدار شاخص {features['current_value_pct']:.4g} درصد است؛ نسبت به ۹۰ روز قبل {delta_text} واحد پایه تغییر کرده است."
    if status == "stale":
        summary += " داده فعلی قدیمی است و باید با احتیاط استفاده شود."

    snapshot = IndicatorFeatureSnapshot(
        indicator_id=definition["indicator_id"], schema_version=SCHEMA_VERSION, feature_version=FEATURE_VERSION,
        definition_version=DEFINITION_VERSION, as_of_date=as_of_date, calculated_at=calculated_at or datetime.now(UTC), run_id=run_id,
        source={"provider": definition["source"]["provider"], "series_id": definition["source"]["series_id"], "latest_observation_date": latest.observation_date},
        current={"value_pct": float(latest.value_pct)}, features=features, feature_reasons=reasons, derived_features=derived,
        state={"direction_90d": direction, "materiality_threshold_bp": definition["feature_config"]["trend_threshold_bp"], "state_is_experimental": True},
        quality={"status": status, "freshness_days": freshness, "missing_ratio_1y": missing_ratio, "observation_count_1y": len(valid_1y), "flags": list(dict.fromkeys(quality_flags))},
        semantics=definition["semantics"],
        llm_context={"language": "fa", "facts": facts, "summary_template_fa": summary, "guardrails_fa": ["بین همبستگی و علیت تفاوت بگذار.", "از یک شاخص به تنهایی توصیه سرمایه‌گذاری تولید نکن.", "هر ادعا را به facts موجود محدود کن.", "در صورت stale یا insufficient_history عدم قطعیت را ذکر کن."]},
        provenance={"code_version": code_version, "python_version": platform.python_version(), "config_hash": config_hash(definition), "input_min_date": clean.observation_date.iloc[0].isoformat(), "input_max_date": clean.observation_date.iloc[-1].isoformat(), "received_count": received_count},
    )
    return snapshot, clean
