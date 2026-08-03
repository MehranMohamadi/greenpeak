"""Data models and schemas."""

from datetime import datetime, date
from typing import Optional, List, Dict, Union, Any
from pydantic import BaseModel, Field
from enum import Enum


class ImpactLevel(str, Enum):
    """Impact level for indicators."""

    HIGH = "High"
    MEDIUM = "Medium"
    LOW = "Low"


class DataFrequency(str, Enum):
    """Data frequency types."""

    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    ANNUALLY = "annually"


class IndicatorStatus(str, Enum):
    """Indicator status."""

    CURRENT = "current"
    OVERDUE = "overdue"
    UPCOMING = "upcoming"


class DataType(str, Enum):
    """Types of data that indicators can have."""

    SINGLE_VALUE = "single_value"
    TIME_SERIES = "time_series"
    OHLC = "ohlc"
    MULTIPLE_SERIES = "multiple_series"


class NewsArticle(BaseModel):
    """Model for news articles."""

    title: str = Field(..., description="Title of the news article")
    content: str = Field(..., description="Content of the news article")
    source: str = Field(..., description="Source of the news article")
    image: str = Field(..., description="Image URL of the news article")
    published_date: datetime = Field(
        ..., description="Publication date of the news article"
    )


class CalendarEvent(BaseModel):
    """Model for calendar events."""

    event_date: date = Field(..., description="Date of the calendar event")
    title: str = Field(..., description="Title of the calendar event")
    description: str = Field(..., description="Description of the calendar event")
    currency: str = Field(..., description="Currency of the calendar event")
    impact: ImpactLevel = Field(..., description="Impact level of the calendar event")
    actual: Optional[float] = Field(
        None, description="Actual value of the calendar event"
    )
    forecast: Optional[float] = Field(
        None, description="Forecast value of the calendar event"
    )
    previous: Optional[float] = Field(
        None, description="Previous value of the calendar event"
    )


class HealthCheckResponse(BaseModel):
    """Health check response model."""

    status: str = Field(..., description="Service status")
    message: str = Field(..., description="Status message")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    version: str = Field(..., description="API version")


class TimeSeriesDataPoint(BaseModel):
    """Basic time series data point."""

    time: int = Field(..., description="Unix timestamp")
    date: str = Field(..., description="Date in YYYY-MM-DD format")
    value: Optional[float] = Field(None, description="Data value")


class OHLCDataPoint(BaseModel):
    """OHLC (Open, High, Low, Close) data point for financial instruments."""

    time: int = Field(..., description="Unix timestamp")
    date: str = Field(..., description="Date in YYYY-MM-DD format")
    open: float = Field(..., description="Opening price")
    high: float = Field(..., description="Highest price")
    low: float = Field(..., description="Lowest price")
    close: float = Field(..., description="Closing price")
    volume: Optional[float] = Field(None, description="Trading volume")


class EconomicDataPoint(BaseModel):
    """Economic indicator data point."""

    time: int = Field(..., description="Unix timestamp")
    date: str = Field(..., description="Date in YYYY-MM-DD format")
    value: Optional[float] = Field(None, description="Indicator value")
    rate: Optional[float] = Field(None, description="Rate value (for compatibility)")


class SectorDataPoint(BaseModel):
    """Sector performance data point."""

    time: int = Field(..., description="Unix timestamp")
    date: str = Field(..., description="Date in YYYY-MM-DD format")
    value: Optional[float] = Field(None, description="Sector value")
    rate: Optional[float] = Field(None, description="Rate value (for compatibility)")
    sector: str = Field(..., description="Sector name")


class IndicatorMetadata(BaseModel):
    """Rich metadata for financial indicators."""

    # Core identification
    indicator_id: str = Field(..., description="Unique indicator identifier")
    name: str = Field(..., description="Display name")
    category: str = Field(..., description="Category (e.g., 'monetary_policy')")

    # Current status
    current_value: Optional[float] = Field(None, description="Current/latest value")
    change_1d: Optional[float] = Field(None, description="1-day change")
    change_percent_1d: Optional[float] = Field(
        None, description="1-day percentage change"
    )
    change_1w: Optional[float] = Field(None, description="1-week change")
    change_1m: Optional[float] = Field(None, description="1-month change")
    change_ytd: Optional[float] = Field(None, description="Year-to-date change")

    # Timing information
    last_updated: Optional[datetime] = Field(None, description="Last update timestamp")
    next_release: Optional[datetime] = Field(None, description="Next release date")
    status: IndicatorStatus = Field(
        IndicatorStatus.CURRENT, description="Current status"
    )

    # Classification
    impact: ImpactLevel = Field(ImpactLevel.MEDIUM, description="Market impact level")
    frequency: DataFrequency = Field(
        DataFrequency.DAILY, description="Update frequency"
    )
    data_type: DataType = Field(DataType.TIME_SERIES, description="Type of data")

    # Data source information
    source: str = Field("", description="Data source")
    fred_series: Optional[str] = Field(None, description="FRED series ID if applicable")
    description: str = Field("", description="Detailed description")
    unit: str = Field("", description="Unit of measurement")

    # Data availability
    earliest_date: Optional[str] = Field(
        None, description="Earliest available data date"
    )
    latest_date: Optional[str] = Field(None, description="Latest available data date")
    total_records: int = Field(0, description="Total number of records")

    # Display formatting
    display_format: str = Field(
        "{:.2f}", description="Python format string for display"
    )
    chart_color: Optional[str] = Field(None, description="Preferred chart color")


class IndicatorSummary(BaseModel):
    """Summary information for dashboard cards."""

    indicator_id: str
    name: str
    current_value: Optional[float]
    change_percent_1d: Optional[float]
    impact: ImpactLevel
    status: IndicatorStatus
    last_updated: Optional[datetime]
    next_release: Optional[datetime]
    unit: str
    chart_color: Optional[str] = None


