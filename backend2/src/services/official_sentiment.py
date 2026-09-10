"""Official positioning, sentiment, and volatility source adapters.

The upstream providers do not share a common API.  This module normalizes their
public data into GreenPeak's time-series contract and keeps a small disk cache so
provider outages never turn a previously valid series into fabricated values.
"""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from hashlib import sha256
from html.parser import HTMLParser
from io import BytesIO, StringIO
import csv
import json
import math
from pathlib import Path
import re
from typing import Any, Callable

import pandas as pd
import requests
from pymongo import MongoClient
from pymongo.errors import PyMongoError

from ..core.config import get_settings


OWNER_GROUP = "positioning_sentiment_derivatives_volatility"
CBOE_DAILY_URL = "https://www.cboe.com/markets/us/options/market-statistics/daily/"
CBOE_SPX_ARCHIVE_URL = "https://cdn.cboe.com/resources/options/volume_and_call_put_ratios/spxpc.csv"
AAII_HISTORY_URL = "https://www.aaii.com/files/surveys/sentiment.xls"
AAII_RESULTS_URL = "https://www.aaii.com/sentimentsurvey/sent_results"
CFTC_TFF_URLS = (
    "https://publicreportinghub.cftc.gov/resource/gpe5-46if.json",
    "https://publicreporting.cftc.gov/resource/gpe5-46if.json",
)
CBOE_VOLATILITY_URLS = {
    "VIX9D": "https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX9D_History.csv",
    "VIX": "https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv",
    "VIX3M": "https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX3M_History.csv",
    "VIX6M": "https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX6M_History.csv",
    "VIX1Y": "https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX1Y_History.csv",
}

SOURCE_CONFIG = {
    "spx_put_call_ratio": {"ttl": timedelta(hours=18), "stale_days": 5, "frequency": "daily", "unit": "ratio", "source_series_id": "SPX+SPXW_PUT_CALL_RATIO"},
    "aaii_bull_bear_spread": {"ttl": timedelta(days=3), "stale_days": 10, "frequency": "weekly", "unit": "percentage points", "source_series_id": "AAII_BULL_MINUS_BEAR"},
    "cftc_sp500_positioning": {"ttl": timedelta(days=3), "stale_days": 10, "frequency": "weekly", "unit": "contracts", "source_series_id": "TFF_13874A_ASSET_MGR_NET"},
    "vix_term_structure": {"ttl": timedelta(hours=18), "stale_days": 5, "frequency": "daily", "unit": "volatility points", "source_series_id": "VIX1Y_MINUS_VIX9D"},
}


class OfficialSourceUnavailable(RuntimeError):
    pass


class _TableParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.rows: list[list[str]] = []
        self._row: list[str] | None = None
        self._cell: list[str] | None = None

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag == "tr":
            self._row = []
        elif tag in {"td", "th"} and self._row is not None:
            self._cell = []

    def handle_data(self, data: str) -> None:
        if self._cell is not None:
            self._cell.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag in {"td", "th"} and self._cell is not None and self._row is not None:
            self._row.append(" ".join("".join(self._cell).split()))
            self._cell = None
        elif tag == "tr" and self._row is not None:
            if self._row:
                self.rows.append(self._row)
            self._row = None


def _number(value: Any) -> float | None:
    try:
        parsed = float(str(value).replace(",", "").replace("%", "").strip())
        return parsed if math.isfinite(parsed) else None
    except (TypeError, ValueError):
        return None


def _day(value: Any, default_year: int | None = None) -> str | None:
    candidate = value
    if default_year is not None and isinstance(value, str) and not re.search(r"\b\d{4}\b", value):
        candidate = f"{value} {default_year}"
    parsed = pd.to_datetime(candidate, errors="coerce")
    return None if pd.isna(parsed) else parsed.date().isoformat()


def _point(day: str, value: float) -> dict[str, Any]:
    return {"time": int(datetime.fromisoformat(day).replace(tzinfo=UTC).timestamp()), "date": day, "value": value}


def _series(rows: dict[str, float]) -> list[dict[str, Any]]:
    return [_point(day, value) for day, value in sorted(rows.items())]


def parse_cboe_spx_archive(content: bytes) -> list[dict[str, Any]]:
    text = content.decode("utf-8-sig", errors="replace")
    result: dict[str, float] = {}
    for row in csv.DictReader(StringIO(text)):
        normalized = {re.sub(r"[^a-z0-9]", "", str(key).lower()): value for key, value in row.items() if key}
        day = _day(normalized.get("date"))
        ratio = next((_number(value) for key, value in normalized.items() if key in {"pcratio", "putcallratio", "pc"}), None)
        if day and ratio is not None:
            result[day] = ratio
    return _series(result)


