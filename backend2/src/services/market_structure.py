"""Verified source adapters and calculations for Group 6 market structure.

The service keeps current constituent/sector weights separate from historical
adjusted-price comparisons.  Current SPY weights come from State Street.  ETF
comparison series use Yahoo Finance adjusted close values through the same
provider family already used by the sector-performance ETL.
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import UTC, date, datetime, timedelta
from html import unescape
from io import BytesIO, StringIO
import json
import math
from pathlib import Path
import re
import time
from typing import Any, Callable
from zipfile import ZipFile
import xml.etree.ElementTree as ET

import pandas as pd
import requests

from ..core.config import get_settings
from ..models.schemas import MarketStructureResponse


OWNER_GROUP = "market_internals_sectors"
DATA_VERSION = "1.0"
CACHE_TTL = timedelta(hours=12)
PRICE_HISTORY_START = int(datetime(1993, 1, 1, tzinfo=UTC).timestamp())

STATE_STREET_PROFILE_URL = (
    "https://www.ssga.com/us/en/intermediary/etfs/"
    "state-street-spdr-sp-500-etf-trust-spy"
)
STATE_STREET_HOLDINGS_URL = (
    "https://www.ssga.com/library-content/products/fund-data/etfs/us/"
    "holdings-daily-us-en-spy.xlsx"
)
YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"

SECTOR_ETFS = {
    "communication_services": ("Communication Services", "XLC"),
    "consumer_discretionary": ("Consumer Discretionary", "XLY"),
    "consumer_staples": ("Consumer Staples", "XLP"),
    "energy": ("Energy", "XLE"),
    "financials": ("Financials", "XLF"),
    "healthcare": ("Health Care", "XLV"),
    "industrials": ("Industrials", "XLI"),
    "materials": ("Materials", "XLB"),
    "real_estate": ("Real Estate", "XLRE"),
    "technology": ("Technology", "XLK"),
    "utilities": ("Utilities", "XLU"),
}
STYLE_PAIRS = {
    "growth_value": (("S&P 500 Growth", "IVW"), ("S&P 500 Value", "IVE")),
    "large_small": (("S&P 500", "SPY"), ("S&P SmallCap 600", "IJR")),
}
CYCLICAL_SYMBOLS = ["XLY", "XLI", "XLF", "XLB", "XLE"]
DEFENSIVE_SYMBOLS = ["XLP", "XLV", "XLU"]
REQUIRED_SYMBOLS = sorted(
    {
        "SPY",
        "RSP",
        "IVW",
        "IVE",
        "IJR",
        *CYCLICAL_SYMBOLS,
        *DEFENSIVE_SYMBOLS,
        *(symbol for _, symbol in SECTOR_ETFS.values()),
    }
)
VALID_PERIODS = {"1Y", "3Y", "5Y", "10Y", "MAX"}
HEATMAP_PERIODS = ("1W", "1M", "3M", "YTD", "1Y")

_XLSX_NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


class MarketStructureSourceUnavailable(RuntimeError):
    """Raised when verified upstream data cannot be assembled."""


def _number(value: Any) -> float | None:
    if value is None or str(value).strip() == "":
        return None
    try:
        parsed = float(str(value).replace(",", "").replace("%", "").strip())
        return parsed if math.isfinite(parsed) else None
    except (TypeError, ValueError):
        return None


def _point(day: str, value: float) -> dict[str, Any]:
    timestamp = int(datetime.fromisoformat(day).replace(tzinfo=UTC).timestamp())
    return {"time": timestamp, "date": day, "value": value}


def _column_index(reference: str) -> int:
    letters = re.match(r"[A-Z]+", reference.upper())
    if not letters:
        return 0
    result = 0
    for letter in letters.group(0):
        result = result * 26 + ord(letter) - 64
    return result - 1


def _xlsx_rows(content: bytes) -> list[list[str]]:
    """Read simple XLSX cell values with stdlib only.

    State Street's daily holdings workbook uses a single worksheet and shared
    strings.  Supporting numeric and inline-string cells keeps the adapter
    resilient without adding an Excel dependency to the API runtime.
    """

    with ZipFile(BytesIO(content)) as workbook:
        shared: list[str] = []
        if "xl/sharedStrings.xml" in workbook.namelist():
            shared_root = ET.fromstring(workbook.read("xl/sharedStrings.xml"))
            shared = [
                "".join(node.text or "" for node in item.findall(".//m:t", _XLSX_NS))
                for item in shared_root.findall("m:si", _XLSX_NS)
            ]
        sheet = ET.fromstring(workbook.read("xl/worksheets/sheet1.xml"))
        rows: list[list[str]] = []
        for row in sheet.findall(".//m:row", _XLSX_NS):
            values: list[str] = []
            for cell in row.findall("m:c", _XLSX_NS):
                index = _column_index(cell.get("r", "A1"))
                while len(values) <= index:
                    values.append("")
                kind = cell.get("t")
                value_node = cell.find("m:v", _XLSX_NS)
                if kind == "inlineStr":
                    value = "".join(
                        node.text or "" for node in cell.findall(".//m:t", _XLSX_NS)
                    )
                elif value_node is None:
                    value = ""
                elif kind == "s":
                    shared_index = int(value_node.text or "0")
                    value = shared[shared_index] if shared_index < len(shared) else ""
                else:
                    value = value_node.text or ""
                values[index] = value.strip()
            rows.append(values)
        return rows


def parse_spy_holdings_xlsx(content: bytes) -> tuple[list[dict[str, Any]], str]:
    """Return ranked SPY holdings and the workbook observation date."""

    rows = _xlsx_rows(content)
    observation_date = None
    for row in rows:
        if row and row[0].strip().lower() == "holdings:" and len(row) > 1:
            raw = re.sub(r"^as of\s+", "", row[1], flags=re.IGNORECASE)
            try:
                observation_date = datetime.strptime(raw, "%d-%b-%Y").date().isoformat()
            except ValueError:
                observation_date = None
            break

    header_index = next(
        (
            index
            for index, row in enumerate(rows)
            if {"Name", "Ticker", "Weight"}.issubset(set(row))
        ),
        None,
    )
    if header_index is None or observation_date is None:
        raise MarketStructureSourceUnavailable("invalid State Street holdings workbook")

    header = rows[header_index]
    name_index, ticker_index, weight_index = (
        header.index("Name"),
        header.index("Ticker"),
        header.index("Weight"),
    )
    holdings: list[dict[str, Any]] = []
    for row in rows[header_index + 1 :]:
        if max(name_index, ticker_index, weight_index) >= len(row):
            continue
        name, symbol, weight = row[name_index], row[ticker_index], _number(row[weight_index])
        if not name or not symbol or weight is None or weight <= 0:
            continue
        holdings.append({"symbol": symbol, "name": name, "weight_pct": weight})

    holdings.sort(key=lambda item: item["weight_pct"], reverse=True)
    if len(holdings) < 10:
        raise MarketStructureSourceUnavailable("State Street holdings workbook returned fewer than 10 holdings")
    for rank, holding in enumerate(holdings, start=1):
        holding["rank"] = rank
    return holdings, observation_date


def parse_spy_sector_html(html_text: str) -> tuple[list[dict[str, Any]], str]:
    """Parse the current State Street fund-sector table and observation date."""

    tables = pd.read_html(StringIO(html_text))
    sectors: list[dict[str, Any]] | None = None
    for table in tables:
        normalized = {str(column).strip().lower(): column for column in table.columns}
        if "sector" not in normalized or "weight" not in normalized or len(table) < 10:
            continue
        parsed = []
        for _, row in table.iterrows():
            sector = str(row[normalized["sector"]]).strip()
            weight = _number(row[normalized["weight"]])
            if sector and sector.lower() != "nan" and weight is not None:
                parsed.append({"sector": sector, "weight_pct": weight})
        if len(parsed) >= 11:
            sectors = parsed
            break

    plain_text = " ".join(unescape(re.sub(r"<[^>]+>", " ", html_text)).split())
    match = re.search(
        r"Fund Sector Breakdown as of ([A-Z][a-z]{2} \d{1,2} \d{4})",
        plain_text,
    )
    if sectors is None or match is None:
        raise MarketStructureSourceUnavailable("invalid State Street sector table")
    observation_date = datetime.strptime(match.group(1), "%b %d %Y").date().isoformat()
    return sectors, observation_date


def parse_yahoo_adjusted_chart(payload: dict[str, Any], symbol: str) -> list[dict[str, Any]]:
    """Normalize Yahoo adjusted-close observations without raw-close fallback."""

    chart = payload.get("chart") if isinstance(payload, dict) else None
    results = chart.get("result") if isinstance(chart, dict) else None
    if not results or chart.get("error"):
        raise MarketStructureSourceUnavailable(f"adjusted history unavailable for {symbol}")
    result = results[0]
    timestamps = result.get("timestamp") or []
    indicators = result.get("indicators") or {}
    adjusted_sets = indicators.get("adjclose") or []
    adjusted = adjusted_sets[0].get("adjclose") if adjusted_sets else None
    if not isinstance(adjusted, list):
        raise MarketStructureSourceUnavailable(f"adjusted close missing for {symbol}")

    by_date: dict[str, float] = {}
    for timestamp, value in zip(timestamps, adjusted):
        numeric = _number(value)
        if numeric is None or numeric <= 0:
            continue
        day = datetime.fromtimestamp(int(timestamp), UTC).date().isoformat()
        by_date[day] = numeric
    if len(by_date) < 2:
        raise MarketStructureSourceUnavailable(f"insufficient adjusted history for {symbol}")
    return [_point(day, value) for day, value in sorted(by_date.items())]


def _price_map(points: list[dict[str, Any]]) -> dict[str, float]:
    return {item["date"]: float(item["value"]) for item in points}


def _subtract_years(day: date, years: int) -> date:
    try:
        return day.replace(year=day.year - years)
    except ValueError:
        return day.replace(year=day.year - years, day=28)


def _period_dates(series: list[dict[str, float]], period: str) -> list[str]:
    if not series:
        return []
    common = sorted(set.intersection(*(set(item) for item in series)))
    if len(common) < 2 or period == "MAX":
        return common
    latest = date.fromisoformat(common[-1])
    target = _subtract_years(latest, int(period[:-1]))
    return [day for day in common if day >= target.isoformat()]


def _normalized_series(
    prices: dict[str, list[dict[str, Any]]],
    labeled_symbols: list[tuple[str, str]],
    period: str,
) -> tuple[list[dict[str, Any]], str | None]:
    maps = [_price_map(prices.get(symbol, [])) for _, symbol in labeled_symbols]
    dates = _period_dates(maps, period)
    if len(dates) < 2:
        return [], None
    result = []
    for (label, symbol), values in zip(labeled_symbols, maps):
        base = values[dates[0]]
        result.append(
            {
                "label": label,
                "symbol": symbol,
                "data": [_point(day, values[day] / base * 100) for day in dates],
            }
        )
    return result, dates[-1]


def _basket_series(
    prices: dict[str, list[dict[str, Any]]],
    period: str,
) -> tuple[list[dict[str, Any]], str | None]:
    symbols = [*CYCLICAL_SYMBOLS, *DEFENSIVE_SYMBOLS]
    maps = {symbol: _price_map(prices.get(symbol, [])) for symbol in symbols}
    dates = _period_dates(list(maps.values()), period)
    if len(dates) < 2:
        return [], None

    normalized = {
        symbol: {day: values[day] / values[dates[0]] * 100 for day in dates}
        for symbol, values in maps.items()
    }
    cyclical = [
        _point(day, sum(normalized[symbol][day] for symbol in CYCLICAL_SYMBOLS) / len(CYCLICAL_SYMBOLS))
        for day in dates
    ]
    defensive = [
        _point(day, sum(normalized[symbol][day] for symbol in DEFENSIVE_SYMBOLS) / len(DEFENSIVE_SYMBOLS))
        for day in dates
    ]
    return [
        {"label": "Equal-weight cyclical basket", "symbol": "CYCLICAL", "data": cyclical},
        {"label": "Equal-weight defensive basket", "symbol": "DEFENSIVE", "data": defensive},
    ], dates[-1]


def _horizon_target(latest: date, horizon: str) -> date:
    if horizon == "1W":
        return latest - timedelta(days=7)
    if horizon == "1M":
        return latest - timedelta(days=30)
    if horizon == "3M":
        return latest - timedelta(days=90)
    if horizon == "YTD":
        return date(latest.year, 1, 1)
    return latest - timedelta(days=365)


def _relative_return(values: dict[str, float], benchmark: dict[str, float], horizon: str) -> float | None:
    common = sorted(set(values) & set(benchmark))
    if len(common) < 2:
        return None
    latest = date.fromisoformat(common[-1])
    target = _horizon_target(latest, horizon).isoformat()
    starts = [day for day in common if day <= target]
    if not starts:
        return None
    start, end = starts[-1], common[-1]
    if start == end:
        return None
    sector_return = (values[end] / values[start] - 1) * 100
    benchmark_return = (benchmark[end] / benchmark[start] - 1) * 100
    return sector_return - benchmark_return


def _relative_series(
    values: dict[str, float],
    benchmark: dict[str, float],
    period: str,
) -> tuple[list[dict[str, Any]], str | None]:
    dates = _period_dates([values, benchmark], period)
    if len(dates) < 2:
        return [], None
    sector_base, benchmark_base = values[dates[0]], benchmark[dates[0]]
    points = [
        _point(
            day,
            ((values[day] / sector_base) - (benchmark[day] / benchmark_base)) * 100,
        )
        for day in dates
    ]
    return points, dates[-1]


def _metadata(
    *,
    source: str,
    source_url: str,
    source_series_id: str,
    observation_date: str | None,
    retrieved_at: str,
    unit: str,
    transformation: str,
    quality_status: str,
    quality_reason: str | None,
    definition_urls: list[str] | None = None,
) -> dict[str, Any]:
    return {
        "owner_group": OWNER_GROUP,
        "source": source,
        "source_url": source_url,
        "source_series_id": source_series_id,
        "observation_date": observation_date,
        "retrieved_at": retrieved_at,
        "unit": unit,
        "frequency": "daily",
        "transformation": transformation,
        "quality_status": quality_status,
        "quality_reason": quality_reason,
        "data_version": DATA_VERSION,
        "definition_urls": definition_urls or [],
    }


def build_market_structure_payload(
    source: dict[str, Any],
    period: str,
    retrieved_at: str,
    stale: bool = False,
) -> dict[str, Any]:
    """Build all six blocks from immutable source observations."""

    if period not in VALID_PERIODS:
        raise ValueError(f"unsupported period: {period}")
    quality_status = "stale" if stale else "available"
    quality_reason = "upstream_refresh_failed" if stale else None
    prices = source.get("prices", {})
    holdings = source.get("holdings", [])[:10]
    sector_weights = source.get("sector_weights", [])
    holdings_date = source.get("holdings_observation_date")
    sector_weights_date = source.get("sector_weights_observation_date")

    profile_metadata = _metadata(
        source="State Street Global Advisors",
        source_url=STATE_STREET_PROFILE_URL,
        source_series_id="SPY_FUND_HOLDINGS",
        observation_date=holdings_date,
        retrieved_at=retrieved_at,
        unit="percent_weight",
        transformation="reported_fund_weight",
        quality_status=quality_status,
        quality_reason=quality_reason,
    )
    price_metadata = lambda series_id, observation_date, definitions=None: _metadata(
        source="Yahoo Finance adjusted close",
        source_url="https://finance.yahoo.com/quote/SPY/history/",
        source_series_id=series_id,
        observation_date=observation_date,
        retrieved_at=retrieved_at,
        unit="rebased_total_return_index",
        transformation=f"adjusted_close_rebased_to_100_at_{period.lower()}_period_start",
        quality_status=quality_status,
        quality_reason=quality_reason,
        definition_urls=definitions,
    )

    cap_series, cap_date = _normalized_series(
        prices,
        [("S&P 500 cap-weight proxy", "SPY"), ("S&P 500 equal-weight proxy", "RSP")],
        period,
    )
    growth_series, growth_date = _normalized_series(prices, list(STYLE_PAIRS["growth_value"]), period)
    size_series, size_date = _normalized_series(prices, list(STYLE_PAIRS["large_small"]), period)
    basket_series, basket_date = _basket_series(prices, period)

    benchmark = _price_map(prices.get("SPY", []))
    heatmap = []
    sector_series = {}
    sector_observation_dates = []
    for sector_id, (sector_name, symbol) in SECTOR_ETFS.items():
        values = _price_map(prices.get(symbol, []))
        relative_points, observation_date = _relative_series(values, benchmark, period)
        if observation_date:
            sector_observation_dates.append(observation_date)
        sector_series[sector_id] = relative_points
        heatmap.append(
            {
                "sector_id": sector_id,
                "sector": sector_name,
                "symbol": symbol,
                "returns": {
                    horizon: _relative_return(values, benchmark, horizon)
                    for horizon in HEATMAP_PERIODS
                },
            }
        )
    sector_return_date = min(sector_observation_dates) if sector_observation_dates else None

    def comparison_block(series, metadata, reason):
        if series:
            return {"status": quality_status, "metadata": metadata, "series": series}
        return {"status": "unavailable", "reason": reason, "metadata": metadata}

    blocks = {
        "company_concentration": {
            "status": quality_status if holdings else "unavailable",
            "reason": None if holdings else "current_spy_holdings_unavailable",
            "metadata": profile_metadata,
            "holdings": holdings,
            "top_10_weight_pct": sum(item["weight_pct"] for item in holdings) if holdings else None,
        },
        "company_contribution": {
            "status": "unavailable",
            "reason": "point_in_time_constituent_weights_and_membership_history_unavailable",
            "metadata": {
                **profile_metadata,
                "quality_status": "unavailable",
                "quality_reason": "Current SPY holdings cannot be reused as historical starting weights.",
                "unit": "percentage_points_of_index_return",
                "transformation": "previous_weight_times_same_period_adjusted_total_return",
            },
            "formula": "contribution_i = previous_weight_i × total_return_i",
        },
        "cap_vs_equal_weight": comparison_block(
            cap_series,
            price_metadata(
                "SPY_RSP_ADJUSTED_CLOSE",
                cap_date,
                ["https://www.invesco.com/us/financial-products/etfs/product-detail?productId=RSP"],
            ),
            "SPY or RSP adjusted history unavailable",
        ),
        "sector_weights": {
            "status": quality_status if sector_weights else "unavailable",
            "reason": None if sector_weights else "current_spy_sector_weights_unavailable",
            "metadata": _metadata(
                source="State Street Global Advisors",
                source_url=STATE_STREET_PROFILE_URL,
                source_series_id="SPY_FUND_SECTOR_BREAKDOWN",
                observation_date=sector_weights_date,
                retrieved_at=retrieved_at,
                unit="percent_weight",
                transformation="reported_fund_sector_weight",
                quality_status=quality_status if sector_weights else "unavailable",
                quality_reason=quality_reason if sector_weights else "current_spy_sector_weights_unavailable",
            ),
            "sectors": sector_weights,
        },
        "sector_relative_returns": {
            "status": quality_status if any(item["returns"].get("1Y") is not None for item in heatmap) else "unavailable",
            "reason": None if sector_return_date else "sector_or_spy_adjusted_history_unavailable",
            "metadata": _metadata(
                source="Yahoo Finance adjusted close via existing sector ETF pipeline",
                source_url="https://finance.yahoo.com/quote/SPY/history/",
                source_series_id="SELECT_SECTOR_ETFS_MINUS_SPY",
                observation_date=sector_return_date,
                retrieved_at=retrieved_at,
                unit="percentage_points",
                transformation="sector_adjusted_total_return_minus_spy_adjusted_total_return",
                quality_status=quality_status if sector_return_date else "unavailable",
                quality_reason=quality_reason if sector_return_date else "sector_or_spy_adjusted_history_unavailable",
                definition_urls=[
                    "https://www.ssga.com/us/en/individual/capabilities/equities/sector-investing/select-sector-etfs"
                ],
            ),
            "heatmap": heatmap,
            "sector_series": sector_series,
        },
        "styles": {
            "status": quality_status if growth_series and size_series and basket_series else "partial",
            "reason": None if growth_series and size_series and basket_series else "one_or_more_style_series_unavailable",
            "metadata": price_metadata(
                "IVW_IVE_SPY_IJR_SECTOR_BASKETS",
                min(day for day in [growth_date, size_date, basket_date] if day) if any([growth_date, size_date, basket_date]) else None,
                [
                    "https://www.ishares.com/us/products/239725/ishares-s-p-500-growth-etf",
                    "https://www.ishares.com/us/products/239774/ishares-core-sp-smallcap-etf",
                ],
            ),
            "series": [*growth_series, *size_series, *basket_series],
            "basket_composition": {
                "cyclical": CYCLICAL_SYMBOLS,
                "defensive": DEFENSIVE_SYMBOLS,
            },
            "formula": "Each constituent is rebased to 100 at the selected start; each basket is the arithmetic mean of its fixed start-date equal weights.",
        },
    }
    available_charts = (
        int(bool(holdings))
        + int(bool(cap_series))
        + int(bool(sector_weights))
        + int(bool(heatmap))
        + int(any(sector_series.values()))
        + int(bool(growth_series))
        + int(bool(size_series))
        + int(bool(basket_series))
    )
    payload = {
        "selected_period": period,
        "blocks": blocks,
        "metadata": {
            "owner_group": OWNER_GROUP,
            "retrieved_at": retrieved_at,
            "available_chart_count": available_charts,
            "required_chart_count": 8,
            "price_field": "adjusted_close",
            "missing_values": "null_not_zero",
            "data_version": DATA_VERSION,
        },
    }
    return MarketStructureResponse.model_validate(payload).model_dump(mode="json")


def unavailable_market_structure_payload(period: str, retrieved_at: str) -> dict[str, Any]:
    reason = "verified_market_structure_sources_unavailable"
    blocks = {
        name: {"status": "unavailable", "reason": reason, "metadata": {"quality_status": "unavailable", "quality_reason": reason}}
        for name in (
            "company_concentration",
            "company_contribution",
            "cap_vs_equal_weight",
            "sector_weights",
            "sector_relative_returns",
            "styles",
        )
    }
    payload = {
        "selected_period": period,
        "blocks": blocks,
        "metadata": {
            "owner_group": OWNER_GROUP,
            "retrieved_at": retrieved_at,
            "available_chart_count": 0,
            "required_chart_count": 8,
            "price_field": "adjusted_close",
            "missing_values": "null_not_zero",
            "data_version": DATA_VERSION,
        },
    }
    return MarketStructureResponse.model_validate(payload).model_dump(mode="json")


class MarketStructureService:
    def __init__(
        self,
        cache_dir: Path | None = None,
        http_get: Callable[..., Any] | None = None,
        now: Callable[[], datetime] | None = None,
    ) -> None:
        settings = get_settings()
        self.cache_dir = cache_dir or settings.data_dir.parent / "cache" / "market_structure"
        self.http_get = http_get or requests.get
        self.now = now or (lambda: datetime.now(UTC))
        self.headers = {
            "User-Agent": "GreenPeak/1.0 (verified market-structure cache)",
            "Accept": "application/json,text/html,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*",
        }
        self._memory_envelope: dict[str, Any] | None = None

    def get(self, period: str = "5Y", force: bool = False) -> dict[str, Any]:
        if period not in VALID_PERIODS:
            raise ValueError(f"unsupported period: {period}")
        envelope = self._read()
        fetched_at = datetime.fromisoformat(envelope["fetched_at"]) if envelope else None
        fresh = fetched_at is not None and self.now() - fetched_at <= CACHE_TTL
        if envelope and fresh and not force:
            return build_market_structure_payload(envelope["source"], period, fetched_at.isoformat())
        try:
            source = self._fetch_source()
            fetched_at = self.now()
            envelope = {"fetched_at": fetched_at.isoformat(), "source": source}
            self._write(envelope)
            return build_market_structure_payload(source, period, fetched_at.isoformat())
        except Exception:
            if envelope and fetched_at:
                return build_market_structure_payload(envelope["source"], period, fetched_at.isoformat(), stale=True)
            return unavailable_market_structure_payload(period, self.now().isoformat())

    def _request(self, url: str, **kwargs):
        last_error = None
        for attempt in range(2):
            try:
                response = self.http_get(url, headers=self.headers, timeout=30, **kwargs)
                response.raise_for_status()
                return response
            except Exception as exc:
                last_error = exc
                if attempt == 0:
                    time.sleep(0.35)
        raise MarketStructureSourceUnavailable("verified upstream request failed") from last_error

    def _fetch_source(self) -> dict[str, Any]:
        holdings_response = self._request(STATE_STREET_HOLDINGS_URL)
        holdings, holdings_date = parse_spy_holdings_xlsx(holdings_response.content)
        profile_response = self._request(STATE_STREET_PROFILE_URL)
        sector_weights, sector_date = parse_spy_sector_html(profile_response.text)

        prices: dict[str, list[dict[str, Any]]] = {}
        failures = []
        with ThreadPoolExecutor(max_workers=4) as executor:
            futures = {executor.submit(self._fetch_price, symbol): symbol for symbol in REQUIRED_SYMBOLS}
            for future in as_completed(futures):
                symbol = futures[future]
                try:
                    prices[symbol] = future.result()
                except Exception:
                    failures.append(symbol)
        if failures:
            raise MarketStructureSourceUnavailable(
                f"adjusted history unavailable for {len(failures)} required symbols"
            )
        return {
            "holdings": holdings,
            "holdings_observation_date": holdings_date,
            "sector_weights": sector_weights,
            "sector_weights_observation_date": sector_date,
            "prices": prices,
        }

    def _fetch_price(self, symbol: str) -> list[dict[str, Any]]:
        response = self._request(
            YAHOO_CHART_URL.format(symbol=symbol),
            params={
                "period1": PRICE_HISTORY_START,
                "period2": int(self.now().timestamp()) + 86400,
                "interval": "1d",
                "events": "div,splits",
                "includeAdjustedClose": "true",
            },
        )
        return parse_yahoo_adjusted_chart(response.json(), symbol)

    def _path(self) -> Path:
        return self.cache_dir / "market_structure.json"

    def _read(self) -> dict[str, Any] | None:
        if self._memory_envelope is not None:
            return self._memory_envelope
        try:
            value = json.loads(self._path().read_text(encoding="utf-8"))
            if isinstance(value, dict) and isinstance(value.get("source"), dict):
                self._memory_envelope = value
                return value
        except (OSError, ValueError):
            pass
        return None

    def _write(self, value: dict[str, Any]) -> None:
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        path = self._path()
        temporary = path.with_suffix(".tmp")
        temporary.write_text(
            json.dumps(value, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )
        temporary.replace(path)
        self._memory_envelope = value


market_structure_service = MarketStructureService()
