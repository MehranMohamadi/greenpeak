import os
import pytest

os.environ["DEBUG"] = "false"

from src.services.data_service import DataService
from src.models.schemas import DataMetadata, DataResponse, EconomicDataPoint


class FakeCursor(list):
    def sort(self, *args, **kwargs):
        return self

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


def test_unverified_sp500_eps_is_explicitly_unavailable():
    service = make_service({
        "corporate_earnings": FakeCollection([
            {"indicator": "sp500_eps", "date": "2025-03-31", "value": 61.25}
        ])
    })

    response = service.get_sp500_eps_data()

    assert service.mongodb.requested == []
    assert response.data == []
    assert response.metadata.quality_status == "invalid"
    assert response.metadata.source_series_id is None


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


def test_cpi_endpoint_returns_yoy_change_not_index_level():
    service = DataService.__new__(DataService)
    service.mongodb = None
    levels = [
        EconomicDataPoint(time=index, date=f"2024-{index + 1:02d}-01", value=100 + index, rate=100 + index)
        for index in range(12)
    ] + [EconomicDataPoint(time=12, date="2025-01-01", value=112, rate=112)]
    service.get_economic_data = lambda **_: DataResponse(
        data=levels,
        metadata=DataMetadata(description="CPI", unit="index", frequency="monthly", source="FRED", fred_series="CPIAUCSL"),
    )

    response = service.get_macro_cpi_inflation_data()

    assert response.data[-1].value == pytest.approx(12)
    assert response.metadata.unit == "percent_change_from_year_ago"
    assert response.metadata.transformation == "year_over_year_percent_change_from_index_level"


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


def test_empty_corporate_data_returns_valid_metadata():
    service = make_service({"corporate_earnings": FakeCollection([])})

    response = service.get_revenue_growth_data()

    assert response.data == []
    assert response.metadata.total_records == 0
    assert response.metadata.description.startswith("Average revenue growth")


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


def test_valuation_data_uses_lazy_collection_accessor():
    service = make_service({
        "valuation": FakeCollection([
            {
                "indicator": "pe_ratio",
                "date": "2025-08-01",
                "value": 24.75,
                "metadata": {"symbol": "^GSPC"},
            }
        ])
    })

    response = service.get_valuation_pe_ratio_data()

    assert service.mongodb.requested == ["valuation"]
    assert response.data[0].value == 24.75
    assert response.metadata.total_records == 1


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
