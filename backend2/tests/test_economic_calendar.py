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
