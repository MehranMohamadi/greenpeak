import os

os.environ["DEBUG"] = "false"

from src.services.data_service import DataService
from src.services.valuation_sources import (
    PublishedValuationPoint,
    PublishedValuationSeries,
    extract_latest_fed_report_url,
    parse_fed_forward_pe_table,
    parse_multpl_table,
)


def test_parse_multpl_table_sorts_rows_and_preserves_estimate_flag():
    document = """
    <html><table id="datatable">
      <tr><th>Date</th><th>Value</th></tr>
      <tr><td>Sep 1, 2026</td><td><span title="Estimate">29.12 estimate</span></td></tr>
      <tr><td>Aug 1, 2026</td><td>28.75</td></tr>
    </table></html>
    """

    points = parse_multpl_table(document)

    assert [point.date for point in points] == ["2026-08-01", "2026-09-01"]
    assert [point.value for point in points] == [28.75, 29.12]
    assert points[-1].is_estimate is True


def test_parse_fed_forward_pe_table_selects_the_named_table():
    document = """
    <table><thead><tr><th>Date</th><th>Other Ratio</th></tr></thead>
      <tr><th>2026-03-01</th><td>999</td></tr>
    </table>
    <table class="pubtables"><thead><tr><th>Date</th>
      <th>Forward Price-to-Earnings Ratio</th></tr></thead>
      <tr><th>2026-03-01</th><td>20.1243631066133</td></tr>
      <tr><th>2026-04-01</th><td>20.8488538170787</td></tr>
    </table>
    """

    points = parse_fed_forward_pe_table(document)

    assert [point.date for point in points] == ["2026-03-01", "2026-04-01"]
    assert points[-1].value == 20.8488538170787


def test_extract_latest_fed_report_url_uses_first_safe_chart_data_link():
    document = """
      <a href="/publications/2026-may-financial-stability-report-accessibility-tables.htm">Chart Data</a>
      <a href="/publications/2025-november-financial-stability-report-accessibility-tables.htm">Older</a>
    """

    assert extract_latest_fed_report_url(document) == (
        "https://www.federalreserve.gov/publications/"
        "2026-may-financial-stability-report-accessibility-tables.htm"
    )


class _FakePublishedSourceClient:
    def get_series(self, indicator_id):
        assert indicator_id == "pe_ratio"
        return PublishedValuationSeries(
            indicator_id="pe_ratio",
            points=(
                PublishedValuationPoint("2099-07-01", 27.0),
                PublishedValuationPoint("2099-08-01", 28.0),
                PublishedValuationPoint("2099-09-01", 29.0, is_estimate=True),
            ),
            description="S&P 500 trailing 12-month price-to-earnings ratio",
            unit="ratio",
            frequency="monthly",
            source="Multpl",
            source_provider="Multpl",
            source_url="https://www.multpl.com/s-p-500-pe-ratio/table/by-month",
            source_series_id="S&P 500 P/E Ratio",
            population="S&P 500 index",
            transformation="published values; GreenPeak generates no observations",
        )


def test_published_valuation_response_keeps_contract_and_filters_latest_points():
    service = DataService.__new__(DataService)
    service.mongodb = None
    service.valuation_sources = _FakePublishedSourceClient()

    response = service.get_valuation_pe_ratio_data(limit=2)

    assert [point.date for point in response.data] == ["2099-08-01", "2099-09-01"]
    assert [point.value for point in response.data] == [28.0, 29.0]
    assert response.metadata.source == "Multpl"
    assert response.metadata.source_provider == "Multpl"
    assert response.metadata.latest_observation_is_estimate is True
    assert response.metadata.quality_reason == "latest_source_observation_is_estimate"
    assert response.metadata.total_records == 2
