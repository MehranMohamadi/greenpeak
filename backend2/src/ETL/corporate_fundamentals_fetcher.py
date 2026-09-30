"""Refresh corporate fundamentals from SEC Company Facts and SPY holdings.

Run from ``backend2`` or directly from this directory:

    python src/ETL/corporate_fundamentals_fetcher.py --dry-run --max-companies 10
    python src/ETL/corporate_fundamentals_fetcher.py --dry-run --write-cache
    python src/ETL/corporate_fundamentals_fetcher.py
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys


BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from src.services.corporate_fundamentals_job import CorporateFundamentalsJob


def main() -> int:
    parser = argparse.ArgumentParser(description="Build SEC-backed corporate fundamentals")
    parser.add_argument("--dry-run", action="store_true", help="Fetch and calculate without MongoDB writes")
    parser.add_argument("--max-companies", type=int, default=None, help="Limit the SPY cohort for a smoke test")
    parser.add_argument("--workers", type=int, default=4, help="Concurrent SEC downloads (1-6)")
    parser.add_argument(
        "--write-cache",
        action="store_true",
        help="Write the validated file fallback (allowed with --dry-run for a cache-only refresh)",
    )
    args = parser.parse_args()
    try:
        summary = CorporateFundamentalsJob(workers=args.workers).run(
            write=not args.dry_run,
            max_companies=args.max_companies,
            write_cache=args.write_cache or not args.dry_run,
        )
        print(json.dumps(summary, ensure_ascii=False, indent=2, default=str))
        return 0
    except Exception as exc:
        print(f"Corporate fundamentals refresh failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
