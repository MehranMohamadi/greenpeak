"""Data service for financial market data."""

from datetime import datetime
from typing import List, Optional
from ..models.schemas import (
    OHLCDataPoint, 
    EconomicDataPoint, 
    TreasuryRatePoint,
    PerformanceDataPoint,
    DataMetadata,
    DataResponse
)
from ..utils.data_utils import (
    load_csv_data,
    load_performance_graph_data,
    filter_by_date_range,
    apply_limit,
    safe_float,
    safe_timestamp,
)
from .mongodb_service import MongoDBService
import logging
import pandas as pd

logger = logging.getLogger(__name__)


# Source-level contracts used to keep API metadata consistent across MongoDB
# and checked-in-file fallbacks.  Unknown fields stay explicit instead of
# being guessed from the latest value.
SERIES_CONTRACTS = {
    "DFF": {
        "indicator_id": "federal_funds_rate",
        "owner_group": "monetary_liquidity",
        "population": "U.S. overnight federal funds transactions",
        "seasonal_adjustment": "not_seasonally_adjusted",
        "transformation": "source_level_percent",
    },
    "DGS10": {
        "indicator_id": "us_10y_treasury_yield",
        "owner_group": "monetary_liquidity",
        "population": "U.S. Treasury constant-maturity securities",
        "seasonal_adjustment": "not_seasonally_adjusted",
        "transformation": "source_level_percent",
    },
    "SOFR": {
        "indicator_id": "sofr_rate",
        "owner_group": "monetary_liquidity",
        "population": "U.S. Treasury repo transactions eligible for SOFR",
        "seasonal_adjustment": "not_seasonally_adjusted",
        "transformation": "source_level_percent",
    },
    "REAINTRATREARAT10Y": {
        "indicator_id": "real_interest_rate_10y",
        "owner_group": "monetary_liquidity",
        "population": "U.S. 10-year inflation-indexed Treasury securities",
        "seasonal_adjustment": "not_seasonally_adjusted",
        "transformation": "source_level_percent",
    },
    "WALCL": {
        "indicator_id": "fed_balance_sheet",
        "owner_group": "monetary_liquidity",
        "population": "All Federal Reserve Banks",
        "seasonal_adjustment": "not_seasonally_adjusted",
        "transformation": "source_level_millions_usd",
    },
    "M2SL": {
        "indicator_id": "money_supply_m2",
        "owner_group": "monetary_liquidity",
        "population": "United States",
        "seasonal_adjustment": "seasonally_adjusted",
        "transformation": "source_level_billions_usd",
    },
    "RRPONTSYD": {
        "indicator_id": "reverse_repo_operations",
        "owner_group": "monetary_liquidity",
        "population": "New York Fed overnight RRP counterparties",
        "seasonal_adjustment": "not_seasonally_adjusted",
        "transformation": "source_level_billions_usd",
    },
    "GDP": {
        "indicator_id": "nominal_gdp_level",
        "owner_group": "growth_inflation_labor",
        "population": "United States economy",
        "seasonal_adjustment": "seasonally_adjusted_annual_rate",
        "transformation": "source_level_current_dollars",
    },
    "GDPC1": {
        "indicator_id": "real_gdp",
        "owner_group": "growth_inflation_labor",
        "population": "United States economy",
        "seasonal_adjustment": "seasonally_adjusted_annual_rate",
        "transformation": "source_level_chained_2017_dollars",
    },
    "UNRATE": {
        "indicator_id": "unemployment_rate",
        "owner_group": "growth_inflation_labor",
        "population": "U.S. civilian noninstitutional population, age 16 and over",
        "seasonal_adjustment": "seasonally_adjusted",
        "transformation": "source_level_percent",
    },
    "PAYEMS": {
        "indicator_id": "nonfarm_payrolls",
        "owner_group": "growth_inflation_labor",
        "population": "U.S. total nonfarm payroll employment",
        "seasonal_adjustment": "seasonally_adjusted",
        "transformation": "source_level_thousands_of_persons",
    },
    "UMCSENT": {
        "indicator_id": "consumer_confidence",
        "owner_group": "growth_inflation_labor",
        "population": "University of Michigan U.S. consumer survey respondents",
        "seasonal_adjustment": "not_seasonally_adjusted",
        "transformation": "source_index_level",
    },
    "CSCICP03USM665S": {
        "indicator_id": "consumer_confidence",
        "owner_group": "growth_inflation_labor",
        "population": "United States consumers represented by the OECD CCI",
        "seasonal_adjustment": "source_defined",
        "transformation": "source_index_level_long_term_average_100",
    },
    "CPIAUCSL": {
        "indicator_id": "cpi_index",
        "owner_group": "growth_inflation_labor",
        "population": "All Urban Consumers, U.S. city average, all items",
        "seasonal_adjustment": "seasonally_adjusted",
        "transformation": "source_index_level_1982_84_100",
    },
    "RSXFS": {
        "indicator_id": "retail_sales",
        "owner_group": "growth_inflation_labor",
        "population": "U.S. retail and food services sales",
        "seasonal_adjustment": "seasonally_adjusted",
        "transformation": "source_level_millions_usd",
    },
    "VIXCLS": {
        "indicator_id": "vix",
        "owner_group": "positioning_sentiment_derivatives_volatility",
        "population": "S&P 500 index-option implied volatility",
        "seasonal_adjustment": "not_applicable",
        "transformation": "source_index_close",
    },
    "^VIX": {
        "indicator_id": "vix",
        "owner_group": "positioning_sentiment_derivatives_volatility",
        "population": "S&P 500 index-option implied volatility",
        "seasonal_adjustment": "not_applicable",
        "transformation": "source_index_close",
    },
    "BAMLH0A0HYM2": {
        "indicator_id": "high_yield_credit_spread",
        "owner_group": "credit_financial_risk",
        "population": "ICE BofA U.S. high-yield corporate bond index constituents",
        "seasonal_adjustment": "not_seasonally_adjusted",
        "transformation": "source_percent_level",
    },
    "BAMLC0A4CBBB": {
        "indicator_id": "bbb_credit_spread",
        "owner_group": "credit_financial_risk",
        "population": "ICE BofA BBB U.S. corporate bond index constituents",
        "seasonal_adjustment": "not_seasonally_adjusted",
        "transformation": "source_percent_level",
    },
    "T10Y2Y": {
        "indicator_id": "treasury_2y10y_spread",
        "owner_group": "credit_financial_risk",
        "population": "U.S. Treasury constant-maturity securities",
        "seasonal_adjustment": "not_seasonally_adjusted",
        "transformation": "10_year_yield_minus_2_year_yield_percent",
    },
    "STLFSI4": {
        "indicator_id": "financial_stress_index",
        "owner_group": "credit_financial_risk",
        "population": "U.S. financial-market stress indicators in STLFSI4",
        "seasonal_adjustment": "not_applicable",
        "transformation": "source_index_level",
    },
}


