"""Privacy-preserving broker cost comparison built from current MT5 snapshots."""

from collections import Counter, defaultdict
from datetime import datetime, timezone
from hashlib import sha256
from statistics import median
from typing import Any, Iterable

from .mt5_snapshot_service import MT5SnapshotService


MAX_DYNAMIC_SYMBOLS = 12

ASSET_LABELS = {
    "sp500": "S&P 500",
    "gold": "Gold",
    "eurusd": "EUR/USD",
    "bitcoin": "Bitcoin",
    "ethereum": "Ethereum",
}
ASSET_PRIORITY = {key: index for index, key in enumerate(ASSET_LABELS)}
COMMON_SYMBOLS = (
    "GBPUSD",
    "USDJPY",
    "AUDUSD",
    "USDCHF",
    "USDCAD",
    "NZDUSD",
    "EURJPY",
    "GBPJPY",
    "NASDAQ",
    "NAS100",
    "US30",
    "DAX40",
    "UK100",
    "WTI",
    "BRENT",
    "XAGUSD",
)


def _number(value: Any) -> float | None:
    if value is None or value == "" or isinstance(value, bool):
        return None
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    return parsed if parsed == parsed and parsed not in (float("inf"), float("-inf")) else None


def _median(values: Iterable[float | None]) -> float | None:
    clean = [value for value in values if value is not None]
    return float(median(clean)) if clean else None


def _normalized_symbol(symbol: Any) -> str:
    return "".join(character for character in str(symbol or "").upper() if character.isalnum())


def _asset_identity(symbol: Any) -> tuple[str, str]:
    normalized = _normalized_symbol(symbol)
    if not normalized:
        return "", "Unknown"
    if "XAUUSD" in normalized or "GOLD" in normalized:
        return "gold", ASSET_LABELS["gold"]
    if normalized == "SPX" or any(alias in normalized for alias in ("US500", "SP500", "SPX500", "USA500", "SANDP500")):
        return "sp500", ASSET_LABELS["sp500"]
    if "EURUSD" in normalized:
        return "eurusd", ASSET_LABELS["eurusd"]
    if any(alias in normalized for alias in ("BTCUSD", "XBTUSD", "BTCEUR", "BITCOIN")):
        return "bitcoin", ASSET_LABELS["bitcoin"]
    if any(alias in normalized for alias in ("ETHUSD", "ETHEUR", "ETHEREUM")):
        return "ethereum", ASSET_LABELS["ethereum"]
    for common in COMMON_SYMBOLS:
        if common in normalized:
            return common.lower(), common
    return normalized.lower(), str(symbol or normalized)


def _broker_key(name: str) -> str:
    return sha256(name.casefold().encode("utf-8")).hexdigest()[:12]


def _broker_identity(snapshot: dict[str, Any]) -> str:
    name = str(snapshot.get("source", {}).get("broker_company") or "").strip()
    return " ".join(name.casefold().split())


def _commission_samples(snapshot: dict[str, Any], field: str) -> list[float]:
    samples: list[float] = []
    aliases = {
        "commission": ("commission",),
        "dividend": ("dividend_adjustment", "dividend", "cash_dividend"),
    }
    for deal in snapshot.get("trade_history_delta") or []:
        volume = _number(deal.get("volume"))
        if volume is None or volume <= 0:
            continue
        value = next((_number(deal.get(key)) for key in aliases[field] if deal.get(key) is not None), None)
        if value is not None:
            samples.append(abs(value) / volume if field == "commission" else value / volume)
    return samples


