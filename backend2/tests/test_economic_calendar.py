import os
from datetime import UTC, datetime
from datetime import timedelta

import httpx
import pytest

os.environ["DEBUG"] = "false"

from src.services import economic_calendar


class FakeResponse:
    def raise_for_status(self):
        return None

    def json(self):
        return [
            {
                "Id": 2,
                "Url": "/en/economic-calendar/widget/united-states/nonfarm-payrolls",
                "EventName": "Nonfarm Payrolls",
                "Importance": "high",
                "CurrencyCode": "USD",
                "Country": 840,
                "ReleaseDate": 1_790_944_200_000,
                "ForecastValue": "52 K",
                "PreviousValue": "162 K",
            },
            {
                "Id": 1,
                "Url": "/en/economic-calendar/widget/united-states/initial-jobless-claims",
                "EventName": "Initial Jobless Claims",
                "Importance": "high",
                "CurrencyCode": "USD",
                "Country": 840,
                "ReleaseDate": 1_790_253_000_000,
                "ForecastValue": "189 K",
                "PreviousValue": "196 K",
            },
            {
                "Id": 3,
                "Url": "/en/economic-calendar/widget/united-states/existing-home-sales",
                "EventName": "Existing Home Sales",
                "Importance": "medium",
                "CurrencyCode": "USD",
                "Country": 840,
                "ReleaseDate": 1_790_260_000_000,
            },
            {
                "Id": 4,
                "Url": "/en/economic-calendar/widget/united-states/retail-sales-mm",
                "EventName": "Retail Sales",
                "Importance": "high",
                "CurrencyCode": "USD",
                "Country": 840,
                "ReleaseDate": 1_789_900_000_000,
                "ActualValue": "0.4%",
                "ForecastValue": "0.2%",
                "PreviousValue": "-0.1%",
            },
        ]


class FakeTradingViewResponse:
    def raise_for_status(self):
        return None

    def json(self):
        return {
            "status": "ok",
            "result": [
                {
                    "id": "future-low",
                    "title": "Minor Release",
                    "country": "US",
                    "currency": "USD",
                    "importance": 0,
                    "date": "2026-09-25T10:00:00.000Z",
                },
                {
                    "id": "future-high",
                    "title": "Initial Jobless Claims",
                    "country": "US",
                    "currency": "USD",
                    "importance": 1,
                    "date": "2026-09-25T12:30:00.000Z",
                    "forecast": 190,
                    "previous": 196,
                    "unit": "K",
                },
                {
                    "id": "released-high",
                    "title": "Retail Sales MoM",
                    "country": "US",
                    "currency": "USD",
                    "importance": 1,
                    "date": "2026-09-20T12:30:00.000Z",
                    "actual": 0.4,
                    "forecast": 0.2,
                    "previous": -0.1,
                    "unit": "%",
                },
            ],
        }


def test_upcoming_calendar_filters_sorts_and_translates(monkeypatch):
    captured = {}

    def fake_get(url, **kwargs):
        captured["url"] = url
        captured.update(kwargs)
        return FakeResponse()

    monkeypatch.setattr(economic_calendar.httpx, "get", fake_get)
    events = economic_calendar.fetch_upcoming_us_events(
        now=datetime(2026, 9, 21, tzinfo=UTC),
        days=14,
        limit=6,
    )

    assert captured["url"] == economic_calendar.TRADAYS_CONTENT_URL
    assert captured["params"]["importance"] == 8
    assert captured["params"]["currencies"] == 1
    assert [item["event_id"] for item in events] == ["1", "2"]
    assert events[0]["title_fa"] == "درخواست‌های اولیه بیمه بیکاری"
    assert events[1]["title_fa"] == "اشتغال غیرکشاورزی آمریکا"
    assert events[0]["release_at"].endswith("+00:00")


def test_recent_calendar_returns_released_values_without_country(monkeypatch):
    monkeypatch.setattr(economic_calendar.httpx, "get", lambda *args, **kwargs: FakeResponse())
    events = economic_calendar.fetch_recent_us_events(
        now=datetime.fromtimestamp(1_790_253_000, tz=UTC),
        days=14,
        limit=6,
    )

    assert len(events) == 1
    assert events[0]["title_fa"] == "خرده‌فروشی ماهانه آمریکا"
    assert events[0]["actual"] == "0.4%"
    assert events[0]["forecast"] == "0.2%"
    assert events[0]["previous"] == "-0.1%"
    assert "country" not in events[0]


def test_upcoming_calendar_falls_back_to_tradingview(monkeypatch):
    calls = []

    def fake_get(url, **kwargs):
        calls.append((url, kwargs))
        if url == economic_calendar.TRADAYS_CONTENT_URL:
            raise httpx.ConnectError("primary calendar unavailable")
        return FakeTradingViewResponse()

    monkeypatch.setattr(economic_calendar.httpx, "get", fake_get)
    events = economic_calendar.fetch_upcoming_us_events(
        now=datetime(2026, 9, 24, tzinfo=UTC),
        days=14,
        limit=6,
    )

    assert [call[0] for call in calls] == [
        economic_calendar.TRADAYS_CONTENT_URL,
        economic_calendar.TRADINGVIEW_CALENDAR_URL,
    ]
    assert len(events) == 1
    assert events[0]["event_id"] == "tradingview-future-high"
    assert events[0]["title_fa"] == "درخواست‌های اولیه بیمه بیکاری"
    assert events[0]["forecast"] == "190K"
    assert events[0]["source"] == "TradingView Economic Calendar"