class DataService:
    """Service for handling financial data operations."""

    def __init__(self):
        """Initialize the data service with MongoDB connection."""
        self.mongodb = None
        try:
            self.mongodb = MongoDBService()
            logger.info("DataService initialized with MongoDB")
        except Exception as e:
            logger.warning(f"MongoDB initialization failed: {e}. Falling back to CSV files.")

    @staticmethod
    def _build_metadata(
        *,
        latest_value: Optional[float],
        latest_date: Optional[str],
        total_records: int,
        description: str,
        unit: str,
        frequency: str,
        source: str,
        source_series_id: Optional[str],
        indicator_id: Optional[str] = None,
        owner_group: Optional[str] = None,
        population: Optional[str] = None,
        seasonal_adjustment: Optional[str] = None,
        transformation: Optional[str] = None,
        quality_status: Optional[str] = None,
        quality_reason: Optional[str] = None,
    ) -> DataMetadata:
        """Build traceable metadata without inventing unavailable semantics."""
        contract = SERIES_CONTRACTS.get(source_series_id or "", {})
        normalized_frequency = str(frequency or "unknown").lower()
        resolved_status = quality_status or (
            "available" if latest_value is not None and latest_date else "unavailable"
        )
        resolved_reason = quality_reason
        if resolved_status == "available" and latest_date:
            stale_after_days = {
                "daily": 10,
                "weekly": 21,
                "monthly": 62,
                "quarterly": 185,
                "annually": 550,
                "annual": 550,
            }.get(normalized_frequency)
            if stale_after_days is not None:
                try:
                    observation_day = datetime.fromisoformat(str(latest_date)[:10]).date()
                    age_days = (datetime.utcnow().date() - observation_day).days
                    if age_days > stale_after_days:
                        resolved_status = "stale"
                        resolved_reason = "observation_older_than_frequency_threshold"
                except ValueError:
                    resolved_status = "invalid"
                    resolved_reason = "invalid_observation_date"
        if resolved_status == "unavailable" and not resolved_reason:
            resolved_reason = "no_valid_observations"

        return DataMetadata(
            indicator_id=indicator_id or contract.get("indicator_id"),
            owner_group=owner_group or contract.get("owner_group"),
            latest_value=latest_value,
            latest_date=latest_date,
            total_records=total_records,
            description=description,
            unit=unit,
            frequency=normalized_frequency,
            source=source,
            fred_series=source_series_id,
            source_series_id=source_series_id,
            population=population or contract.get("population") or "not_specified_by_source_adapter",
            seasonal_adjustment=(
                seasonal_adjustment
                or contract.get("seasonal_adjustment")
                or "not_specified_by_source_adapter"
            ),
            transformation=(
                transformation
                or contract.get("transformation")
                or "source_observation_without_additional_transformation"
            ),
            observation_date=latest_date,
            retrieved_at=datetime.utcnow(),
            quality_status=resolved_status,
            quality_reason=resolved_reason,
            data_version="2.0",
        )

    @staticmethod
    def _unavailable_response(
        *,
        indicator_id: str,
        owner_group: str,
        description: str,
        unit: str,
        frequency: str,
        source: str,
        source_series_id: Optional[str],
        quality_status: str,
        quality_reason: str,
        transformation: Optional[str] = None,
        seasonal_adjustment: Optional[str] = None,
        population: Optional[str] = None,
    ) -> DataResponse:
        """Return an explicit null state without manufacturing an observation."""
        return DataResponse(
            data=[],
            metadata=DataService._build_metadata(
                indicator_id=indicator_id,
                owner_group=owner_group,
                latest_value=None,
                latest_date=None,
                total_records=0,
                description=description,
                unit=unit,
                frequency=frequency,
                source=source,
                source_series_id=source_series_id,
                population=population,
                seasonal_adjustment=seasonal_adjustment,
                transformation=transformation,
                quality_status=quality_status,
                quality_reason=quality_reason,
            ),
        )

    @staticmethod
    def _filter_transformed_points(
        points: List[EconomicDataPoint],
        limit: Optional[int],
        start_date: Optional[str],
        end_date: Optional[str],
    ) -> List[EconomicDataPoint]:
        filtered = [
            point for point in points
            if (not start_date or point.date >= start_date)
            and (not end_date or point.date <= end_date)
        ]
        return filtered[-limit:] if limit else filtered

    @staticmethod
    def _scale_economic_response(
        response: DataResponse,
        *,
        multiplier: float,
        indicator_id: str,
        owner_group: str,
        unit: str,
        transformation: str,
    ) -> DataResponse:
        points = []
        for point in response.data:
            raw_value = getattr(point, "value", None)
            if raw_value is None:
                continue
            scaled = raw_value * multiplier
            points.append(EconomicDataPoint(
                time=point.time,
                date=point.date,
                value=scaled,
                rate=scaled,
            ))

        original = response.metadata
        latest_value = points[-1].value if points else None
        latest_date = points[-1].date if points else None
        return DataResponse(
            data=points,
            metadata=DataService._build_metadata(
                indicator_id=indicator_id,
                owner_group=owner_group,
                latest_value=latest_value,
                latest_date=latest_date,
                total_records=len(points),
                description=original.description,
                unit=unit,
                frequency=original.frequency,
                source=original.source,
                source_series_id=original.source_series_id or original.fred_series,
                population=original.population,
                seasonal_adjustment=original.seasonal_adjustment,
                transformation=transformation,
            ),
        )

    def get_sp500_data(self) -> List[OHLCDataPoint]:
        """Get S&P 500 OHLC data."""
        df = load_csv_data("S&P_ohlc.csv", "Date")
        
        result = []
        for _, row in df.iterrows():
            timestamp = safe_timestamp(row["Date"])
            result.append(OHLCDataPoint(
                time=timestamp,
                date=str(row["Date"]),
                open=float(row["Open"]),
                high=float(row["High"]),
                low=float(row["Low"]),
                close=float(row["Close"]),
                volume=float(row["Volume"])
            ))
        return result

    def get_vix_data(
        self,
        limit: Optional[int] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> DataResponse:
        """Get VIX volatility index data from MongoDB or fallback to CSV."""
        response = None
        source_series_id = "VIXCLS"
        # Try MongoDB first (unified systemic_risk collection)
        if self.mongodb:
            try:
                response = self.get_systemic_risk_data(
                    indicator_name="vix",
                    limit=limit,
                    start_date=start_date,
                    end_date=end_date,
                    description="CBOE Volatility Index: VIX",
                    unit="index",
                    frequency="daily",
                    source="Federal Reserve Economic Data (FRED)",
                    data_source="VIXCLS"
                )
                if not response.data:
                    response = None
            except Exception as e:
                logger.warning(f"MongoDB failed for VIX: {e}. Falling back to CSV.")

        # Fallback to CSV
        if response is None:
            source_series_id = "^VIX"
            response = self.get_economic_data(
                filename="VIX_ohlc.csv",
                date_column="Date",
                value_column="Close",
                limit=limit,
                start_date=start_date,
                end_date=end_date,
                description="CBOE Volatility Index close",
                unit="index",
                frequency="daily",
                source="CBOE index history distributed by Yahoo Finance",
                fred_series="^VIX"
            )

        latest_date = response.data[-1].date if response.data else None
        response.metadata.indicator_id = "vix"
        response.metadata.owner_group = "positioning_sentiment_derivatives_volatility"
        response.metadata.source_series_id = source_series_id
        response.metadata.transformation = "reported_index_level"
        response.metadata.observation_date = latest_date
        response.metadata.retrieved_at = datetime.utcnow()
        if not response.data:
            response.metadata.quality_status = "unavailable"
            response.metadata.quality_reason = "no_valid_observations"
        response.metadata.data_version = "2.0"
        return response

    def get_treasury_data(self) -> List[TreasuryRatePoint]:
        """Get Treasury rates data."""
        df = load_csv_data("merged-treasury-rates-2000-2025.csv", "Date")
        
        result = []
        for _, row in df.iterrows():
            try:
                timestamp = safe_timestamp(row["Date"], "%m/%d/%Y")
                result.append(TreasuryRatePoint(
                    Date=timestamp,
                    **{
                        "3 Mo": safe_float(row.get("3 Mo")),
                        "6 Mo": safe_float(row.get("6 Mo")),
                        "1 Yr": safe_float(row.get("1 Yr")),
                        "5 Yr": safe_float(row.get("5 Yr")),
                        "10 Yr": safe_float(row.get("10 Yr")),
                    }
                ))
            except Exception as e:
                print(f"Error parsing treasury row: {row['Date']} -> {e}")
                continue
        return result

    def get_economic_data(
        self, 
        filename: str, 
        date_column: str, 
        value_column: str,
        limit: Optional[int] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        description: str = "",
        unit: str = "",
        frequency: str = "",
        source: str = "",
        fred_series: Optional[str] = None,
        mongo_collection: Optional[str] = None
    ) -> DataResponse:
        """Generic method to get economic indicator data from MongoDB or CSV fallback."""
        
        # Try MongoDB first if collection name is provided
        if mongo_collection and self.mongodb:
            try:
                return self.get_data_from_mongodb(
                    collection_name=mongo_collection,
                    limit=limit,
                    start_date=start_date,
                    end_date=end_date,
                    description=description,
                    unit=unit,
                    frequency=frequency,
                    source=source,
                    fred_series=fred_series
                )
            except Exception as e:
                logger.warning(f"MongoDB failed for {mongo_collection}: {e}. Falling back to CSV.")
        
        # Fallback to CSV
        df = load_csv_data(filename, date_column)
        df = filter_by_date_range(df, date_column, start_date, end_date)
        df = apply_limit(df, limit)
        
        result = []
        values = []
        
        for _, row in df.iterrows():
            try:
                timestamp = safe_timestamp(row[date_column])
                value = safe_float(row[value_column])
                
                if value is not None:
                    values.append(value)
                
                result.append(EconomicDataPoint(
                    time=timestamp,
                    date=row[date_column],
                    rate=value,
                    value=value
                ))
            except Exception as e:
                print(f"Error parsing {filename} row: {row[date_column]} -> {e}")
                continue
        
        # Calculate metadata
        latest_value = values[-1] if values else None
        latest_date = result[-1].date if result else None
        
        # Calculate recent changes
        recent_change = None
        if len(values) >= 30:  # 30 days/periods ago
            recent_change = values[-1] - values[-30]
        
        yoy_change = None
        if len(values) >= 365:  # Approximate year-over-year
            yoy_change = values[-1] - values[-365]
        elif len(values) >= 12 and frequency.lower() == "monthly":  # Monthly data
            yoy_change = values[-1] - values[-12]
        elif len(values) >= 4 and frequency.lower() == "quarterly":  # Quarterly data
            yoy_change = values[-1] - values[-4]
        
        metadata = self._build_metadata(
            latest_value=latest_value,
            latest_date=latest_date,
            total_records=len(result),
            description=description,
            unit=unit,
            frequency=frequency,
            source=source,
            source_series_id=fred_series,
        )
        
        return DataResponse(data=result, metadata=metadata)

    def get_data_from_mongodb(
        self,
        collection_name: str,
        limit: Optional[int] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        description: str = "",
        unit: str = "",
        frequency: str = "",
        source: str = "",
        fred_series: Optional[str] = None
    ) -> DataResponse:
        """Get data from any MongoDB collection."""
        if not self.mongodb:
            raise RuntimeError("MongoDB connection not available")
        
        collection = self.mongodb.get_collection(collection_name)
        
        # Build query filter
        query_filter = {}
        if start_date or end_date:
            date_filter = {}
            if start_date:
                date_filter["$gte"] = start_date
            if end_date:
                date_filter["$lte"] = end_date
            query_filter["date"] = date_filter
        
        # Get data from MongoDB
        cursor = collection.find(query_filter).sort("date", 1)
        if limit:
            cursor = cursor.limit(limit)
        
        result = []
        values = []
        
        for doc in cursor:
            try:
                # Handle different date formats and edge cases
                date_str = doc.get("date", "")
                if not date_str:
                    logger.warning(f"Empty date field in document: {doc.get('_id', 'unknown')}")
                    continue
                
                # Convert date string to timestamp with better error handling
                try:
                    # Try standard YYYY-MM-DD format first
                    if isinstance(date_str, str):
                        date_obj = datetime.strptime(date_str, "%Y-%m-%d")
                    else:
                        # If it's already a datetime object
                        date_obj = date_str
                    
                    # Handle dates before 1970 (Unix epoch) which cause issues on Windows
                    try:
                        timestamp = int(date_obj.timestamp())
                    except (OSError, OverflowError):
                        # For dates before 1970, use a different approach
                        epoch = datetime(1970, 1, 1)
                        if date_obj < epoch:
                            # Use days since 1900 for very old dates
                            base_date = datetime(1900, 1, 1)
                            days_since_1900 = (date_obj - base_date).days
                            timestamp = -(25567 - days_since_1900) * 86400  # Excel-style negative timestamp
                        else:
                            timestamp = int((date_obj - epoch).total_seconds())
                        
                except ValueError:
                    # Try alternative date formats
                    try:
                        date_obj = datetime.strptime(str(date_str), "%m/%d/%Y")
                        try:
                            timestamp = int(date_obj.timestamp())
                        except (OSError, OverflowError):
                            epoch = datetime(1970, 1, 1)
                            if date_obj < epoch:
                                base_date = datetime(1900, 1, 1)
                                days_since_1900 = (date_obj - base_date).days
                                timestamp = -(25567 - days_since_1900) * 86400
                            else:
                                timestamp = int((date_obj - epoch).total_seconds())
                    except ValueError:
                        try:
                            date_obj = datetime.strptime(str(date_str), "%Y-%m-%d %H:%M:%S")
                            try:
                                timestamp = int(date_obj.timestamp())
                            except (OSError, OverflowError):
                                epoch = datetime(1970, 1, 1)
                                timestamp = int((date_obj - epoch).total_seconds())
                        except ValueError:
                            logger.warning(f"Could not parse date '{date_str}' in document: {doc.get('_id', 'unknown')}")
                            continue
                
                # Handle value field with better error checking
                value_raw = doc.get("value")
                if value_raw is None:
                    logger.warning(f"Missing value field in document: {doc.get('_id', 'unknown')}")
                    continue
                
                try:
                    value = float(value_raw)
                except (ValueError, TypeError):
                    logger.warning(f"Could not convert value '{value_raw}' to float in document: {doc.get('_id', 'unknown')}")
                    continue
                
                if value is not None:
                    values.append(value)
                
                result.append(EconomicDataPoint(
                    time=timestamp,
                    date=date_obj.strftime("%Y-%m-%d"),
                    rate=value,
                    value=value
                ))
            except Exception as e:
                logger.warning(f"Error parsing MongoDB document from {collection_name}: {e}")
                logger.warning(f"Document content: {doc}")
                continue
        
        # Calculate metadata
        latest_value = values[-1] if values else None
        latest_date = result[-1].date if result else None
        
        # Use DataMetadata to match the simple DataResponse schema
        metadata = self._build_metadata(
            latest_value=latest_value,
            latest_date=latest_date,
            total_records=len(result),
            description=description,
            unit=unit,
            frequency=frequency,
            source=source,
            source_series_id=fred_series,
        )
        
        return DataResponse(data=result, metadata=metadata)

    def get_dff_data(
        self, 
        limit: Optional[int] = None, 
        start_date: Optional[str] = None, 
        end_date: Optional[str] = None
    ) -> DataResponse:
        """Get Federal Funds Rate data from MongoDB or fallback to CSV."""
        # Try MongoDB first
        if self.mongodb:
            try:
                response = self.get_monetary_policy_data(
                    indicator_name="federal_funds_rate",
                    limit=limit,
                    start_date=start_date,
                    end_date=end_date,
                    description="Federal Funds Effective Rate",
                    unit="percent",
                    frequency="daily",
                    source="Board of Governors of the Federal Reserve System (US)",
                    fred_series="DFF"
                )
                if response.data:
                    return response
            except Exception as e:
                logger.warning(f"MongoDB failed for federal_funds_rate: {e}. Falling back to CSV.")
        
        # Fallback to CSV
        return self.get_economic_data(
            filename="DFF.csv",
            date_column="DATE",
            value_column="DFF",
            limit=limit,
            start_date=start_date,
            end_date=end_date,
            description="Federal Funds Effective Rate",
            unit="percent",
            frequency="daily",
            source="Board of Governors of the Federal Reserve System (US)",
            fred_series="DFF"
        )

    def get_cpi_data(
        self, 
        limit: Optional[int] = None, 
        start_date: Optional[str] = None, 
        end_date: Optional[str] = None
    ) -> DataResponse:
        """Get Consumer Price Index data."""
        return self.get_economic_data(
            filename="CPI.csv",
            date_column="observation_date",
            value_column="CPIAUCSL",
            limit=limit,
            start_date=start_date,
            end_date=end_date,
            description="Consumer Price Index for All Urban Consumers: All Items",
            unit="index",
            frequency="monthly",
            source="U.S. Bureau of Labor Statistics",
            fred_series="CPIAUCSL"
        )

    def get_gdp_data(
        self, 
        limit: Optional[int] = None, 
        start_date: Optional[str] = None, 
        end_date: Optional[str] = None
    ) -> DataResponse:
        """Get the checked-in nominal GDP level series."""
        return self.get_economic_data(
            filename="GDP.csv",
            date_column="observation_date",
            value_column="GDP",
            limit=limit,
            start_date=start_date,
            end_date=end_date,
            description="Gross Domestic Product, nominal level",
            unit="billions_of_dollars_seasonally_adjusted_annual_rate",
            frequency="quarterly",
            source="U.S. Bureau of Economic Analysis via FRED",
            fred_series="GDP",
        )

    def get_unrate_data(
        self, 
        limit: Optional[int] = None, 
        start_date: Optional[str] = None, 
        end_date: Optional[str] = None
    ) -> DataResponse:
        """Get Unemployment Rate data."""
        return self.get_economic_data(
            filename="UNRATE.csv",
            date_column="DATE",
            value_column="UNRATE",
            limit=limit,
            start_date=start_date,
            end_date=end_date,
            description="Unemployment Rate",
            unit="percent",
            frequency="monthly",
            source="U.S. Bureau of Labor Statistics",
            fred_series="UNRATE"
        )

    def get_walcl_data(
        self, 
        limit: Optional[int] = None, 
        start_date: Optional[str] = None, 
        end_date: Optional[str] = None
    ) -> DataResponse:
        """Get Federal Reserve Balance Sheet data from MongoDB or fallback to CSV."""
        # Try MongoDB first
        if self.mongodb:
            try:
                response = self.get_monetary_policy_data(
                    indicator_name="fed_balance_sheet",
                    limit=limit,
                    start_date=start_date,
                    end_date=end_date,
                    description="All Federal Reserve Banks - Total Assets",
                    unit="millions_usd",
                    frequency="weekly",
                    source="Board of Governors of the Federal Reserve System (US)",
                    fred_series="WALCL"
                )
                if response.data:
                    return response
            except Exception as e:
                logger.warning(f"MongoDB failed for fed_balance_sheet: {e}. Falling back to CSV.")
        
        # Fallback to CSV
        return self.get_economic_data(
            filename="WALCL.csv",
            date_column="observation_date",
            value_column="WALCL",
            limit=limit,
            start_date=start_date,
            end_date=end_date,
            description="Federal Reserve Balance Sheet - Total Assets",
            unit="millions_usd",
            frequency="weekly",
            source="Board of Governors of the Federal Reserve System (US)",
            fred_series="WALCL"
        )

    def get_10year_data(
        self, 
        limit: Optional[int] = None, 
        start_date: Optional[str] = None, 
        end_date: Optional[str] = None
    ) -> DataResponse:
        """Get 10-Year Treasury Rate data from MongoDB or fallback to CSV."""
        # Try MongoDB first
        if self.mongodb:
            try:
                response = self.get_monetary_policy_data(
                    indicator_name="ten_year_treasury",
                    limit=limit,
                    start_date=start_date,
                    end_date=end_date,
                    description="10-Year Treasury Constant Maturity Rate",
                    unit="percent",
                    frequency="daily",
                    source="Board of Governors of the Federal Reserve System (US)",
                    fred_series="DGS10"
                )
                if response.data:
                    return response
            except Exception as e:
                logger.warning(f"MongoDB failed for ten_year_treasury: {e}. Falling back to CSV.")
        
        # The GS10.csv fallback is monthly and must not be presented as daily DGS10.
        # Use the checked-in daily Treasury curve export and its 10-year maturity.
        df = load_csv_data("merged-treasury-rates-2000-2025.csv", "Date", sort_by_date=False)
        df["parsed_date"] = pd.to_datetime(df["Date"], format="%m/%d/%Y", errors="coerce")
        df = df.dropna(subset=["parsed_date", "10 Yr"]).sort_values("parsed_date")
        if start_date:
            df = df[df["parsed_date"] >= pd.Timestamp(start_date)]
        if end_date:
            df = df[df["parsed_date"] <= pd.Timestamp(end_date)]
        df = apply_limit(df, limit)

        result = []
        values = []
        for _, row in df.iterrows():
            value = safe_float(row["10 Yr"])
            if value is None:
                continue
            date_str = row["parsed_date"].strftime("%Y-%m-%d")
            values.append(value)
            result.append(EconomicDataPoint(time=safe_timestamp(date_str), date=date_str, rate=value, value=value))

        return DataResponse(
            data=result,
            metadata=self._build_metadata(
                latest_value=values[-1] if values else None,
                latest_date=result[-1].date if result else None,
                total_records=len(result),
                description="10-Year Treasury Constant Maturity Rate",
                unit="percent",
                frequency="daily",
                source="U.S. Department of the Treasury daily yield curve",
                source_series_id="DGS10",
            ),
        )

    def get_sofr_data(
        self, 
        limit: Optional[int] = None, 
        start_date: Optional[str] = None, 
        end_date: Optional[str] = None
    ) -> DataResponse:
        """Get SOFR data from MongoDB or fallback to CSV."""
        # Try MongoDB first
        if self.mongodb:
            try:
                response = self.get_monetary_policy_data(
                    indicator_name="sofr_rate",
                    limit=limit,
                    start_date=start_date,
                    end_date=end_date,
                    description="Secured Overnight Financing Rate",
                    unit="percent",
                    frequency="daily",
                    source="Federal Reserve Bank of New York",
                    fred_series="SOFR"
                )
                if response.data:
                    return response
            except Exception as e:
                logger.warning(f"MongoDB failed for sofr_rate: {e}. Falling back to CSV.")
        
        # Fallback to CSV
        return self.get_economic_data(
            filename="SOFR.csv",
            date_column="observation_date",
            value_column="SOFR",
            limit=limit,
            start_date=start_date,
            end_date=end_date,
            description="Secured Overnight Financing Rate",
            unit="percent",
            frequency="daily",
            source="Federal Reserve Bank of New York",
            fred_series="SOFR"
        )

    def get_real_interest_rate_data(
        self, 
        limit: Optional[int] = None, 
        start_date: Optional[str] = None, 
        end_date: Optional[str] = None
    ) -> DataResponse:
        """Get Real Interest Rate data from MongoDB or fallback to CSV."""
        # Try MongoDB first
        if self.mongodb:
            try:
                response = self.get_monetary_policy_data(
                    indicator_name="real_interest_rate",
                    limit=limit,
                    start_date=start_date,
                    end_date=end_date,
                    description="10-Year Treasury Inflation-Indexed Security, Constant Maturity",
                    unit="percent",
                    frequency="monthly",
                    source="Board of Governors of the Federal Reserve System (US)",
                    fred_series="REAINTRATREARAT10Y"
                )
                if response.data:
                    return response
            except Exception as e:
                logger.warning(f"MongoDB failed for real_interest_rate: {e}. Falling back to CSV.")
        
        # Fallback to CSV
        return self.get_economic_data(
            filename="REAINTRATREARAT10Y.csv",
            date_column="DATE",
            value_column="REAINTRATREARAT10Y",
            limit=limit,
            start_date=start_date,
            end_date=end_date,
            description="10-Year Treasury Inflation-Indexed Security, Constant Maturity",
            unit="percent",
            frequency="daily",
            source="Board of Governors of the Federal Reserve System (US)",
            fred_series="REAINTRATREARAT10Y"
        )
    
    def get_credit_spread_data(
        self,
        limit: Optional[int] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> DataResponse:
        """Get the high-yield OAS in basis points."""
        response = None
        # Try MongoDB first (FRED high yield spread)
        if self.mongodb:
            try:
                response = self.get_systemic_risk_data(
                    indicator_name="credit_spread_hyg",
                    limit=limit,
                    start_date=start_date,
                    end_date=end_date,
                    description="ICE BofA US High Yield Index Option-Adjusted Spread",
                    unit="percent",
                    frequency="daily",
                    source="ICE Bank of America",
                    data_source="BAMLH0A0HYM2"
                )
                if not response.data:
                    response = None
            except Exception as e:
                logger.warning(f"MongoDB failed for credit spread: {e}. Falling back to CSV.")

        if response is None:
            response = self.get_economic_data(
                filename="BAMLH0A0HYM2.csv",
                date_column="observation_date",
                value_column="BAMLH0A0HYM2",
                limit=limit,
                start_date=start_date,
                end_date=end_date,
                description="ICE BofA US High Yield Index Option-Adjusted Spread",
                unit="percent",
                frequency="daily",
                source="ICE Data Indices, LLC",
                fred_series="BAMLH0A0HYM2"
            )

        return self._scale_economic_response(
            response,
            multiplier=100.0,
            indicator_id="high_yield_credit_spread",
            owner_group="credit_financial_risk",
            unit="basis_points",
            transformation="source_percent_times_100",
        )
    
    def get_2y10y_yieldcurve(
        self,
        limit: Optional[int] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> DataResponse:
        """Get 2Y10Y yield curve data from MongoDB or fallback to CSV."""
        # Try MongoDB first (direct FRED T10Y2Y spread)
        if self.mongodb:
            try:
                response = self.get_systemic_risk_data(
                    indicator_name="yield_curve_2y10y",
                    limit=limit,
                    start_date=start_date,
                    end_date=end_date,
                    description="10-Year Treasury Constant Maturity Minus 2-Year Treasury Constant Maturity",
                    unit="percent",
                    frequency="daily",
                    source="Federal Reserve Economic Data (FRED)",
                    data_source="T10Y2Y"
                )
                if response.data:
                    return response
            except Exception as e:
                logger.warning(f"MongoDB failed for yield curve: {e}. Falling back to CSV.")
        
        # Fallback to CSV
        return self.get_economic_data(
            filename="T10Y2Y.csv",
            date_column="observation_date",
            value_column="T10Y2Y",
            limit=limit,
            start_date=start_date,
            end_date=end_date,
            description="2-Year/10-Year Treasury Yield Curve",
            unit="percent",
            frequency="daily",
            source="Federal Reserve Bank of St. Louis via FRED",
            fred_series="T10Y2Y"
        )
    
    def get_cds_spreads(
        self,
        limit: Optional[int] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> DataResponse:
        """Get the BBB corporate option-adjusted spread in basis points.

        The legacy route is named /cds, but BAMLC0A4CBBB is an index OAS and
        must not be presented as a credit-default-swap series.
        """
        response = None
        # Try MongoDB first (unified systemic_risk collection)
        if self.mongodb:
            try:
                response = self.get_systemic_risk_data(
                    indicator_name="bbb_corporate_option_adjusted_spread",
                    limit=limit,
                    start_date=start_date,
                    end_date=end_date,
                    description="ICE BofA BBB US Corporate Index Option-Adjusted Spread",
                    unit="percent",
                    frequency="daily",
                    source="Federal Reserve Economic Data (FRED)",
                    data_source="BAMLC0A4CBBB",
                )
                if not response.data:
                    response = self.get_systemic_risk_data(
                        indicator_name="cds_spreads_investment_grade",
                        limit=limit,
                        start_date=start_date,
                        end_date=end_date,
                        description="ICE BofA BBB US Corporate Index Option-Adjusted Spread",
                        unit="percent",
                        frequency="daily",
                        source="Federal Reserve Economic Data (FRED)",
                        data_source="BAMLC0A4CBBB",
                    )
                if not response.data:
                    response = None
            except Exception as e:
                logger.warning(f"MongoDB failed for BBB corporate OAS: {e}. Falling back to CSV.")

        if response is None:
            response = self.get_economic_data(
                filename="BAMLC0A4CBBB.csv",
                date_column="observation_date",
                value_column="BAMLC0A4CBBB",
                limit=limit,
                start_date=start_date,
                end_date=end_date,
                description="ICE BofA BBB US Corporate Index Option-Adjusted Spread",
                unit="percent",
                frequency="daily",
                source="ICE Data Indices, LLC via FRED",
                fred_series="BAMLC0A4CBBB"
            )

        return self._scale_economic_response(
            response,
            multiplier=100.0,
            indicator_id="bbb_credit_spread",
            owner_group="credit_financial_risk",
            unit="basis_points",
            transformation="source_percent_times_100",
        )
    
    def get_stress_index(
        self,
        limit: Optional[int] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> DataResponse:
        """Get Fed Financial Stress Index data from MongoDB or fallback to CSV."""
        # Try MongoDB first (unified systemic_risk collection)
        if self.mongodb:
            try:
                response = self.get_systemic_risk_data(
                    indicator_name="financial_stress_index",
                    limit=limit,
                    start_date=start_date,
                    end_date=end_date,
                    description="St. Louis Fed Financial Stress Index",
                    unit="index",
                    frequency="weekly",
                    source="Federal Reserve Economic Data (FRED)",
                    data_source="STLFSI4"
                )
                if response.data:
                    return response
            except Exception as e:
                logger.warning(f"MongoDB failed for financial stress index: {e}. Falling back to CSV.")
        
        # Fallback to CSV
        return self.get_economic_data(
            filename="STLFSI4.csv",
            date_column="observation_date",
            value_column="STLFSI4",
            limit=limit,
            start_date=start_date,
            end_date=end_date,
            description="Fed Financial Stress Index",
            unit="index",
            frequency="weekly",
            source="Federal Reserve Bank of St. Louis via FRED",
            fred_series="STLFSI4"
        )

    def get_dollar_index_data(
        self,
        limit: Optional[int] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> DataResponse:
        """Get US Dollar Index data from MongoDB."""
        return self.get_economic_data(
            filename="",  # No CSV fallback for Yahoo Finance data
            date_column="date",
            value_column="value",
            limit=limit,
            start_date=start_date,
            end_date=end_date,
            description="US Dollar Index measures the value of the USD against a basket of foreign currencies",
            unit="index",
            frequency="daily",
            source="Yahoo Finance",
            mongo_collection="systemic_risk_dollar_index"
        )

    def get_gold_data(
        self,
        limit: Optional[int] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> DataResponse:
        """Get Gold Futures data from MongoDB."""
        return self.get_economic_data(
            filename="",  # No CSV fallback for Yahoo Finance data
            date_column="date",
            value_column="value",
            limit=limit,
            start_date=start_date,
            end_date=end_date,
            description="Gold futures prices reflecting safe-haven demand and inflation expectations",
            unit="USD/oz",
            frequency="daily",
            source="Yahoo Finance",
            mongo_collection="systemic_risk_gold"
        )
    
    def get_m2_data(
        self,
        limit: Optional[int] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> DataResponse:
        """Get M2 (M2SL) data from MongoDB or fallback to CSV."""
        # Try MongoDB first (unified liquidity_flows collection)
        if self.mongodb:
            try:
                response = self.get_liquidity_flows_data(
                    indicator_name="money_supply_m2",
                    limit=limit,
                    start_date=start_date,
                    end_date=end_date,
                    description="M2 Money Stock",
                    unit="billions_of_dollars",
                    frequency="monthly",
                    source="Federal Reserve Economic Data (FRED)",
                    data_source="M2SL"
                )
                if response.data:
                    return response
            except Exception as e:
                logger.warning(f"MongoDB failed for M2 data: {e}. Falling back to CSV.")
        
        # Fallback to CSV
        return self.get_economic_data(
            filename="M2SL.csv",
            date_column="observation_date",
            value_column="M2SL",
            limit=limit,
            start_date=start_date,
            end_date=end_date,
            description="M2 Money Supply",
            unit="Billions of Dollars",
            frequency="monthly",
            source="Board of Governors of the Federal Reserve System (US) via FRED",
            fred_series="M2SL"
        )

    def get_reverse_repo_data(
        self,
        limit: Optional[int] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> DataResponse:
        """Get Reverse Repo data from MongoDB or fallback to CSV."""
        # Try MongoDB first (unified liquidity_flows collection)
        if self.mongodb:
            try:
                response = self.get_liquidity_flows_data(
                    indicator_name="reverse_repo_operations",
                    limit=limit,
                    start_date=start_date,
                    end_date=end_date,
                    description="Overnight Reverse Repurchase Agreements: Treasury Securities Sold by the Federal Reserve in the Temporary Open Market Operations",
                    unit="billions_of_dollars",
                    frequency="daily",
                    source="Federal Reserve Economic Data (FRED)",
                    data_source="RRPONTSYD"
                )
                if response.data:
                    return response
            except Exception as e:
                logger.warning(f"MongoDB failed for reverse repo data: {e}. Falling back to CSV.")
        
        # Fallback to CSV
        return self.get_economic_data(
            filename="RRPONTSYD.csv",
            date_column="observation_date",
            value_column="RRPONTSYD",
            limit=limit,
            start_date=start_date,
            end_date=end_date,
            description="Reverse Repo",
            unit="Billions of Dollars",
            frequency="daily",
            source="Federal Reserve Bank of New York via FRED",
            fred_series="RRPONTSYD"
        )
    
    def get_etf_inflows_data(
        self,
        limit: Optional[int] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> DataResponse:
        """Get ETF Inflows data from MongoDB or fallback to placeholder."""
        # Try MongoDB first (unified liquidity_flows collection)
        if self.mongodb:
            try:
                return self.get_liquidity_flows_data(
                    indicator_name="etf_inflows",
                    limit=limit,
                    start_date=start_date,
                    end_date=end_date,
                    description="ETF Inflows - Major ETF Volume Analysis",
                    unit="millions_of_dollars",
                    frequency="daily",
                    source="Yahoo Finance",
                    data_source="yahoo_finance"
                )
            except Exception as e:
                logger.warning(f"MongoDB failed for ETF inflows: {e}. No fallback available yet.")
        
        # Return empty response with metadata for future implementation
        return self._unavailable_response(
            indicator_id="etf_inflows",
            owner_group="capital_flows_intermarket",
            description="ETF net flows",
            unit="millions_of_dollars",
            frequency="daily",
            source="Not connected",
            source_series_id=None,
            quality_status="unavailable",
            quality_reason="verified_net_flow_source_not_connected",
            transformation="not_available",
            seasonal_adjustment="not_applicable",
            population="not_available",
        )

    def get_equity_fund_flows_data(
        self,
        limit: Optional[int] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> DataResponse:
        """Get Equity Fund Flows data (Placeholder - Future: Paid API)."""
        # Try MongoDB first (unified liquidity_flows collection)
        if self.mongodb:
            try:
                return self.get_liquidity_flows_data(
                    indicator_name="equity_fund_flows",
                    limit=limit,
                    start_date=start_date,
                    end_date=end_date,
                    description="Equity Fund Flows (Placeholder - Future: Paid API)",
                    unit="millions_of_dollars",
                    frequency="weekly",
                    source="Future: Paid API",
                    data_source="paid_api_placeholder"
                )
            except Exception as e:
                logger.warning(f"MongoDB failed for equity fund flows: {e}. No fallback available yet.")
        
        # Return empty response with metadata for future implementation
        return self._unavailable_response(
            indicator_id="equity_fund_flows",
            owner_group="capital_flows_intermarket",
            description="Equity fund net flows",
            unit="millions_of_dollars",
            frequency="weekly",
            source="Not connected",
            source_series_id=None,
            quality_status="unavailable",
            quality_reason="verified_net_flow_source_not_connected",
            transformation="not_available",
            seasonal_adjustment="not_applicable",
            population="not_available",
        )

    def get_margin_debt_data(
        self,
        limit: Optional[int] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> DataResponse:
        """Get Margin Debt data (Placeholder - Future: Paid API)."""
        # Try MongoDB first (unified liquidity_flows collection)
        if self.mongodb:
            try:
                return self.get_liquidity_flows_data(
                    indicator_name="margin_debt",
                    limit=limit,
                    start_date=start_date,
                    end_date=end_date,
                    description="Margin Debt (Placeholder - Future: Paid API)",
                    unit="millions_of_dollars",
                    frequency="monthly",
                    source="Future: Paid API",
                    data_source="paid_api_placeholder"
                )
            except Exception as e:
                logger.warning(f"MongoDB failed for margin debt: {e}. No fallback available yet.")
        
        # Return empty response with metadata for future implementation
        return self._unavailable_response(
            indicator_id="margin_debt",
            owner_group="credit_financial_risk",
            description="U.S. securities margin debt",
            unit="millions_of_dollars",
            frequency="monthly",
            source="Not connected",
            source_series_id=None,
            quality_status="unavailable",
            quality_reason="verified_margin_debt_source_not_connected",
            transformation="not_available",
            seasonal_adjustment="not_applicable",
            population="not_available",
        )

    def get_institutional_flows_data(
        self,
        limit: Optional[int] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> DataResponse:
        """Get Institutional Flows data (Placeholder - Future: Paid API)."""
        # Try MongoDB first (unified liquidity_flows collection)
        if self.mongodb:
            try:
                return self.get_liquidity_flows_data(
                    indicator_name="institutional_flows",
                    limit=limit,
                    start_date=start_date,
                    end_date=end_date,
                    description="Institutional Flows (Placeholder - Future: Paid API)",
                    unit="millions_of_dollars",
                    frequency="daily",
                    source="Future: Paid API",
                    data_source="paid_api_placeholder"
                )
            except Exception as e:
                logger.warning(f"MongoDB failed for institutional flows: {e}. No fallback available yet.")
        
        # Return empty response with metadata for future implementation
        return self._unavailable_response(
            indicator_id="institutional_flows",
            owner_group="capital_flows_intermarket",
            description="Institutional net flows",
            unit="millions_of_dollars",
            frequency="daily",
            source="Not connected",
            source_series_id=None,
            quality_status="unavailable",
            quality_reason="verified_institutional_flow_source_not_connected",
            transformation="not_available",
            seasonal_adjustment="not_applicable",
            population="not_available",
        )
    
    def get_payroll_data(
        self,
        limit: Optional[int] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> DataResponse:
        """Get Non-farm Payrolls data."""
        return self.get_economic_data(
            filename="PAYEMS.csv",
            date_column="observation_date",
            value_column="PAYEMS",
            limit=limit,
            start_date=start_date,
            end_date=end_date,
            description="Non-farm Payrolls",
            unit="Thousands of Persons",
            frequency="monthly",
            source="U.S. Bureau of Labor Statistics via FRED®",
            fred_series="PAYEMS",
        )
    
    def get_confidence_data(
        self,
        limit: Optional[int] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> DataResponse:
        """Get Consumer Confidence data."""
        return self.get_economic_data(
            filename="CSCICP03USM665S.csv",
            date_column="observation_date",
            value_column="CSCICP03USM665S",
            limit=limit,
            start_date=start_date,
            end_date=end_date,
            description="OECD Main Economic Indicators: Consumer Confidence Index for the United States",
            unit="index_long_term_average_100",
            frequency="Monthly",
            source="Organization for Economic Co-operation and Development via FRED®",
            fred_series="CSCICP03USM665S",
        )

    def get_systemic_risk_data(
        self,
        indicator_name: str,
        limit: Optional[int] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        description: str = "",
        unit: str = "",
        frequency: str = "",
        source: str = "",
        data_source: Optional[str] = None
    ) -> DataResponse:
        """Get systemic risk data from the unified systemic_risk collection."""
        if not self.mongodb:
            raise RuntimeError("MongoDB connection not available")
        
        collection = self.mongodb.get_collection("systemic_risk")
        
        # Build query filter
        query_filter = {"indicator": indicator_name}
        if start_date or end_date:
            date_filter = {}
            if start_date:
                date_filter["$gte"] = start_date
            if end_date:
                date_filter["$lte"] = end_date
            query_filter["date"] = date_filter
        
        # Get data from MongoDB
        cursor = collection.find(query_filter).sort("date", 1)
        if limit:
            cursor = cursor.limit(limit)
        
        result = []
        values = []
        
        for doc in cursor:
            try:
                date_str = doc.get("date", "")
                if not date_str:
                    continue
                
                date_obj = datetime.strptime(date_str, "%Y-%m-%d")
                timestamp = int(date_obj.timestamp())
                
                value_raw = doc.get("value")
                if value_raw is None:
                    continue
                
                value = float(value_raw)
                values.append(value)
                
                result.append(EconomicDataPoint(
                    time=timestamp,
                    date=date_obj.strftime("%Y-%m-%d"),
                    rate=value,
                    value=value
                ))
            except Exception as e:
                logger.warning(f"Error parsing systemic risk document: {e}")
                continue
        
        # Calculate metadata
        latest_value = values[-1] if values else None
        latest_date = result[-1].date if result else None
        
        metadata = self._build_metadata(
            indicator_id=SERIES_CONTRACTS.get(data_source or "", {}).get(
                "indicator_id", indicator_name
            ),
            owner_group=(
                "positioning_sentiment_derivatives_volatility"
                if indicator_name == "vix"
                else "credit_financial_risk"
            ),
            latest_value=latest_value,
            latest_date=latest_date,
            total_records=len(result),
            description=description,
            unit=unit,
            frequency=frequency,
            source=source,
            source_series_id=data_source,
        )
        
        return DataResponse(data=result, metadata=metadata)

    def get_liquidity_flows_data(
        self,
        indicator_name: str,
        limit: Optional[int] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        description: str = "",
        unit: str = "",
        frequency: str = "",
        source: str = "",
        data_source: Optional[str] = None
    ) -> DataResponse:
        """Get liquidity flows data from the unified liquidity_flows collection."""
        if not self.mongodb:
            raise RuntimeError("MongoDB connection not available")
        
        collection = self.mongodb.get_collection("liquidity_flows")
        
        # Build query filter
        query_filter = {"indicator": indicator_name}
        if start_date or end_date:
            date_filter = {}
            if start_date:
                date_filter["$gte"] = start_date
            if end_date:
                date_filter["$lte"] = end_date
            query_filter["date"] = date_filter
        
        # Get data from MongoDB
        cursor = collection.find(query_filter).sort("date", 1)
        if limit:
            cursor = cursor.limit(limit)
        
        result = []
        values = []
        
        for doc in cursor:
            try:
                date_str = doc.get("date", "")
                if not date_str:
                    continue
                
                date_obj = datetime.strptime(date_str, "%Y-%m-%d")
                timestamp = int(date_obj.timestamp())
                
                value_raw = doc.get("value")
                if value_raw is None:
                    continue
                
                value = float(value_raw)
                values.append(value)
                
                result.append(EconomicDataPoint(
                    time=timestamp,
                    date=date_obj.strftime("%Y-%m-%d"),
                    rate=value,
                    value=value
                ))
            except Exception as e:
                logger.warning(f"Error parsing liquidity flows document: {e}")
                continue
        
        # Calculate metadata
        latest_value = values[-1] if values else None
        latest_date = result[-1].date if result else None
        
        metadata = self._build_metadata(
            indicator_id=SERIES_CONTRACTS.get(data_source or "", {}).get(
                "indicator_id", indicator_name
            ),
            owner_group=(
                "monetary_liquidity"
                if indicator_name in {"money_supply_m2", "reverse_repo_operations"}
                else "capital_flows_intermarket"
            ),
            latest_value=latest_value,
            latest_date=latest_date,
            total_records=len(result),
            description=description,
            unit=unit,
            frequency=frequency,
            source=source,
            source_series_id=data_source,
        )
        
        return DataResponse(data=result, metadata=metadata)

    def get_performance_graph_data(
        self,
        limit: Optional[int] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> DataResponse:
        """Get S&P 500 performance graph data from Excel file."""
        try:
            df = load_performance_graph_data()
            
            # Apply date filtering if provided
            if start_date:
                df = df[df['date'] >= start_date]
            if end_date:
                df = df[df['date'] <= end_date]
            
            # Apply limit if provided
            if limit:
                df = df.tail(limit)
            
            result = []
            values = []
            
            for i, row in df.iterrows():
                try:
                    # Convert date to timestamp
                    timestamp = int(row['date'].timestamp())
                    date_str = row['date'].strftime('%Y-%m-%d')
                    value = float(row['sp500_value'])
                    
                    # Calculate daily change and percentage change
                    change = None
                    change_percent = None
                    if i > 0:
                        prev_value = float(df.iloc[i-1]['sp500_value'])
                        change = value - prev_value
                        change_percent = (change / prev_value) * 100 if prev_value != 0 else 0
                    
                    values.append(value)
                    
                    result.append(PerformanceDataPoint(
                        time=timestamp,
                        date=date_str,
                        value=value,
                        change=change,
                        change_percent=change_percent
                    ))
                except Exception as e:
                    print(f"Error parsing performance data row: {row['date']} -> {e}")
                    continue
            
            # Calculate metadata
            latest_value = values[-1] if values else None
            latest_date = result[-1].date if result else None
            
            # Calculate recent performance metrics
            performance_1d = None
            performance_1w = None
            performance_1m = None
            performance_ytd = None
            
            if len(values) >= 2:
                performance_1d = ((values[-1] - values[-2]) / values[-2]) * 100
            
            if len(values) >= 7:
                performance_1w = ((values[-1] - values[-7]) / values[-7]) * 100
            
            if len(values) >= 30:
                performance_1m = ((values[-1] - values[-30]) / values[-30]) * 100
            
            # For YTD, find the first value of the current year
            if result:
                current_year = datetime.now().year
                ytd_start_idx = None
                for i, point in enumerate(result):
                    point_year = datetime.fromtimestamp(point.time).year
                    if point_year == current_year:
                        ytd_start_idx = i
                        break
                
                if ytd_start_idx is not None and ytd_start_idx < len(values):
                    ytd_start_value = values[ytd_start_idx]
                    performance_ytd = ((values[-1] - ytd_start_value) / ytd_start_value) * 100
            
            metadata = self._build_metadata(
                indicator_id="sp500_performance",
                owner_group="market_internals_sectors",
                latest_value=latest_value,
                latest_date=latest_date,
                total_records=len(result),
                description="S&P 500 Performance Graph Export Data",
                unit="index_value",
                frequency="daily",
                source="Performance Graph Export",
                source_series_id="performance_graph_export",
                population="S&P 500 index",
                seasonal_adjustment="not_applicable",
                transformation="source_index_level",
            )
            
            return DataResponse(data=result, metadata=metadata)
            
        except Exception as e:
            raise RuntimeError(f"Error loading performance graph data: {e}")

    def get_monetary_policy_data(
        self,
        indicator_name: str,
        limit: Optional[int] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        description: str = "",
        unit: str = "",
        frequency: str = "",
        source: str = "",
        fred_series: Optional[str] = None
    ) -> DataResponse:
        """Get monetary policy data from the unified monetary_policy collection."""
        if not self.mongodb:
            raise RuntimeError("MongoDB connection not available")

        # MongoDBService connects lazily. Resolving the collection through the
        # accessor ensures the first request does not fall through to a stale
        # local file simply because ``db`` has not been initialized yet.
        collection = self.mongodb.get_collection("monetary_policy")
        
        # Build query filter
        query_filter = {"indicator": indicator_name}
        if start_date or end_date:
            date_filter = {}
            if start_date:
                date_filter["$gte"] = start_date
            if end_date:
                date_filter["$lte"] = end_date
            query_filter["date"] = date_filter
        
        # Get data from MongoDB
        cursor = collection.find(query_filter).sort("date", 1)
        if limit:
            cursor = cursor.limit(limit)
        
        result = []
        values = []
        
        for doc in cursor:
            try:
                # Handle different date formats and edge cases
                date_str = doc.get("date", "")
                if not date_str:
                    logger.warning(f"Empty date field in document: {doc.get('_id', 'unknown')}")
                    continue
                
                # Convert date string to timestamp with better error handling
                try:
                    # Try standard YYYY-MM-DD format first
                    if isinstance(date_str, str):
                        date_obj = datetime.strptime(date_str, "%Y-%m-%d")
                    else:
                        # If it's already a datetime object
                        date_obj = date_str
                    
                    # Handle dates before 1970 (Unix epoch) which cause issues on Windows
                    try:
                        timestamp = int(date_obj.timestamp())
                    except (OSError, OverflowError):
                        # For dates before 1970, use a different approach
                        epoch = datetime(1970, 1, 1)
                        if date_obj < epoch:
                            # Use days since 1900 for very old dates
                            base_date = datetime(1900, 1, 1)
                            days_since_1900 = (date_obj - base_date).days
                            timestamp = -(25567 - days_since_1900) * 86400  # Excel-style negative timestamp
                        else:
                            timestamp = int((date_obj - epoch).total_seconds())
                        
                except ValueError:
                    # Try alternative date formats
                    try:
                        date_obj = datetime.strptime(str(date_str), "%m/%d/%Y")
                        try:
                            timestamp = int(date_obj.timestamp())
                        except (OSError, OverflowError):
                            epoch = datetime(1970, 1, 1)
                            if date_obj < epoch:
                                base_date = datetime(1900, 1, 1)
                                days_since_1900 = (date_obj - base_date).days
                                timestamp = -(25567 - days_since_1900) * 86400
                            else:
                                timestamp = int((date_obj - epoch).total_seconds())
                    except ValueError:
                        try:
                            date_obj = datetime.strptime(str(date_str), "%Y-%m-%d %H:%M:%S")
                            try:
                                timestamp = int(date_obj.timestamp())
                            except (OSError, OverflowError):
                                epoch = datetime(1970, 1, 1)
                                timestamp = int((date_obj - epoch).total_seconds())
                        except ValueError:
                            logger.warning(f"Could not parse date '{date_str}' in document: {doc.get('_id', 'unknown')}")
                            continue
                
                # Handle value field with better error checking
                value_raw = doc.get("value")
                if value_raw is None:
                    logger.warning(f"Missing value field in document: {doc.get('_id', 'unknown')}")
                    continue
                
                try:
                    value = float(value_raw)
                except (ValueError, TypeError):
                    logger.warning(f"Could not convert value '{value_raw}' to float in document: {doc.get('_id', 'unknown')}")
                    continue
                
                if value is not None:
                    values.append(value)
                
                result.append(EconomicDataPoint(
                    time=timestamp,
                    date=date_obj.strftime("%Y-%m-%d"),
                    rate=value,
                    value=value
                ))
            except Exception as e:
                logger.warning(f"Error parsing MongoDB document for {indicator_name}: {e}")
                logger.warning(f"Document content: {doc}")
                continue
        
        # Calculate metadata
        latest_value = values[-1] if values else None
        latest_date = result[-1].date if result else None
        
        metadata = self._build_metadata(
            indicator_id=SERIES_CONTRACTS.get(fred_series or "", {}).get(
                "indicator_id", indicator_name
            ),
            owner_group="monetary_liquidity",
            latest_value=latest_value,
            latest_date=latest_date,
            total_records=len(result),
            description=description,
            unit=unit,
            frequency=frequency,
            source=source,
            source_series_id=fred_series,
        )
        
        return DataResponse(data=result, metadata=metadata)

    def get_macro_economics_data(
        self,
        indicator_name: str,
        limit: Optional[int] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        description: str = "",
        unit: str = "",
        frequency: str = "",
        source: str = "",
        fred_series: Optional[str] = None
    ) -> DataResponse:
        """Get macro economics data from the unified macro_economics collection."""
        if not self.mongodb:
            raise RuntimeError("MongoDB connection not available")
        
        collection = self.mongodb.get_collection("macro_economics")
        
        # Build query filter
        query_filter = {"indicator": indicator_name}
        if start_date or end_date:
            date_filter = {}
            if start_date:
                date_filter["$gte"] = start_date
            if end_date:
                date_filter["$lte"] = end_date
            query_filter["date"] = date_filter
        
        # Get data from MongoDB
        cursor = collection.find(query_filter).sort("date", 1)
        if limit:
            cursor = cursor.limit(limit)
        
        result = []
        values = []
        
        for doc in cursor:
            try:
                # Handle different date formats and edge cases
                date_str = doc.get("date", "")
                if not date_str:
                    logger.warning(f"Empty date field in document: {doc.get('_id', 'unknown')}")
                    continue
                
                # Convert date string to timestamp with better error handling
                try:
                    # Try standard YYYY-MM-DD format first
                    if isinstance(date_str, str):
                        date_obj = datetime.strptime(date_str, "%Y-%m-%d")
                    else:
                        # If it's already a datetime object
                        date_obj = date_str
                    
                    # Handle dates before 1970 (Unix epoch) which cause issues on Windows
                    try:
                        timestamp = int(date_obj.timestamp())
                    except (OSError, OverflowError):
                        # For dates before 1970, use a different approach
                        epoch = datetime(1970, 1, 1)
                        if date_obj < epoch:
                            # Use days since 1900 for very old dates
                            base_date = datetime(1900, 1, 1)
                            days_since_1900 = (date_obj - base_date).days
                            timestamp = -(25567 - days_since_1900) * 86400  # Excel-style negative timestamp
                        else:
                            timestamp = int((date_obj - epoch).total_seconds())
                        
                except ValueError:
                    # Try alternative date formats
                    try:
                        date_obj = datetime.strptime(str(date_str), "%m/%d/%Y")
                        try:
                            timestamp = int(date_obj.timestamp())
                        except (OSError, OverflowError):
                            epoch = datetime(1970, 1, 1)
                            if date_obj < epoch:
                                base_date = datetime(1900, 1, 1)
                                days_since_1900 = (date_obj - base_date).days
                                timestamp = -(25567 - days_since_1900) * 86400
                            else:
                                timestamp = int((date_obj - epoch).total_seconds())
                    except ValueError:
                        try:
                            date_obj = datetime.strptime(str(date_str), "%Y-%m-%d %H:%M:%S")
                            try:
                                timestamp = int(date_obj.timestamp())
                            except (OSError, OverflowError):
                                epoch = datetime(1970, 1, 1)
                                timestamp = int((date_obj - epoch).total_seconds())
                        except ValueError:
                            logger.warning(f"Could not parse date '{date_str}' in document: {doc.get('_id', 'unknown')}")
                            continue
                
                # Handle value field with better error checking
                value_raw = doc.get("value")
                if value_raw is None:
                    logger.warning(f"Missing value field in document: {doc.get('_id', 'unknown')}")
                    continue
                
                try:
                    value = float(value_raw)
                except (ValueError, TypeError):
                    logger.warning(f"Could not convert value '{value_raw}' to float in document: {doc.get('_id', 'unknown')}")
                    continue
                
                if value is not None:
                    values.append(value)
                
                result.append(EconomicDataPoint(
                    time=timestamp,
                    date=date_obj.strftime("%Y-%m-%d"),
                    rate=value,
                    value=value
                ))
            except Exception as e:
                logger.warning(f"Error parsing macro economics document for {indicator_name}: {e}")
                logger.warning(f"Document content: {doc}")
                continue
        
        # Calculate metadata
        latest_value = values[-1] if values else None
        latest_date = result[-1].date if result else None
        
        metadata = self._build_metadata(
            indicator_id=SERIES_CONTRACTS.get(fred_series or "", {}).get(
                "indicator_id", indicator_name
            ),
            owner_group="growth_inflation_labor",
            latest_value=latest_value,
            latest_date=latest_date,
            total_records=len(result),
            description=description,
            unit=unit,
            frequency=frequency,
            source=source,
            source_series_id=fred_series,
        )
        
        return DataResponse(data=result, metadata=metadata)

    def get_macro_gdp_growth_rate_data(
        self,
        limit: Optional[int] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> DataResponse:
        """Return annualized quarter-over-quarter growth from GDPC1 levels.

        The checked-in GDP.csv file is nominal GDP (series GDP), so it is not
        used as a fallback for this real-GDP endpoint.
        """
        if not self.mongodb:
            return self._unavailable_response(
                indicator_id="real_gdp_growth",
                owner_group="growth_inflation_labor",
                description="Real GDP annualized quarter-over-quarter growth",
                unit="percent_annualized",
                frequency="quarterly",
                source="U.S. Bureau of Economic Analysis via FRED",
                source_series_id="GDPC1",
                quality_status="unavailable",
                quality_reason="verified_gdpc1_level_series_not_available_locally",
                transformation="annualized_quarter_over_quarter_percent_change",
                seasonal_adjustment="seasonally_adjusted_annual_rate",
                population="United States economy",
            )

        try:
            raw = self.get_macro_economics_data(
                indicator_name="gdp_growth_rate",
                limit=None,
                start_date=None,
                end_date=end_date,
                description="Real Gross Domestic Product",
                unit="billions_of_chained_dollars",
                frequency="quarterly",
                source="U.S. Bureau of Economic Analysis via FRED",
                fred_series="GDPC1",
            )
            growth_points = []
            previous = None
            previous_quarter = None
            for point in raw.data:
                current = point.value
                parsed = datetime.strptime(point.date[:10], "%Y-%m-%d")
                current_quarter = parsed.year * 4 + ((parsed.month - 1) // 3)
                if (
                    current is not None
                    and previous is not None
                    and current > 0
                    and previous > 0
                    and previous_quarter is not None
                    and current_quarter - previous_quarter == 1
                ):
                    growth = ((current / previous) ** 4 - 1) * 100
                    growth_points.append(EconomicDataPoint(
                        time=point.time, date=point.date, value=growth, rate=growth
                    ))
                if current is not None and current > 0:
                    previous = current
                    previous_quarter = current_quarter

            growth_points = self._filter_transformed_points(
                growth_points, limit, start_date, end_date
            )
            latest_value = growth_points[-1].value if growth_points else None
            latest_date = growth_points[-1].date if growth_points else None
            return DataResponse(
                data=growth_points,
                metadata=self._build_metadata(
                    indicator_id="real_gdp_growth",
                    owner_group="growth_inflation_labor",
                    latest_value=latest_value,
                    latest_date=latest_date,
                    total_records=len(growth_points),
                    description="Real GDP annualized quarter-over-quarter growth calculated from GDPC1 levels",
                    unit="percent_annualized",
                    frequency="quarterly",
                    source="U.S. Bureau of Economic Analysis via FRED",
                    source_series_id="GDPC1",
                    population="United States economy",
                    seasonal_adjustment="seasonally_adjusted_annual_rate",
                    transformation="annualized_quarter_over_quarter_percent_change",
                    quality_reason=None if growth_points else "insufficient_verified_history",
                ),
            )
        except Exception as e:
            logger.warning(f"Verified GDPC1 data unavailable: {e}")
            return self._unavailable_response(
                indicator_id="real_gdp_growth",
                owner_group="growth_inflation_labor",
                description="Real GDP annualized quarter-over-quarter growth",
                unit="percent_annualized",
                frequency="quarterly",
                source="U.S. Bureau of Economic Analysis via FRED",
                source_series_id="GDPC1",
                quality_status="unavailable",
                quality_reason="verified_gdpc1_level_series_not_available",
                transformation="annualized_quarter_over_quarter_percent_change",
                seasonal_adjustment="seasonally_adjusted_annual_rate",
                population="United States economy",
            )

    def get_macro_unemployment_rate_data(
        self,
        limit: Optional[int] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> DataResponse:
        """Get Unemployment Rate data from MongoDB or fallback to CSV."""
        # Try MongoDB first
        if self.mongodb:
            try:
                response = self.get_macro_economics_data(
                    indicator_name="unemployment_rate",
                    limit=limit,
                    start_date=start_date,
                    end_date=end_date,
                    description="Unemployment Rate",
                    unit="percent",
                    frequency="monthly",
                    source="U.S. Bureau of Labor Statistics",
                    fred_series="UNRATE"
                )
                if response.data:
                    return response
            except Exception as e:
                logger.warning(f"MongoDB failed for unemployment_rate: {e}. Falling back to CSV.")
        
        # Fallback to CSV
        return self.get_economic_data(
            filename="UNRATE.csv",
            date_column="DATE",
            value_column="UNRATE",
            limit=limit,
            start_date=start_date,
            end_date=end_date,
            description="Unemployment Rate",
            unit="percent",
            frequency="monthly",
            source="U.S. Bureau of Labor Statistics",
            fred_series="UNRATE"
        )

    def get_macro_nonfarm_payrolls_data(
        self,
        limit: Optional[int] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> DataResponse:
        """Get Nonfarm Payrolls data from MongoDB or fallback to CSV."""
        # Try MongoDB first
        if self.mongodb:
            try:
                response = self.get_macro_economics_data(
                    indicator_name="nonfarm_payrolls",
                    limit=limit,
                    start_date=start_date,
                    end_date=end_date,
                    description="All Employees, Total Nonfarm",
                    unit="thousands_of_persons",
                    frequency="monthly",
                    source="U.S. Bureau of Labor Statistics",
                    fred_series="PAYEMS"
                )
                if response.data:
                    return response
            except Exception as e:
                logger.warning(f"MongoDB failed for nonfarm_payrolls: {e}. Falling back to CSV.")
        
        # Fallback to CSV
        return self.get_economic_data(
            filename="PAYEMS.csv",
            date_column="observation_date",
            value_column="PAYEMS",
            limit=limit,
            start_date=start_date,
            end_date=end_date,
            description="Non-farm Payrolls",
            unit="Thousands of Persons",
            frequency="monthly",
            source="U.S. Bureau of Labor Statistics via FRED®",
            fred_series="PAYEMS"
        )

    def get_macro_consumer_confidence_data(
        self,
        limit: Optional[int] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> DataResponse:
        """Get Consumer Confidence data from MongoDB or fallback to CSV."""
        # Try MongoDB first
        if self.mongodb:
            try:
                response = self.get_macro_economics_data(
                    indicator_name="consumer_confidence",
                    limit=limit,
                    start_date=start_date,
                    end_date=end_date,
                    description="University of Michigan: Consumer Sentiment",
                    unit="index_1966_q1_100",
                    frequency="monthly",
                    source="University of Michigan",
                    fred_series="UMCSENT"
                )
                if response.data:
                    return response
            except Exception as e:
                logger.warning(f"MongoDB failed for consumer_confidence: {e}. Falling back to CSV.")
        
        # Fallback to CSV
        return self.get_economic_data(
            filename="CSCICP03USM665S.csv",
            date_column="observation_date",
            value_column="CSCICP03USM665S",
            limit=limit,
            start_date=start_date,
            end_date=end_date,
            description="OECD Main Economic Indicators: Consumer Confidence Index for the United States",
            unit="index_long_term_average_100",
            frequency="monthly",
            source="Organization for Economic Co-operation and Development via FRED®",
            fred_series="CSCICP03USM665S"
        )

    def get_macro_cpi_inflation_data(
        self,
        limit: Optional[int] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> DataResponse:
        """Return 12-month CPI inflation calculated from CPIAUCSL levels."""
        raw = None
        if self.mongodb:
            try:
                raw = self.get_macro_economics_data(
                    indicator_name="cpi_inflation",
                    limit=None,
                    start_date=None,
                    end_date=end_date,
                    description="Consumer Price Index for All Urban Consumers: All Items",
                    unit="index_1982_84_100",
                    frequency="monthly",
                    source="U.S. Bureau of Labor Statistics via FRED",
                    fred_series="CPIAUCSL",
                )
                if not raw.data:
                    raw = None
            except Exception as e:
                logger.warning(f"MongoDB failed for CPIAUCSL: {e}. Falling back to CSV.")

        if raw is None:
            raw = self.get_economic_data(
                filename="CPI.csv",
                date_column="observation_date",
                value_column="CPIAUCSL",
                limit=None,
                start_date=None,
                end_date=end_date,
                description="Consumer Price Index for All Urban Consumers: All Items",
                unit="index_1982_84_100",
                frequency="monthly",
                source="U.S. Bureau of Labor Statistics via FRED",
                fred_series="CPIAUCSL",
            )

        levels = [point for point in raw.data if point.value is not None and point.value > 0]
        levels_by_month = {
            (parsed.year, parsed.month): point
            for point in levels
            for parsed in [datetime.strptime(point.date[:10], "%Y-%m-%d")]
        }
        inflation_points = []
        for current in levels:
            parsed = datetime.strptime(current.date[:10], "%Y-%m-%d")
            year_ago = levels_by_month.get((parsed.year - 1, parsed.month))
            if year_ago is None:
                continue
            inflation = ((current.value / year_ago.value) - 1) * 100
            inflation_points.append(EconomicDataPoint(
                time=current.time, date=current.date, value=inflation, rate=inflation
            ))

        inflation_points = self._filter_transformed_points(
            inflation_points, limit, start_date, end_date
        )
        latest_value = inflation_points[-1].value if inflation_points else None
        latest_date = inflation_points[-1].date if inflation_points else None
        return DataResponse(
            data=inflation_points,
            metadata=self._build_metadata(
                indicator_id="cpi_inflation_yoy",
                owner_group="growth_inflation_labor",
                latest_value=latest_value,
                latest_date=latest_date,
                total_records=len(inflation_points),
                description="12-month percent change in CPIAUCSL",
                unit="percent_change_from_year_ago",
                frequency="monthly",
                source="U.S. Bureau of Labor Statistics via FRED",
                source_series_id="CPIAUCSL",
                population="All Urban Consumers, U.S. city average, all items",
                seasonal_adjustment="seasonally_adjusted",
                transformation="year_over_year_percent_change_from_index_level",
                quality_reason=None if inflation_points else "insufficient_12_month_history",
            ),
        )

    def get_macro_retail_sales_data(
        self,
        limit: Optional[int] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> DataResponse:
        """Get Retail Sales data from MongoDB or fallback to CSV."""
        # Try MongoDB first
        if self.mongodb:
            try:
                response = self.get_macro_economics_data(
                    indicator_name="retail_sales",
                    limit=limit,
                    start_date=start_date,
                    end_date=end_date,
                    description="Advance Retail Sales: Retail Trade and Food Services",
                    unit="millions_of_dollars",
                    frequency="monthly",
                    source="U.S. Census Bureau",
                    fred_series="RSXFS"
                )
                if response.data:
                    return response
            except Exception as e:
                logger.warning(f"MongoDB failed for retail_sales: {e}. Falling back to CSV.")
        
        # Fallback to CSV
        return self.get_economic_data(
            filename="RSXFS.csv",  # Need to add this CSV file if fallback is needed
            date_column="observation_date",
            value_column="RSXFS",
            limit=limit,
            start_date=start_date,
            end_date=end_date,
            description="Advance Retail Sales: Retail Trade and Food Services",
            unit="millions_of_dollars",
            frequency="monthly",
            source="U.S. Census Bureau via FRED®",
            fred_series="RSXFS"
        )

    # Corporate Earnings Data Methods
    def get_corporate_earnings_data(
        self,
        indicator_name: str,
        limit: Optional[int] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        description: str = "",
        unit: str = "",
        frequency: str = "",
        source: str = "",
        symbol: str = ""
    ) -> DataResponse:
        """Get corporate earnings data from MongoDB."""
        if not self.mongodb:
            raise Exception("MongoDB not available for corporate earnings data")
        
        try:
            # Resolve the collection through MongoDBService so its lazy
            # connection is established before the first query.
            collection = self.mongodb.get_collection("corporate_earnings")

            # Query corporate_earnings collection
            query = {"indicator": indicator_name}
            
            # Add date filtering if provided
            if start_date or end_date:
                date_filter = {}
                if start_date:
                    date_filter["$gte"] = start_date
                if end_date:
                    date_filter["$lte"] = end_date
                query["date"] = date_filter
            
            # Get data from MongoDB
            cursor = collection.find(query).sort("date", 1)
            
            if limit:
                cursor = cursor.limit(limit)
            
            documents = list(cursor)
            
            if not documents:
                logger.warning(f"No corporate earnings data found for indicator: {indicator_name}")
                return DataResponse(
                    data=[],
                    metadata=self._build_metadata(
                        indicator_id=indicator_name,
                        owner_group="corporate_fundamentals",
                        latest_value=None,
                        latest_date=None,
                        total_records=0,
                        description=description,
                        unit=unit,
                        frequency=frequency,
                        source="Corporate Earnings Database",
                        source_series_id=symbol,
                        population="S&P 500 companies available to the ingestion job",
                        seasonal_adjustment="not_applicable",
                        transformation="cross_sectional_aggregate_from_reported_company_metrics",
                    )
                )
            
            # Convert to EconomicDataPoint objects
            data_points = []
            for doc in documents:
                timestamp = int(datetime.fromisoformat(doc["date"]).timestamp())
                data_points.append(EconomicDataPoint(
                    time=timestamp,
                    date=doc["date"],
                    value=float(doc["value"]),
                    rate=float(doc["value"])  # For compatibility
                ))
            
            # Extract metadata from latest document
            latest_doc = documents[-1]
            doc_metadata = latest_doc.get("metadata", {})
            
            # Create response metadata using simpler DataMetadata
            source_series_id = doc_metadata.get("symbol", symbol)
            metadata = self._build_metadata(
                indicator_id=indicator_name,
                owner_group="corporate_fundamentals",
                latest_value=data_points[-1].value if data_points else None,
                latest_date=data_points[-1].date if data_points else None,
                total_records=len(data_points),
                description=description,
                unit=doc_metadata.get("unit", unit),
                frequency=doc_metadata.get("frequency", frequency),
                source=f"Corporate Earnings Database - {source}",
                source_series_id=source_series_id,
                population="S&P 500 companies available to the ingestion job",
                seasonal_adjustment="not_applicable",
                transformation="cross_sectional_aggregate_from_reported_company_metrics",
            )
            
            return DataResponse(data=data_points, metadata=metadata)
            
        except Exception as e:
            logger.error(f"Error fetching corporate earnings data for {indicator_name}: {e}")
            raise

    def get_sp500_eps_data(
        self,
        limit: Optional[int] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> DataResponse:
        """Return an explicit invalid state until a verified EPS series is connected.

        SPASTT01USQ661N is a stock-price index and is not an EPS series.
        """
        return self._unavailable_response(
            indicator_id="sp500_eps",
            owner_group="corporate_fundamentals",
            description="S&P 500 Earnings Per Share",
            unit="USD",
            frequency="quarterly",
            source="Not connected",
            source_series_id=None,
            quality_status="invalid",
            quality_reason="previous_source_was_stock_price_index_not_eps",
            transformation="level",
            population="S&P 500 constituent companies",
        )

    def get_revenue_growth_data(
        self,
        limit: Optional[int] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> DataResponse:
        """Get Revenue Growth data from major S&P 500 companies."""
        return self.get_corporate_earnings_data(
            indicator_name="revenue_growth",
            limit=limit,
            start_date=start_date,
            end_date=end_date,
            description="Average revenue growth from major S&P 500 companies",
            unit="Percent",
            frequency="quarterly",
            source="Yahoo Finance (Aggregated)",
            symbol="Multiple"
        )

    def get_profit_margins_data(
        self,
        limit: Optional[int] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> DataResponse:
        """Get Profit Margins data from major S&P 500 companies."""
        return self.get_corporate_earnings_data(
            indicator_name="profit_margins",
            limit=limit,
            start_date=start_date,
            end_date=end_date,
            description="Average profit margins from major S&P 500 companies",
            unit="Percent",
            frequency="quarterly",
            source="Yahoo Finance (Aggregated)",
            symbol="Multiple"
        )

    def get_pe_ratio_data(
        self,
        limit: Optional[int] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> DataResponse:
        """Get P/E Ratio data for S&P 500."""
        return self.get_corporate_earnings_data(
            indicator_name="pe_ratio",
            limit=limit,
            start_date=start_date,
            end_date=end_date,
            description="S&P 500 Price-to-Earnings ratio (calculated from price and EPS data)",
            unit="Ratio",
            frequency="monthly",
            source="Yahoo Finance (Calculated)",
            symbol="^GSPC"
        )

    def get_dividend_yield_data(
        self,
        limit: Optional[int] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> DataResponse:
        """Get Dividend Yield data for S&P 500."""
        return self.get_corporate_earnings_data(
            indicator_name="dividend_yield",
            limit=limit,
            start_date=start_date,
            end_date=end_date,
            description="S&P 500 dividend yield via SPY ETF",
            unit="Percent",
            frequency="monthly",
            source="Yahoo Finance",
            symbol="SPY"
        )

    def get_return_on_assets_data(
        self,
        limit: Optional[int] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> DataResponse:
        """Get Return on Assets data from major S&P 500 companies."""
        return self.get_corporate_earnings_data(
            indicator_name="return_on_assets",
            limit=limit,
            start_date=start_date,
            end_date=end_date,
            description="Average return on assets from major S&P 500 companies",
            unit="Percent",
            frequency="quarterly",
            source="Yahoo Finance (Aggregated)",
            symbol="Multiple"
        )

    # Valuation Data Methods
    def get_valuation_data(
        self,
        indicator_name: str,
        limit: Optional[int] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        description: str = "",
        unit: str = "",
        frequency: str = "",
        source: str = "",
        symbol: str = ""
    ) -> DataResponse:
        """Get valuation data from MongoDB."""
        if not self.mongodb:
            raise Exception("MongoDB not available for valuation data")
        
        try:
            # MongoDBService connects lazily, so always resolve collections
            # through its accessor instead of reading the uninitialized db.
            collection = self.mongodb.get_collection("valuation")

            # Query valuation_metrics collection
            query = {"indicator": indicator_name}
            
            # Add date filtering if provided
            if start_date or end_date:
                date_filter = {}
                if start_date:
                    date_filter["$gte"] = start_date
                if end_date:
                    date_filter["$lte"] = end_date
                query["date"] = date_filter
            
            # Get data from MongoDB
            cursor = collection.find(query).sort("date", 1)
            
            if limit:
                cursor = cursor.limit(limit)
            
            documents = list(cursor)
            
            if not documents:
                logger.warning(f"No valuation data found for indicator: {indicator_name}")
                return DataResponse(
                    data=[],
                    metadata=self._build_metadata(
                        indicator_id=indicator_name,
                        owner_group="valuation",
                        latest_value=None,
                        latest_date=None,
                        total_records=0,
                        description=description,
                        unit=unit,
                        frequency=frequency,
                        source="Valuation Metrics Database",
                        source_series_id=symbol,
                        population="S&P 500 companies available to the ingestion job",
                        seasonal_adjustment="not_applicable",
                        transformation="cross_sectional_aggregate_from_company_valuation_metrics",
                    )
                )
            
            # Convert to EconomicDataPoint objects
            data_points = []
            for doc in documents:
                timestamp = int(datetime.fromisoformat(doc["date"]).timestamp())
                data_points.append(EconomicDataPoint(
                    time=timestamp,
                    date=doc["date"],
                    value=float(doc["value"]),
                    rate=float(doc["value"])  # For compatibility
                ))
            
            # Create response metadata using simpler DataMetadata
            latest_doc_metadata = documents[-1].get("metadata", {})
            metadata = self._build_metadata(
                indicator_id=indicator_name,
                owner_group="valuation",
                latest_value=data_points[-1].value if data_points else None,
                latest_date=data_points[-1].date if data_points else None,
                total_records=len(data_points),
                description=description,
                unit=latest_doc_metadata.get("unit", unit),
                frequency=latest_doc_metadata.get("frequency", frequency),
                source=f"Valuation Metrics Database - {source}",
                source_series_id=latest_doc_metadata.get("symbol", symbol),
                population="S&P 500 companies available to the ingestion job",
                seasonal_adjustment="not_applicable",
                transformation="cross_sectional_aggregate_from_company_valuation_metrics",
            )
            
            return DataResponse(data=data_points, metadata=metadata)
            
        except Exception as e:
            logger.error(f"Error fetching valuation data for {indicator_name}: {e}")
            raise

    def get_valuation_pe_ratio_data(
        self, 
        limit: Optional[int] = None, 
        start_date: Optional[str] = None, 
        end_date: Optional[str] = None
    ) -> DataResponse:
        """Get P/E Ratio data for S&P 500 from valuation metrics."""
        return self.get_valuation_data(
            indicator_name="pe_ratio",
            limit=limit,
            start_date=start_date,
            end_date=end_date,
            description="S&P 500 Price-to-Earnings ratio",
            unit="ratio",
            frequency="monthly",
            source="Yahoo Finance",
            symbol="^GSPC"
        )

    def get_forward_pe_data(
        self, 
        limit: Optional[int] = None, 
        start_date: Optional[str] = None, 
        end_date: Optional[str] = None
    ) -> DataResponse:
        """Get Forward P/E Ratio data from major S&P 500 companies."""
        return self.get_valuation_data(
            indicator_name="forward_pe",
            limit=limit,
            start_date=start_date,
            end_date=end_date,
            description="Forward Price-to-Earnings ratio from major S&P 500 companies",
            unit="ratio",
            frequency="daily",
            source="Yahoo Finance (Aggregated)",
            symbol="Multiple"
        )

    def get_price_to_book_data(
        self, 
        limit: Optional[int] = None, 
        start_date: Optional[str] = None, 
        end_date: Optional[str] = None
    ) -> DataResponse:
        """Get Price-to-Book ratio data."""
        return self.get_valuation_data(
            indicator_name="price_to_book",
            limit=limit,
            start_date=start_date,
            end_date=end_date,
            description="Price-to-Book value ratio for S&P 500 companies",
            unit="ratio",
            frequency="daily",
            source="Yahoo Finance",
            symbol="Multiple"
        )

    def get_price_to_sales_data(
        self, 
        limit: Optional[int] = None, 
        start_date: Optional[str] = None, 
        end_date: Optional[str] = None
    ) -> DataResponse:
        """Get Price-to-Sales ratio data."""
        return self.get_valuation_data(
            indicator_name="price_to_sales",
            limit=limit,
            start_date=start_date,
            end_date=end_date,
            description="Price-to-Sales ratio from major S&P 500 companies",
            unit="ratio",
            frequency="daily",
            source="Yahoo Finance (Aggregated)",
            symbol="Multiple"
        )

    def get_peg_ratio_data(
        self, 
        limit: Optional[int] = None, 
        start_date: Optional[str] = None, 
        end_date: Optional[str] = None
    ) -> DataResponse:
        """Get PEG Ratio data."""
        return self.get_valuation_data(
            indicator_name="peg_ratio",
            limit=limit,
            start_date=start_date,
            end_date=end_date,
            description="Price/Earnings to Growth ratio from major S&P 500 companies",
            unit="ratio",
            frequency="daily",
            source="Yahoo Finance",
            symbol="Multiple"
        )

    def get_valuation_dividend_yield_data(
        self, 
        limit: Optional[int] = None, 
        start_date: Optional[str] = None, 
        end_date: Optional[str] = None
    ) -> DataResponse:
        """Get Dividend Yield data from valuation metrics."""
        return self.get_valuation_data(
            indicator_name="dividend_yield",
            limit=limit,
            start_date=start_date,
            end_date=end_date,
            description="S&P 500 dividend yield via SPY ETF",
            unit="percent",
            frequency="monthly",
            source="Yahoo Finance",
            symbol="SPY"
        )

    # Sector Performance Data Methods
    def get_sector_performance_data(
        self,
        metric_name: str,
        sector_name: Optional[str] = None,
        limit: Optional[int] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        description: str = "",
        unit: str = "",
        frequency: str = "",
        source: str = ""
    ) -> DataResponse:
        """Get sector performance data from MongoDB."""
        if not self.mongodb:
            raise Exception("MongoDB not available for sector performance data")
        
        try:
            # Resolve the collection through MongoDBService so its lazy
            # connection is established before the first query.
            collection = self.mongodb.get_collection("sector_performance")

            # Query sector_performance collection
            query = {"metric": metric_name}
            
            # Add sector filtering if provided
            if sector_name:
                query["sector"] = sector_name
                
            # Add date filtering if provided
            if start_date or end_date:
                date_filter = {}
                if start_date:
                    date_filter["$gte"] = start_date
                if end_date:
                    date_filter["$lte"] = end_date
                query["date"] = date_filter
            
            # Get data from MongoDB
            cursor = collection.find(query).sort([("date", 1), ("sector", 1)])
            
            if limit and sector_name:
                # Only apply limit if sector is specified
                cursor = cursor.limit(limit)
            
            documents = list(cursor)
            
            if not documents:
                logger.warning(f"No sector performance data found for metric: {metric_name}")
                return DataResponse(
                    data=[],
                    metadata=self._build_metadata(
                        indicator_id=f"sector_{metric_name}",
                        owner_group="market_internals_sectors",
                        latest_value=None,
                        latest_date=None,
                        total_records=0,
                        description=description,
                        unit=unit,
                        frequency=frequency,
                        source="Sector Performance Database",
                        source_series_id=metric_name,
                        population="U.S. sector SPDR ETF proxies",
                        seasonal_adjustment="not_applicable",
                        transformation="source_price_or_relative_return_metric",
                    )
                )
            
            # Filter out NaN values and convert to appropriate format
            data_points = []
            for doc in documents:
                # Skip documents with NaN values
                if doc.get("value") is None or (isinstance(doc["value"], float) and doc["value"] != doc["value"]):  # NaN check
                    continue
                    
                timestamp = int(datetime.fromisoformat(doc["date"]).timestamp())
                # Use standard EconomicDataPoint, let API handle grouping
                data_points.append(EconomicDataPoint(
                    time=timestamp,
                    date=doc["date"],
                    value=float(doc["value"]),
                    rate=float(doc["value"])  # For compatibility
                ))
            
            # Create response metadata using simpler DataMetadata
            latest_doc_metadata = documents[-1].get("metadata", {}) if documents else {}
            metadata = self._build_metadata(
                indicator_id=f"sector_{metric_name}",
                owner_group="market_internals_sectors",
                latest_value=data_points[-1].value if data_points else None,
                latest_date=data_points[-1].date if data_points else None,
                total_records=len(data_points),
                description=description,
                unit=latest_doc_metadata.get("unit", unit),
                frequency=latest_doc_metadata.get("frequency", frequency),
                source=f"Sector Performance Database - {source}",
                source_series_id=latest_doc_metadata.get("etf_symbol", metric_name),
                population="U.S. sector SPDR ETF proxies",
                seasonal_adjustment="not_applicable",
                transformation="source_price_or_relative_return_metric",
            )
            
            return DataResponse(data=data_points, metadata=metadata)
            
        except Exception as e:
            logger.error(f"Error fetching sector performance data for {metric_name}: {e}")
            raise

    def get_sector_price_performance_data(
        self,
        sector_name: Optional[str] = None,
        limit: Optional[int] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> DataResponse:
        """Get sector price performance data."""
        return self.get_sector_performance_data(
            metric_name="price_performance",
            sector_name=sector_name,
            limit=limit,
            start_date=start_date,
            end_date=end_date,
            description="Sector price performance from SPDR ETFs",
            unit="index_value",
            frequency="daily",
            source="Yahoo Finance"
        )

    def get_sector_relative_performance_data(
        self,
        sector_name: Optional[str] = None,
        limit: Optional[int] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> DataResponse:
        """Get sector relative performance vs SPY data."""
        return self.get_sector_performance_data(
            metric_name="relative_performance",
            sector_name=sector_name,
            limit=limit,
            start_date=start_date,
            end_date=end_date,
            description="Sector performance relative to S&P 500 (SPY)",
            unit="percent",
            frequency="daily",
            source="Yahoo Finance"
        )

    def get_all_sectors_latest_data(self, metric_name: str) -> dict:
        """Get latest data for all sectors for a specific metric."""
        if not self.mongodb:
            raise Exception("MongoDB not available for sector performance data")
        
        try:
            collection = self.mongodb.get_collection("sector_performance")

            # Get the latest date
            latest_date_doc = collection.find_one(
                {"metric": metric_name},
                sort=[("date", -1)]
            )
            
            if not latest_date_doc:
                return {}
            
            latest_date = latest_date_doc["date"]
            
            # Get all sectors for the latest date
            cursor = collection.find({
                "metric": metric_name,
                "date": latest_date
            })
            
            result = {}
            for doc in cursor:
                result[doc["sector"]] = {
                    "value": float(doc["value"]),
                    "date": doc["date"],
                    "etf_symbol": doc.get("metadata", {}).get("etf_symbol", "")
                }
            
            return result
            
        except Exception as e:
            logger.error(f"Error fetching all sectors latest data for {metric_name}: {e}")
            return {}

    def get_sector_performance_grouped_data(
        self,
        metric_name: str,
        limit: Optional[int] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> dict:
        """Get sector performance data grouped by sector."""
        if not self.mongodb:
            raise Exception("MongoDB not available for sector performance data")
        
        try:
            collection = self.mongodb.get_collection("sector_performance")

            # Query sector_performance collection
            query = {"metric": metric_name}
                
            # Add date filtering if provided
            if start_date or end_date:
                date_filter = {}
                if start_date:
                    date_filter["$gte"] = start_date
                if end_date:
                    date_filter["$lte"] = end_date
                query["date"] = date_filter
            
            # Get data from MongoDB
            cursor = collection.find(query).sort([("date", 1), ("sector", 1)])
            
            documents = list(cursor)
            
            if not documents:
                return {}
            
            # Group data by sector
            sector_data = {}
            for doc in documents:
                # Skip documents with NaN values
                if doc.get("value") is None or (isinstance(doc["value"], float) and doc["value"] != doc["value"]):
                    continue
                
                sector = doc["sector"]
                if sector not in sector_data:
                    sector_data[sector] = []
                
                timestamp = int(datetime.fromisoformat(doc["date"]).timestamp())
                sector_data[sector].append({
                    "time": timestamp,
                    "date": doc["date"],
                    "value": float(doc["value"]),
                    "rate": float(doc["value"])  # For compatibility
                })
            
            # Apply limit to each sector
            if limit:
                for sector in sector_data:
                    sector_data[sector] = sector_data[sector][-limit:]
            
            return sector_data
            
        except Exception as e:
            logger.error(f"Error fetching grouped sector performance data for {metric_name}: {e}")
            return {}
