"""Official-source adapters and formulas for corporate fundamentals.

The customer-facing series use two distinct source contracts:

* S&P 500 operating EPS is read from the checked-in S&P Dow Jones workbook.
* Multpl's monthly real EPS and quarterly nominal sales growth are loaded from
  manually refreshed CSV snapshots.
* Profit margin and ROA are calculated from SEC Company Facts for the current
  State Street SPY holdings cohort by the offline ETL job.

This module contains no database writes.  Parsing and financial formulas stay
pure so they can be tested without MongoDB or network access.
"""

from __future__ import annotations

import csv
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from io import BytesIO
import math
from pathlib import Path
import re
from typing import Any, Iterable, Mapping
from zipfile import ZipFile
import xml.etree.ElementTree as ET

from ..core.config import get_settings


S_AND_P_EPS_URL = (
    "https://www.spglobal.com/spdji/en/documents/additional-material/"
    "sp-500-eps-est.xlsx"
)
MULTPL_SP500_EARNINGS_URL = "https://www.multpl.com/s-p-500-earnings/table/by-month"
MULTPL_SP500_EARNINGS_BASIS = "July 2026 dollars"
MULTPL_SP500_SALES_GROWTH_URL = (
    "https://www.multpl.com/s-p-500-sales-growth/table/by-quarter"
)
SEC_COMPANYFACTS_URL = "https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json"
CORPORATE_METHODOLOGY_VERSION = "sec_companyfacts_spy_current_cohort_v2"
CORPORATE_FORMULA_VERSION = "1.0"
CORPORATE_MIN_PUBLISHABLE_COVERAGE_PCT = 60.0

REVENUE_TAGS = (
    "RevenueFromContractWithCustomerExcludingAssessedTax",
    "Revenues",
    "SalesRevenueNet",
    "SalesRevenueGoodsNet",
    "SalesRevenueServicesNet",
)
NET_INCOME_TAGS = ("NetIncomeLoss", "ProfitLoss")
ASSET_TAGS = ("Assets",)

_MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
_REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
_PACKAGE_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
_FLOW_FORMS = {"10-Q", "10-Q/A", "10-K", "10-K/A", "20-F", "20-F/A", "40-F", "40-F/A"}
_QUARTER_FRAME = re.compile(r"^CY(?P<year>\d{4})Q(?P<quarter>[1-4])$")
_INSTANT_QUARTER_FRAME = re.compile(r"^CY(?P<year>\d{4})Q(?P<quarter>[1-4])I?$")
_ANNUAL_FRAME = re.compile(r"^CY(?P<year>\d{4})$")
_INSTANT_ANNUAL_FRAME = re.compile(r"^CY(?P<year>\d{4})I$")


class CorporateFundamentalsSourceError(RuntimeError):
    """Raised when an official-source document cannot be validated."""


@dataclass(frozen=True)
class PublishedCorporatePoint:
    date: str
    value: float
    is_estimate: bool = False


@dataclass(frozen=True)
class PublishedCorporateSeries:
    points: tuple[PublishedCorporatePoint, ...]
    report_as_of: str | None
    source_path: Path


@dataclass(frozen=True)
class FactObservation:
    frame: str
    value: float
    tag: str
    unit: str
    filed: str | None
    period_end: str | None
    form: str | None
    accession: str | None
    derived: bool = False
    source_frames: tuple[str, ...] = ()


@dataclass(frozen=True)
class CompanyFundamentals:
    symbol: str
    cik: str
    name: str
    revenue: Mapping[str, FactObservation]
    net_income: Mapping[str, FactObservation]
    assets: Mapping[str, FactObservation]


@dataclass(frozen=True)
class CorporateBuildResult:
    aggregates: tuple[dict[str, Any], ...]
    normalized_facts: tuple[dict[str, Any], ...]
    companies_expected: int
    companies_with_any_facts: int


def _column_index(reference: str) -> int:
    match = re.match(r"[A-Z]+", reference.upper())
    if not match:
        return 0
    result = 0
    for letter in match.group(0):
        result = result * 26 + ord(letter) - 64
    return result - 1


