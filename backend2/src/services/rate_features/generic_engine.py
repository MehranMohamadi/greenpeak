"""Deterministic features for non-rate single-series indicators."""

from __future__ import annotations

from datetime import date, timedelta

import numpy as np
import pandas as pd


def _prior(frame: pd.DataFrame, target: date):
    candidates = frame[frame.observation_date <= target]
    return None if candidates.empty else candidates.iloc[-1]


def calculate_generic_features(
    frame: pd.DataFrame, config: dict, anchor_date: date
) -> tuple[dict[str, float | None], dict[str, str], str]:
    """Calculate unit-aware level features without assuming values are rates."""
    features: dict[str, float | None] = {}
    reasons: dict[str, str] = {}
    current = float(frame.iloc[-1].value_pct)
    features["current_value"] = current

    for days in config["calendar_offsets_days"]:
        prior = _prior(frame, anchor_date - timedelta(days=days))
        absolute_name = f"delta_{days}d"
        percent_name = f"delta_{days}d_pct"
        if prior is None:
            features[absolute_name] = features[percent_name] = None
            reasons[absolute_name] = reasons[percent_name] = "insufficient_history"
            continue
        previous = float(prior.value_pct)
        features[absolute_name] = current - previous
        if previous == 0:
            features[percent_name] = None
            reasons[percent_name] = "zero_denominator"
        else:
            features[percent_name] = (current / previous - 1) * 100

    z_days = int(config["zscore_window_days"])
    z_values = frame[frame.observation_date >= anchor_date - timedelta(days=z_days)].value_pct.astype(float)
    minimum = config["minimum_observation_counts"]
    z_minimum = int(minimum.get("zscore", minimum.get("zscore_365d", 2)))
    if len(z_values) < z_minimum:
        features["zscore_window"] = None
        reasons["zscore_window"] = "insufficient_history"
    else:
        std = float(z_values.std(ddof=0))
        if std == 0:
            features["zscore_window"] = None
            reasons["zscore_window"] = "zero_variance"
        else:
            features["zscore_window"] = (current - float(z_values.mean())) / std

    if z_values.empty:
        features["mean_window"] = features["median_window"] = None
        features["distance_to_mean_window"] = features["distance_to_median_window"] = None
        reasons["mean_window"] = reasons["median_window"] = "insufficient_history"
    else:
        features["mean_window"] = float(z_values.mean())
        features["median_window"] = float(z_values.median())
        features["distance_to_mean_window"] = current - features["mean_window"]
        features["distance_to_median_window"] = current - features["median_window"]

    percentile_days = int(config["percentile_window_days"])
    population = frame[frame.observation_date >= anchor_date - timedelta(days=percentile_days)].value_pct.astype(float)
    percentile_minimum = int(minimum.get("percentile", minimum.get("percentile_5y", 2)))
    if len(population) < percentile_minimum:
        features["percentile_window"] = None
        reasons["percentile_window"] = "insufficient_history"
    else:
        below = int((population < current).sum())
        equal = int((population == current).sum())
        features["percentile_window"] = (below + 0.5 * equal) / len(population) * 100

    slope_days = int(config["slope_window_days"])
    slope_frame = frame[frame.observation_date >= anchor_date - timedelta(days=slope_days)]
    slope_minimum = int(minimum.get("slope", minimum.get("slope_90d", 2)))
    if len(slope_frame) < slope_minimum:
        features["slope_per_30d"] = None
        reasons["slope_per_30d"] = "insufficient_history"
    else:
        x = np.array([(item - slope_frame.observation_date.iloc[0]).days for item in slope_frame.observation_date], dtype=float)
        if np.ptp(x) == 0:
            features["slope_per_30d"] = None
            reasons["slope_per_30d"] = "zero_time_span"
        else:
            features["slope_per_30d"] = float(np.polyfit(x, slope_frame.value_pct.astype(float), 1)[0] * 30)

    volatility_days = int(config["volatility_window_days"])
    volatility_values = frame[frame.observation_date >= anchor_date - timedelta(days=volatility_days)].value_pct.astype(float)
    volatility_minimum = int(minimum.get("volatility", minimum.get("volatility_90d", 2)))
    if len(volatility_values) < volatility_minimum:
        features["change_volatility_window"] = None
        reasons["change_volatility_window"] = "insufficient_history"
    else:
        features["change_volatility_window"] = float(volatility_values.diff().dropna().std(ddof=0))

    features["observation_count_window"] = float(len(z_values))
    threshold = float(config["trend_threshold_bp"])
    direction_delta = next(
        (features.get(f"delta_{days}d") for days in (90, 180, 365) if f"delta_{days}d" in features),
        None,
    )
    if direction_delta is None:
        direction = "unknown"
    elif direction_delta > threshold:
        direction = "rising"
    elif direction_delta < -threshold:
        direction = "falling"
    else:
        direction = "stable"
    return features, reasons, direction
