"""Adapter for the current public University of Michigan sentiment release."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from html.parser import HTMLParser
import re
from threading import Lock
from time import monotonic
from typing import Callable, Dict, List, Optional, Tuple

import requests


SOURCE_URL = "https://www.sca.isr.umich.edu/"
USER_AGENT = "GreenPeak/1.0 (+https://greenpeak.tech)"
DEFAULT_CACHE_TTL_SECONDS = 60 * 60


class UmichConsumerSourceError(RuntimeError):
    """Raised when the current public Michigan release cannot be parsed."""


@dataclass(frozen=True)
class UmichSentimentObservation:
    date: str
    value: float
    release_status: str


@dataclass(frozen=True)
class UmichSentimentRelease:
    title: str
    release_status: str
    source_url: str
    observations: Tuple[UmichSentimentObservation, ...]


class _FrontTableParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.in_front_table = False
        self.table_depth = 0
        self.rows: List[List[str]] = []
        self._row: Optional[List[str]] = None
        self._cell: Optional[List[str]] = None

    def handle_starttag(self, tag: str, attrs) -> None:
        attributes = dict(attrs)
        if tag == "table" and attributes.get("id") == "front_table":
            self.in_front_table = True
            self.table_depth = 1
            return
        if not self.in_front_table:
            return
        if tag == "table":
            self.table_depth += 1
        elif tag == "tr":
            self._row = []
        elif tag in {"td", "th"} and self._row is not None:
            self._cell = []

    def handle_data(self, data: str) -> None:
        if self._cell is not None:
            self._cell.append(data)

    def handle_endtag(self, tag: str) -> None:
        if not self.in_front_table:
            return
        if tag in {"td", "th"} and self._cell is not None and self._row is not None:
            self._row.append(" ".join("".join(self._cell).split()))
            self._cell = None
        elif tag == "tr" and self._row is not None:
            if self._row:
                self.rows.append(self._row)
            self._row = None
        elif tag == "table":
            self.table_depth -= 1
            if self.table_depth == 0:
                self.in_front_table = False


def parse_umich_release(document: str) -> UmichSentimentRelease:
    """Parse the current and previous headline observations from the public page."""
    heading = re.search(
        r"<(?:h1|h2)[^>]*>\s*(Preliminary|Final)\s+Results\s+for\s+"
        r"([A-Za-z]+)\s+(\d{4})\s*</(?:h1|h2)>",
        document,
        flags=re.IGNORECASE,
    )
    if not heading:
        raise UmichConsumerSourceError("Michigan page did not expose a release heading")

    release_status = heading.group(1).lower()
    try:
        current_month = datetime.strptime(
            f"{heading.group(2)} {heading.group(3)}", "%B %Y"
        )
    except ValueError as exc:
        raise UmichConsumerSourceError("Michigan release month was invalid") from exc

    parser = _FrontTableParser()
    parser.feed(document)
    sentiment_row = next(
        (
            row
            for row in parser.rows
            if row and row[0].strip().lower() == "index of consumer sentiment"
        ),
        None,
    )
    if sentiment_row is None or len(sentiment_row) < 3:
        raise UmichConsumerSourceError("Michigan page did not expose headline sentiment values")

    try:
        current_value = float(sentiment_row[1].replace(",", ""))
        previous_value = float(sentiment_row[2].replace(",", ""))
    except ValueError as exc:
        raise UmichConsumerSourceError("Michigan headline sentiment values were invalid") from exc

    if current_month.month == 1:
        previous_month = current_month.replace(year=current_month.year - 1, month=12)
    else:
        previous_month = current_month.replace(month=current_month.month - 1)

    title = f"{heading.group(1).title()} Results for {heading.group(2).title()} {heading.group(3)}"
    return UmichSentimentRelease(
        title=title,
        release_status=release_status,
        source_url=SOURCE_URL,
        observations=(
            UmichSentimentObservation(
                date=previous_month.date().replace(day=1).isoformat(),
                value=previous_value,
                release_status="final",
            ),
            UmichSentimentObservation(
                date=current_month.date().replace(day=1).isoformat(),
                value=current_value,
                release_status=release_status,
            ),
        ),
    )


class UmichConsumerClient:
    """Fetch and cache the latest public headline release."""

    def __init__(
        self,
        http_get: Optional[Callable] = None,
        cache_ttl_seconds: int = DEFAULT_CACHE_TTL_SECONDS,
    ) -> None:
        self._http_get = http_get or requests.get
        self._cache_ttl_seconds = cache_ttl_seconds
        self._cache: Dict[str, Tuple[float, UmichSentimentRelease]] = {}
        self._cache_lock = Lock()

    def get_release(self) -> UmichSentimentRelease:
        with self._cache_lock:
            cached = self._cache.get("current")
            if cached and monotonic() - cached[0] < self._cache_ttl_seconds:
                return cached[1]

        try:
            response = self._http_get(
                SOURCE_URL,
                headers={"Accept": "text/html", "User-Agent": USER_AGENT},
                timeout=30,
            )
            response.raise_for_status()
        except requests.RequestException as exc:
            raise UmichConsumerSourceError(
                "University of Michigan public release is unavailable"
            ) from exc

        release = parse_umich_release(response.text)
        with self._cache_lock:
            self._cache["current"] = (monotonic(), release)
        return release
