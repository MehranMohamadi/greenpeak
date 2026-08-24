import os

os.environ["DEBUG"] = "false"

from src.services.data_service import DataService


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


def test_corporate_data_uses_lazy_collection_accessor():
    service = make_service({
        "corporate_earnings": FakeCollection([
            {"indicator": "sp500_eps", "date": "2025-03-31", "value": 61.25}
        ])
    })

    response = service.get_sp500_eps_data()

    assert service.mongodb.requested == ["corporate_earnings"]
    assert response.data[0].value == 61.25
    assert response.metadata.total_records == 1


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
