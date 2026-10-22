"""Bounded, whitelisted daily source adapters and an atomic server-side cache."""
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, date, datetime, timedelta
from io import StringIO
import csv
import json
import math
import os
from pathlib import Path
from threading import Lock
from urllib.parse import quote
from zoneinfo import ZoneInfo

import requests
from curl_cffi import requests as browser_requests
from curl_cffi.requests.exceptions import RequestException as BrowserRequestException

from .definitions import DEFINITIONS

TTL = timedelta(hours=12)
HEADERS = {"User-Agent": "Mozilla/5.0", "Accept": "application/json,text/csv"}


class SourceUnavailable(Exception):
    """Intentionally contains a public error code, never an upstream URL/key."""


def clean_points(rows, *, today=None):
    """Reject malformed/nonfinite/future rows; keep real zero/negative prices."""
    today = today or datetime.now(UTC).date()
    values = {}
    invalid = duplicates = 0
    for row in rows:
        try:
            day = date.fromisoformat(str(row["date"]))
            if isinstance(row["value"], bool) or row["value"] is None:
                raise ValueError
            value = float(row["value"])
            if not math.isfinite(value) or day > today:
                raise ValueError
            if day.isoformat() in values:
                # Conflicting duplicates are not safe to choose arbitrarily.
                if values[day.isoformat()] != value:
                    raise SourceUnavailable("conflicting_duplicate_date")
                duplicates += 1
            values[day.isoformat()] = value
        except (KeyError, TypeError, ValueError, OverflowError):
            invalid += 1
    return [{"date": day, "value": values[day]} for day in sorted(values)], invalid, duplicates


def parse_tsetmc(payload, series, *, today=None):
    rows = payload.get("indexB2") if isinstance(payload, dict) else None
    if not isinstance(rows, list):
        raise SourceUnavailable("invalid_tsetmc_payload")
    points = []
    for row in rows:
        if not isinstance(row, dict):
            raise SourceUnavailable("invalid_tsetmc_observation")
        if str(row.get("insCode")) != series:
            raise SourceUnavailable("tsetmc_identity_mismatch")
        raw_day = str(row.get("dEven", ""))
        points.append({"date": f"{raw_day[:4]}-{raw_day[4:6]}-{raw_day[6:]}", "value": row.get("xNivInuClMresIbs")})
    return clean_points(points, today=today)


def parse_yahoo(payload, symbol, *, now=None):
    try:
        result = payload["chart"]["result"][0]
        metadata = result["meta"]
        if metadata["symbol"] != symbol or metadata.get("dataGranularity") != "1d" or metadata.get("currency") != "USD":
            raise SourceUnavailable("yahoo_identity_or_frequency_mismatch")
        closes = result["indicators"]["quote"][0]["close"]
        timestamps = result["timestamp"]
        if len(timestamps) != len(closes):
            raise SourceUnavailable("yahoo_length_mismatch")
        zone = ZoneInfo(metadata["exchangeTimezoneName"])
        current = now or datetime.now(UTC)
        points = []
        for timestamp, value in zip(timestamps, closes):
            day = datetime.fromtimestamp(timestamp, UTC).astimezone(zone).date()
            # Yahoo's final daily candle can still be intraday. Use completed days.
            if day < current.astimezone(zone).date():
                points.append({"date": day.isoformat(), "value": value})
        return clean_points(points, today=current.date())
    except (KeyError, IndexError, TypeError, ValueError, OverflowError) as exc:
        raise SourceUnavailable("invalid_yahoo_payload") from exc


def parse_fred_csv(text, series, *, today=None):
    reader = csv.DictReader(StringIO(text))
    fields = reader.fieldnames or []
    day_field = next((key for key in ("observation_date", "DATE") if key in fields), None)
    if not day_field or series not in fields or len(fields) != 2:
        raise SourceUnavailable("fred_identity_mismatch")
    return clean_points([{"date": row[day_field], "value": row[series]} for row in reader], today=today)


def parse_navasan(payload, quote_unit, *, today=None):
    if quote_unit not in {"IRR", "IRT"} or not isinstance(payload, list):
        raise SourceUnavailable("unverified_fx_unit_or_shape")
    # Dates come from documented Unix timestamps, avoiding an inferred Jalali parser.
    points = []
    for row in payload:
        try:
            if not isinstance(row, dict) or isinstance(row.get("close"), bool) or isinstance(row.get("timestamp"), bool):
                raise ValueError
            day = datetime.fromtimestamp(int(row["timestamp"]), UTC).astimezone(ZoneInfo("Asia/Tehran")).date()
            close = float(row["close"])
            if close <= 0:
                raise ValueError
            points.append({"date": day.isoformat(), "value": close * (10 if quote_unit == "IRT" else 1)})
        except (KeyError, TypeError, ValueError, OverflowError):
            raise SourceUnavailable("invalid_fx_observation") from None
    return clean_points(points, today=today)


