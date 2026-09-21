"""Small adapters for whitelisted public FRED CSV series."""

from __future__ import annotations

import csv
from dataclasses import dataclass
from datetime import date
from io import StringIO
from threading import Lock
from time import monotonic
from typing import Callable, Dict, Optional, Tuple
from urllib.parse import urlencode

import requests


FRED_GRAPH_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv"
USER_AGENT = "GreenPeak/1.0 (+https://greenpeak.tech)"
DEFAULT_CACHE_TTL_SECONDS = 6 * 60 * 60
SUPPORTED_SERIES = frozenset({
    "CPIAUCNS",
    "CPILFENS",
    "PCEPILFE",
    "PPIFID",
    "RSXFS",
    "UMCSENT",
})


class FredPublicSourceError(RuntimeError):
    """Raised when a whitelisted public FRED series cannot be retrieved."""


@dataclass(frozen=True)
class FredObservation:
    date: str
    value: float


@dataclass(frozen=True)
class FredPublicSeries:
    series_id: str
    source_url: str
    observations: Tuple[FredObservation, ...]


def parse_fred_csv(series_id: str, payload: str) -> Tuple[FredObservation, ...]:
    """Parse a FRED graph CSV without filling or estimating missing values."""
    reader = csv.DictReader(StringIO(payload.lstrip("\ufeff")))
    if (
        not reader.fieldnames
        or "observation_date" not in reader.fieldnames
        or series_id not in reader.fieldnames
    ):
        raise FredPublicSourceError(f"Unexpected FRED CSV columns for {series_id}")

    by_date: Dict[str, FredObservation] = {}
    for row in reader:
        observation_date = (row.get("observation_date") or "").strip()
        raw_value = (row.get(series_id) or "").strip()
        if not observation_date or not raw_value or raw_value == ".":
            continue
        try:
            date.fromisoformat(observation_date)
            value = float(raw_value)
        except ValueError:
            continue
        by_date[observation_date] = FredObservation(observation_date, value)

    observations = tuple(by_date[key] for key in sorted(by_date))
    if not observations:
        raise FredPublicSourceError(f"FRED returned no valid observations for {series_id}")
    return observations


class FredPublicSeriesClient:
    """Fetch and briefly cache approved public FRED time series."""

    def __init__(
        self,
        http_get: Optional[Callable] = None,
        cache_ttl_seconds: int = DEFAULT_CACHE_TTL_SECONDS,
    ) -> None:
        self._http_get = http_get or requests.get
        self._cache_ttl_seconds = cache_ttl_seconds
        self._cache: Dict[str, Tuple[float, FredPublicSeries]] = {}
        self._cache_lock = Lock()

    def get_series(self, series_id: str) -> FredPublicSeries:
        normalized_id = series_id.upper()
        if normalized_id not in SUPPORTED_SERIES:
            raise FredPublicSourceError(f"Unsupported public FRED series: {series_id}")

        with self._cache_lock:
            cached = self._cache.get(normalized_id)
            if cached and monotonic() - cached[0] < self._cache_ttl_seconds:
                return cached[1]

        source_url = f"{FRED_GRAPH_URL}?{urlencode({'id': normalized_id})}"
        try:
            response = self._http_get(
                source_url,
                headers={"Accept": "text/csv", "User-Agent": USER_AGENT},
                timeout=30,
            )
            response.raise_for_status()
        except requests.RequestException as exc:
            raise FredPublicSourceError("Public FRED series is unavailable") from exc

        series = FredPublicSeries(
            series_id=normalized_id,
            source_url=source_url,
            observations=parse_fred_csv(normalized_id, response.text),
        )
        with self._cache_lock:
            self._cache[normalized_id] = (monotonic(), series)
        return series
