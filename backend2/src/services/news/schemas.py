from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, HttpUrl


class RawNewsItem(BaseModel):
    source: Literal["alpha_vantage", "cnbc_rss", "investing_rss"]
    source_item_id: str | None = None
    url: HttpUrl
    canonical_url: HttpUrl | None = None
    title: str = Field(min_length=1, max_length=1000)
    summary: str | None = None
    published_at: datetime
    fetched_at: datetime
    topics: list[str] = []
    tickers: list[str] = []
    alpha_overall_sentiment_score: float | None = None
    alpha_overall_sentiment_label: str | None = None
    raw_payload: dict[str, Any] = {}


