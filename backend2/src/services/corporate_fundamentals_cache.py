"""Validated file cache for SEC-backed corporate aggregate snapshots."""

from __future__ import annotations

from datetime import date, datetime
import json
import math
from pathlib import Path
from typing import Any, Iterable, Mapping

from ..core.config import get_settings
from .corporate_fundamentals import (
    CORPORATE_METHODOLOGY_VERSION,
    CORPORATE_MIN_PUBLISHABLE_COVERAGE_PCT,
)


CORPORATE_CACHE_SCHEMA_VERSION = "1.0"
CORPORATE_CACHE_INDICATORS = frozenset(
    {"revenue_growth", "profit_margins", "return_on_assets"}
)


def default_corporate_cache_path() -> Path:
    return (
        get_settings().data_dir.parent
        / "cache"
        / "corporate_fundamentals"
        / "corporate_fundamentals.json"
    )


def _json_default(value: Any) -> str:
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    raise TypeError(f"unsupported cache value: {type(value).__name__}")


def _validated_document(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, Mapping):
        return None
    indicator = str(value.get("indicator") or "")
    if indicator not in CORPORATE_CACHE_INDICATORS:
        return None
    observation_date = str(value.get("date") or "")
    try:
        if date.fromisoformat(observation_date).isoformat() != observation_date:
            return None
        numeric_value = float(value.get("value"))
    except (TypeError, ValueError):
        return None
    if isinstance(value.get("value"), bool) or not math.isfinite(numeric_value):
        return None
    metadata = value.get("metadata")
    if not isinstance(metadata, Mapping):
        return None
    if (
        value.get("methodology_version") != CORPORATE_METHODOLOGY_VERSION
        or metadata.get("methodology_version") != CORPORATE_METHODOLOGY_VERSION
    ):
        return None
    try:
        coverage_pct = float(metadata.get("coverage_pct"))
    except (TypeError, ValueError):
        return None
    if (
        not math.isfinite(coverage_pct)
        or coverage_pct < CORPORATE_MIN_PUBLISHABLE_COVERAGE_PCT
    ):
        return None
    document = dict(value)
    document["indicator"] = indicator
    document["date"] = observation_date
    document["value"] = numeric_value
    document["metadata"] = dict(metadata)
    return document


def load_corporate_aggregate_cache(
    cache_path: Path | None = None,
) -> tuple[dict[str, Any], ...]:
    """Load only a complete cache matching the current methodology contract."""

    path = cache_path or default_corporate_cache_path()
    try:
        envelope = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return ()
    if not isinstance(envelope, dict):
        return ()
    if (
        envelope.get("schema_version") != CORPORATE_CACHE_SCHEMA_VERSION
        or envelope.get("methodology_version") != CORPORATE_METHODOLOGY_VERSION
        or not isinstance(envelope.get("aggregates"), list)
    ):
        return ()

    documents = [_validated_document(item) for item in envelope["aggregates"]]
    if any(document is None for document in documents):
        return ()
    validated = [document for document in documents if document is not None]
    if {document["indicator"] for document in validated} != CORPORATE_CACHE_INDICATORS:
        return ()
    validated.sort(key=lambda item: (item["indicator"], item["date"]))
    return tuple(validated)


def write_corporate_aggregate_cache(
    aggregates: Iterable[Mapping[str, Any]],
    *,
    holdings_as_of: str,
    built_at: datetime,
    cache_path: Path | None = None,
) -> Path:
    """Atomically write a complete, source-backed aggregate snapshot."""

    json_documents = json.loads(
        json.dumps(list(aggregates), ensure_ascii=False, default=_json_default)
    )
    documents = [_validated_document(item) for item in json_documents]
    if any(document is None for document in documents):
        raise ValueError("corporate aggregate cache contains an invalid document")
    validated = [document for document in documents if document is not None]
    if {document["indicator"] for document in validated} != CORPORATE_CACHE_INDICATORS:
        raise ValueError("corporate aggregate cache must contain all required indicators")
    validated.sort(key=lambda item: (item["indicator"], item["date"]))

    path = cache_path or default_corporate_cache_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".tmp")
    envelope = {
        "schema_version": CORPORATE_CACHE_SCHEMA_VERSION,
        "methodology_version": CORPORATE_METHODOLOGY_VERSION,
        "built_at": built_at.isoformat(),
        "holdings_as_of": holdings_as_of,
        "aggregates": validated,
    }
    temporary.write_text(
        json.dumps(envelope, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    temporary.replace(path)
    return path