class DailyMarketStore:
    def __init__(self, directory, *, fred_key="", navasan_key="", navasan_unit="", request=None, now=None):
        self.directory = Path(directory)
        self.fred_key = fred_key
        self.navasan_key = navasan_key
        self.navasan_unit = navasan_unit
        self.request = request or requests.get
        self.fred_request = request or (lambda *args, **kwargs: browser_requests.get(*args, impersonate="chrome", **kwargs))
        self.now = now or (lambda: datetime.now(UTC))
        self.locks = {key: Lock() for key in [*DEFINITIONS, "usdirr"]}

    def _read(self, key):
        try:
            value = json.loads((self.directory / f"{key}.json").read_text(encoding="utf-8"))
            if not isinstance(value, dict) or not all(isinstance(value.get(field), str) and value[field] for field in ("source", "source_url", "retrieved_at")):
                return None
            expected = "usd_sell" if key == "usdirr" else DEFINITIONS[key]["series"]
            if value.get("version") != 1 or value.get("source_series_id") != expected:
                return None
            points, invalid, _ = clean_points(value["data"], today=self.now().date())
            if invalid or len(points) < 2 or points != value["data"]:
                return None
            retrieved = datetime.fromisoformat(value["retrieved_at"])
            if retrieved.tzinfo is None or retrieved > self.now():
                return None
            return value
        except (OSError, ValueError, KeyError, TypeError, SourceUnavailable):
            return None

    def fx_verified(self):
        cached = self._read("usdirr")
        return bool(cached and cached.get("unit") == "IRR_per_USD" and len(cached["data"]) >= 60)

    def _fetch(self, key):
        today = self.now().date()
        if key == "usdirr":
            if not self.navasan_key or self.navasan_unit not in {"IRR", "IRT"}:
                raise SourceUnavailable("fx_history_not_verified")
            response = self.request("https://api.navasan.tech/ohlcSearch/", params={
                "api_key": self.navasan_key, "item": "usd_sell", "start": 946684800,
                "end": int(self.now().timestamp()),
            }, headers=HEADERS, timeout=(5, 20))
            response.raise_for_status()
            points, invalid, duplicates = parse_navasan(response.json(), self.navasan_unit, today=today)
            if len(points) < 60:
                raise SourceUnavailable("insufficient_fx_history")
            extra = dict(source="نوسان · دلار آزاد فروش", source_url="https://www.navasan.tech/webserviceguide/", source_series_id="usd_sell", unit="IRR_per_USD")
        else:
            definition = DEFINITIONS[key]
            series = definition["series"]
            provider = definition["provider"]
            if provider == "yahoo":
                url = f"https://query1.finance.yahoo.com/v8/finance/chart/{quote(series, safe='')}"
                response = self.request(url, params={"period1": 946684800, "period2": int(self.now().timestamp()), "interval": "1d", "includePrePost": "false"}, headers=HEADERS, timeout=(5, 20))
                response.raise_for_status()
                points, invalid, duplicates = parse_yahoo(response.json(), series, now=self.now())
                extra = dict(source="Yahoo Finance · daily close", source_url=f"https://finance.yahoo.com/quote/{quote(series, safe='')}/history/", source_series_id=series)
            elif provider == "tsetmc":
                url = f"https://cdn.tsetmc.com/api/Index/GetIndexB2History/{series}"
                response = self.request(url, headers=HEADERS, timeout=(5, 20))
                response.raise_for_status()
                points, invalid, duplicates = parse_tsetmc(response.json(), series, today=today)
                if len(points) < 60:
                    raise SourceUnavailable("insufficient_verified_index_history")
                extra = dict(source="TSETMC · daily closing index", source_url=url, source_series_id=series)
            else:
                if self.fred_key:
                    response = self.request("https://api.stlouisfed.org/fred/series/observations", params={"api_key": self.fred_key, "series_id": series, "file_type": "json", "sort_order": "asc"}, headers=HEADERS, timeout=(5, 20))
                    response.raise_for_status()
                    payload = response.json()
                    rows = payload.get("observations") if isinstance(payload, dict) else None
                    if not isinstance(rows, list):
                        raise SourceUnavailable("invalid_fred_payload")
                    points, invalid, duplicates = clean_points([{"date": row.get("date"), "value": row.get("value")} if isinstance(row, dict) else {} for row in rows], today=today)
                else:
                    response = self.fred_request("https://fred.stlouisfed.org/graph/fredgraph.csv", params={"id": series, "cosd": "2000-01-01"}, headers=HEADERS, timeout=20)
                    response.raise_for_status()
                    points, invalid, duplicates = parse_fred_csv(response.text, series, today=today)
                extra = dict(source="Federal Reserve Board via FRED", source_url=f"https://fred.stlouisfed.org/series/{series}", source_series_id=series)
        if len(points) < 2:
            raise SourceUnavailable("insufficient_history")
        return {"version": 1, "retrieved_at": self.now().isoformat(), "data": points,
                "invalid_rows": invalid, "duplicate_rows": duplicates, **extra}

    def load(self, key, *, force=False):
        if key not in self.locks:
            raise ValueError("Unsupported comparison symbol")
        with self.locks[key]:
            cached = self._read(key)
            if cached and not force and self.now() - datetime.fromisoformat(cached["retrieved_at"]) < TTL:
                return {**cached, "cache_stale": False}
            try:
                value = self._fetch(key)
                self.directory.mkdir(parents=True, exist_ok=True)
                temporary = self.directory / f"{key}.{os.getpid()}.tmp"
                temporary.write_text(json.dumps(value, ensure_ascii=False, allow_nan=False), encoding="utf-8")
                temporary.replace(self.directory / f"{key}.json")
                return {**value, "cache_stale": False}
            except (requests.RequestException, BrowserRequestException, SourceUnavailable, OSError, ValueError, KeyError, TypeError):
                if cached:
                    return {**cached, "cache_stale": True}
                return None

    def load_many(self, keys):
        with ThreadPoolExecutor(max_workers=4) as pool:
            return dict(zip(keys, pool.map(self.load, keys)))
