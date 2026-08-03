"""Economic data endpoints."""

from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from ....models.schemas import DataResponse
from ....services.data_service import DataService

router = APIRouter(prefix="/economic", tags=["Economic Data"])
data_service = DataService()


@router.get("/gdp", response_model=DataResponse)
async def get_gdp_data(
    limit: Optional[int] = Query(None, description="Limit number of records"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)")
):
    """Get Real GDP data."""
    try:
        return data_service.get_gdp_data(limit=limit, start_date=start_date, end_date=end_date)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/cpi", response_model=DataResponse)
async def get_cpi_data(
    limit: Optional[int] = Query(None, description="Limit number of records"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)")
):
    """Get Consumer Price Index data."""
    try:
        return data_service.get_cpi_data(limit=limit, start_date=start_date, end_date=end_date)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/unemployment", response_model=DataResponse)
async def get_unemployment_data(
    limit: Optional[int] = Query(None, description="Limit number of records"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)")
):
    """Get Unemployment Rate data."""
    try:
        return data_service.get_unrate_data(limit=limit, start_date=start_date, end_date=end_date)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


