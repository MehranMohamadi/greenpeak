import os

os.environ["DEBUG"] = "false"

from src.services.fred_public import FredPublicSeriesClient, parse_fred_csv


def test_parse_fred_csv_keeps_valid_observations_and_skips_missing_values():
    payload = """observation_date,UMCSENT
2026-05-01,44.8
2026-06-01,.
2026-07-01,55.2
"""

    observations = parse_fred_csv("UMCSENT", payload)

    assert [(item.date, item.value) for item in observations] == [
        ("2026-05-01", 44.8),
        ("2026-07-01", 55.2),
    ]


class _Response:
    text = "observation_date,UMCSENT\n2026-07-01,55.2\n"

    def raise_for_status(self):
        return None


def test_fred_public_client_uses_the_whitelisted_series_and_cache():
    calls = []

    def http_get(url, **kwargs):
        calls.append((url, kwargs))
        return _Response()

    client = FredPublicSeriesClient(http_get=http_get)

    first = client.get_series("UMCSENT")
    second = client.get_series("UMCSENT")

    assert first is second
    assert len(calls) == 1
    assert calls[0][0].endswith("?id=UMCSENT")
    assert first.observations[-1].value == 55.2
