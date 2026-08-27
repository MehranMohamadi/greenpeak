"""Build validated, explainable feature snapshots."""

import hashlib
import json
import platform
from datetime import UTC, date, datetime, timedelta
from typing import Any

import pandas as pd

from .cleaning import clean_observations
from .config import FEATURE_VERSION, SCHEMA_VERSION
from .engine import calculate_fed_change, calculate_rate_features
from .generic_engine import calculate_generic_features
from .schemas import IndicatorFeatureSnapshot


def config_hash(definition: dict) -> str:
    value = json.dumps(definition, ensure_ascii=False, sort_keys=True, default=str).encode("utf-8")
    return "sha256:" + hashlib.sha256(value).hexdigest()


def build_snapshot(definition: dict, raw_frame: pd.DataFrame, as_of_date: date, run_id: str, code_version: str, calculated_at: datetime | None = None) -> tuple[IndicatorFeatureSnapshot | None, pd.DataFrame]:
    clean, adapter_flags, received_count = clean_observations(raw_frame, as_of_date)
    if clean.empty:
        return None, clean
    latest = clean.iloc[-1]
    feature_anchor_date = latest.observation_date
    family = definition["feature_config"].get("family", "daily_rate")
    is_rate = family == "daily_rate"
    if is_rate:
        features, reasons, direction = calculate_rate_features(clean, definition["feature_config"], feature_anchor_date)
    else:
        features, reasons, direction = calculate_generic_features(clean, definition["feature_config"], feature_anchor_date)
    derived: dict[str, Any] = {}
    if definition["indicator_id"] == "federal_funds_rate":
        derived, derived_reasons = calculate_fed_change(clean, as_of_date)
        reasons.update(derived_reasons)

    freshness = (as_of_date - latest.observation_date).days
    one_year_received = raw_frame[
        raw_frame.observation_date.notna() & (raw_frame.observation_date >= feature_anchor_date - timedelta(days=365)) & (raw_frame.observation_date <= feature_anchor_date)
    ]
    valid_1y = clean[clean.observation_date >= feature_anchor_date - timedelta(days=365)]
    invalid_count = max(0, len(one_year_received) - int(one_year_received.is_valid.sum()))
    missing_ratio = invalid_count / len(one_year_received) if len(one_year_received) else 0.0
    quality_flags = adapter_flags + sorted(set(reasons.values()))
    if freshness > definition["feature_config"]["stale_after_calendar_days"]:
        status = "stale"; quality_flags.append("stale_data")
    elif reasons:
        status = "insufficient_history"
    else:
        status = "ok"

    unit = definition["data"]["unit"]
    fact_fields = (
        (("current_value_pct", "percent"), ("delta_90d_bp", "bp"), ("zscore_365d", None))
        if is_rate
        else (("current_value", unit), ("delta_90d", unit), ("delta_90d_pct", "percent"), ("zscore_window", None), ("percentile_window", "percentile"))
    )
    facts = [
        {"field": name, "value": features.get(name), "unit": fact_unit, "available": features.get(name) is not None}
        for name, fact_unit in fact_fields
    ]
    facts.append({"field": "quality_status", "value": status, "unit": None, "available": True})
    delta = features.get("delta_90d_bp" if is_rate else "delta_90d")
    delta_text = "unavailable" if delta is None else f"{delta:.4g}"
    lrm = "\u200e"
    rlm = "\u200f"
    summary = (
        f"{rlm}در تاریخ {lrm}{feature_anchor_date.isoformat()}{lrm}، مقدار {lrm}{definition['name_en']}{lrm} "
        f"برابر {lrm}{float(latest.value_pct):.6g} {unit}{lrm} است؛ تغییر آن در افق محاسباتی "
        f"برابر {lrm}{delta_text} {definition['data']['delta_unit']}{lrm} است."
    )
    if status == "stale":
        summary += " داده فعلی قدیمی است و باید با احتیاط استفاده شود."

    snapshot = IndicatorFeatureSnapshot(
        indicator_id=definition["indicator_id"], schema_version=SCHEMA_VERSION, feature_version=FEATURE_VERSION,
        definition_version=definition["definition_version"], as_of_date=as_of_date, calculated_at=calculated_at or datetime.now(UTC), run_id=run_id,
        source={"provider": definition["source"]["provider"], "series_id": definition["source"]["series_id"], "latest_observation_date": latest.observation_date},
        current={"value": float(latest.value_pct), "value_pct": float(latest.value_pct) if is_rate else None, "unit": unit}, features=features, feature_reasons=reasons, derived_features=derived,
        state={"direction_90d": direction, "direction_horizon_days": 90 if 90 in definition["feature_config"]["calendar_offsets_days"] else min(definition["feature_config"]["calendar_offsets_days"], key=lambda days: abs(days - 90)), "materiality_threshold": definition["feature_config"]["trend_threshold_bp"], "materiality_threshold_unit": "bp" if is_rate else unit, "materiality_threshold_bp": definition["feature_config"]["trend_threshold_bp"] if is_rate else None, "state_is_experimental": True},
        quality={"status": status, "freshness_days": freshness, "missing_ratio_1y": missing_ratio, "observation_count_1y": len(valid_1y), "flags": list(dict.fromkeys(quality_flags))},
        semantics=definition["semantics"],
        llm_context={"language": "fa", "facts": facts, "summary_template_fa": summary, "guardrails_fa": ["بین همبستگی و علیت تفاوت بگذار.", "از یک شاخص به تنهایی توصیه سرمایه‌گذاری تولید نکن.", "هر ادعا را به facts موجود محدود کن.", "در صورت stale یا insufficient_history عدم قطعیت را ذکر کن."]},
        provenance={"code_version": code_version, "python_version": platform.python_version(), "config_hash": config_hash(definition), "feature_config_version": definition["feature_config_version"], "feature_config_hash": definition["feature_config_hash"], "observation_anchor_date": feature_anchor_date.isoformat(), "feature_anchor_date": feature_anchor_date.isoformat(), "input_min_date": clean.observation_date.iloc[0].isoformat(), "input_max_date": clean.observation_date.iloc[-1].isoformat(), "received_count": received_count},
    )
    return snapshot, clean
