import os
from datetime import datetime
import pytest

os.environ["DEBUG"] = "false"

from src.services.data_service import DataService
from src.services.corporate_fundamentals import CORPORATE_METHODOLOGY_VERSION
from src.services.corporate_fundamentals_cache import write_corporate_aggregate_cache
from src.services.fred_public import (
    FredObservation,
    FredPublicSeries,
    FredPublicSourceError,
)
from src.services.umich_consumer import (
    UmichConsumerSourceError,
    UmichSentimentObservation,
    UmichSentimentRelease,
)
from src.services.valuation_sources import (
    PublishedValuationPoint,
    PublishedValuationSeries,
)
from src.models.schemas import DataMetadata, DataResponse, EconomicDataPoint


class FakeCursor(list):
    def sort(self, key, direction):
        return FakeCursor(sorted(self, key=lambda item: item[key], reverse=direction < 0))

    def limit(self, count):
        return FakeCursor(self[:count])


class FakeCollection:
    def __init__(self, documents):
        self.documents = documents

    def find(self, query):
        matches = [
            document
            for document in self.documents
            if all(document.get(key) == value for key, value in query.items())
        ]
        return FakeCursor(matches)

    def find_one(self, query, sort=None):
        matches = list(self.find(query))
        if not matches:
            return None
        if sort:
            key, direction = sort[0]
            matches.sort(key=lambda item: item[key], reverse=direction < 0)
        return matches[0]


class LazyMongoStub:
    def __init__(self, collections):
        self.collections = collections
        self.requested = []

    def get_collection(self, name):
        self.requested.append(name)
        return self.collections[name]


def make_service(collections):
    service = DataService.__new__(DataService)
    service.mongodb = LazyMongoStub(collections)
    return service


def test_sp500_eps_uses_official_workbook_without_mongodb():
    service = make_service({
        "corporate_earnings": FakeCollection([
            {"indicator": "sp500_eps", "date": "2025-03-31", "value": 61.25}
        ])
    })

    response = service.get_sp500_eps_data()

    assert service.mongodb.requested == []
    assert response.data
    assert response.data[-1].date == "2025-03-31"
    assert response.data[-1].value == pytest.approx(236.24)
    assert response.metadata.source_series_id == "SP500_OPERATING_EPS_TTM_REPORTED"
    assert response.metadata.formula_version == "ttm_sum_4q_v1"
    assert response.metadata.latest_observation_is_estimate is False


def test_credit_spread_percent_is_converted_to_basis_points():
    raw = DataResponse(
        data=[EconomicDataPoint(time=1, date="2025-01-01", value=3.25, rate=3.25)],
        metadata=DataMetadata(
            latest_value=3.25,
            latest_date="2025-01-01",
            total_records=1,
            description="High-yield OAS",
            unit="percent",
            frequency="daily",
            source="FRED",
            fred_series="BAMLH0A0HYM2",
        ),
    )

    response = DataService._scale_economic_response(
        raw,
        multiplier=100,
        indicator_id="high_yield_credit_spread",
        owner_group="credit_financial_risk",
        unit="basis_points",
        transformation="source_percent_times_100",
    )

    assert response.data[0].value == 325
    assert response.metadata.latest_value == 325
    assert response.metadata.unit == "basis_points"


class _SingleSeriesFredClient:
    def __init__(self, series_id, observations):
        self.series_id = series_id
        self.observations = tuple(observations)

    def get_series(self, series_id):
        assert series_id == self.series_id
        return FredPublicSeries(
            series_id=series_id,
            source_url=f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={series_id}",
            observations=self.observations,
        )


def test_cpi_endpoint_returns_yoy_change_from_live_cpiaucns_levels():
    service = DataService.__new__(DataService)
    service.mongodb = None
    service.fred_public = _SingleSeriesFredClient(
        "CPIAUCNS",
        [
            FredObservation("2024-01-01", 100),
            FredObservation("2025-01-01", 112),
        ],
    )

    response = service.get_macro_cpi_inflation_data()

    assert response.data[-1].value == pytest.approx(12)
    assert response.metadata.source_series_id == "CPIAUCNS"
    assert response.metadata.seasonal_adjustment == "not_seasonally_adjusted"
    assert response.metadata.unit == "percent_change_from_year_ago"
    assert response.metadata.transformation == "year_over_year_percent_change_from_source_index"


