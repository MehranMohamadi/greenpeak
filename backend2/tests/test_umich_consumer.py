import os

os.environ["DEBUG"] = "false"

from src.services.umich_consumer import UmichConsumerClient, parse_umich_release


SAMPLE_PAGE = """
<html><main>
  <h1>Preliminary Results for September 2026</h1>
  <table id="front_table">
    <tr><td></td><td>Sep</td><td>Aug</td><td>Sep</td><td>M-M</td><td>Y-Y</td></tr>
    <tr><td></td><td>2026</td><td>2026</td><td>2025</td><td>Change</td><td>Change</td></tr>
    <tr><td>Index of Consumer Sentiment</td><td>47.8</td><td>51.7</td><td>55.1</td><td>-7.5%</td><td>-13.2%</td></tr>
  </table>
</main></html>
"""


def test_parse_umich_release_returns_current_and_previous_month():
    release = parse_umich_release(SAMPLE_PAGE)

    assert release.release_status == "preliminary"
    assert [(item.date, item.value, item.release_status) for item in release.observations] == [
        ("2026-08-01", 51.7, "final"),
        ("2026-09-01", 47.8, "preliminary"),
    ]


class _Response:
    text = SAMPLE_PAGE

    def raise_for_status(self):
        return None


def test_umich_client_caches_the_public_release():
    calls = []

    def http_get(url, **kwargs):
        calls.append((url, kwargs))
        return _Response()

    client = UmichConsumerClient(http_get=http_get)

    first = client.get_release()
    second = client.get_release()

    assert first is second
    assert len(calls) == 1
    assert first.observations[-1].value == 47.8
