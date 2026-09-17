from datetime import UTC, datetime

import pytest

from src.services.official_sentiment import (
    OfficialSentimentService,
    filter_payload,
    parse_aaii_html,
    parse_cboe_daily_ratio,
    parse_cboe_spx_archive,
    parse_cboe_volatility_csv,
    parse_cftc_rows,
)


def test_cboe_archive_parser_uses_put_call_ratio():
    rows = parse_cboe_spx_archive(b"DATE,CALL,PUT,P/C Ratio\n09/03/2026,10,20,2.0\n")
    assert rows == [{"time": 1788393600, "date": "2026-09-03", "value": 2.0}]


def test_cboe_daily_parser_extracts_spx_and_spxw_ratio():
    point = parse_cboe_daily_ratio(
        "<table><tr><td>SPX + SPXW PUT/CALL RATIO</td><td>1.23</td></tr></table>",
        datetime(2026, 9, 4).date(),
    )
    assert point and point["date"] == "2026-09-04" and point["value"] == 1.23


def test_aaii_html_parser_preserves_three_reported_shares():
    series = parse_aaii_html(
        "<table><tr><th>Date</th><th>Bullish</th><th>Neutral</th><th>Bearish</th></tr>"
        "<tr><td>9/3</td><td>41.2%</td><td>30.0%</td><td>28.8%</td></tr></table>",
        2026,
    )
    assert series["bullish"][-1]["value"] == 41.2
    assert series["bearish"][-1]["date"] == "2026-09-03"


def test_cftc_parser_calculates_both_tff_net_positions():
    series = parse_cftc_rows([{
        "cftc_contract_market_code": "13874A",
        "report_date_as_yyyy_mm_dd": "2026-09-01",
        "asset_mgr_positions_long": "125,000",
        "asset_mgr_positions_short": "25,000",
        "lev_money_positions_long": "45,000",
        "lev_money_positions_short": "80,000",
    }])
    assert series["asset_manager_net"][0]["value"] == 100000
    assert series["leveraged_money_net"][0]["value"] == -35000


def test_vix_parser_reads_official_close_column():
    rows = parse_cboe_volatility_csv(b"DATE,OPEN,HIGH,LOW,CLOSE\n09/03/2026,15,17,14,16.25\n", "VIX")
    assert rows[-1]["value"] == 16.25


def test_cache_is_returned_as_stale_after_refresh_failure(tmp_path):
    clock = [datetime(2026, 9, 2, tzinfo=UTC)]
    service = OfficialSentimentService(cache_dir=tmp_path, now=lambda: clock[0], persist=False)
    service._fetch_spx_put_call_ratio = lambda: service._payload(
        "spx_put_call_ratio",
        [{"time": 1788220800, "date": "2026-09-01", "value": 1.1}],
        {},
        "Cboe Global Markets",
        "https://www.cboe.com/",
        "test fixture",
    )
    assert service.get("spx_put_call_ratio")["metadata"]["quality_status"] == "available"
    clock[0] = datetime(2026, 9, 3, tzinfo=UTC)
    service._fetch_spx_put_call_ratio = lambda: (_ for _ in ()).throw(RuntimeError("offline"))
    cached = service.get("spx_put_call_ratio")
    assert cached["data"][-1]["value"] == 1.1
    assert cached["metadata"]["quality_status"] == "stale"
    assert cached["metadata"]["quality_reason"] == "upstream_refresh_failed"


def test_filter_contract_validates_dates_and_filters_all_series():
    payload = {
        "data": [{"date": "2026-09-01", "value": 1}, {"date": "2026-09-02", "value": 2}],
        "series": {"detail": [{"date": "2026-09-01", "value": 3}, {"date": "2026-09-02", "value": 4}]},
        "metadata": {"returned_records": 2},
    }
    filtered = filter_payload(payload, limit=1, start_date="2026-09-01", end_date="2026-09-02")
    assert filtered["data"] == [{"date": "2026-09-02", "value": 2}]
    assert filtered["series"]["detail"] == [{"date": "2026-09-02", "value": 4}]
    assert filtered["metadata"]["returned_records"] == 1
    with pytest.raises(ValueError):
        filter_payload(payload, start_date="09/01/2026")