@pytest.mark.parametrize(
    ("method_name", "series_id", "indicator_id"),
    [
        ("get_macro_core_cpi_inflation_data", "CPILFENS", "core_cpi_inflation_yoy"),
        ("get_macro_core_pce_inflation_data", "PCEPILFE", "core_pce_inflation_yoy"),
        ("get_macro_ppi_final_demand_inflation_data", "PPIFID", "ppi_final_demand_inflation_yoy"),
    ],
)
def test_new_inflation_endpoints_return_exact_fred_series_yoy(
    method_name, series_id, indicator_id
):
    service = DataService.__new__(DataService)
    service.mongodb = None
    service.fred_public = _SingleSeriesFredClient(
        series_id,
        [
            FredObservation("2024-02-01", 200),
            FredObservation("2025-02-01", 205),
        ],
    )

    response = getattr(service, method_name)()

    assert response.data[-1].value == pytest.approx(2.5)
    assert response.metadata.indicator_id == indicator_id
    assert response.metadata.source_series_id == series_id


def test_retail_sales_endpoint_returns_month_over_month_growth():
    service = DataService.__new__(DataService)
    service.mongodb = None
    service.fred_public = _SingleSeriesFredClient(
        "RSXFS",
        [
            FredObservation("2025-01-01", 100),
            FredObservation("2025-02-01", 101.2),
        ],
    )

    response = service.get_macro_retail_sales_data()

    assert response.data[-1].value == pytest.approx(1.2)
    assert response.metadata.indicator_id == "retail_sales_growth_mom"
    assert response.metadata.unit == "percent_change_from_previous_month"
    assert response.metadata.source_series_id == "RSXFS"


def test_gdp_growth_is_unavailable_without_verified_gdpc1_levels():
    service = DataService.__new__(DataService)
    service.mongodb = None

    response = service.get_macro_gdp_growth_rate_data()

    assert response.data == []
    assert response.metadata.source_series_id == "GDPC1"
    assert response.metadata.quality_status == "unavailable"


def test_gdp_growth_is_annualized_from_consecutive_quarter_levels():
    service = DataService.__new__(DataService)
    service.mongodb = object()
    levels = DataResponse(
        data=[
            EconomicDataPoint(time=1, date="2025-01-01", value=100, rate=100),
            EconomicDataPoint(time=2, date="2025-04-01", value=101, rate=101),
            EconomicDataPoint(time=3, date="2025-10-01", value=104, rate=104),
        ],
        metadata=DataMetadata(description="Real GDP", unit="level", frequency="quarterly", source="FRED", fred_series="GDPC1"),
    )
    service.get_macro_economics_data = lambda **_: levels

    response = service.get_macro_gdp_growth_rate_data()

    assert len(response.data) == 1
    assert response.data[0].value == pytest.approx(((101 / 100) ** 4 - 1) * 100)
    assert response.metadata.transformation == "annualized_quarter_over_quarter_percent_change"


class _FakeFredPublicClient:
    def get_series(self, series_id):
        assert series_id == "UMCSENT"
        return FredPublicSeries(
            series_id="UMCSENT",
            source_url="https://fred.stlouisfed.org/graph/fredgraph.csv?id=UMCSENT",
            observations=(
                FredObservation("2099-05-01", 44.8),
                FredObservation("2099-06-01", 49.5),
                FredObservation("2099-07-01", 55.2),
            ),
        )


class _FakeUmichConsumerClient:
    def get_release(self):
        return UmichSentimentRelease(
            title="Preliminary Results for September 2099",
            release_status="preliminary",
            source_url="https://www.sca.isr.umich.edu/",
            observations=(
                UmichSentimentObservation("2099-08-01", 51.7, "final"),
                UmichSentimentObservation("2099-09-01", 47.8, "preliminary"),
            ),
        )


def test_consumer_confidence_uses_live_umcsent_and_latest_limit():
    service = DataService.__new__(DataService)
    service.mongodb = None
    service.fred_public = _FakeFredPublicClient()
    service.umich_consumer = _FakeUmichConsumerClient()

    response = service.get_macro_consumer_confidence_data(limit=3)

    assert [point.date for point in response.data] == [
        "2099-07-01",
        "2099-08-01",
        "2099-09-01",
    ]
    assert response.data[-1].value == 47.8
    assert response.metadata.source_series_id == "UMCSENT"
    assert response.metadata.source == "University of Michigan direct release + FRED history"
    assert response.metadata.source_url == "https://www.sca.isr.umich.edu/"
    assert response.metadata.latest_observation_status == "preliminary"
    assert response.metadata.quality_status == "available"


