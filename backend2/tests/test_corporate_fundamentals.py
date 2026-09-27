from datetime import datetime, timedelta
from pathlib import Path

import pytest

from src.services.corporate_fundamentals import (
    CORPORATE_METHODOLOGY_VERSION,
    build_sec_corporate_documents,
    extract_company_fundamentals,
    load_sp500_operating_eps,
)


def _flow(value, frame, end, filed="2026-05-01", form="10-Q"):
    start = (datetime.fromisoformat(end) - timedelta(days=89)).date().isoformat()
    return {
        "val": value,
        "frame": frame,
        "start": start,
        "end": end,
        "filed": filed,
        "form": form,
        "accn": f"{frame}-{value}",
    }


def _instant(value, frame, end, filed="2026-05-01"):
    return {
        "val": value,
        "frame": frame,
        "end": end,
        "filed": filed,
        "form": "10-Q",
        "accn": f"{frame}-{value}",
    }


def _company_payload(scale):
    periods = [
        ("CY2024Q1", "2024-03-31", 100, 10),
        ("CY2024Q2", "2024-06-30", 110, 11),
        ("CY2024Q3", "2024-09-30", 120, 12),
        ("CY2024Q4", "2024-12-31", 130, 13),
        ("CY2025Q1", "2025-03-31", 150, 15),
    ]
    return {
        "facts": {
            "us-gaap": {
                "RevenueFromContractWithCustomerExcludingAssessedTax": {
                    "units": {
                        "USD": [
                            _flow(revenue * scale, frame, end)
                            for frame, end, revenue, _ in periods
                        ]
                    }
                },
                "NetIncomeLoss": {
                    "units": {
                        "USD": [
                            _flow(net_income * scale, frame, end)
                            for frame, end, _, net_income in periods
                        ]
                    }
                },
                "Assets": {
                    "units": {
                        "USD": [
                            _instant(400 * scale, "CY2024Q1I", "2024-03-31"),
                            _instant(500 * scale, "CY2025Q1I", "2025-03-31"),
                        ]
                    }
                },
            }
        }
    }


def test_official_sp500_workbook_returns_reported_operating_eps():
    path = Path(__file__).parents[1] / "src" / "data" / "raw" / "sp-500-eps-est.xlsx"

    series = load_sp500_operating_eps(path)

    assert len(series.points) > 100
    assert series.points[-1].date == "2025-03-31"
    assert series.points[-1].value == pytest.approx(57.51)
    assert series.points[-1].is_estimate is False
    assert series.report_as_of == "2025-08-06"


def test_sec_aggregate_formulas_use_common_cohorts_and_summed_amounts():
    payloads = {"AAA": _company_payload(1), "BBB": _company_payload(2)}
    identifiers = {
        "AAA": {"cik": "1", "name": "Alpha"},
        "BBB": {"cik": "2", "name": "Beta"},
    }

    result = build_sec_corporate_documents(
        payloads,
        identifiers,
        expected_symbols=["AAA", "BBB"],
        holdings_as_of="2025-04-01",
        updated_at=datetime(2025, 5, 2),
    )

    latest = {
        item["indicator"]: item
        for item in result.aggregates
        if item["date"] == "2025-03-31"
    }
    assert latest["revenue_growth"]["value"] == pytest.approx(50.0)
    assert latest["profit_margins"]["value"] == pytest.approx(10.0)
    assert latest["return_on_assets"]["value"] == pytest.approx(153 / 1350 * 100)
    for item in latest.values():
        assert item["methodology_version"] == CORPORATE_METHODOLOGY_VERSION
        assert item["metadata"]["companies_received"] == 2
        assert item["metadata"]["coverage_pct"] == 100
        assert item["metadata"]["missing_symbols"] == []
    assert result.normalized_facts
    assert {item["metric"] for item in result.normalized_facts} == {
        "revenue",
        "net_income",
        "assets",
    }


def test_fourth_quarter_flow_is_derived_only_from_published_annual_and_q1_to_q3():
    payload = {
        "facts": {
            "us-gaap": {
                "Revenues": {
                    "units": {
                        "USD": [
                            _flow(20, "CY2024Q1", "2024-03-31"),
                            _flow(25, "CY2024Q2", "2024-06-30"),
                            _flow(30, "CY2024Q3", "2024-09-30"),
                            {
                                "val": 100,
                                "frame": "CY2024",
                                "start": "2024-01-01",
                                "end": "2024-12-31",
                                "filed": "2025-02-01",
                                "form": "10-K",
                                "accn": "annual",
                            },
                        ]
                    }
                }
            }
        }
    }

    company = extract_company_fundamentals(
        payload, symbol="AAA", cik="1", name="Alpha"
    )

    assert company.revenue["CY2024Q4"].value == pytest.approx(25)
    assert company.revenue["CY2024Q4"].derived is True
    assert company.revenue["CY2024Q4"].source_frames == (
        "CY2024",
        "CY2024Q1",
        "CY2024Q2",
        "CY2024Q3",
    )
