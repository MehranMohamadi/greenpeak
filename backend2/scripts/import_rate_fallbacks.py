"""Import the checked-in DFF and daily Treasury fallback files into local MongoDB.

This helper is intentionally local and idempotent: it inserts a series only when
that exact indicator/series pair is absent. It never updates or deletes raw rows.
"""

from datetime import UTC, datetime
from pathlib import Path

import pandas as pd
from pymongo import MongoClient

from src.core.config import get_settings

RAW = Path(__file__).resolve().parents[1] / "src" / "data" / "raw"


def documents(path: Path, date_column: str, value_column: str, indicator: str, series_id: str):
    frame = pd.read_csv(path, usecols=[date_column, value_column])
    frame[date_column] = pd.to_datetime(frame[date_column], errors="coerce")
    frame[value_column] = pd.to_numeric(frame[value_column], errors="coerce")
    frame = frame.dropna().sort_values(date_column)
    imported_at = datetime.now(UTC)
    return [
        {
            "date": row[date_column].date().isoformat(),
            "indicator": indicator,
            "value": float(row[value_column]),
            "fred_series_id": series_id,
            "updated_at": imported_at,
            "metadata": {"frequency": "Daily", "unit": "Percent", "source": f"checked-in fallback:{path.name}"},
        }
        for _, row in frame.iterrows()
    ]


def main():
    settings = get_settings()
    client = MongoClient(settings.mongodb_url, serverSelectionTimeoutMS=5000)
    collection = client[settings.mongodb_database].monetary_policy
    sources = [
        ("DFF.csv", "DATE", "DFF", "federal_funds_rate", "DFF"),
        ("merged-treasury-rates-2000-2025.csv", "Date", "10 Yr", "ten_year_treasury", "DGS10"),
    ]
    result = {}
    for filename, date_column, value_column, indicator, series_id in sources:
        query = {"indicator": indicator, "fred_series_id": series_id}
        existing = collection.count_documents(query)
        if existing:
            result[series_id] = {"status": "already_present", "count": existing}
            continue
        values = documents(RAW / filename, date_column, value_column, indicator, series_id)
        if values:
            collection.insert_many(values, ordered=False)
        result[series_id] = {"status": "inserted", "count": len(values)}
    print(result)
    client.close()


if __name__ == "__main__":
    main()