class _FailedFredPublicClient:
    def get_series(self, series_id):
        raise FredPublicSourceError("offline")


class _FailedUmichConsumerClient:
    def get_release(self):
        raise UmichConsumerSourceError("offline")


def test_consumer_confidence_fallback_only_accepts_matching_umcsent_documents():
    service = make_service({
        "macro_economics": FakeCollection([
            {
                "indicator": "consumer_confidence",
                "fred_series_id": "CSCICP03USM665S",
                "date": "2024-01-01",
                "value": 98.91,
            },
            {
                "indicator": "consumer_confidence",
                "fred_series_id": "UMCSENT",
                "date": "2025-12-01",
                "value": 52.9,
            },
            {
                "indicator": "consumer_confidence",
                "fred_series_id": "UMCSENT",
                "date": "2026-07-01",
                "value": 55.2,
            },
        ])
    })
    service.fred_public = _FailedFredPublicClient()
    service.umich_consumer = _FailedUmichConsumerClient()

    response = service.get_macro_consumer_confidence_data(limit=1)

    assert [(point.date, point.value) for point in response.data] == [("2026-07-01", 55.2)]
    assert response.metadata.source_series_id == "UMCSENT"


def test_empty_corporate_data_returns_valid_metadata(tmp_path):
    service = make_service({
        "corporate_earnings": FakeCollection([
            {
                "indicator": "revenue_growth",
                "date": "2025-03-31",
                "value": 999,
                "methodology_version": "legacy_unverified_method",
                "metadata": {"coverage_pct": 100},
            }
        ])
    })
    service.corporate_cache_path = tmp_path / "missing.json"

    response = service.get_revenue_growth_data()

    assert response.data == []
    assert response.metadata.total_records == 0
    assert response.metadata.description.startswith("Aggregate year-over-year revenue growth")


def test_empty_mongodb_uses_verified_corporate_file_cache(tmp_path):
    metadata = {
        "unit": "Percent",
        "frequency": "quarterly",
        "source": "SEC Company Facts + State Street SPY holdings",
        "source_provider": "U.S. Securities and Exchange Commission; State Street Global Advisors",
        "source_url": "https://data.sec.gov/api/xbrl/companyfacts/",
        "source_series_id": "SEC_COMPANYFACTS_SPY_CURRENT_CONSTITUENTS",
        "population": "Current SPY holdings cohort as of 2025-04-01",
        "transformation": "verified test formula",
        "methodology_version": CORPORATE_METHODOLOGY_VERSION,
        "formula_version": "1.0",
        "companies_expected": 500,
        "companies_received": 450,
        "coverage_pct": 90,
        "missing_symbols_count": 50,
        "missing_symbols": ["MISS"],
        "holdings_as_of": "2025-04-01",
        "latest_filing_date": "2025-05-01",
        "proxy": True,
    }
    documents = [
        {
            "indicator": indicator,
            "date": "2025-03-31",
            "value": value,
            "methodology_version": CORPORATE_METHODOLOGY_VERSION,
            "updated_at": "2025-05-02T00:00:00",
            "metadata": metadata,
        }
        for indicator, value in (
            ("revenue_growth", 8.5),
            ("profit_margins", 11.5),
            ("return_on_assets", 7.5),
        )
    ]
    cache_path = tmp_path / "corporate.json"
    write_corporate_aggregate_cache(
        documents,
        holdings_as_of="2025-04-01",
        built_at=datetime(2025, 5, 2),
        cache_path=cache_path,
    )
    service = make_service({
        "corporate_earnings": FakeCollection([
            {
                "indicator": "revenue_growth",
                "date": "2025-03-31",
                "value": 999,
                "methodology_version": "legacy_unverified_method",
                "metadata": {"coverage_pct": 100},
            }
        ])
    })
    service.corporate_cache_path = cache_path

    response = service.get_revenue_growth_data()

    assert [(point.date, point.value) for point in response.data] == [
        ("2025-03-31", 8.5)
    ]
    assert response.metadata.companies_received == 450
    assert response.metadata.coverage_pct == 90


