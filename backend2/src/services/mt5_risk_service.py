"""Read-only net-by-symbol leverage and linear price stress calculations."""

from datetime import datetime, timezone
from decimal import Decimal
from math import fsum, isfinite

from ..models.mt5_schemas import MT5Leverage, MT5RiskAccount, MT5RiskOverview, MT5Snapshot, MT5SymbolRisk
from .broker_comparison_service import _asset_identity


def _number(value):
    if value is None or isinstance(value, bool) or value == "":
        return None
    try:
        result = float(value)
    except (TypeError, ValueError, OverflowError):
        return None
    return result if isfinite(result) else None


def _sum(values):
    values = list(values)
    if any(value is None for value in values):
        return None
    try:
        result = fsum(values)
    except (OverflowError, ValueError):
        return None
    return result if isfinite(result) else None


def _combine_symbols(rows):
    """Net the same underlying across aliases/accounts before taking absolutes."""
    groups = {}
    for row in rows:
        group = groups.setdefault(row.symbol_id, {"label": row.label, "symbols": set(), "nets": []})
        group["symbols"].update(row.symbols)
        group["nets"].append(row.net_exposure_usd)
    combined = []
    for key, group in sorted(groups.items()):
        net = _sum(group["nets"])
        combined.append(MT5SymbolRisk(
            symbol_id=key, label=group["label"], symbols=sorted(group["symbols"]), net_exposure_usd=net,
            reason=("missing_symbol_exposure" if any(value is None for value in group["nets"]) else "invalid_result") if net is None else None,
        ))
    return combined


def _position_net_usd(snapshot, positions, specs):
    """Linear MT5 contracts: net lots * price * (tick value / tick size).

    Tick value is in deposit currency, so this path is limited to USD accounts.
    A common quote makes equal buy/sell quantities cancel before valuation.
    Options, bonds and collateral modes do not use this linear approximation.
    """
    volumes = [_number(item.get("volume")) for item in positions]
    if any(value is None or value <= 0 for value in volumes):
        return None
    # Lot quantities are decimal contract units: 0.1 + 0.2 - 0.3 must be zero.
    lots = _number(sum((Decimal(str(volume)) * (1 if str(item.get("direction")).upper() == "BUY" else -1)
                        for item, volume in zip(positions, volumes)), Decimal(0)))
    if lots == 0:
        return 0.0
    if lots is None or snapshot.account.currency.strip().upper() != "USD" or len(specs) != 1:
        return None
    spec = specs[0]
    mode = spec.get("trade_calculation_mode")
    linear_modes = {0, 1, 2, 3, 4, 5, 32, 33, 36}
    linear_names = {"FOREX", "FOREX_NO_LEVERAGE", "FUTURES", "CFD", "CFDINDEX", "CFDLEVERAGE", "EXCH_STOCKS", "EXCH_FUTURES", "EXCH_STOCKS_MOEX"}
    if _number(mode) not in linear_modes and str(mode).removeprefix("SYMBOL_CALC_MODE_") not in linear_names:
        return None
    tick_size, tick_value = _number(spec.get("tick_size")), _number(spec.get("tick_value"))
    if tick_size is None or tick_value is None or tick_size <= 0 or tick_value <= 0:
        return None
    bid, ask = _number(spec.get("bid")), _number(spec.get("ask"))
    quotes = [value for value in (bid, ask) if value is not None and value > 0]
    if bid is not None and ask is not None and bid > ask:
        return None
    if not quotes:
        quotes = [_number(item.get("current_valuation_price")) for item in positions]
        if any(value is None or value <= 0 for value in quotes):
            return None
    # Divide first so averaging valid large quotes does not overflow.
    price = _sum(value / len(quotes) for value in quotes)
    return _number(lots * price * (tick_value / tick_size)) if price is not None else None


def _symbol_exposures(snapshot):
    positions = {}
    position_rows = {}
    malformed = False
    for position in snapshot.positions:
        symbol = str(position.get("symbol") or "").strip()
        direction = str(position.get("direction") or "").upper()
        volume = _number(position.get("volume"))
        if not symbol or direction not in {"BUY", "SELL"} or volume is None or volume <= 0:
            malformed = True
        positions.setdefault(symbol, set()).add(direction)
        position_rows.setdefault(symbol, []).append(position)
    metrics = {}
    for item in snapshot.symbol_metrics:
        metrics.setdefault(str(item.get("symbol") or "").strip().upper(), []).append(item)
    specs = {}
    for item in snapshot.broker_symbol_data:
        specs.setdefault(str(item.get("symbol") or "").strip().upper(), []).append(item)
    rows = []
    conversion_failed = snapshot.calculation_status.get("active_symbol") == "USD_CONVERSION_UNAVAILABLE"
    declared = _number(snapshot.portfolio_metrics.gross_portfolio_exposure_usd)
    for symbol, directions in positions.items():
        matches = metrics.get(symbol.upper(), [])
        position_net = _position_net_usd(snapshot, position_rows[symbol], specs.get(symbol.upper(), []))
        net = position_net
        if net is None and len(matches) == 1:
            metric = matches[0]
            net = _number(metric.get("net_symbol_exposure_usd"))
            if net is None:
                long = _number(metric.get("long_symbol_notional_usd"))
                short = _number(metric.get("short_symbol_notional_usd"))
                if long is not None and short is not None and long >= 0 and short >= 0:
                    net = _sum([long, -short])
        if net is None and len(positions) == 1:
            net = _number(snapshot.portfolio_metrics.net_portfolio_exposure_usd)
            if net is None and declared is not None and declared >= 0:
                if directions == {"BUY"} and declared > 0:
                    net = declared
                elif directions == {"SELL"} and declared > 0:
                    net = -declared
                elif directions == {"BUY", "SELL"} and declared == 0:
                    net = 0.0
        if net == 0 and len(directions) == 1:
            net = None
        if malformed or (conversion_failed and position_net is None):
            net = None
        key, label = _asset_identity(symbol)
        rows.append(MT5SymbolRisk(
            symbol_id=key or "unknown", label=label, symbols=[symbol or "Unknown"], net_exposure_usd=net,
            reason="missing_symbol_exposure" if net is None else None,
        ))
    return _combine_symbols(rows), malformed, conversion_failed


