"""Adapters and validation for immutable raw monetary observations."""

from datetime import date
from math import isfinite
from typing import Any, Iterable

import pandas as pd

CANONICAL_COLUMNS = [
    "indicator_id", "observation_date", "value_pct", "source_provider",
    "source_series_id", "ingested_at", "raw_document_id", "is_valid", "validation_flags",
]


def adapt_mongo_documents(documents: Iterable[dict[str, Any]], indicator_id: str) -> pd.DataFrame:
    rows = []
    for document in documents:
        flags: list[str] = []
        parsed_date = pd.to_datetime(document.get("date"), errors="coerce", utc=True)
        raw_value = document.get("value")
        try:
            value = float(raw_value)
            if not isfinite(value):
                raise ValueError
        except (TypeError, ValueError):
            value = None
            flags.append("invalid_value")
        if pd.isna(parsed_date):
            flags.append("invalid_date")
            observation_date = None
        else:
            observation_date = parsed_date.date()
        metadata = document.get("metadata") or {}
        rows.append({
            "indicator_id": indicator_id,
            "observation_date": observation_date,
            "value_pct": value,
            "source_provider": metadata.get("source", "FRED"),
            "source_series_id": document.get("fred_series_id"),
            "ingested_at": pd.to_datetime(document.get("updated_at"), errors="coerce", utc=True),
            "raw_document_id": str(document.get("_id")) if document.get("_id") is not None else None,
            "is_valid": not flags,
            "validation_flags": flags,
        })
    return pd.DataFrame(rows, columns=CANONICAL_COLUMNS)


def clean_observations(frame: pd.DataFrame, as_of_date: date) -> tuple[pd.DataFrame, list[str], int]:
    if frame.empty:
        return frame.copy(), ["no_observations"], 0
    working = frame.copy()
    received = len(working)
    working = working[working["observation_date"].notna()]
    working = working[working["observation_date"] <= as_of_date]
    duplicate_dates = working[working.duplicated("observation_date", keep=False)]["observation_date"].nunique()
    flags = [f"duplicate_dates:{duplicate_dates}"] if duplicate_dates else []
    working["_ingested_sort"] = pd.to_datetime(working["ingested_at"], errors="coerce", utc=True)
    working = working.sort_values(["observation_date", "_ingested_sort"], na_position="first")
    valid = working[working["is_valid"] & working["value_pct"].notna()]
    valid = valid.drop_duplicates("observation_date", keep="last").drop(columns="_ingested_sort")
    return valid.sort_values("observation_date").reset_index(drop=True), flags, received
