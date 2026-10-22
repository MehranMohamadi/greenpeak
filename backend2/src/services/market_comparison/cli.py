"""Explicit bounded source check; writes only the comparison server cache.

python -m src.services.market_comparison.cli --symbols iran_total,iran_equal
Use --include-fx only after configuring NAVASAN_API_KEY and NAVASAN_QUOTE_UNIT.
"""
import argparse
import json
from concurrent.futures import ThreadPoolExecutor

from .definitions import DEFINITIONS
from .service import get_comparison_service


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--symbols", default="iran_total,iran_equal")
    parser.add_argument("--include-fx", action="store_true")
    args = parser.parse_args()
    keys = args.symbols.split(",")
    if set(keys) - set(DEFINITIONS):
        parser.error("Unsupported symbol")
    if args.include_fx:
        keys.append("usdirr")
    store = get_comparison_service().store
    def check(key):
        value = store.load(key, force=True)
        points = value["data"] if value else []
        return {"symbol": key, "status": "stale" if value and value["cache_stale"] else "available" if points else "unavailable",
            "count": len(points), "first_date": points[0]["date"] if points else None,
            "last_date": points[-1]["date"] if points else None,
            "invalid_rows": value.get("invalid_rows") if value else None,
            "duplicate_rows": value.get("duplicate_rows") if value else None,
            "source_series_id": value.get("source_series_id") if value else None}
    with ThreadPoolExecutor(max_workers=4) as pool:
        report = list(pool.map(check, keys))
    print(json.dumps(report, ensure_ascii=False))
    return 0 if all(row["status"] == "available" for row in report) else 2


if __name__ == "__main__":
    raise SystemExit(main())