def _leverage(exposure, equity, source, reason=None):
    result = MT5Leverage(gross_exposure_usd=exposure, equity_usd=equity, exposure_source=source)
    if equity is None:
        result.reason = reason or "missing_equity"
    elif equity <= 0:
        result.reason = "non_positive_equity"
    elif reason or exposure is None:
        result.reason = reason or "missing_exposure"
    else:
        result.value = _number(exposure / equity)
        if result.value is None:
            result.reason = "invalid_result"
    return result


def _symbol_stress(row, equity):
    """Move only this symbol; E'=E(1+r), equity'=equity+E*r.

    Solve abs(E')/equity'=10 with positive price and equity. Other symbols,
    quantities, FX rates and trading costs are held constant. This is a linear
    scenario, not an MT5 stop-out forecast or an order execution price.
    """
    result = row.model_copy(deep=True)
    net = row.net_exposure_usd
    if net is None or equity is None or equity <= 0:
        result.target_reason = row.reason or ("missing_equity" if equity is None else "non_positive_equity")
        return result
    result.leverage = _number(abs(net) / equity)
    if result.leverage is None:
        result.target_reason = "invalid_result"
        return result
    if net == 0:
        result.target_reason = "net_zero"
        return result
    if result.leverage == 0:
        result.target_reason = "invalid_result"
        return result
    result.adverse_direction = "fall" if net > 0 else "rise"
    if result.leverage >= result.target_leverage:
        result.adverse_move_pct = 0
        result.target_reason = "already_at_target"
        return result
    if net > 0 and result.leverage <= 1:
        result.target_reason = "no_positive_price_solution"
        return result
    denominator = result.target_leverage - (1 if net > 0 else -1)
    move = _number((result.target_leverage / result.leverage - 1) / denominator)
    if move is None or not isfinite(move * 100):
        result.target_reason = "invalid_result"
    else:
        result.adverse_move_pct = move * 100
    return result


def _account_calculations(snapshot):
    rows, malformed, conversion_failed = _symbol_exposures(snapshot)
    equity = _number(snapshot.account.equity) if snapshot.account.currency.strip().upper() == "USD" else None
    declared = _number(snapshot.portfolio_metrics.gross_portfolio_exposure_usd)
    source, reason = "symbol_net", None
    exposure = _sum(abs(row.net_exposure_usd) if row.net_exposure_usd is not None else None for row in rows)
    if not snapshot.positions:
        source = "no_positions"
        if declared not in (None, 0):
            exposure, reason = None, "inconsistent_positions"
    elif malformed:
        exposure, reason = None, "incomplete_positions"
    elif conversion_failed and exposure is None:
        exposure, reason = None, "missing_exposure"
    elif any(row.reason == "invalid_result" for row in rows) or (exposure is None and all(row.net_exposure_usd is not None for row in rows)):
        reason = "invalid_result"
    elif exposure is None:
        # Legacy portfolio exposure already uses sum(abs(net per symbol)). It
        # can serve one account, but cannot supply cross-account symbol netting.
        if declared is not None and declared > 0:
            exposure, source = declared, "portfolio_exposure"
        else:
            reason = "missing_exposure"
    if snapshot.account.currency.strip().upper() != "USD":
        reason = "unsupported_currency"
    leverage = _leverage(exposure, equity, source, reason)
    return leverage, [_symbol_stress(row, equity) for row in rows]


def account_leverage(snapshot: MT5Snapshot) -> MT5Leverage:
    return _account_calculations(snapshot)[0]


def build_risk_overview(snapshots: list[MT5Snapshot]) -> MT5RiskOverview:
    accounts = []
    for snapshot in snapshots:
        leverage, rows = _account_calculations(snapshot)
        accounts.append(MT5RiskAccount.model_validate({
            **snapshot.model_dump(mode="python"), "leverage": leverage, "symbol_risks": rows,
        }))
    rows = _combine_symbols(row for account in accounts for row in account.symbol_risks)
    equity = _sum(account.leverage.equity_usd for account in accounts) if accounts else None
    exposure = _sum(abs(row.net_exposure_usd) if row.net_exposure_usd is not None else None for row in rows)
    reason = None
    if not accounts:
        reason = "no_accounts"
    elif any(row.reason == "invalid_result" for row in rows) or (equity is None and all(account.leverage.equity_usd is not None for account in accounts)):
        reason = "invalid_result"
    elif any(account.leverage.equity_usd is None or account.leverage.gross_exposure_usd is None for account in accounts) or exposure is None:
        reason = "incomplete_accounts"
    if reason:
        exposure = None
    leverage = _leverage(exposure, equity, "aggregate", reason)
    return MT5RiskOverview(
        generated_at_utc=datetime.now(timezone.utc), accounts=accounts, leverage=leverage,
        symbol_risks=[_symbol_stress(row, equity) for row in rows],
    )
