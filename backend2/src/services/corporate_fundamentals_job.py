"""Offline SEC/State Street ingestion job for corporate fundamentals."""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import UTC, datetime
import logging
from threading import Lock
import time
from typing import Any, Callable

from pymongo import ASCENDING, UpdateOne
import requests

from ..core.config import get_settings
from .corporate_fundamentals import (
    CORPORATE_METHODOLOGY_VERSION,
    SEC_COMPANYFACTS_URL,
    CorporateBuildResult,
    CorporateFundamentalsSourceError,
    build_sec_corporate_documents,
)
from .market_structure import STATE_STREET_HOLDINGS_URL, parse_spy_holdings_xlsx
from .mongodb_service import MongoDBService


logger = logging.getLogger(__name__)

SEC_TICKERS_URL = "https://www.sec.gov/files/company_tickers.json"


def _normalized_symbol(symbol: str) -> str:
    return str(symbol).strip().upper().replace(".", "-").replace("/", "-")


class _SecRateLimiter:
    def __init__(self, requests_per_second: float = 6.0) -> None:
        self.interval = 1.0 / requests_per_second
        self.lock = Lock()
        self.next_request = 0.0

    def wait(self) -> None:
        with self.lock:
            now = time.monotonic()
            delay = max(0.0, self.next_request - now)
            self.next_request = max(now, self.next_request) + self.interval
        if delay:
            time.sleep(delay)