def _xlsx_sheet_rows(workbook_path: Path, sheet_name: str) -> list[list[str]]:
    """Read cached values from one XLSX sheet using only the standard library."""

    try:
        with ZipFile(workbook_path) as workbook:
            shared: list[str] = []
            if "xl/sharedStrings.xml" in workbook.namelist():
                shared_root = ET.fromstring(workbook.read("xl/sharedStrings.xml"))
                shared = [
                    "".join(node.text or "" for node in item.iter(f"{{{_MAIN_NS}}}t"))
                    for item in shared_root.findall(f"{{{_MAIN_NS}}}si")
                ]

            book_root = ET.fromstring(workbook.read("xl/workbook.xml"))
            relationships_root = ET.fromstring(
                workbook.read("xl/_rels/workbook.xml.rels")
            )
            relationships = {
                item.get("Id"): item.get("Target")
                for item in relationships_root.findall(f"{{{_PACKAGE_REL_NS}}}Relationship")
            }
            sheet = next(
                (
                    item
                    for item in book_root.findall(f".//{{{_MAIN_NS}}}sheet")
                    if item.get("name") == sheet_name
                ),
                None,
            )
            if sheet is None:
                raise CorporateFundamentalsSourceError(
                    f"S&P workbook is missing sheet: {sheet_name}"
                )
            relationship_id = sheet.get(f"{{{_REL_NS}}}id")
            target = relationships.get(relationship_id)
            if not target:
                raise CorporateFundamentalsSourceError(
                    f"S&P workbook has no relationship for sheet: {sheet_name}"
                )
            target = target.lstrip("/")
            if not target.startswith("xl/"):
                target = f"xl/{target}"
            sheet_root = ET.fromstring(workbook.read(target))

            rows: list[list[str]] = []
            for row in sheet_root.findall(f".//{{{_MAIN_NS}}}row"):
                values: list[str] = []
                for cell in row.findall(f"{{{_MAIN_NS}}}c"):
                    index = _column_index(cell.get("r", "A1"))
                    while len(values) <= index:
                        values.append("")
                    kind = cell.get("t")
                    value_node = cell.find(f"{{{_MAIN_NS}}}v")
                    if kind == "inlineStr":
                        value = "".join(
                            node.text or ""
                            for node in cell.iter(f"{{{_MAIN_NS}}}t")
                        )
                    elif value_node is None:
                        value = ""
                    elif kind == "s":
                        shared_index = int(value_node.text or "0")
                        value = shared[shared_index] if shared_index < len(shared) else ""
                    else:
                        value = value_node.text or ""
                    values[index] = value.strip()
                rows.append(values)
            return rows
    except CorporateFundamentalsSourceError:
        raise
    except (OSError, KeyError, ValueError, ET.ParseError) as exc:
        raise CorporateFundamentalsSourceError("S&P EPS workbook could not be read") from exc


def _excel_date(value: str) -> str | None:
    try:
        serial = float(value)
        parsed = date(1899, 12, 30) + timedelta(days=int(serial))
        return parsed.isoformat()
    except (TypeError, ValueError, OverflowError):
        return None


def load_sp500_operating_eps(
    workbook_path: Path | None = None,
) -> PublishedCorporateSeries:
    """Load reported quarterly S&P 500 operating EPS from the official workbook."""

    path = workbook_path or get_settings().data_dir / "sp-500-eps-est.xlsx"
    rows = _xlsx_sheet_rows(path, "QUARTERLY DATA")
    if len(rows) < 8:
        raise CorporateFundamentalsSourceError("S&P EPS workbook has insufficient rows")

    def value(row_index: int, column_index: int) -> str:
        row = rows[row_index] if row_index < len(rows) else []
        return row[column_index] if column_index < len(row) else ""

    expected_headers = (
        value(3, 1).upper(),
        value(4, 1).upper(),
        value(5, 1).upper(),
    )
    if expected_headers != ("OPERATING", "EARNINGS", "PER SHR"):
        raise CorporateFundamentalsSourceError(
            "S&P EPS workbook operating-EPS columns changed"
        )

    by_date: dict[str, PublishedCorporatePoint] = {}
    for row in rows[6:]:
        if len(row) < 2:
            continue
        observation_date = _excel_date(row[0])
        try:
            eps = float(row[1])
        except (TypeError, ValueError):
            continue
        if observation_date and math.isfinite(eps):
            by_date[observation_date] = PublishedCorporatePoint(
                date=observation_date,
                value=eps,
                is_estimate=False,
            )
    points = tuple(by_date[key] for key in sorted(by_date))
    if len(points) < 8:
        raise CorporateFundamentalsSourceError(
            "S&P EPS workbook returned insufficient reported observations"
        )

    report_as_of = None
    try:
        report_rows = _xlsx_sheet_rows(path, "ESTIMATES&PEs")
        if len(report_rows) > 1 and report_rows[1]:
            report_as_of = _excel_date(report_rows[1][0])
    except CorporateFundamentalsSourceError:
        pass
    return PublishedCorporateSeries(
        points=points,
        report_as_of=report_as_of,
        source_path=path,
    )


