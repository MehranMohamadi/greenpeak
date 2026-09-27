"""Refresh the six Valuation API series from published S&P 500 sources.

Unlike the retired implementation, this job never synthesizes history from
index prices or random numbers.  Five series are copied from their published
tables and PEG is a disclosed trailing proxy calculated from published P/E and
earnings inputs by ``ValuationSourceClient``.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import sys
from typing import Dict, List

from pymongo import UpdateOne

from etl_config import setup_etl_environment


BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

# Some deployment shells use DEBUG=release as an application label.  Pydantic
# expects a boolean, and this fetcher does not need debug mode.
if os.getenv("DEBUG", "").strip().lower() not in {
    "1",
    "0",
    "true",
    "false",
    "yes",
    "no",
    "on",
    "off",
}:
    os.environ["DEBUG"] = "false"

from src.services.valuation_sources import (  # noqa: E402
    PublishedValuationSeries,
    ValuationSourceClient,
)


INDICATORS = (
    "pe_ratio",
    "forward_pe",
    "price_to_book",
    "price_to_sales",
    "peg_ratio",
    "dividend_yield",
)


class ValuationDataFetcher:
    """Fetch verified published valuation observations and optionally persist them."""

    def __init__(self, *, write: bool = True) -> None:
        self.logger, self.db = setup_etl_environment("valuation_fetcher")
        self.source_client = ValuationSourceClient()
        self.write = write

    @staticmethod
    def _documents(series: PublishedValuationSeries) -> List[Dict]:
        fetched_at = datetime.now(timezone.utc).isoformat()
        proxy = series.indicator_id == "peg_ratio"
        return [
            {
                "indicator": series.indicator_id,
                "date": point.date,
                "value": point.value,
                "metadata": {
                    "description": series.description,
                    "unit": series.unit,
                    "frequency": series.frequency,
                    "source": series.source,
                    "source_provider": series.source_provider,
                    "source_url": series.source_url,
                    "source_series_id": series.source_series_id,
                    "population": series.population,
                    "transformation": series.transformation,
                    "is_estimate": point.is_estimate,
                    "proxy": proxy,
                    "methodology_version": "published_sp500_valuation_v1",
                    "formula_version": (
                        "trailing_peg_5y_eps_cagr_v1" if proxy else None
                    ),
                },
                "updated_at": fetched_at,
            }
            for point in series.points
        ]

    def _save(self, documents: List[Dict]) -> int:
        if not self.write or self.db is None or not documents:
            return 0
        operations = [
            UpdateOne(
                {"indicator": document["indicator"], "date": document["date"]},
                {"$set": document},
                upsert=True,
            )
            for document in documents
        ]
        result = self.db.valuation.bulk_write(operations, ordered=False)
        return result.upserted_count + result.modified_count

    def run_full_fetch(self) -> Dict:
        results: Dict[str, Dict] = {}
        for indicator_id in INDICATORS:
            try:
                series = self.source_client.get_series(indicator_id)
                documents = self._documents(series)
                written = self._save(documents)
                results[indicator_id] = {
                    "status": "ok",
                    "records": len(documents),
                    "written": written,
                    "latest_date": documents[-1]["date"] if documents else None,
                    "source": series.source,
                }
                self.logger.info(
                    "Fetched %s: %d verified observations", indicator_id, len(documents)
                )
            except Exception as exc:
                results[indicator_id] = {
                    "status": "error",
                    "error": str(exc),
                }
                self.logger.error("Failed to fetch %s: %s", indicator_id, exc)

        successful = sum(result["status"] == "ok" for result in results.values())
        return {
            "status": "complete" if successful == len(INDICATORS) else "partial",
            "successful_indicators": successful,
            "total_indicators": len(INDICATORS),
            "mongo_write_enabled": self.write and self.db is not None,
            "indicators": results,
        }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Refresh published S&P 500 valuation series"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Fetch and validate all sources without writing MongoDB",
    )
    args = parser.parse_args()
    summary = ValuationDataFetcher(write=not args.dry_run).run_full_fetch()
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0 if summary["status"] == "complete" else 1


if __name__ == "__main__":
    raise SystemExit(main())