def test_recent_calendar_falls_back_to_tradingview_with_actual_values(monkeypatch):
    def fake_get(url, **kwargs):
        if url == economic_calendar.TRADAYS_CONTENT_URL:
            raise httpx.ConnectError("primary calendar unavailable")
        return FakeTradingViewResponse()

    monkeypatch.setattr(economic_calendar.httpx, "get", fake_get)
    events = economic_calendar.fetch_recent_us_events(
        now=datetime(2026, 9, 24, tzinfo=UTC),
        days=14,
        limit=6,
    )

    assert len(events) == 1
    assert events[0]["event_id"] == "tradingview-released-high"
    assert events[0]["title_fa"] == "خرده‌فروشی ماهانه آمریکا"
    assert events[0]["actual"] == "0.4%"
    assert events[0]["forecast"] == "0.2%"
    assert events[0]["previous"] == "-0.1%"


def timeline_row(identifier, release, **changes):
    return {"Id": identifier, "Url": "/en/economic-calendar/widget/united-states/retail-sales-mm",
            "Importance": "high", "CurrencyCode": "USD", "Country": 840,
            "ReleaseDate": int(release.timestamp() * 1000), **changes}


def test_timeline_has_no_top_n_cut_and_keeps_pending_past_events(monkeypatch):
    anchor = datetime(2026, 11, 16, 12, tzinfo=UTC)
    rows = [timeline_row(index, anchor - timedelta(minutes=index + 1)) for index in range(35)]
    rows += [rows[0], timeline_row("future", anchor + timedelta(hours=1), ActualValue="must not leak"),
             timeline_row("outside", anchor - timedelta(days=9)),
             timeline_row("low", anchor, Importance="medium"), None]
    captured = {}

    def fetch(start, end, timeout):
        captured.update(start=start, end=end)
        return rows

    monkeypatch.setattr(economic_calendar, "_fetch_calendar_rows", fetch)
    result = economic_calendar.fetch_important_us_timeline(now=anchor)
    assert result.count == 36
    assert len(result.items) == 36
    assert result.items[0].event_id == "34"
    assert result.items[-1].event_id == "future"
    assert all(item.actual is None for item in result.items)
    assert captured["start"] == datetime(2026, 11, 8, 20, 30, tzinfo=UTC)
    assert captured["end"] == datetime(2026, 11, 23, 20, 30, tzinfo=UTC)


def test_timeline_fallback_keeps_past_events_without_actual_and_filters_window(monkeypatch):
    anchor = datetime(2026, 11, 16, 21, tzinfo=UTC)  # Next calendar day in Tehran.
    def unavailable(*args):
        raise httpx.ConnectError("private upstream details")
    monkeypatch.setattr(economic_calendar, "_fetch_calendar_rows", unavailable)
    monkeypatch.setattr(economic_calendar, "_fetch_tradingview_rows", lambda *args: [
        {"id": name, "title": "Initial Jobless Claims", "date": date, "country": "US", "currency": "USD", "importance": 1}
        for name, date in [("past", "2026-11-16T12:30:00Z"), ("future", "2026-11-18T12:30:00Z"), ("outside", "2026-10-01T12:00:00Z")]
    ])
    result = economic_calendar.fetch_important_us_timeline(now=anchor)
    assert [item.event_id for item in result.items] == ["tradingview-past", "tradingview-future"]
    assert result.window_start == datetime(2026, 11, 9, 20, 30, tzinfo=UTC)
    assert result.source == "TradingView Economic Calendar"


def test_timeline_endpoint_and_health_without_network_or_database(monkeypatch):
    from fastapi.testclient import TestClient
    from src.main import app
    from src.api.v1.endpoints import news
    from src.models.economic_calendar import ImportantCalendarData

    anchor = datetime(2026, 11, 16, tzinfo=UTC)
    captured = {}
    def fetch(**kwargs):
        captured.update(kwargs)
        return ImportantCalendarData(items=[], count=0, window_start=anchor, window_end=anchor + timedelta(days=2), generated_at=anchor, source="Tradays / MQL5", source_url=economic_calendar.TRADAYS_BASE_URL)
    monkeypatch.setattr(news, "fetch_important_us_timeline", fetch)
    client = TestClient(app)
    response = client.get("/api/v1/news/calendar/timeline?days_before=7&days_after=8")
    assert response.status_code == 200
    assert response.json()["data"]["count"] == 0
    assert captured == {"days_before": 7, "days_after": 8}
    assert client.get("/health").status_code == 200
    assert client.get("/api/v1/news/calendar/timeline?days_before=0").status_code == 422
    assert client.get("/api/v1/news/calendar/timeline?days_after=15").status_code == 422

    def unavailable(**kwargs):
        raise httpx.ConnectError("private upstream details")
    monkeypatch.setattr(news, "fetch_important_us_timeline", unavailable)
    failed = client.get("/api/v1/news/calendar/timeline")
    assert failed.status_code == 503
    assert "private upstream" not in failed.text


@pytest.mark.parametrize("before,after", [(0, 7), (7, 15)])
def test_timeline_rejects_unbounded_windows(before, after):
    with pytest.raises(ValueError):
        economic_calendar.fetch_important_us_timeline(days_before=before, days_after=after)
