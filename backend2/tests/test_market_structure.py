from datetime import UTC, datetime, timedelta
from io import BytesIO
from zipfile import ZIP_DEFLATED, ZipFile

import pytest

from src.services.market_structure import (
    MarketStructureService,
    REQUIRED_SYMBOLS,
    SECTOR_ETFS,
    _relative_return,
    build_market_structure_payload,
    parse_spy_holdings_xlsx,
    parse_yahoo_adjusted_chart,
)


DATES = ["2024-12-31", "2025-01-08", "2025-10-01", "2025-12-01", "2025-12-24", "2025-12-31"]


def point(day, value):
    return {
        "time": int(datetime.fromisoformat(day).replace(tzinfo=UTC).timestamp()),
        "date": day,
        "value": value,
    }


def source_fixture():
    prices = {
        symbol: [point(day, 100 + index * 2) for index, day in enumerate(DATES)]
        for symbol in REQUIRED_SYMBOLS
    }
    prices["SPY"] = [point(day, value) for day, value in zip(DATES, [100, 101, 105, 108, 109, 110])]
    prices["RSP"] = [point(day, value) for day, value in zip(DATES, [50, 51, 54, 57, 59, 60])]
    prices["XLK"] = [point(day, value) for day, value in zip(DATES, [100, 102, 109, 116, 118, 120])]
    return {
        "holdings": [
            {"rank": rank, "symbol": f"C{rank}", "name": f"Company {rank}", "weight_pct": 11 - rank}
            for rank in range(1, 11)
        ],
        "holdings_observation_date": "2025-12-31",
        "sector_weights": [
            {"sector": name, "weight_pct": 100 / len(SECTOR_ETFS)}
            for name, _ in SECTOR_ETFS.values()
        ],
        "sector_weights_observation_date": "2025-12-31",
        "prices": prices,
    }


def test_group_6_calculations_rebase_sum_and_preserve_limitation():
    payload = build_market_structure_payload(
        source_fixture(),
        "1Y",
        "2026-01-01T00:00:00+00:00",
    )

    assert payload["blocks"]["company_concentration"]["top_10_weight_pct"] == pytest.approx(55)
    cap_series = payload["blocks"]["cap_vs_equal_weight"]["series"]
    assert [series["data"][0]["value"] for series in cap_series] == pytest.approx([100, 100])
    assert cap_series[1]["data"][-1]["value"] == pytest.approx(120)
    contribution = payload["blocks"]["company_contribution"]
    assert contribution["status"] == "unavailable"
    assert contribution["reason"] == "point_in_time_constituent_weights_and_membership_history_unavailable"
    assert "previous_weight_i" in contribution["formula"]
    assert payload["metadata"]["available_chart_count"] == 8


def test_relative_return_is_sector_total_return_minus_spy():
    sector = {"2024-12-31": 100, "2025-12-31": 120}
    spy = {"2024-12-31": 100, "2025-12-31": 110}
    assert _relative_return(sector, spy, "1Y") == pytest.approx(10)


def test_missing_relative_history_returns_null_not_zero():
    assert _relative_return({"2025-12-31": 120}, {"2025-12-31": 110}, "1Y") is None
    source = source_fixture()
    source["prices"]["XLU"] = [point("2025-12-31", 100)]
    payload = build_market_structure_payload(source, "1Y", "2026-01-01T00:00:00+00:00")
    utilities = next(
        row for row in payload["blocks"]["sector_relative_returns"]["heatmap"]
        if row["symbol"] == "XLU"
    )
    assert utilities["returns"]["1Y"] is None
    assert payload["metadata"]["missing_values"] == "null_not_zero"


def test_equal_weight_basket_contract_is_explicit():
    styles = build_market_structure_payload(
        source_fixture(),
        "1Y",
        "2026-01-01T00:00:00+00:00",
    )["blocks"]["styles"]
    assert styles["basket_composition"]["cyclical"] == ["XLY", "XLI", "XLF", "XLB", "XLE"]
    assert styles["basket_composition"]["defensive"] == ["XLP", "XLV", "XLU"]
    basket_series = [series for series in styles["series"] if series["symbol"] in {"CYCLICAL", "DEFENSIVE"}]
    assert len(basket_series) == 2
    assert all(series["data"][0]["value"] == pytest.approx(100) for series in basket_series)
    assert "arithmetic mean" in styles["formula"]


def test_yahoo_parser_uses_adjusted_close_and_skips_nulls():
    timestamps = [
        int(datetime(2025, 1, day, tzinfo=UTC).timestamp())
        for day in (2, 3, 4)
    ]
    payload = {
        "chart": {
            "result": [{
                "timestamp": timestamps,
                "indicators": {
                    "quote": [{"close": [999, 999, 999]}],
                    "adjclose": [{"adjclose": [100, None, 102]}],
                },
            }],
            "error": None,
        }
    }
    assert [item["value"] for item in parse_yahoo_adjusted_chart(payload, "SPY")] == [100, 102]


def _xlsx_cell(reference, value, numeric=False):
    if numeric:
        return f'<c r="{reference}"><v>{value}</v></c>'
    return f'<c r="{reference}" t="inlineStr"><is><t>{value}</t></is></c>'


def _holdings_workbook():
    rows = [
        f'<row r="1">{_xlsx_cell("A1", "Holdings:")}{_xlsx_cell("B1", "As of 31-Dec-2025")}</row>',
        f'<row r="2">{_xlsx_cell("A2", "Name")}{_xlsx_cell("B2", "Ticker")}{_xlsx_cell("C2", "Weight")}</row>',
    ]
    for rank in range(1, 11):
        excel_row = rank + 2
        rows.append(
            f'<row r="{excel_row}">'
            f'{_xlsx_cell(f"A{excel_row}", f"Company {rank}")}'
            f'{_xlsx_cell(f"B{excel_row}", f"C{rank}")}'
            f'{_xlsx_cell(f"C{excel_row}", 11 - rank, numeric=True)}'
            "</row>"
        )
    worksheet = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        f'<sheetData>{"".join(rows)}</sheetData></worksheet>'
    )
    buffer = BytesIO()
    with ZipFile(buffer, "w", ZIP_DEFLATED) as archive:
        archive.writestr("xl/worksheets/sheet1.xml", worksheet)
    return buffer.getvalue()


def test_state_street_xlsx_parser_extracts_date_ranking_and_weights():
    holdings, observation_date = parse_spy_holdings_xlsx(_holdings_workbook())
    assert observation_date == "2025-12-31"
    assert holdings[0] == {"symbol": "C1", "name": "Company 1", "weight_pct": 10, "rank": 1}
    assert holdings[-1]["weight_pct"] == 1


def test_failed_refresh_uses_verified_cache_and_marks_it_stale(tmp_path):
    clock = [datetime(2026, 1, 1, tzinfo=UTC)]
    service = MarketStructureService(cache_dir=tmp_path, now=lambda: clock[0])
    service._fetch_source = source_fixture
    assert service.get("1Y")["blocks"]["company_concentration"]["status"] == "available"

    clock[0] += timedelta(hours=13)
    service._fetch_source = lambda: (_ for _ in ()).throw(RuntimeError("offline"))
    stale = service.get("1Y")
    assert stale["blocks"]["company_concentration"]["status"] == "stale"
    assert stale["blocks"]["company_concentration"]["metadata"]["quality_reason"] == "upstream_refresh_failed"