def _account_symbol_rows(snapshot: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """Collapse broker-specific duplicate aliases to one observation per account/asset."""
    risk_by_symbol = {
        _normalized_symbol(item.get("symbol")): item
        for item in snapshot.get("symbol_metrics") or []
        if item.get("symbol")
    }
    buckets: dict[str, dict[str, Any]] = defaultdict(
        lambda: {
            "labels": [],
            "spread_points": [],
            "spread_bps": [],
            "swap_long_raw": [],
            "swap_short_raw": [],
            "swap_long_annualized_pct": [],
            "swap_short_annualized_pct": [],
            "swap_modes": [],
        }
    )
    for item in snapshot.get("broker_symbol_data") or []:
        key, label = _asset_identity(item.get("symbol"))
        if not key:
            continue
        bucket = buckets[key]
        bucket["labels"].append(label)
        for field in ("spread_points", "swap_long_raw", "swap_short_raw"):
            value = _number(item.get(field))
            if value is not None:
                bucket[field].append(value)
        bid, ask = _number(item.get("bid")), _number(item.get("ask"))
        if bid is not None and ask is not None and bid > 0 and ask >= bid:
            midpoint = (bid + ask) / 2
            bucket["spread_bps"].append((ask - bid) / midpoint * 10_000)
        mode = item.get("swap_mode")
        if _number(mode) is not None:
            bucket["swap_modes"].append(int(float(mode)))
        risk = risk_by_symbol.get(_normalized_symbol(item.get("symbol")), {})
        for target, candidates in (
            ("swap_long_annualized_pct", ("annualized_long_swap_rate_pct", "swap_long_annualized_pct")),
            ("swap_short_annualized_pct", ("annualized_short_swap_rate_pct", "swap_short_annualized_pct")),
        ):
            value = next(
                (_number(source.get(candidate)) for source in (item, risk) for candidate in candidates if source.get(candidate) is not None),
                None,
            )
            if value is not None:
                bucket[target].append(value)

    result: dict[str, dict[str, Any]] = {}
    for key, bucket in buckets.items():
        modes = set(bucket["swap_modes"])
        result[key] = {
            "asset_key": key,
            "asset_label": ASSET_LABELS.get(key) or Counter(bucket["labels"]).most_common(1)[0][0],
            "spread_points": _median(bucket["spread_points"]),
            "spread_bps": _median(bucket["spread_bps"]),
            "swap_long_raw": _median(bucket["swap_long_raw"]),
            "swap_short_raw": _median(bucket["swap_short_raw"]),
            "swap_long_annualized_pct": _median(bucket["swap_long_annualized_pct"]),
            "swap_short_annualized_pct": _median(bucket["swap_short_annualized_pct"]),
            "swap_mode": next(iter(modes)) if len(modes) == 1 else None,
            "swap_mode_mixed": len(modes) > 1,
        }
    return result


def aggregate_broker_comparison(
    snapshots: list[dict[str, Any]],
) -> dict[str, Any]:
    """Aggregate all current broker account snapshots without exposing identifiers."""
    groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for snapshot in snapshots:
        owner = str(snapshot.get("owner_user_id") or "").strip()
        broker = _broker_identity(snapshot)
        if owner and broker:
            groups[broker].append(snapshot)

    eligible = groups
    coverage: Counter[str] = Counter()
    for items in eligible.values():
        seen: set[str] = set()
        for snapshot in items:
            seen.update(_account_symbol_rows(snapshot))
        coverage.update(seen)
    fixed = set(ASSET_LABELS)
    dynamic = sorted(
        (key for key in coverage if key not in fixed),
        key=lambda key: (-coverage[key], key),
    )[:MAX_DYNAMIC_SYMBOLS]
    included_assets = fixed | set(dynamic)

    brokers: list[dict[str, Any]] = []
    for normalized_name, items in eligible.items():
        display_names = [str(item["source"]["broker_company"]).strip() for item in items]
        owners = {str(item["owner_user_id"]) for item in items}
        currencies = Counter(str(item.get("account", {}).get("currency") or "").upper() for item in items)
        currencies.pop("", None)
        account_currency = currencies.most_common(1)[0][0] if currencies else None
        currency_items = [item for item in items if str(item.get("account", {}).get("currency") or "").upper() == account_currency]

        symbols_by_key: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for snapshot in items:
            for key, row in _account_symbol_rows(snapshot).items():
                if key in included_assets:
                    symbols_by_key[key].append(row)

        symbols = []
        for key, rows in symbols_by_key.items():
            modes = {row["swap_mode"] for row in rows if row["swap_mode"] is not None}
            mixed_mode = any(row["swap_mode_mixed"] for row in rows) or len(modes) > 1
            symbols.append({
                "asset_key": key,
                "asset_label": ASSET_LABELS.get(key) or Counter(row["asset_label"] for row in rows).most_common(1)[0][0],
                "sample_accounts": len(rows),
                "spread_points_median": _median(row["spread_points"] for row in rows),
                "spread_bps_median": _median(row["spread_bps"] for row in rows),
                "swap_long_raw_median": None if mixed_mode else _median(row["swap_long_raw"] for row in rows),
                "swap_short_raw_median": None if mixed_mode else _median(row["swap_short_raw"] for row in rows),
                "swap_long_annualized_pct_median": _median(row["swap_long_annualized_pct"] for row in rows),
                "swap_short_annualized_pct_median": _median(row["swap_short_annualized_pct"] for row in rows),
                "swap_mode": None if mixed_mode or not modes else next(iter(modes)),
                "swap_mode_mixed": mixed_mode,
            })
        symbols.sort(key=lambda row: (ASSET_PRIORITY.get(row["asset_key"], 100), row["asset_label"]))

        commission = [sample for item in currency_items for sample in _commission_samples(item, "commission")]
        dividend = [sample for item in currency_items for sample in _commission_samples(item, "dividend")]
        timestamps = [item.get("timestamp_utc") for item in items if isinstance(item.get("timestamp_utc"), datetime)]
        broker_name = Counter(display_names).most_common(1)[0][0]
        brokers.append({
            "broker_key": _broker_key(normalized_name),
            "broker_name": broker_name,
            "sample_users": len(owners),
            "sample_accounts": len(items),
            "latest_observation_utc": max(timestamps) if timestamps else None,
            "account_currency": account_currency,
            "commission_per_lot_median": _median(commission),
            "commission_sample_deals": len(commission),
            "dividend_per_lot_median": _median(dividend),
            "dividend_sample_records": len(dividend),
            "symbols": symbols,
        })
    brokers.sort(key=lambda broker: (-broker["sample_accounts"], broker["broker_name"].casefold()))

    return {
        "generated_at_utc": datetime.now(timezone.utc),
        "privacy": {"identifiers_included": False},
        "eligible_broker_count": len(brokers),
        "excluded_broker_count": len(groups) - len(eligible),
        "brokers": brokers,
    }


class BrokerComparisonService:
    def __init__(self, snapshots: MT5SnapshotService | None = None):
        self.snapshots = snapshots or MT5SnapshotService()

    def comparison(self) -> dict[str, Any]:
        return aggregate_broker_comparison(self.snapshots.latest_accounts_for_aggregation())
