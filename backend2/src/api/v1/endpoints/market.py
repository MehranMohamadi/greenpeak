"""Market data endpoints."""

from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from ....models.schemas import DataResponse
from ....services.data_service import DataService

router = APIRouter(prefix="/market", tags=["Market Data"])
data_service = DataService()


@router.get("/sp500/performance", response_model=DataResponse)
async def get_sp500_performance_data(
    limit: Optional[int] = Query(None, description="Limit number of records"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
):
    """Get S&P 500 performance graph data from Excel export."""
    try:
        return data_service.get_performance_graph_data(
            limit=limit, start_date=start_date, end_date=end_date
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/sp500", response_model=list)
async def get_sp500_ohlc_data():
    """Get S&P 500 OHLC data from CSV."""
    try:
        return data_service.get_sp500_data()
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/vix", response_model=list)
async def get_vix_data():
    """Get VIX data."""
    try:
        return data_service.get_vix_data()
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/treasury", response_model=list)
async def get_treasury_data():
    """Get Treasury rates data."""
    try:
        return data_service.get_treasury_data()
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
