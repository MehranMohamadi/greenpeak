"""Read-only daily features for Yahoo/Cboe ^TNX, separate from FRED DGS10."""

from datetime import UTC, date, datetime

import pandas as pd

from ..models.treasury_yield import YahooTreasuryPreviewRequest
from .rate_features.builder import build_snapshot
from .rate_features.cleaning import CANONICAL_COLUMNS
from .rate_features.config import get_definition


def preview_yahoo_treasury(request: YahooTreasuryPreviewRequest, as_of: date | None = None):
    definition = get_definition("us_10y_treasury_yield")
    definition.update(
        indicator_id="cboe_10y_treasury_yield",
        name_en="Cboe 10-Year Treasury Yield (^TNX)",
        name_fa="بازده ۱۰سالهٔ خزانه · شاخص Cboe",
        definition_version="1.0.0",
        source={"provider": "Yahoo Finance / Cboe", "series_id": "^TNX", "collection": "live_preview"},
        raw_indicator="cboe_10y_treasury_yield",
    )
    definition["semantics"] = {
        **definition["semantics"],
        "source_basis": "Daily Yahoo Finance ^TNX yield-percent observations; distinct from FRED DGS10 constant-maturity yields.",
    }
    now = datetime.now(UTC)
    frame = pd.DataFrame([
        {"indicator_id": definition["indicator_id"], "observation_date": item.date,
         "value_pct": item.value, "source_provider": "Yahoo Finance / Cboe", "source_series_id": "^TNX",
         "ingested_at": now, "raw_document_id": None, "is_valid": True, "validation_flags": []}
        for item in request.observations
    ], columns=CANONICAL_COLUMNS)
    snapshot, _ = build_snapshot(definition, frame, as_of or now.date(), "yahoo-treasury-preview", "yahoo-treasury-1.0.0")
    if snapshot is None:
        raise ValueError("No valid daily Treasury observations")
    return snapshot