def parse_cboe_daily_ratio(html: str, requested_day: date) -> dict[str, Any] | None:
    parser = _TableParser(); parser.feed(html)
    for row in parser.rows:
        if row and "SPX + SPXW PUT/CALL RATIO" in row[0].upper():
            value = next((_number(cell) for cell in row[1:] if _number(cell) is not None), None)
            return _point(requested_day.isoformat(), value) if value is not None else None
    return None


def parse_aaii_html(html: str, year: int) -> dict[str, list[dict[str, Any]]]:
    parser = _TableParser(); parser.feed(html)
    values = {"bullish": {}, "neutral": {}, "bearish": {}}
    current_year = year
    previous_month = 13
    for row in parser.rows:
        if len(row) < 4:
            continue
        tentative_day = _day(row[0], current_year)
        if tentative_day is None:
            continue
        tentative_month = date.fromisoformat(tentative_day).month
        if tentative_month > previous_month:
            current_year -= 1
            tentative_day = _day(row[0], current_year)
        previous_month = tentative_month
        day = tentative_day
        numbers = [_number(cell) for cell in row[1:4]]
        if day and all(item is not None for item in numbers):
            values["bullish"][day], values["neutral"][day], values["bearish"][day] = numbers
    return {key: _series(item) for key, item in values.items()}


def parse_aaii_xls(content: bytes) -> dict[str, list[dict[str, Any]]]:
    raw = pd.read_excel(BytesIO(content), header=None, engine="xlrd")
    header_index = next(index for index, row in raw.iterrows() if "date" in " ".join(str(value).lower() for value in row.tolist()) and "bullish" in " ".join(str(value).lower() for value in row.tolist()))
    frame = pd.read_excel(BytesIO(content), header=header_index, engine="xlrd")
    columns = {str(column).strip().lower(): column for column in frame.columns}
    date_column = next(column for name, column in columns.items() if "date" in name)
    bullish_column = next(column for name, column in columns.items() if "bullish" in name)
    neutral_column = next(column for name, column in columns.items() if "neutral" in name)
    bearish_column = next(column for name, column in columns.items() if "bearish" in name)
    values = {"bullish": {}, "neutral": {}, "bearish": {}}
    for _, row in frame.iterrows():
        day = _day(row[date_column])
        numbers = [_number(row[column]) for column in (bullish_column, neutral_column, bearish_column)]
        if day and all(item is not None for item in numbers):
            scale = 100 if max(numbers) <= 1 else 1
            values["bullish"][day], values["neutral"][day], values["bearish"][day] = [item * scale for item in numbers]
    return {key: _series(item) for key, item in values.items()}


