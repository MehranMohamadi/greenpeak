"""Command-line entry point for deterministic rate feature builds."""

import argparse
import json
from datetime import date
from pathlib import Path

from pymongo import MongoClient

from ...core.config import get_settings
from .config import DEFINITIONS
from .job import run_feature_job
from .repository import MongoFeatureRepository


def main() -> int:
    parser = argparse.ArgumentParser(description="Build versioned GreenPeak rate feature snapshots")
    parser.add_argument("build", nargs="?")
    parser.add_argument("--indicators", default=",".join(DEFINITIONS))
    parser.add_argument("--as-of", default="latest", help="YYYY-MM-DD or latest (UTC today)")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--write-mongo", action="store_true")
    mode.add_argument("--dry-run", action="store_true")
    parser.add_argument("--output-json")
    args = parser.parse_args()
    indicators = [item.strip() for item in args.indicators.split(",") if item.strip()]
    unknown = sorted(set(indicators) - set(DEFINITIONS))
    if unknown:
        parser.error(f"unknown indicators: {', '.join(unknown)}")
    as_of = date.today() if args.as_of == "latest" else date.fromisoformat(args.as_of)
    settings = get_settings(); client = MongoClient(settings.mongodb_url, serverSelectionTimeoutMS=5000)
    repository = MongoFeatureRepository(client, settings.mongodb_database)
    try:
        snapshots, run = run_feature_job(repository, indicators, as_of, args.write_mongo)
        output = {"run": run.model_dump(mode="json"), "snapshots": snapshots}
        serialized = json.dumps(output, ensure_ascii=False, indent=2)
        if args.output_json:
            Path(args.output_json).write_text(serialized, encoding="utf-8")
        print(serialized)
        return 0 if run.status == "success" else 2 if run.status == "partial" else 1
    finally:
        client.close()


if __name__ == "__main__":
    raise SystemExit(main())