def load_sp500_operating_eps_ttm(
    workbook_path: Path | None = None,
) -> PublishedCorporateSeries:
    """Derive trailing-four-quarter operating EPS from reported S&P values."""

    quarterly = load_sp500_operating_eps(workbook_path)
    points: list[PublishedCorporatePoint] = []
    for index in range(3, len(quarterly.points)):
        window = quarterly.points[index - 3 : index + 1]
        quarter_indexes = []
        for point in window:
            parsed = date.fromisoformat(point.date)
            quarter_indexes.append(parsed.year * 4 + (parsed.month - 1) // 3)
        if quarter_indexes != list(range(quarter_indexes[0], quarter_indexes[0] + 4)):
            continue
        points.append(
            PublishedCorporatePoint(
                date=window[-1].date,
                value=math.fsum(point.value for point in window),
                is_estimate=any(point.is_estimate for point in window),
            )
        )
    if len(points) < 5:
        raise CorporateFundamentalsSourceError(
            "S&P EPS workbook returned insufficient consecutive quarters for TTM EPS"
        )
    return PublishedCorporateSeries(
        points=tuple(points),
        report_as_of=quarterly.report_as_of,
        source_path=quarterly.source_path,
    )


def load_multpl_sp500_real_eps(
    csv_path: Path | None = None,
) -> PublishedCorporateSeries:
    """Load Multpl's manually refreshed monthly real trailing-12-month EPS.

    The source restates its history to the current inflation reference month.
    Refresh the complete CSV and ``MULTPL_SP500_EARNINGS_BASIS`` when Multpl
    changes that reference, then include the newly published month; appending
    alone would mix dollar bases.
    """

    path = csv_path or get_settings().data_dir / "sp500-earnings-multpl-monthly.csv"
    try:
        with path.open("r", encoding="utf-8-sig", newline="") as source:
            reader = csv.DictReader(source)
            if reader.fieldnames != ["date", "value"]:
                raise CorporateFundamentalsSourceError(
                    "Multpl EPS snapshot columns changed"
                )

            points: list[PublishedCorporatePoint] = []
            previous_date: date | None = None
            for row in reader:
                try:
                    observation_date = date.fromisoformat(row["date"])
                    eps = float(row["value"])
                except (TypeError, ValueError) as exc:
                    raise CorporateFundamentalsSourceError(
                        "Multpl EPS snapshot contains an invalid observation"
                    ) from exc

                if not math.isfinite(eps):
                    raise CorporateFundamentalsSourceError(
                        "Multpl EPS snapshot contains a non-finite value"
                    )
                if (
                    (observation_date + timedelta(days=1)).month
                    == observation_date.month
                ):
                    raise CorporateFundamentalsSourceError(
                        "Multpl EPS observations must use month-end dates"
                    )
                if previous_date is not None:
                    expected_month = (
                        (previous_date.year + 1, 1)
                        if previous_date.month == 12
                        else (previous_date.year, previous_date.month + 1)
                    )
                    if (observation_date.year, observation_date.month) != expected_month:
                        raise CorporateFundamentalsSourceError(
                            "Multpl EPS snapshot must contain consecutive monthly observations"
                        )

                points.append(
                    PublishedCorporatePoint(
                        date=observation_date.isoformat(), value=eps, is_estimate=False
                    )
                )
                previous_date = observation_date

        if len(points) < 12:
            raise CorporateFundamentalsSourceError(
                "Multpl EPS snapshot returned insufficient monthly observations"
            )
    except CorporateFundamentalsSourceError:
        raise
    except (OSError, csv.Error, TypeError, ValueError) as exc:
        raise CorporateFundamentalsSourceError(
            "Multpl EPS snapshot could not be read"
        ) from exc

    return PublishedCorporateSeries(
        points=tuple(points),
        report_as_of=points[-1].date,
        source_path=path,
    )


def load_multpl_sp500_sales_growth(
    csv_path: Path | None = None,
) -> PublishedCorporateSeries:
    """Load Multpl's manually refreshed quarterly nominal sales growth.

    The CSV contains Multpl's annual percentage change in trailing-12-month
    S&P 500 sales per share. Append new quarter-end observations as they are
    published; values are already growth rates and require no calculation.
    """

    path = (
        csv_path
        or get_settings().data_dir / "sp500-sales-growth-multpl-quarterly.csv"
    )
    quarter_end_month_days = {(3, 31), (6, 30), (9, 30), (12, 31)}
    try:
        with path.open("r", encoding="utf-8-sig", newline="") as source:
            reader = csv.DictReader(source)
            if reader.fieldnames != ["date", "value"]:
                raise CorporateFundamentalsSourceError(
                    "Multpl sales growth snapshot columns changed"
                )

            points: list[PublishedCorporatePoint] = []
            previous_date: date | None = None
            for row in reader:
                try:
                    observation_date = date.fromisoformat(row["date"])
                    growth = float(row["value"])
                except (TypeError, ValueError) as exc:
                    raise CorporateFundamentalsSourceError(
                        "Multpl sales growth snapshot contains an invalid observation"
                    ) from exc

                if not math.isfinite(growth):
                    raise CorporateFundamentalsSourceError(
                        "Multpl sales growth snapshot contains a non-finite value"
                    )
                if (
                    observation_date.month,
                    observation_date.day,
                ) not in quarter_end_month_days:
                    raise CorporateFundamentalsSourceError(
                        "Multpl sales growth observations must use calendar quarter-end dates"
                    )
                if previous_date is not None:
                    previous_quarter = (previous_date.year * 4) + (
                        previous_date.month - 1
                    ) // 3
                    current_quarter = (observation_date.year * 4) + (
                        observation_date.month - 1
                    ) // 3
                    if current_quarter != previous_quarter + 1:
                        raise CorporateFundamentalsSourceError(
                            "Multpl sales growth snapshot must contain consecutive quarterly observations"
                        )

                points.append(
                    PublishedCorporatePoint(
                        date=observation_date.isoformat(),
                        value=growth,
                        is_estimate=False,
                    )
                )
                previous_date = observation_date

        if len(points) < 4:
            raise CorporateFundamentalsSourceError(
                "Multpl sales growth snapshot returned insufficient quarterly observations"
            )
    except CorporateFundamentalsSourceError:
        raise
    except (OSError, csv.Error, TypeError, ValueError) as exc:
        raise CorporateFundamentalsSourceError(
            "Multpl sales growth snapshot could not be read"
        ) from exc

    return PublishedCorporateSeries(
        points=tuple(points),
        report_as_of=points[-1].date,
        source_path=path,
    )


def _safe_number(value: Any) -> float | None:
    try:
        parsed = float(value)
        return parsed if math.isfinite(parsed) else None
    except (TypeError, ValueError):
        return None


def _duration_days(item: Mapping[str, Any]) -> int | None:
    try:
        return (
            datetime.fromisoformat(str(item["end"])[:10]).date()
            - datetime.fromisoformat(str(item["start"])[:10]).date()
        ).days
    except (KeyError, TypeError, ValueError):
        return None


def _latest_observation(
    observations: Iterable[Mapping[str, Any]],
    *,
    frame: str,
    tag: str,
    unit: str,
) -> FactObservation | None:
    candidates = []
    for item in observations:
        parsed = _safe_number(item.get("val"))
        if parsed is None:
            continue
        candidates.append((str(item.get("filed") or ""), str(item.get("accn") or ""), item, parsed))
    if not candidates:
        return None
    _, _, selected, parsed = max(candidates, key=lambda item: (item[0], item[1]))
    return FactObservation(
        frame=frame,
        value=parsed,
        tag=tag,
        unit=unit,
        filed=str(selected.get("filed")) if selected.get("filed") else None,
        period_end=str(selected.get("end")) if selected.get("end") else None,
        form=str(selected.get("form")) if selected.get("form") else None,
        accession=str(selected.get("accn")) if selected.get("accn") else None,
    )


def _tag_unit_items(payload: Mapping[str, Any], tag: str, unit: str) -> list[Mapping[str, Any]]:
    try:
        items = payload["facts"]["us-gaap"][tag]["units"][unit]
        return [item for item in items if isinstance(item, Mapping)]
    except (KeyError, TypeError):
        return []


def _extract_flow_tag(
    payload: Mapping[str, Any], tag: str
) -> dict[str, FactObservation]:
    items = [item for item in _tag_unit_items(payload, tag, "USD") if item.get("form") in _FLOW_FORMS]
    grouped_quarters: dict[str, list[Mapping[str, Any]]] = {}
    grouped_years: dict[str, list[Mapping[str, Any]]] = {}
    for item in items:
        frame = str(item.get("frame") or "")
        duration = _duration_days(item)
        if _QUARTER_FRAME.fullmatch(frame) and duration is not None and 45 <= duration <= 125:
            grouped_quarters.setdefault(frame, []).append(item)
        elif _ANNUAL_FRAME.fullmatch(frame) and duration is not None and 250 <= duration <= 400:
            grouped_years.setdefault(frame, []).append(item)

    observations = {
        frame: observation
        for frame, values in grouped_quarters.items()
        if (observation := _latest_observation(values, frame=frame, tag=tag, unit="USD"))
    }
    annuals = {
        frame: observation
        for frame, values in grouped_years.items()
        if (observation := _latest_observation(values, frame=frame, tag=tag, unit="USD"))
    }
    for annual_frame, annual in annuals.items():
        year_match = _ANNUAL_FRAME.fullmatch(annual_frame)
        if not year_match:
            continue
        year = year_match.group("year")
        q4_frame = f"CY{year}Q4"
        source_frames = tuple(f"CY{year}Q{quarter}" for quarter in (1, 2, 3))
        if q4_frame in observations or any(frame not in observations for frame in source_frames):
            continue
        q4_value = annual.value - sum(observations[frame].value for frame in source_frames)
        if not math.isfinite(q4_value):
            continue
        observations[q4_frame] = FactObservation(
            frame=q4_frame,
            value=q4_value,
            tag=tag,
            unit="USD",
            filed=annual.filed,
            period_end=annual.period_end,
            form=annual.form,
            accession=annual.accession,
            derived=True,
            source_frames=(annual_frame, *source_frames),
        )
    return observations


def _extract_instant_tag(
    payload: Mapping[str, Any], tag: str
) -> dict[str, FactObservation]:
    items = [item for item in _tag_unit_items(payload, tag, "USD") if item.get("form") in _FLOW_FORMS]
    grouped: dict[str, list[Mapping[str, Any]]] = {}
    for item in items:
        raw_frame = str(item.get("frame") or "")
        quarter_match = _INSTANT_QUARTER_FRAME.fullmatch(raw_frame)
        annual_match = _INSTANT_ANNUAL_FRAME.fullmatch(raw_frame)
        if quarter_match:
            frame = f"CY{quarter_match.group('year')}Q{quarter_match.group('quarter')}"
        elif annual_match:
            frame = f"CY{annual_match.group('year')}Q4"
        else:
            continue
        grouped.setdefault(frame, []).append(item)
    return {
        frame: observation
        for frame, values in grouped.items()
        if (observation := _latest_observation(values, frame=frame, tag=tag, unit="USD"))
    }


def _first_usable_flow(
    payload: Mapping[str, Any], tags: Iterable[str]
) -> dict[str, FactObservation]:
    best: dict[str, FactObservation] = {}
    for tag in tags:
        observations = _extract_flow_tag(payload, tag)
        candidate_latest = max(
            (_frame_index(frame) or -1 for frame in observations), default=-1
        )
        best_latest = max((_frame_index(frame) or -1 for frame in best), default=-1)
        if (candidate_latest, len(observations)) > (best_latest, len(best)):
            best = observations
    return best


def extract_company_fundamentals(
    payload: Mapping[str, Any],
    *,
    symbol: str,
    cik: str,
    name: str,
) -> CompanyFundamentals:
    """Normalize the relevant SEC Company Facts observations for one company."""

    revenue = _first_usable_flow(payload, REVENUE_TAGS)
    net_income = _first_usable_flow(payload, NET_INCOME_TAGS)
    assets: dict[str, FactObservation] = {}
    for tag in ASSET_TAGS:
        candidate = _extract_instant_tag(payload, tag)
        if len(candidate) > len(assets):
            assets = candidate
    return CompanyFundamentals(
        symbol=symbol,
        cik=str(cik).zfill(10),
        name=name,
        revenue=revenue,
        net_income=net_income,
        assets=assets,
    )


def _frame_index(frame: str) -> int | None:
    match = _QUARTER_FRAME.fullmatch(frame)
    if not match:
        return None
    return int(match.group("year")) * 4 + int(match.group("quarter")) - 1


def _frame_from_index(index: int) -> str:
    year, zero_based_quarter = divmod(index, 4)
    return f"CY{year}Q{zero_based_quarter + 1}"


def _frame_date(frame: str) -> str:
    match = _QUARTER_FRAME.fullmatch(frame)
    if not match:
        raise ValueError(f"invalid calendar quarter frame: {frame}")
    month_day = {1: "03-31", 2: "06-30", 3: "09-30", 4: "12-31"}
    return f"{match.group('year')}-{month_day[int(match.group('quarter'))]}"


def _latest_filed(observations: Iterable[FactObservation]) -> str | None:
    values = [observation.filed for observation in observations if observation.filed]
    return max(values) if values else None


def _aggregate_document(
    *,
    indicator: str,
    frame: str,
    value: float,
    formula: str,
    cohort: list[CompanyFundamentals],
    expected_symbols: list[str],
    holdings_as_of: str,
    used_observations: list[FactObservation],
    updated_at: datetime,
) -> dict[str, Any]:
    included = {company.symbol for company in cohort}
    missing = [symbol for symbol in expected_symbols if symbol not in included]
    expected_count = len(expected_symbols)
    coverage_pct = (len(included) / expected_count * 100) if expected_count else 0.0
    return {
        "indicator": indicator,
        "date": _frame_date(frame),
        "value": value,
        "methodology_version": CORPORATE_METHODOLOGY_VERSION,
        "updated_at": updated_at,
        "metadata": {
            "unit": "Percent",
            "frequency": "quarterly",
            "source": "SEC Company Facts + State Street SPY holdings",
            "source_provider": "U.S. Securities and Exchange Commission; State Street Global Advisors",
            "source_url": "https://data.sec.gov/api/xbrl/companyfacts/",
            "source_series_id": "SEC_COMPANYFACTS_SPY_CURRENT_CONSTITUENTS",
            "population": (
                f"Current SPY holdings cohort as of {holdings_as_of}; historical values "
                "use the current cohort and therefore have survivorship-bias risk"
            ),
            "transformation": formula,
            "methodology_version": CORPORATE_METHODOLOGY_VERSION,
            "formula_version": CORPORATE_FORMULA_VERSION,
            "companies_expected": expected_count,
            "companies_received": len(included),
            "coverage_pct": coverage_pct,
            "missing_symbols_count": len(missing),
            "missing_symbols": missing[:50],
            "holdings_as_of": holdings_as_of,
            "latest_filing_date": _latest_filed(used_observations),
            "proxy": True,
        },
    }


def build_sec_corporate_documents(
    company_payloads: Mapping[str, Mapping[str, Any]],
    company_identifiers: Mapping[str, Mapping[str, str]],
    *,
    expected_symbols: Iterable[str],
    holdings_as_of: str,
    updated_at: datetime | None = None,
) -> CorporateBuildResult:
    """Build auditable quarterly aggregate documents from SEC Company Facts."""

    build_time = updated_at or datetime.utcnow()
    expected = list(dict.fromkeys(str(symbol).upper() for symbol in expected_symbols))
    companies: list[CompanyFundamentals] = []
    normalized: list[dict[str, Any]] = []
    for symbol in expected:
        payload = company_payloads.get(symbol)
        identifiers = company_identifiers.get(symbol, {})
        if not isinstance(payload, Mapping):
            continue
        company = extract_company_fundamentals(
            payload,
            symbol=symbol,
            cik=str(identifiers.get("cik") or payload.get("cik") or ""),
            name=str(identifiers.get("name") or payload.get("entityName") or symbol),
        )
        if not (company.revenue or company.net_income or company.assets):
            continue
        companies.append(company)
        for metric, observations in (
            ("revenue", company.revenue),
            ("net_income", company.net_income),
            ("assets", company.assets),
        ):
            for frame, observation in observations.items():
                normalized.append(
                    {
                        "symbol": company.symbol,
                        "cik": company.cik,
                        "company_name": company.name,
                        "metric": metric,
                        "frame": frame,
                        "date": _frame_date(frame),
                        "value": observation.value,
                        "tag": observation.tag,
                        "unit": observation.unit,
                        "filed": observation.filed,
                        "period_end": observation.period_end,
                        "form": observation.form,
                        "accession": observation.accession,
                        "derived": observation.derived,
                        "source_frames": list(observation.source_frames),
                        "source_provider": "U.S. Securities and Exchange Commission",
                        "source_url": SEC_COMPANYFACTS_URL.format(cik=company.cik),
                        "methodology_version": CORPORATE_METHODOLOGY_VERSION,
                        "updated_at": build_time,
                    }
                )

    frame_indexes = sorted(
        {
            index
            for company in companies
            for frame in (*company.revenue, *company.net_income, *company.assets)
            if (index := _frame_index(frame)) is not None
        }
    )
    aggregate_documents: list[dict[str, Any]] = []
    for index in frame_indexes:
        frame = _frame_from_index(index)
        previous_year = _frame_from_index(index - 4)

        revenue_cohort = [
            company
            for company in companies
            if frame in company.revenue and previous_year in company.revenue
        ]
        prior_revenue = sum(company.revenue[previous_year].value for company in revenue_cohort)
        if revenue_cohort and prior_revenue != 0:
            current_revenue = sum(company.revenue[frame].value for company in revenue_cohort)
            observations = [
                observation
                for company in revenue_cohort
                for observation in (company.revenue[frame], company.revenue[previous_year])
            ]
            aggregate_documents.append(
                _aggregate_document(
                    indicator="revenue_growth",
                    frame=frame,
                    value=(current_revenue / prior_revenue - 1) * 100,
                    formula="100 * (sum current-quarter revenue / sum prior-year comparable-quarter revenue - 1), common cohort",
                    cohort=revenue_cohort,
                    expected_symbols=expected,
                    holdings_as_of=holdings_as_of,
                    used_observations=observations,
                    updated_at=build_time,
                )
            )

        margin_cohort = [
            company
            for company in companies
            if frame in company.revenue and frame in company.net_income
        ]
        total_revenue = sum(company.revenue[frame].value for company in margin_cohort)
        if margin_cohort and total_revenue != 0:
            total_net_income = sum(company.net_income[frame].value for company in margin_cohort)
            observations = [
                observation
                for company in margin_cohort
                for observation in (company.revenue[frame], company.net_income[frame])
            ]
            aggregate_documents.append(
                _aggregate_document(
                    indicator="profit_margins",
                    frame=frame,
                    value=total_net_income / total_revenue * 100,
                    formula="100 * sum quarterly net income / sum quarterly revenue, common cohort",
                    cohort=margin_cohort,
                    expected_symbols=expected,
                    holdings_as_of=holdings_as_of,
                    used_observations=observations,
                    updated_at=build_time,
                )
            )

        ttm_frames = [_frame_from_index(index - offset) for offset in range(4)]
        roa_cohort = [
            company
            for company in companies
            if all(period in company.net_income for period in ttm_frames)
            and frame in company.assets
            and previous_year in company.assets
        ]
        average_assets = sum(
            (company.assets[frame].value + company.assets[previous_year].value) / 2
            for company in roa_cohort
        )
        if roa_cohort and average_assets != 0:
            ttm_net_income = sum(
                company.net_income[period].value
                for company in roa_cohort
                for period in ttm_frames
            )
            observations = [
                observation
                for company in roa_cohort
                for observation in (
                    *(company.net_income[period] for period in ttm_frames),
                    company.assets[frame],
                    company.assets[previous_year],
                )
            ]
            aggregate_documents.append(
                _aggregate_document(
                    indicator="return_on_assets",
                    frame=frame,
                    value=ttm_net_income / average_assets * 100,
                    formula="100 * sum trailing-four-quarter net income / sum average beginning-and-ending assets, common cohort",
                    cohort=roa_cohort,
                    expected_symbols=expected,
                    holdings_as_of=holdings_as_of,
                    used_observations=observations,
                    updated_at=build_time,
                )
            )

    aggregate_documents = [
        document
        for document in aggregate_documents
        if float(document["metadata"]["coverage_pct"])
        >= CORPORATE_MIN_PUBLISHABLE_COVERAGE_PCT
    ]
    aggregate_documents.sort(key=lambda item: (item["indicator"], item["date"]))
    normalized.sort(key=lambda item: (item["symbol"], item["metric"], item["date"]))
    return CorporateBuildResult(
        aggregates=tuple(aggregate_documents),
        normalized_facts=tuple(normalized),
        companies_expected=len(expected),
        companies_with_any_facts=len(companies),
    )