def parse_cftc_rows(rows: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    asset: dict[str, float] = {}; leveraged: dict[str, float] = {}
    for row in rows:
        if str(row.get("cftc_contract_market_code", "")).upper() != "13874A":
            continue
        day = _day(row.get("report_date_as_yyyy_mm_dd"))
        asset_long, asset_short = _number(row.get("asset_mgr_positions_long")), _number(row.get("asset_mgr_positions_short"))
        lev_long, lev_short = _number(row.get("lev_money_positions_long")), _number(row.get("lev_money_positions_short"))
        if day and asset_long is not None and asset_short is not None:
            asset[day] = asset_long - asset_short
        if day and lev_long is not None and lev_short is not None:
            leveraged[day] = lev_long - lev_short
    return {"asset_manager_net": _series(asset), "leveraged_money_net": _series(leveraged)}


def parse_cboe_volatility_csv(content: bytes, ticker: str) -> list[dict[str, Any]]:
    text = content.decode("utf-8-sig", errors="replace")
    result: dict[str, float] = {}
    for row in csv.DictReader(StringIO(text)):
        normalized = {re.sub(r"[^a-z0-9]", "", str(key).lower()): value for key, value in row.items() if key}
        day = _day(normalized.get("date"))
        candidates = [normalized.get("close"), normalized.get(ticker.lower())]
        candidates.extend(value for key, value in normalized.items() if key != "date")
        value = next((_number(item) for item in candidates if _number(item) is not None), None)
        if day and value is not None:
            result[day] = value
    return _series(result)


def filter_payload(payload: dict[str, Any], limit: int | None = None, start_date: str | None = None, end_date: str | None = None) -> dict[str, Any]:
    """Apply standard date and limit filters to every returned series."""
    for value in (start_date, end_date):
        if value:
            date.fromisoformat(value)

    def filtered(points: list[dict[str, Any]]) -> list[dict[str, Any]]:
        result = [item for item in points if (not start_date or item["date"] >= start_date) and (not end_date or item["date"] <= end_date)]
        return result[-limit:] if limit else result

    value = json.loads(json.dumps(payload))
    value["data"] = filtered(value.get("data", []))
    value["series"] = {key: filtered(points) for key, points in value.get("series", {}).items()}
    value["metadata"]["returned_records"] = len(value["data"])
    return value


class OfficialSentimentService:
    def __init__(self, cache_dir: Path | None = None, http_get: Callable[..., Any] | None = None, now: Callable[[], datetime] | None = None, persist: bool = True) -> None:
        settings = get_settings()
        self.cache_dir = cache_dir or settings.data_dir.parent / "cache" / "official_sentiment"
        self.http_get = http_get or requests.get
        self.now = now or (lambda: datetime.now(UTC))
        self.persist = persist
        self.headers = {"User-Agent": "GreenPeak/1.0 (official market-data cache)", "Accept": "application/json,text/html,text/csv,*/*"}

    def get(self, indicator_id: str, force: bool = False) -> dict[str, Any]:
        if indicator_id not in SOURCE_CONFIG:
            raise KeyError(indicator_id)
        envelope = self._read(indicator_id)
        fetched_at = datetime.fromisoformat(envelope["fetched_at"]) if envelope else None
        fresh = fetched_at and self.now() - fetched_at <= SOURCE_CONFIG[indicator_id]["ttl"]
        if envelope and fresh and not force:
            return self._decorate(envelope["payload"], fetched_at, False)
        try:
            payload = getattr(self, f"_fetch_{indicator_id}")()
            if envelope:
                payload = self._merge(envelope["payload"], payload)
            fetched_at = self.now()
            self._write(indicator_id, {"fetched_at": fetched_at.isoformat(), "payload": payload})
            if self.persist:
                self._persist(payload)
            return self._decorate(payload, fetched_at, False)
        except Exception as exc:
            if envelope and fetched_at:
                return self._decorate(envelope["payload"], fetched_at, True)
            raise OfficialSourceUnavailable(f"{indicator_id} source is unavailable") from exc

    def refresh_all(self) -> None:
        for indicator_id in SOURCE_CONFIG:
            try:
                self.get(indicator_id, force=True)
            except OfficialSourceUnavailable:
                continue

    def _request(self, url: str, **kwargs):
        response = self.http_get(url, headers=self.headers, timeout=30, **kwargs)
        response.raise_for_status()
        return response

    def _fetch_spx_put_call_ratio(self) -> dict[str, Any]:
        archive = parse_cboe_spx_archive(self._request(CBOE_SPX_ARCHIVE_URL).content)
        recent: dict[str, dict[str, Any]] = {}
        today = self.now().date()
        for offset in range(5):
            day = today - timedelta(days=offset)
            if day.weekday() >= 5:
                continue
            try:
                point = parse_cboe_daily_ratio(self._request(CBOE_DAILY_URL, params={"dt": day.isoformat()}).text, day)
                if point:
                    recent[point["date"]] = point
            except Exception:
                continue
        data = sorted({item["date"]: item for item in [*archive, *recent.values()]}.values(), key=lambda item: item["date"])
        return self._payload("spx_put_call_ratio", data, {}, "Cboe Global Markets", CBOE_DAILY_URL, "Reported SPX and SPXW put volume divided by call volume.")

    def _fetch_aaii_bull_bear_spread(self) -> dict[str, Any]:
        try:
            series = parse_aaii_xls(self._request(AAII_HISTORY_URL).content)
        except Exception:
            series = parse_aaii_html(self._request(AAII_RESULTS_URL).text, self.now().year)
        bullish = {item["date"]: item["value"] for item in series["bullish"]}
        bearish = {item["date"]: item["value"] for item in series["bearish"]}
        data = _series({day: value - bearish[day] for day, value in bullish.items() if day in bearish})
        return self._payload("aaii_bull_bear_spread", data, series, "American Association of Individual Investors", AAII_RESULTS_URL, "Weekly bullish sentiment minus bearish sentiment; chart detail includes bullish, neutral, and bearish shares.")

    def _fetch_cftc_sp500_positioning(self) -> dict[str, Any]:
        params = {"$limit": 5000, "$where": "cftc_contract_market_code='13874A'", "$order": "report_date_as_yyyy_mm_dd ASC"}
        rows = None
        for url in CFTC_TFF_URLS:
            try:
                rows = self._request(url, params=params).json()
                break
            except Exception:
                continue
        if not isinstance(rows, list):
            raise OfficialSourceUnavailable("CFTC TFF response unavailable")
        series = parse_cftc_rows(rows)
        data = series["asset_manager_net"]
        return self._payload("cftc_sp500_positioning", data, series, "U.S. Commodity Futures Trading Commission", CFTC_TFF_URLS[0], "TFF futures-only net positions for E-mini S&P 500 Asset Managers and Leveraged Money.")

    def _fetch_vix_term_structure(self) -> dict[str, Any]:
        series = {ticker.lower(): parse_cboe_volatility_csv(self._request(url).content, ticker) for ticker, url in CBOE_VOLATILITY_URLS.items()}
        short = {item["date"]: item["value"] for item in series["vix9d"]}
        long = {item["date"]: item["value"] for item in series["vix1y"]}
        data = _series({day: value - short[day] for day, value in long.items() if day in short})
        return self._payload("vix_term_structure", data, series, "Cboe Global Markets", "https://www.cboe.com/tradable-products/vix/vix-historical-data", "VIX1Y minus VIX9D; chart detail includes VIX9D, VIX, VIX3M, VIX6M, and VIX1Y.")

    def _payload(self, indicator_id: str, data: list[dict[str, Any]], series: dict[str, list[dict[str, Any]]], source: str, source_url: str, description: str) -> dict[str, Any]:
        if not data:
            raise OfficialSourceUnavailable(f"{indicator_id} returned no valid observations")
        config = SOURCE_CONFIG[indicator_id]
        return {"data": data, "series": series, "metadata": {"indicator_id": indicator_id, "owner_group": OWNER_GROUP, "latest_value": data[-1]["value"], "latest_date": data[-1]["date"], "observation_date": data[-1]["date"], "total_records": len(data), "description": description, "unit": config["unit"], "frequency": config["frequency"], "source": source, "source_url": source_url, "source_series_id": config["source_series_id"], "transformation": "reported_or_documented_difference", "quality_status": "available", "quality_reason": None, "data_version": "1.0"}}

    def _decorate(self, payload: dict[str, Any], fetched_at: datetime, refresh_failed: bool) -> dict[str, Any]:
        value = json.loads(json.dumps(payload))
        metadata = value["metadata"]
        observation = date.fromisoformat(metadata["observation_date"])
        too_old = (self.now().date() - observation).days > SOURCE_CONFIG[metadata["indicator_id"]]["stale_days"]
        metadata["retrieved_at"] = fetched_at.isoformat()
        if refresh_failed or too_old:
            metadata["quality_status"] = "stale"
            metadata["quality_reason"] = "upstream_refresh_failed" if refresh_failed else "latest_observation_exceeds_freshness_threshold"
        return value

    def _merge(self, old: dict[str, Any], new: dict[str, Any]) -> dict[str, Any]:
        merged = json.loads(json.dumps(new))
        merged["data"] = sorted({item["date"]: item for item in [*old.get("data", []), *new.get("data", [])]}.values(), key=lambda item: item["date"])
        all_series = set(old.get("series", {})) | set(new.get("series", {}))
        merged["series"] = {key: sorted({item["date"]: item for item in [*old.get("series", {}).get(key, []), *new.get("series", {}).get(key, [])]}.values(), key=lambda item: item["date"]) for key in all_series}
        merged["metadata"].update(latest_value=merged["data"][-1]["value"], latest_date=merged["data"][-1]["date"], observation_date=merged["data"][-1]["date"], total_records=len(merged["data"]))
        return merged

    def _path(self, indicator_id: str) -> Path:
        return self.cache_dir / f"{indicator_id}.json"

    def _read(self, indicator_id: str) -> dict[str, Any] | None:
        try:
            value = json.loads(self._path(indicator_id).read_text(encoding="utf-8"))
            return value if isinstance(value, dict) and isinstance(value.get("payload"), dict) else None
        except (OSError, ValueError):
            return None

    def _write(self, indicator_id: str, value: dict[str, Any]) -> None:
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        path = self._path(indicator_id); temporary = path.with_suffix(".tmp")
        temporary.write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        temporary.replace(path)

    def _persist(self, payload: dict[str, Any]) -> None:
        settings = get_settings(); metadata = payload["metadata"]
        client = MongoClient(
            settings.mongodb_url,
            serverSelectionTimeoutMS=400,
            connectTimeoutMS=400,
            socketTimeoutMS=400,
        )
        try:
            collection = client[settings.mongodb_database]["positioning_sentiment"]
            for item in payload["data"]:
                identity = sha256(f"{metadata['indicator_id']}|{item['date']}|{item['value']}".encode()).hexdigest()
                collection.update_one({"_id": identity}, {"$setOnInsert": {"date": item["date"], "indicator": metadata["indicator_id"], "value": item["value"], "fred_series_id": metadata["source_series_id"], "updated_at": self.now(), "metadata": {"source": metadata["source"], "source_url": metadata["source_url"], "frequency": metadata["frequency"]}}}, upsert=True)
        except PyMongoError:
            pass
        finally:
            client.close()

official_sentiment_service = OfficialSentimentService()
