"""Allowlisted data retrieval. Account identity is resolved from the authenticated owner."""

from datetime import UTC, datetime, timedelta
from math import isfinite
from typing import Any

from bson import ObjectId
from pydantic import ValidationError
from pymongo import MongoClient
from pymongo.errors import PyMongoError

from ..data_service import DataService
from ..greenpeak_config import load_registry
from ..llm_engine.local_cache import LocalNarrativeCache, NarrativeCacheError
from ..llm_engine.repository import MongoNarrativeRepository
from ..llm_engine.schemas import IndicatorNarrative, DomainNarrative, MarketNarrative
from ..mongodb_service import MongoDBService
from ..mt5_connection_service import COLLECTION as CONNECTIONS
from ..mt5_snapshot_service import COLLECTION as SNAPSHOTS
from ..rate_features.builder import build_snapshot
from ..rate_features.cleaning import adapt_mongo_documents
from ..rate_features.config import get_definition
from ..rate_features.repository import MongoFeatureRepository
from ..rate_features.schemas import IndicatorFeatureSnapshot
from .store import ChatError


RAW_METHODS = {
    "federal_funds_rate": "get_dff_data", "us_10y_treasury_yield": "get_10year_data",
    "sofr_rate": "get_sofr_data", "fed_balance_sheet": "get_walcl_data",
    "cpi_index": "get_cpi_data", "unemployment_rate": "get_unrate_data",
    "real_interest_rate_10y": "get_real_interest_rate_data",
    "treasury_2y10y_spread": "get_2y10y_yieldcurve", "money_supply_m2": "get_m2_data",
    "reverse_repo_operations": "get_reverse_repo_data",
    "vix": "get_vix_data", "financial_stress_index": "get_stress_index",
    "high_yield_credit_spread": "get_credit_spread_data", "bbb_credit_spread": "get_cds_spreads",
    "nonfarm_payrolls": "get_macro_nonfarm_payrolls_data", "consumer_confidence": "get_macro_consumer_confidence_data",
    "sp500_eps": "get_sp500_eps_data", "revenue_growth": "get_revenue_growth_data",
    "profit_margins": "get_profit_margins_data", "return_on_assets": "get_return_on_assets_data",
    "corporate_pe_ratio": "get_pe_ratio_data", "corporate_dividend_yield": "get_dividend_yield_data",
    "valuation_pe_ratio": "get_valuation_pe_ratio_data", "valuation_dividend_yield": "get_valuation_dividend_yield_data",
    "forward_pe_ratio": "get_forward_pe_data", "price_to_book_ratio": "get_price_to_book_data",
    "price_to_sales_ratio": "get_price_to_sales_data", "peg_ratio": "get_peg_ratio_data",
}
POSITION_FIELDS = ("symbol", "direction", "volume", "open_price", "current_bid", "current_ask",
                   "current_valuation_price", "current_profit_loss", "stop_loss", "take_profit", "accrued_swap", "commission", "open_time_utc")
ACCOUNT_FIELDS = ("currency", "balance", "equity", "used_margin", "free_margin", "margin_level_pct", "floating_profit_loss")
PORTFOLIO_FIELDS = ("net_portfolio_exposure_usd", "gross_portfolio_exposure_usd", "net_portfolio_leverage", "gross_portfolio_leverage", "account_current_drawdown_pct")


def bounded(value: Any, depth=0):
    """Only JSON primitives; bound external text, lists and nested objects."""
    if depth > 8:
        return None
    if value is None or isinstance(value, (bool, int)):
        return value
    if isinstance(value, float):
        return value if isfinite(value) else None
    if isinstance(value, str):
        return value[:2000]
    if hasattr(value, "isoformat"):
        return value.isoformat()
    if isinstance(value, dict):
        return {str(k): bounded(v, depth + 1) for k, v in list(value.items())[:100] if str(k) not in {"_id", "owner_user_id", "connection_id", "token", "token_hash", "api_key", "password"}}
    if isinstance(value, list):
        return [bounded(item, depth + 1) for item in value[:50]]
    return None


def select(value, fields):
    return bounded({key: value[key] for key in fields if key in value})


