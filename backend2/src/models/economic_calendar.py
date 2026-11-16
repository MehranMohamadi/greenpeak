from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class ImportantCalendarEvent(BaseModel):
    event_id: str
    title_fa: str
    release_at: datetime
    importance: Literal["high"] = "high"
    actual: Any | None = None
    forecast: Any | None = None
    previous: Any | None = None
    source: str
    source_url: str


class ImportantCalendarData(BaseModel):
    items: list[ImportantCalendarEvent] = Field(default_factory=list)
    count: int
    window_start: datetime
    window_end: datetime
    generated_at: datetime
    source: str
    source_url: str


class ImportantCalendarResponse(BaseModel):
    ok: bool = True
    data: ImportantCalendarData