class CorporateFundamentalsJob:
    """Fetch, normalize, aggregate, and optionally persist corporate data."""

    def __init__(
        self,
        *,
        mongodb: MongoDBService | None = None,
        http_get: Callable[..., Any] | None = None,
        now: Callable[[], datetime] | None = None,
        workers: int = 4,
    ) -> None:
        self.mongodb = mongodb or MongoDBService()
        self.http_get = http_get or requests.get
        self.now = now or (lambda: datetime.now(UTC))
        self.workers = max(1, min(workers, 6))
        self.settings = get_settings()
        self.headers = {
            "User-Agent": self.settings.sec_user_agent,
            "Accept": "application/json",
        }
        self.rate_limiter = _SecRateLimiter()

    def _request(self, url: str, *, sec: bool = False):
        last_error: Exception | None = None
        for attempt in range(3):
            if sec:
                self.rate_limiter.wait()
            try:
                response = self.http_get(
                    url,
                    headers=self.headers,
                    timeout=45,
                )
                response.raise_for_status()
                return response
            except Exception as exc:
                last_error = exc
                if attempt < 2:
                    time.sleep(0.5 * (attempt + 1))
        raise CorporateFundamentalsSourceError("official corporate source request failed") from last_error

    def _load_cohort(self) -> tuple[list[dict[str, Any]], str]:
        response = self._request(STATE_STREET_HOLDINGS_URL)
        return parse_spy_holdings_xlsx(response.content)

    def _load_sec_identifiers(self) -> dict[str, dict[str, str]]:
        response = self._request(SEC_TICKERS_URL, sec=True)
        payload = response.json()
        identifiers: dict[str, dict[str, str]] = {}
        for item in payload.values() if isinstance(payload, dict) else []:
            if not isinstance(item, dict) or not item.get("ticker") or item.get("cik_str") is None:
                continue
            symbol = _normalized_symbol(item["ticker"])
            identifiers[symbol] = {
                "cik": str(item["cik_str"]).zfill(10),
                "name": str(item.get("title") or symbol),
            }
        if len(identifiers) < 1000:
            raise CorporateFundamentalsSourceError("SEC ticker mapping was incomplete")
        return identifiers

    def _load_companyfacts(self, cik: str) -> dict[str, Any]:
        response = self._request(SEC_COMPANYFACTS_URL.format(cik=cik), sec=True)
        payload = response.json()
        if not isinstance(payload, dict) or not isinstance(payload.get("facts"), dict):
            raise CorporateFundamentalsSourceError("SEC Company Facts response was invalid")
        return payload

    def run(
        self,
        *,
        write: bool = True,
        max_companies: int | None = None,
    ) -> dict[str, Any]:
        holdings, holdings_as_of = self._load_cohort()
        sec_identifiers = self._load_sec_identifiers()
        cohort: list[tuple[str, dict[str, str]]] = []
        unmapped: list[str] = []
        for holding in holdings:
            symbol = _normalized_symbol(holding["symbol"])
            identifiers = sec_identifiers.get(symbol)
            if identifiers:
                cohort.append((symbol, identifiers))
            else:
                unmapped.append(symbol)
        if max_companies is not None:
            cohort = cohort[: max(0, max_companies)]
        if not cohort:
            raise CorporateFundamentalsSourceError("no SPY holdings mapped to SEC CIKs")

        payloads: dict[str, dict[str, Any]] = {}
        failures: list[str] = []
        with ThreadPoolExecutor(max_workers=self.workers) as executor:
            futures = {
                executor.submit(self._load_companyfacts, identifiers["cik"]): symbol
                for symbol, identifiers in cohort
            }
            for future in as_completed(futures):
                symbol = futures[future]
                try:
                    payloads[symbol] = future.result()
                except Exception:
                    failures.append(symbol)
                    logger.warning("SEC Company Facts unavailable for %s", symbol)

        company_identifiers = {symbol: identifiers for symbol, identifiers in cohort}
        expected_symbols = [symbol for symbol, _ in cohort]
        result = build_sec_corporate_documents(
            payloads,
            company_identifiers,
            expected_symbols=expected_symbols,
            holdings_as_of=holdings_as_of,
            updated_at=self.now(),
        )
        if not result.aggregates:
            raise CorporateFundamentalsSourceError("SEC facts produced no aggregate observations")
        if write:
            self._write(result)

        by_indicator: dict[str, int] = {}
        for document in result.aggregates:
            indicator = str(document["indicator"])
            by_indicator[indicator] = by_indicator.get(indicator, 0) + 1
        return {
            "status": "written" if write else "dry_run",
            "methodology_version": CORPORATE_METHODOLOGY_VERSION,
            "holdings_as_of": holdings_as_of,
            "companies_expected": result.companies_expected,
            "companies_with_any_facts": result.companies_with_any_facts,
            "companyfacts_failures": len(failures),
            "unmapped_holdings": len(unmapped),
            "normalized_facts": len(result.normalized_facts),
            "aggregate_records": by_indicator,
        }

    def _write(self, result: CorporateBuildResult) -> None:
        aggregate_collection = self.mongodb.get_collection("corporate_earnings")
        fact_collection = self.mongodb.get_collection("corporate_company_facts")
        aggregate_collection.create_index(
            [("indicator", ASCENDING), ("date", ASCENDING)],
            unique=True,
            name="indicator_date_unique",
        )
        aggregate_collection.create_index(
            [("methodology_version", ASCENDING), ("indicator", ASCENDING)],
            name="methodology_indicator_idx",
        )
        fact_collection.create_index(
            [("cik", ASCENDING), ("metric", ASCENDING), ("frame", ASCENDING)],
            unique=True,
            name="cik_metric_frame_unique",
        )
        aggregate_operations = [
            UpdateOne(
                {"indicator": item["indicator"], "date": item["date"]},
                {"$set": item},
                upsert=True,
            )
            for item in result.aggregates
        ]
        fact_operations = [
            UpdateOne(
                {"cik": item["cik"], "metric": item["metric"], "frame": item["frame"]},
                {"$set": item},
                upsert=True,
            )
            for item in result.normalized_facts
        ]
        if aggregate_operations:
            aggregate_collection.bulk_write(aggregate_operations, ordered=False)
        if fact_operations:
            fact_collection.bulk_write(fact_operations, ordered=False)
