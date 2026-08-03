"""Sector Performance endpoints."""

from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Path
from ....models.schemas import DataResponse
from ....services.data_service import DataService

router = APIRouter(prefix="/sectors", tags=["Sector Performance"])
data_service = DataService()


@router.get("/price-performance", response_model=DataResponse)
async def get_sector_price_performance(
    sector: Optional[str] = Query(None, description="Sector name (e.g., technology, financials)"),
    limit: Optional[int] = Query(None, description="Limit number of records"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
):
    """Get sector price performance data from SPDR ETFs."""
    try:
        return data_service.get_sector_price_performance_data(
            sector_name=sector,
            limit=limit,
            start_date=start_date,
            end_date=end_date
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/relative-performance", response_model=DataResponse)
async def get_sector_relative_performance(
    sector: Optional[str] = Query(None, description="Sector name (e.g., technology, financials)"),
    limit: Optional[int] = Query(None, description="Limit number of records"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
):
    """Get sector performance relative to S&P 500 (SPY)."""
    try:
        return data_service.get_sector_relative_performance_data(
            sector_name=sector,
            limit=limit,
            start_date=start_date,
            end_date=end_date
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/momentum-scores", response_model=DataResponse)
async def get_sector_momentum_scores(
    sector: Optional[str] = Query(None, description="Sector name (e.g., technology, financials)"),
    limit: Optional[int] = Query(None, description="Limit number of records"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
):
    """Get sector momentum scores (0-100 scale)."""
    try:
        return data_service.get_sector_momentum_score_data(
            sector_name=sector,
            limit=limit,
            start_date=start_date,
            end_date=end_date
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/rotation-signals", response_model=DataResponse)
async def get_sector_rotation_signals(
    sector: Optional[str] = Query(None, description="Sector name (e.g., technology, financials)"),
    limit: Optional[int] = Query(None, description="Limit number of records"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
):
    """Get sector rotation signals (0-100 scale)."""
    try:
        return data_service.get_sector_rotation_signal_data(
            sector_name=sector,
            limit=limit,
            start_date=start_date,
            end_date=end_date
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/latest/{metric}")
async def get_all_sectors_latest(
    metric: str = Path(..., description="Metric name: price_performance, relative_performance, momentum_score, sector_rotation_signal"),
):
    """Get latest data for all sectors for a specific metric."""
    try:
        valid_metrics = ["price_performance", "relative_performance", "momentum_score", "sector_rotation_signal"]
        if metric not in valid_metrics:
            raise HTTPException(status_code=400, detail=f"Invalid metric. Must be one of: {valid_metrics}")
        
        data = data_service.get_all_sectors_latest_data(metric)
        return {
            "metric": metric,
            "sectors": data,
            "count": len(data)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


# Individual sector endpoints for convenience
@router.get("/technology/{metric}", response_model=DataResponse)
async def get_technology_sector_data(
    metric: str = Path(..., description="Metric name"),
    limit: Optional[int] = Query(None, description="Limit number of records"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
):
    """Get technology sector data for a specific metric."""
    try:
        return data_service.get_sector_performance_data(
            metric_name=metric,
            sector_name="technology",
            limit=limit,
            start_date=start_date,
            end_date=end_date,
            description=f"Technology sector {metric}",
            unit="varies",
            frequency="daily",
            source="Yahoo Finance"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/financials/{metric}", response_model=DataResponse)
async def get_financials_sector_data(
    metric: str = Path(..., description="Metric name"),
    limit: Optional[int] = Query(None, description="Limit number of records"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
):
    """Get financials sector data for a specific metric."""
    try:
        return data_service.get_sector_performance_data(
            metric_name=metric,
            sector_name="financials",
            limit=limit,
            start_date=start_date,
            end_date=end_date,
            description=f"Financials sector {metric}",
            unit="varies",
            frequency="daily",
            source="Yahoo Finance"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/healthcare/{metric}", response_model=DataResponse)
async def get_healthcare_sector_data(
    metric: str = Path(..., description="Metric name"),
    limit: Optional[int] = Query(None, description="Limit number of records"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
):
    """Get healthcare sector data for a specific metric."""
    try:
        return data_service.get_sector_performance_data(
            metric_name=metric,
            sector_name="healthcare",
            limit=limit,
            start_date=start_date,
            end_date=end_date,
            description=f"Healthcare sector {metric}",
            unit="varies",
            frequency="daily",
            source="Yahoo Finance"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/all-sectors", response_model=list)
async def get_available_sectors():
    """Get list of available sectors."""
    return [
        "technology",
        "financials", 
        "healthcare",
        "energy",
        "utilities",
        "consumer_discretionary",
        "consumer_staples",
        "industrials",
        "materials",
        "real_estate",
        "communication_services"
    ]


@router.get("/all-metrics", response_model=list)
async def get_available_metrics():
    """Get list of available metrics."""
    return [
        "price_performance",
        "relative_performance", 
        "momentum_score",
        "sector_rotation_signal"
    ]
