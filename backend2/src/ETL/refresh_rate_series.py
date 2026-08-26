"""Incrementally refresh DFF and DGS10 raw observations from FRED's public CSV.

Run from ``backend2``:

    python -m src.ETL.refresh_rate_series --dry-run
    python -m src.ETL.refresh_rate_series

Only observations newer than the latest stored date are considered. Existing
raw documents are protected with ``$setOnInsert`` and are never overwritten.
"""

from __future__ import annotations

import argparse
import csv
import io
import os
from dataclasses import dataclass
from datetime import UTC, date, datetime
from urllib.parse import urlencode
from urllib.request import urlopen

from pymongo import MongoClient, UpdateOne


@dataclass(frozen=True)
class RateSeries:
    indicator: str
    series_id: str
    name: str


RATE_SERIES = {
    "DFF": RateSeries("federal_funds_rate", "DFF", "Federal Funds Effective Rate"),
    "DGS10": RateSeries("ten_year_treasury", "DGS10", "10-Year Treasury Constant Maturity Rate"),
}


def parse_fred_csv(series_id: str, payload: str) -> list[tuple[str, float]]:
    reader = csv.DictReader(io.StringIO(payload))
    if not reader.fieldnames or "observation_date" not in reader.fieldnames or series_id not in reader.fieldnames:
        raise ValueError(f"Unexpected FRED CSV columns for {series_id}")

    observations: list[tuple[str, float]] = []
    for row in reader:
        observation_date = (row.get("observation_date") or "").strip()
        raw_value = (row.get(series_id) or "").strip()
        if not observation_date or not raw_value or raw_value == ".":
            continue
        date.fromisoformat(observation_date)
        observations.append((observation_date, float(raw_value)))
    return observations


def select_new_observations(
    observations: list[tuple[str, float]], latest_stored_date: str | None
) -> list[tuple[str, float]]:
    if latest_stored_date is None:
        return observations
    return [(day, value) for day, value in observations if day > latest_stored_date]


def fetch_fred_series(series_id: str) -> list[tuple[str, float]]:
    query = urlencode({"id": series_id})
    url = f"https://fred.stlouisfed.org/graph/fredgraph.csv?{query}"
    with urlopen(url, timeout=60) as response:  # noqa: S310 - fixed trusted host and whitelisted IDs
        payload = response.read().decode("utf-8-sig")
    return parse_fred_csv(series_id, payload)


def _load_settings():
    # Some shells reserve DEBUG for non-boolean values. Normalize it only for
    # this child process so the project's Pydantic settings can be loaded.
    debug_value = os.environ.get("DEBUG", "").strip().lower()
    if debug_value not in {"", "0", "1", "true", "false", "yes", "no", "on", "off"}:
        os.environ["DEBUG"] = "false"
    from ..core.config import get_settings

    return get_settings()


def refresh(collection, series: RateSeries, *, dry_run: bool) -> dict:
    latest = collection.find_one({"indicator": series.indicator}, sort=[("date", -1)])
    previous_latest = latest.get("date") if latest else None
    observations = fetch_fred_series(series.series_id)
    new_observations = select_new_observations(observations, previous_latest)
    source_latest = observations[-1] if observations else (None, None)

    inserted = 0
    if new_observations and not dry_run:
        ingested_at = datetime.now(UTC)
        operations = []
        for observation_date, value in new_observations:
            document = {
                "date": observation_date,
                "indicator": series.indicator,
                "value": value,
                "fred_series_id": series.series_id,
                "updated_at": ingested_at,
                "metadata": {
                    "name": series.name,
                    "frequency": "Daily",
                    "unit": "Percent",
                    "seasonal_adjustment": "Not Seasonally Adjusted",
                    "source": "Federal Reserve Economic Data (FRED)",
                    "retrieval": "fredgraph_csv",
                },
            }
            operations.append(
                UpdateOne(
                    {"indicator": series.indicator, "date": observation_date},
                    {"$setOnInsert": document},
                    upsert=True,
                )
            )
        inserted = collection.bulk_write(operations, ordered=False).upserted_count

    return {
        "series_id": series.series_id,
        "previous_latest": previous_latest,
        "source_latest": source_latest[0],
        "source_latest_value": source_latest[1],
        "candidate_count": len(new_observations),
        "inserted_count": inserted,
        "dry_run": dry_run,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Refresh the two GreenPeak rate series from FRED.")
    parser.add_argument("--series", default="DFF,DGS10", help="Comma-separated whitelist: DFF,DGS10")
    parser.add_argument("--dry-run", action="store_true", help="Fetch and report without writing to MongoDB")
    args = parser.parse_args()

    requested = [item.strip().upper() for item in args.series.split(",") if item.strip()]
    unknown = [item for item in requested if item not in RATE_SERIES]
    if unknown:
        parser.error(f"Unsupported series: {','.join(unknown)}")

    settings = _load_settings()
    client = MongoClient(settings.mongodb_url, serverSelectionTimeoutMS=5000)
    try:
        client.admin.command("ping")
        collection = client[settings.mongodb_database].monetary_policy
        for series_id in requested:
            result = refresh(collection, RATE_SERIES[series_id], dry_run=args.dry_run)
            print(
                f"{series_id}: previous={result['previous_latest']} "
                f"source={result['source_latest']} candidates={result['candidate_count']} "
                f"inserted={result['inserted_count']} dry_run={result['dry_run']}"
            )
    finally:
        client.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
