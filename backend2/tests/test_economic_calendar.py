import os
from datetime import UTC, datetime

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
        ]


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