class CategorySummary(BaseModel):
    """Summary for an entire category."""

    category_id: str = Field(..., description="Category identifier")
    category_name: str = Field(..., description="Category display name")
    indicators: List[IndicatorSummary] = Field(..., description="List of indicators")
    last_updated: Optional[datetime] = Field(
        None, description="Most recent update across all indicators"
    )


class TreasuryRatePoint(BaseModel):
    """Treasury rates data point with multiple maturities."""

    Date: int = Field(..., description="Unix timestamp")
    date: str = Field(..., description="Date in YYYY-MM-DD format")

    # Treasury maturities - using Optional to handle missing data
    three_month: Optional[float] = Field(None, alias="3Mo", description="3-month rate")
    six_month: Optional[float] = Field(None, alias="6Mo", description="6-month rate")
    one_year: Optional[float] = Field(None, alias="1Yr", description="1-year rate")
    two_year: Optional[float] = Field(None, alias="2Yr", description="2-year rate")
    three_year: Optional[float] = Field(None, alias="3Yr", description="3-year rate")
    five_year: Optional[float] = Field(None, alias="5Yr", description="5-year rate")
    seven_year: Optional[float] = Field(None, alias="7Yr", description="7-year rate")
    ten_year: Optional[float] = Field(None, alias="10Yr", description="10-year rate")
    twenty_year: Optional[float] = Field(None, alias="20Yr", description="20-year rate")
    thirty_year: Optional[float] = Field(None, alias="30Yr", description="30-year rate")

    model_config = {"populate_by_name": True}


class PerformanceDataPoint(BaseModel):
    """Performance data point with change calculations."""

    time: int = Field(..., description="Unix timestamp")
    date: str = Field(..., description="Date in YYYY-MM-DD format")
    value: float = Field(..., description="Performance value")
    change: Optional[float] = Field(None, description="Daily change")
    change_percent: Optional[float] = Field(None, description="Daily change percentage")


class DataMetadata(BaseModel):
    """Metadata for data series."""

    latest_value: Optional[float] = Field(None, description="Most recent value")
    latest_date: Optional[str] = Field(None, description="Date of most recent value")
    total_records: int = Field(0, description="Total number of records")
    description: str = Field("", description="Description of the data series")
    unit: str = Field("", description="Unit of measurement")
    frequency: str = Field("", description="Data frequency (daily, monthly, etc.)")
    source: str = Field("", description="Data source")
    fred_series: Optional[str] = Field(None, description="FRED series ID if applicable")


class DataResponse(BaseModel):
    """Standard response format for time series data."""

    data: List[
        Union[
            TimeSeriesDataPoint,
            OHLCDataPoint,
            EconomicDataPoint,
            SectorDataPoint,
            PerformanceDataPoint,
        ]
    ] = Field(..., description="Data points")
    metadata: Union[IndicatorMetadata, DataMetadata] = Field(
        ..., description="Indicator metadata"
    )


class BulkDataResponse(BaseModel):
    """Response for multiple indicators."""

    indicators: Dict[str, DataResponse] = Field(
        ..., description="Map of indicator_id to data response"
    )
    category_metadata: Optional[CategorySummary] = Field(
        None, description="Category summary"
    )


class ErrorResponse(BaseModel):
    """Error response format."""

    detail: str = Field(..., description="Error message")
    status_code: int = Field(..., description="HTTP status code")
    timestamp: datetime = Field(
        default_factory=datetime.utcnow, description="Error timestamp"
    )


class SessionStatus(BaseModel):
    """Forex session status."""

    name: str = Field(..., description="Session name")
    timezone: str = Field(..., description="Session timezone")
    description: str = Field(..., description="Session description")
    status: str = Field(..., description="Current status (open/closed)")
    local_open_time: str = Field(..., description="Local opening time")
    local_close_time: str = Field(..., description="Local closing time")
    utc_open_hour: int = Field(..., description="UTC opening hour")
    utc_close_hour: int = Field(..., description="UTC closing hour")
    overlapping_sessions: List[str] = Field(
        ..., description="Currently overlapping sessions"
    )
    is_weekend: bool = Field(..., description="Is it weekend")
    is_holiday: bool = Field(..., description="Is it a holiday")
    current_utc_hour: int = Field(..., description="Current UTC hour")
    current_utc_minute: int = Field(..., description="Current UTC minute")
    next_open_minutes: Optional[int] = Field(
        None, description="Minutes until next open"
    )
    next_close_minutes: Optional[int] = Field(
        None, description="Minutes until next close"
    )
    major_pairs: List[str] = Field(
        ..., description="Major currency pairs for this session"
    )


class MarketOverview(BaseModel):
    """Market overview information."""

    active_sessions_count: int = Field(..., description="Number of active sessions")
    active_sessions: List[str] = Field(..., description="List of active session names")
    is_weekend: bool = Field(..., description="Is it weekend")
    current_utc_time: str = Field(..., description="Current UTC time")
    current_local_times: Dict[str, Dict[str, str]] = Field(
        ..., description="Local times for each session"
    )
    market_status: str = Field(..., description="Overall market status")
    volume_score: int = Field(..., description="Market volume score")
    high_volume_periods: List[str] = Field(..., description="High volume periods")
    next_major_event: Optional[Dict[str, Any]] = Field(
        None, description="Next major market event"
    )


class SessionResponse(BaseModel):
    """Session calculation response."""

    sessions: List[SessionStatus] = Field(..., description="Session statuses")
    market_overview: MarketOverview = Field(..., description="Market overview")
