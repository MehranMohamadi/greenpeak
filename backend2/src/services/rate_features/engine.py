"""Deterministic feature calculations for percent-valued rate series."""

from datetime import date, timedelta
from typing import Any

import numpy as np
import pandas as pd


def _window(frame: pd.DataFrame, as_of: date, days: int) -> pd.DataFrame:
    return frame[(frame.observation_date >= as_of - timedelta(days=days)) & (frame.observation_date <= as_of)]


def _lookup(frame: pd.DataFrame, target: date) -> pd.Series | None:
    eligible = frame[frame.observation_date <= target]
    return None if eligible.empty else eligible.iloc[-1]


def calculate_rate_features(frame: pd.DataFrame, config: dict, as_of_date: date) -> tuple[dict[str, float | None], dict[str, str], str]:
    features: dict[str, float | None] = {}
    reasons: dict[str, str] = {}
    current = _lookup(frame, as_of_date)
    names = ["current_value_pct"] + [f"delta_{days}d_bp" for days in config["calendar_offsets_days"]]
    names += ["mean_30d_pct", "mean_90d_pct", "mean_365d_pct", "distance_to_mean_365d_bp", "zscore_365d", "percentile_5y", "slope_90d_bp_per_30d", "volatility_90d_bp"]
    if current is None:
        return {name: None for name in names}, {name: "no_valid_current_value" for name in names}, "unknown"
    current_value = float(current.value_pct)
    features["current_value_pct"] = current_value
    for days in config["calendar_offsets_days"]:
        name = f"delta_{days}d_bp"
        prior = _lookup(frame, as_of_date - timedelta(days=days))
        if prior is None:
            features[name], reasons[name] = None, "insufficient_history"
        else:
            features[name] = (current_value - float(prior.value_pct)) * 100

    minimums = config["minimum_observation_counts"]
    for days in (30, 90, 365):
        name = f"mean_{days}d_pct"
        values = _window(frame, as_of_date, days).value_pct.astype(float)
        if len(values) < minimums[name.replace("_pct", "")]:
            features[name], reasons[name] = None, "insufficient_history"
        else:
            features[name] = float(values.mean())
    mean_365 = features["mean_365d_pct"]
    if mean_365 is None:
        features["distance_to_mean_365d_bp"] = None
        reasons["distance_to_mean_365d_bp"] = "insufficient_history"
    else:
        features["distance_to_mean_365d_bp"] = (current_value - mean_365) * 100

    yearly = _window(frame, as_of_date, config["zscore_window_days"]).value_pct.astype(float)
    if len(yearly) < minimums["zscore_365d"]:
        features["zscore_365d"], reasons["zscore_365d"] = None, "insufficient_history"
    else:
        standard_deviation = float(yearly.std(ddof=0))
        if standard_deviation == 0:
            features["zscore_365d"], reasons["zscore_365d"] = None, "zero_variance"
        else:
            features["zscore_365d"] = (current_value - float(yearly.mean())) / standard_deviation

    five_year = _window(frame, as_of_date, config["percentile_window_days"]).value_pct.astype(float)
    if len(five_year) < minimums["percentile_5y"]:
        features["percentile_5y"], reasons["percentile_5y"] = None, "insufficient_history"
    else:
        below = float((five_year < current_value).sum())
        equal = float((five_year == current_value).sum())
        features["percentile_5y"] = ((below + 0.5 * equal) / len(five_year)) * 100

    slope_frame = _window(frame, as_of_date, config["slope_window_days"])
    if len(slope_frame) < minimums["slope_90d"]:
        features["slope_90d_bp_per_30d"], reasons["slope_90d_bp_per_30d"] = None, "insufficient_history"
    else:
        origin = slope_frame.observation_date.iloc[0]
        x = np.array([(item - origin).days for item in slope_frame.observation_date], dtype=float)
        features["slope_90d_bp_per_30d"] = float(np.polyfit(x, slope_frame.value_pct.astype(float), 1)[0] * 30 * 100)

    volatility = _window(frame, as_of_date, config["volatility_window_days"]).value_pct.astype(float)
    if len(volatility) < minimums["volatility_90d"]:
        features["volatility_90d_bp"], reasons["volatility_90d_bp"] = None, "insufficient_history"
    else:
        features["volatility_90d_bp"] = float(volatility.diff().dropna().std(ddof=0) * 100)

    delta_90 = features.get("delta_90d_bp")
    threshold = config["trend_threshold_bp"]
    direction = "unknown" if delta_90 is None else "rising" if delta_90 > threshold else "falling" if delta_90 < -threshold else "stable"
    return features, reasons, direction


def calculate_fed_change(frame: pd.DataFrame, as_of_date: date) -> tuple[dict[str, Any], dict[str, str]]:
    eligible = frame[frame.observation_date <= as_of_date]
    changes = eligible.value_pct.astype(float).diff()
    positions = np.flatnonzero(changes.to_numpy() != 0)
    positions = positions[positions > 0]
    if not len(positions):
        return {"last_change_date": None, "last_change_bp": None, "days_since_last_change": None}, {"last_change_date": "no_change_found"}
    index = int(positions[-1]); changed = eligible.iloc[index]
    change_date = changed.observation_date
    return {"last_change_date": change_date.isoformat(), "last_change_bp": float(changes.iloc[index] * 100), "days_since_last_change": (as_of_date - change_date).days}, {}


def calculate_pair_features(ten_year: pd.DataFrame, fed_funds: pd.DataFrame, as_of_date: date) -> tuple[dict[str, Any], dict[str, str]]:
    left = ten_year[["observation_date", "value_pct"]].rename(columns={"value_pct": "ten_year"})
    right = fed_funds[["observation_date", "value_pct"]].rename(columns={"value_pct": "fed_funds"})
    common = left.merge(right, on="observation_date").sort_values("observation_date")
    current = _lookup(common, as_of_date)
    if current is None:
        return {"spread_to_fed_funds_bp": None, "spread_delta_90d_bp": None, "spread_common_date": None, "spread_prior_common_date": None}, {"spread_to_fed_funds_bp": "no_common_date", "spread_delta_90d_bp": "no_common_date"}
    current_spread = (float(current.ten_year) - float(current.fed_funds)) * 100
    prior = _lookup(common, current.observation_date - timedelta(days=90))
    result = {"spread_to_fed_funds_bp": current_spread, "spread_common_date": current.observation_date.isoformat(), "spread_prior_common_date": None, "spread_delta_90d_bp": None}
    reasons = {}
    if prior is None:
        reasons["spread_delta_90d_bp"] = "insufficient_history"
    else:
        prior_spread = (float(prior.ten_year) - float(prior.fed_funds)) * 100
        result.update(spread_delta_90d_bp=current_spread - prior_spread, spread_prior_common_date=prior.observation_date.isoformat())
    return result, reasons