class ChatData:
    def __init__(self, settings):
        self.settings = settings
        self.client = MongoClient(settings.mongodb_url, serverSelectionTimeoutMS=1500, connectTimeoutMS=1500, socketTimeoutMS=5000)
        self.db = self.client[settings.mongodb_database]
        self._online = None
        self.sources = []
        self.attachments = {}
        self._snapshot_cache = {}

    def close(self):
        self.client.close()

    def online(self):
        if self._online is None:
            try:
                self.client.admin.command("ping")
                self._online = True
            except PyMongoError:
                self._online = False
        return self._online

    def connection(self, user_id, connection_id):
        if not ObjectId.is_valid(connection_id or ""):
            raise ChatError("CHAT_ACCOUNT_UNAVAILABLE", "حساب انتخاب‌شده در دسترس نیست.", 404)
        try:
            row = self.db[CONNECTIONS].find_one({"_id": ObjectId(connection_id), "user_id": user_id, "revoked_at": None})
        except PyMongoError as exc:
            raise ChatError("CHAT_ACCOUNT_STORE_UNAVAILABLE", "اطلاعات متاتریدر موقتاً در دسترس نیست.", 503) from exc
        if row is None or not row.get("account_identity"):
            raise ChatError("CHAT_ACCOUNT_UNAVAILABLE", "حساب انتخاب‌شده متصل نیست یا هنوز داده‌ای ارسال نکرده است.", 404)
        return row

    def accounts(self, user_id):
        try:
            rows = self.db[CONNECTIONS].find({"user_id": user_id, "revoked_at": None, "account_identity": {"$ne": None}}).limit(100)
            result = []
            for row in rows:
                identity = row.get("account_identity") or {}
                if not identity:
                    continue
                result.append({"id": str(row["_id"]), "label": row.get("label", "MetaTrader 5"),
                               "broker": identity.get("broker_company", ""), "server": identity.get("trade_server", ""),
                               "account_label": "••••" + str(identity.get("account_identifier", ""))[-4:],
                               "last_seen_at": bounded(row.get("last_seen_at"))})
            return result
        except PyMongoError as exc:
            raise ChatError("CHAT_ACCOUNT_STORE_UNAVAILABLE", "فهرست حساب‌های متاتریدر موقتاً در دسترس نیست.", 503) from exc

    @staticmethod
    def catalog():
        domains, _, indicators = load_registry()
        return {
            "indicators": [{"id": key, "name_fa": item.display.name_fa, "name_en": item.display.name_en,
                            "unit": item.display.unit, "domain": item.classification.primary_domain} for key, item in indicators.items() if item.enabled],
            "domains": [{"id": item.id, "name_fa": item.name_fa} for item in domains.domains],
        }

    def evidence(self, title, href, data, observed_at=None, status="available"):
        source = {"id": f"S{len(self.sources) + 1}", "title": title, "href": href,
                  "observed_at": bounded(observed_at), "retrieved_at": datetime.now(UTC).isoformat(), "status": status}
        self.sources.append(source)
        return {"source": source, "data": bounded(data)}

    def indicator(self, subject):
        _, _, indicators = load_registry()
        if subject not in indicators or not indicators[subject].enabled:
            raise ChatError("CHAT_UNKNOWN_INDICATOR", "این شاخص در فهرست داده‌ها نیست.")
        definition = get_definition(subject)
        snapshot = None
        if self.online():
            stored = MongoFeatureRepository(self.client, self.settings.mongodb_database).latest_snapshot(subject)
            if stored:
                snapshot = IndicatorFeatureSnapshot.model_validate(stored).model_dump(mode="json")
        # Build only an in-memory preview from the same public API data and Python formulas.
        if snapshot is None and subject in RAW_METHODS:
            service = DataService()
            service.mongodb = None
            if self.online():
                mongo = MongoDBService()
                mongo.client, mongo.db = self.client, self.db
                service.mongodb = mongo
            response = getattr(service, RAW_METHODS[subject])(limit=2500)
            metadata = response.metadata.model_dump(mode="json") if hasattr(response.metadata, "model_dump") else response.metadata
            # Preserve actual adapter provenance, especially the Treasury curve fallback.
            actual_unit = metadata.get("unit")
            actual_series = metadata.get("source_series_id") or metadata.get("fred_series")
            if (actual_unit and actual_unit != definition["data"]["unit"]) or (actual_series and actual_series != definition["source"]["series_id"]):
                return self.evidence(indicators[subject].display.name_fa, "/analytics/feature-pipeline-debug", {
                    "metadata": metadata, "observations": [point.model_dump(mode="json") for point in response.data[-12:]],
                    "limitation": "API units or source differ from the feature definition. Use ONLY the actual API metadata for interpretation; derived features are unavailable.",
                }, metadata.get("observation_date") or metadata.get("latest_date"), metadata.get("quality_status") or "unavailable")
            rows = [{"date": point.date, "value": point.value, "fred_series_id": definition["source"]["series_id"],
                     "metadata": {"source": metadata.get("source", definition["source"]["provider"])}} for point in response.data]
            definition["source"]["provider"] = metadata.get("source") or definition["source"]["provider"]
            preview, _ = build_snapshot(definition, adapt_mongo_documents(rows, subject), datetime.now(UTC).date(),
                                        "chat-preview", "chat-v1")
            if preview:
                snapshot = preview.model_dump(mode="json")
        if snapshot:
            observed = snapshot["source"]["latest_observation_date"]
            definition = get_definition(subject)
            fresh_days = max(0, (datetime.now(UTC).date() - datetime.fromisoformat(observed[:10]).date()).days)
            quality = dict(snapshot["quality"], freshness_days=fresh_days)
            if fresh_days > definition["feature_config"]["stale_after_calendar_days"]:
                quality["status"] = "stale"
            return self.evidence(indicators[subject].display.name_fa, "/analytics/feature-pipeline-debug", {
                **select(snapshot, ("indicator_id", "source", "current", "features", "feature_reasons", "derived_features", "state", "semantics", "calculated_at")),
                "quality": quality, "semantics": indicators[subject].semantics,
            }, observed, quality["status"])
        return self.evidence(indicators[subject].display.name_fa, "/analytics/feature-pipeline-debug", {
            "semantics": indicators[subject].semantics, "unit": indicators[subject].display.unit,
            "limitation": "No stored or supported API-backed feature snapshot is available. No current values are known.",
        }, status="unavailable")

    def analysis(self, subject):
        domains, _, indicators = load_registry()
        if subject == "market":
            level, key, model, title = "market", "sp500", MarketNarrative, "تحلیل بازار"
        elif subject in indicators and indicators[subject].enabled:
            level, key, model, title = "indicator", subject, IndicatorNarrative, indicators[subject].display.name_fa
        elif subject in {item.id for item in domains.domains}:
            level, key, model, title = "domain", subject, DomainNarrative, next(item.name_fa for item in domains.domains if item.id == subject)
        else:
            raise ChatError("CHAT_UNKNOWN_ANALYSIS", "تحلیل انتخاب‌شده در فهرست نیست.")
        row = None
        if self.online():
            row = MongoNarrativeRepository(self.client, self.settings.mongodb_database).latest(level, key)
        if not row and self.settings.environment == "development" and self.settings.analysis_local_fallback_enabled:
            try:
                row = LocalNarrativeCache(self.settings.analysis_local_db_path).latest(level, key)
            except NarrativeCacheError:
                pass
        if not row:
            return self.evidence(title, "/analytics", {"limitation": "No saved analysis is available."}, status="unavailable")
        validated = model.model_validate({k: v for k, v in row.items() if k in model.model_fields}).model_dump(mode="json")
        observed = validated.get("data_as_of")
        return self.evidence(title, "/analytics", validated, observed, "dated_analysis")

    def prices(self):
        service = DataService()
        service.mongodb = None
        points = service.get_sp500_data()
        recent = sorted(points, key=lambda point: point.date)[-5:]
        return self.evidence("دادهٔ قیمت S&P 500", "/dashboard", {
            "source": "GreenPeak checked-in S&P OHLC dataset", "unit": "index_points",
            "observations": [point.model_dump(mode="json") for point in recent],
            "limitation": "Historical site dataset; not a live quote. No current price is known beyond these dates.",
        }, recent[-1].date if recent else None, "historical_dataset")

    def news(self):
        from ..news.repository import MongoNewsRepository
        from ..news.feed import build_source_feed

        if not self.online():
            return self.evidence("خبرهای سایت", "/analytics/events", {"limitation": "News storage is unavailable."}, status="unavailable")
        repository = MongoNewsRepository(self.client, self.settings.mongodb_database)
        documents = repository.source_raw("alpha_vantage", datetime.now(UTC) - timedelta(days=7), limit=30)
        feed = build_source_feed("alpha_vantage", documents, limit=8)
        items = [select(item, ("title", "title_fa", "summary", "published_at", "url", "topics")) for item in feed.get("items", [])]
        return self.evidence("خبرهای ثبت‌شدهٔ سایت", "/analytics/events", {"items": items, "coverage": "Stored Alpha Vantage feed, last seven days; not all news."}, status="available" if items else "unavailable")

    def calendar(self):
        from ..economic_calendar import fetch_upcoming_us_events

        items = fetch_upcoming_us_events(limit=8)
        return self.evidence("تقویم اقتصادی سایت", "/analytics/events", {"items": items}, status="available" if items else "unavailable")

    def account(self, user_id, connection_id, positions=False, symbol="", order="worst"):
        connection = self.connection(user_id, connection_id)
        identity = connection["account_identity"]
        query = {"owner_user_id": user_id, "connection_id": connection_id,
                 **{f"source.{key}": identity[key] for key in ("broker_company", "trade_server", "account_identifier")}}
        # Account cards and positions in one answer must refer to the same snapshot.
        cache = getattr(self, "_snapshot_cache", {})
        cache_key = (user_id, connection_id)
        if cache_key not in cache:
            cache[cache_key] = self.db[SNAPSHOTS].find_one(query, sort=[("timestamp_utc", -1)])
            self._snapshot_cache = cache
        row = cache[cache_key]
        if row is None:
            return self.evidence("متاتریدر انتخاب‌شده", "/analytics/mt5-snapshots", {"limitation": "No snapshot available for this active connection."}, status="unavailable")
        observed = row.get("timestamp_utc")
        if isinstance(observed, str):
            observed = datetime.fromisoformat(observed.replace("Z", "+00:00"))
        if not isinstance(observed, datetime):
            raise ChatError("CHAT_INVALID_ACCOUNT_DATA", "زمان دادهٔ حساب معتبر نیست.")
        if observed.tzinfo is None:
            observed = observed.replace(tzinfo=UTC)
        age = (datetime.now(UTC) - observed).total_seconds()
        status = "stale" if age > max(1, self.settings.greenpeak_chat_mt5_stale_minutes) * 60 else "available"
        if age < -60:
            status = "invalid_timestamp"
        common = {"snapshot_at": observed.isoformat(), "age_seconds": max(0, round(age)),
                  "send_mode": row.get("source", {}).get("send_mode"), "freshness": status,
                  "calculation_status": select(row.get("calculation_status", {}), ("active_symbol", "swap", "trade_history_window_days", "commission_convention")),
                  "limitation": "Snapshot only, not live. Historical performance and risk-to-stop calculations are unavailable."}
        if positions:
            raw = row.get("positions")
            values = [select(item, POSITION_FIELDS) for item in raw if isinstance(item, dict)] if isinstance(raw, list) else []
            if symbol:
                values = [item for item in values if str(item.get("symbol", "")).casefold() == symbol.casefold()]
            def loss_order(item):
                value = item.get("current_profit_loss")
                return value if isinstance(value, (int, float)) and not isinstance(value, bool) and isfinite(value) else float("inf")
            # Missing P/L remains last in either ordering.
            known = [item for item in values if loss_order(item) != float("inf")]
            unknown = [item for item in values if loss_order(item) == float("inf")]
            values = sorted(known, key=loss_order, reverse=order == "best") + unknown
            data = {**common, "currency": row.get("account", {}).get("currency"), "positions": values[:50],
                    "positions_available": isinstance(raw, list), "matched_count": len(values),
                    "shown_count": min(len(values), 50), "filter_symbol_exact": symbol or None,
                    "sort_order": order, "truncated": len(values) > 50,
                    "symbol_mapping": "No verified asset mapping supplied; do not infer exact broker instrument identity from name similarity."}
            self.attachments["positions"] = {k: data[k] for k in ("currency", "positions", "positions_available", "matched_count", "shown_count")}
        else:
            data = {**common, "account": select(row.get("account", {}), ACCOUNT_FIELDS),
                    "portfolio_metrics": select(row.get("portfolio_metrics", {}), PORTFOLIO_FIELDS)}
            self.attachments["account"] = data["account"]
        return self.evidence("آخرین snapshot حساب انتخاب‌شده", "/analytics/mt5-snapshots", data, observed, status)

    def retrieve(self, request, user_id, conversation):
        if request.kind in {"account", "positions"}:
            if conversation["scope"] != "account":
                return {"status": "account_not_selected", "limitation": "Ask the user to select an account in the chat selector. No private data was retrieved."}
            try:
                return self.account(user_id, conversation["connection_id"], request.kind == "positions", request.symbol, request.order)
            except PyMongoError as exc:
                raise ChatError("CHAT_ACCOUNT_STORE_UNAVAILABLE", "اطلاعات حساب موقتاً در دسترس نیست.", 503) from exc
        methods = {"indicator": lambda: self.indicator(request.subject), "analysis": lambda: self.analysis(request.subject or "market"),
                   "prices": self.prices, "news": self.news, "calendar": self.calendar}
        try:
            return methods[request.kind]()
        except (PyMongoError, ValidationError, FileNotFoundError, ValueError, KeyError, ChatError):
            return {"status": "unavailable", "kind": request.kind, "subject": request.subject, "limitation": "Requested evidence could not be retrieved or validated. Do not invent values."}
