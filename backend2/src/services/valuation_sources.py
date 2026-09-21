"""Adapters for published S&P 500 valuation series.

The adapters in this module only parse observations published by the upstream
provider.  They do not estimate, interpolate, or otherwise manufacture
valuation data.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from html import unescape
import re
from threading import Lock
from time import monotonic
from typing import Callable, Dict, Optional, Tuple
from urllib.parse import urljoin, urlparse

import requests


USER_AGENT = "Mozilla/5.0 (compatible; GreenPeak/1.0; +https://greenpeak.tech)"
DEFAULT_CACHE_TTL_SECONDS = 6 * 60 * 60
FED_REPORT_ARCHIVE_URL = (
    "https://www.federalreserve.gov/publications/financial-stability-report.htm"
)
FED_REPORT_FALLBACK_URL = (
    "https://www.federalreserve.gov/publications/"
    "2026-may-financial-stability-report-accessibility-tables.htm"
)


class ValuationSourceError(RuntimeError):
    """Raised when a published valuation source cannot be read safely."""


@dataclass(frozen=True)
class PublishedValuationPoint:
    date: str
    value: float
    is_estimate: bool = False


@dataclass(frozen=True)
class PublishedValuationSeries:
    indicator_id: str
    points: Tuple[PublishedValuationPoint, ...]
    description: str
    unit: str
    frequency: str
    source: str
    source_provider: str
    source_url: str
    source_series_id: str
    population: str
    transformation: str


@dataclass(frozen=True)
class _MultplDefinition:
    indicator_id: str
    url: str
    description: str
    frequency: str
    source_series_id: str


MULTPL_SERIES: Dict[str, _MultplDefinition] = {
    "pe_ratio": _MultplDefinition(
        indicator_id="pe_ratio",
        url="https://www.multpl.com/s-p-500-pe-ratio/table/by-month",
        description="S&P 500 trailing 12-month price-to-earnings ratio",
        frequency="monthly",
        source_series_id="S&P 500 P/E Ratio",
    ),
    "price_to_book": _MultplDefinition(
        indicator_id="price_to_book",
        url="https://www.multpl.com/s-p-500-price-to-book/table/by-quarter",
        description="S&P 500 price-to-book ratio",
        frequency="quarterly",
        source_series_id="S&P 500 Price to Book Value",
    ),
    "price_to_sales": _MultplDefinition(
        indicator_id="price_to_sales",
        url="https://www.multpl.com/s-p-500-price-to-sales/table/by-quarter",
        description="S&P 500 price-to-sales ratio",
        frequency="quarterly",
        source_series_id="S&P 500 Price to Sales Ratio",
    ),
    "dividend_yield": _MultplDefinition(
        indicator_id="dividend_yield",
        url="https://www.multpl.com/s-p-500-dividend-yield/table/by-month",
        description="S&P 500 dividend yield",
        frequency="monthly",
        source_series_id="S&P 500 Dividend Yield",
    ),
}


def _plain_text(fragment: str) -> str:
    value = re.sub(r"<[^>]+>", " ", fragment)
    return " ".join(unescape(value).replace("\xa0", " ").split())


def _parse_multpl_date(value: str) -> Optional[str]:
    for date_format in ("%b %d, %Y", "%B %d, %Y"):
        try:
            return datetime.strptime(value, date_format).date().isoformat()
        except ValueError:
            continue
    return None


def parse_multpl_table(document: str) -> Tuple[PublishedValuationPoint, ...]:
    """Parse the public Multpl data table into an ascending time series."""
    table_match = re.search(
        r"<table\b[^>]*\bid=[\"']datatable[\"'][^>]*>([\s\S]*?)</table>",
        document,
        flags=re.IGNORECASE,
    )
    if not table_match:
        raise ValuationSourceError("Multpl response did not contain the expected data table")

    by_date: Dict[str, PublishedValuationPoint] = {}
    for row_html in re.findall(
        r"<tr\b[^>]*>([\s\S]*?)</tr>", table_match.group(1), flags=re.IGNORECASE
    ):
        cells = re.findall(
            r"<td\b[^>]*>([\s\S]*?)</td>", row_html, flags=re.IGNORECASE
        )
        if len(cells) < 2:
            continue

        observation_date = _parse_multpl_date(_plain_text(cells[0]))
        numeric_matches = re.findall(
            r"-?\d+(?:,\d{3})*(?:\.\d+)?", _plain_text(cells[1])
        )
        if not observation_date or not numeric_matches:
            continue
        try:
            value = float(numeric_matches[-1].replace(",", ""))
        except ValueError:
            continue

        by_date[observation_date] = PublishedValuationPoint(
            date=observation_date,
            value=value,
            is_estimate=bool(
                re.search(r"title=[\"']Estimate[\"']", cells[1], flags=re.IGNORECASE)
            ),
        )

    points = tuple(by_date[key] for key in sorted(by_date))
    if len(points) < 2:
        raise ValuationSourceError("Multpl returned insufficient valid observations")
    return points


def extract_latest_fed_report_url(document: str) -> str:
    """Return the first (newest) chart-data link from the Fed report archive."""
    matches = re.findall(
        r"href=[\"']([^\"']*financial-stability-report-accessibility-tables\.htm)[\"']",
        document,
        flags=re.IGNORECASE,
    )
    for href in matches:
        candidate = urljoin(FED_REPORT_ARCHIVE_URL, unescape(href))
        parsed = urlparse(candidate)
        if parsed.scheme == "https" and parsed.hostname == "www.federalreserve.gov":
            return candidate
    raise ValuationSourceError("Federal Reserve archive did not expose chart data")


def parse_fed_forward_pe_table(document: str) -> Tuple[PublishedValuationPoint, ...]:
    """Parse the Fed table containing the aggregate 12-month forward P/E."""
    header = re.search(r"Forward Price-to-Earnings Ratio", document, flags=re.IGNORECASE)
    if not header:
        raise ValuationSourceError("Federal Reserve response did not contain Forward P/E")

    table_start = document.rfind("<table", 0, header.start())
    table_end = document.find("</table>", header.end())
    if table_start < 0 or table_end < 0:
        raise ValuationSourceError("Federal Reserve Forward P/E table was malformed")
    table_html = document[table_start : table_end + len("</table>")]

    by_date: Dict[str, PublishedValuationPoint] = {}
    for row_html in re.findall(r"<tr\b[^>]*>([\s\S]*?)</tr>", table_html, re.IGNORECASE):
        cells = re.findall(
            r"<t[hd]\b[^>]*>([\s\S]*?)</t[hd]>", row_html, flags=re.IGNORECASE
        )
        if len(cells) < 2:
            continue
        date_text = _plain_text(cells[0])
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", date_text):
            continue
        try:
            value = float(_plain_text(cells[1]).replace(",", ""))
            datetime.strptime(date_text, "%Y-%m-%d")
        except ValueError:
            continue
        by_date[date_text] = PublishedValuationPoint(date=date_text, value=value)

    points = tuple(by_date[key] for key in sorted(by_date))
    if len(points) < 2:
        raise ValuationSourceError(
            "Federal Reserve returned insufficient Forward P/E observations"
        )
    return points


class ValuationSourceClient:
    """Fetch and briefly cache the published valuation series used by the API."""

    def __init__(
        self,
        http_get: Optional[Callable] = None,
        cache_ttl_seconds: int = DEFAULT_CACHE_TTL_SECONDS,
    ) -> None:
        self._http_get = http_get or requests.get
        self._cache_ttl_seconds = cache_ttl_seconds
        self._cache: Dict[str, Tuple[float, PublishedValuationSeries]] = {}
        self._cache_lock = Lock()

    def get_series(self, indicator_id: str) -> PublishedValuationSeries:
        with self._cache_lock:
            cached = self._cache.get(indicator_id)
            if cached and monotonic() - cached[0] < self._cache_ttl_seconds:
                return cached[1]

        if indicator_id == "forward_pe":
            series = self._fetch_forward_pe()
        elif indicator_id in MULTPL_SERIES:
            series = self._fetch_multpl(MULTPL_SERIES[indicator_id])
        else:
            raise ValuationSourceError(f"Unsupported published valuation series: {indicator_id}")

        with self._cache_lock:
            self._cache[indicator_id] = (monotonic(), series)
        return series

    def _get_document(self, url: str) -> str:
        try:
            response = self._http_get(
                url,
                headers={"Accept": "text/html", "User-Agent": USER_AGENT},
                timeout=30,
            )
            response.raise_for_status()
            return response.text
        except requests.RequestException as exc:
            raise ValuationSourceError("Published valuation source is unavailable") from exc

    def _fetch_multpl(self, definition: _MultplDefinition) -> PublishedValuationSeries:
        points = parse_multpl_table(self._get_document(definition.url))
        return PublishedValuationSeries(
            indicator_id=definition.indicator_id,
            points=points,
            description=definition.description,
            unit="ratio" if definition.indicator_id != "dividend_yield" else "percent",
            frequency=definition.frequency,
            source="Multpl",
            source_provider="Multpl",
            source_url=definition.url,
            source_series_id=definition.source_series_id,
            population="S&P 500 index",
            transformation=(
                "published values; source-marked estimates are flagged; "
                "GreenPeak generates no observations"
            ),
        )

    def _fetch_forward_pe(self) -> PublishedValuationSeries:
        report_url = FED_REPORT_FALLBACK_URL
        try:
            archive_document = self._get_document(FED_REPORT_ARCHIVE_URL)
            report_url = extract_latest_fed_report_url(archive_document)
        except ValuationSourceError:
            # The known report remains a valid published vintage if discovery is down.
            pass

        points = parse_fed_forward_pe_table(self._get_document(report_url))
        return PublishedValuationSeries(
            indicator_id="forward_pe",
            points=points,
            description=(
                "Aggregate S&P 500 forward price-to-earnings ratio based on "
                "expected earnings for the next 12 months"
            ),
            unit="ratio",
            frequency="monthly",
            source="Federal Reserve Board (LSEG I/B/E/S)",
            source_provider="Federal Reserve Board",
            source_url=report_url,
            source_series_id="S&P 500 Forward P/E (12-month consensus)",
            population="S&P 500 firms",
            transformation=(
                "published aggregate 12-month forward consensus P/E; "
                "GreenPeak generates no observations"
            ),
        )