def test_verified_corporate_limit_returns_latest_records_in_ascending_order():
    documents = [
        {
            "indicator": "revenue_growth",
            "date": f"202{year}-03-31",
            "value": float(year),
            "methodology_version": CORPORATE_METHODOLOGY_VERSION,
            "metadata": {
                "methodology_version": CORPORATE_METHODOLOGY_VERSION,
                "formula_version": "1.0",
                "coverage_pct": 90,
                "companies_expected": 500,
                "companies_received": 450,
                "source": "SEC Company Facts + State Street SPY holdings",
                "source_provider": "SEC; State Street",
                "source_url": "https://data.sec.gov/api/xbrl/companyfacts/",
                "transformation": "test formula",
                "population": "Current SPY holdings cohort",
                "proxy": True,
            },
        }
        for year in range(2, 6)
    ]
    service = make_service({"corporate_earnings": FakeCollection(documents)})

    response = service.get_revenue_growth_data(limit=2)

    assert [point.date for point in response.data] == ["2024-03-31", "2025-03-31"]
    assert response.metadata.companies_received == 450
    assert response.metadata.coverage_pct == 90


def test_sector_latest_uses_lazy_collection_accessor():
    service = make_service({
        "sector_performance": FakeCollection([
            {
                "metric": "price_performance",
                "sector": "technology",
                "date": "2025-08-01",
                "value": 12.5,
                "metadata": {"etf_symbol": "XLK"},
            }
        ])
    })

    result = service.get_all_sectors_latest_data("price_performance")

    assert service.mongodb.requested == ["sector_performance"]
    assert result["technology"] == {
        "value": 12.5,
        "date": "2025-08-01",
        "etf_symbol": "XLK",
    }


def test_peg_data_uses_published_source_instead_of_legacy_mongodb_rows():
    service = make_service({
        "valuation": FakeCollection([
            {
                "indicator": "peg_ratio",
                "date": "2025-08-01",
                "value": 1.75,
                "metadata": {"symbol": "Multiple"},
            }
        ])
    })
    service.valuation_sources = type(
        "FakeValuationSource",
        (),
        {
            "get_series": lambda self, indicator_id: PublishedValuationSeries(
                indicator_id=indicator_id,
                points=(PublishedValuationPoint("2025-08-01", 1.75),),
                description="S&P 500 trailing PEG proxy",
                unit="ratio",
                frequency="quarterly",
                source="Published test source",
                source_provider="Test",
                source_url="https://example.test/peg",
                source_series_id="P/E + EPS",
                population="S&P 500 index",
                transformation="trailing P/E / five-year EPS CAGR",
            )
        },
    )()

    response = service.get_peg_ratio_data()

    assert service.mongodb.requested == []
    assert response.data[0].value == 1.75
    assert response.metadata.total_records == 1
    assert response.metadata.proxy is True


def test_ten_year_data_uses_lazy_monetary_policy_collection():
    service = make_service({
        "monetary_policy": FakeCollection([
            {
                "indicator": "ten_year_treasury",
                "date": "2026-08-21",
                "value": 4.26,
            }
        ])
    })

    response = service.get_10year_data()

    assert service.mongodb.requested == ["monetary_policy"]
    assert response.data[0].date == "2026-08-21"
    assert response.data[0].value == 4.26
    assert response.metadata.fred_series == "DGS10"


def test_limited_mongodb_series_returns_latest_points_in_chart_order():
    service = make_service({
        "monetary_policy": FakeCollection([
            {"indicator": "ten_year_treasury", "date": "2026-08-20", "value": 4.20},
            {"indicator": "ten_year_treasury", "date": "2026-08-22", "value": 4.24},
            {"indicator": "ten_year_treasury", "date": "2026-08-21", "value": 4.22},
        ])
    })

    response = service.get_10year_data(limit=2)

    assert [point.date for point in response.data] == ["2026-08-21", "2026-08-22"]
    assert response.metadata.latest_value == 4.24
    assert response.metadata.latest_date == "2026-08-22"


def test_reverse_repo_keeps_fred_billions_unit_for_mongodb_data():
    service = make_service({
        "liquidity_flows": FakeCollection([
            {
                "indicator": "reverse_repo_operations",
                "date": "2026-08-21",
                "value": 18.5,
            }
        ])
    })

    response = service.get_reverse_repo_data()

    assert service.mongodb.requested == ["liquidity_flows"]
    assert response.data[0].value == 18.5
    assert response.metadata.unit == "billions_of_dollars"
    assert response.metadata.source_series_id == "RRPONTSYD"
