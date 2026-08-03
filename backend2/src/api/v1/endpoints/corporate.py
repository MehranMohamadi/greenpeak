"""Corporate Earnings endpoints."""

from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from ....models.schemas import DataResponse
from ....services.data_service import DataService

router = APIRouter(prefix="/corporate", tags=["Corporate Data"])
data_service = DataService()


@router.get("/eps/sp500", response_model=DataResponse)
async def get_eps_data(
    limit: Optional[int] = Query(None, description="Limit number of records"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
):
    """Get S&P 500 EPS data."""
    try:
        return data_service.get_sp500_eps_data(
            limit=limit, start_date=start_date, end_date=end_date
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/revenue-growth", response_model=DataResponse)
async def get_revenue_growth_data(
    limit: Optional[int] = Query(None, description="Limit number of records"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
):
    """Get Revenue Growth data from major S&P 500 companies."""
    try:
        return data_service.get_revenue_growth_data(
            limit=limit, start_date=start_date, end_date=end_date
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/profit-margins", response_model=DataResponse)
async def get_profit_margins_data(
    limit: Optional[int] = Query(None, description="Limit number of records"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
):
    """Get Profit Margins data from major S&P 500 companies."""
    try:
        return data_service.get_profit_margins_data(
            limit=limit, start_date=start_date, end_date=end_date
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/pe-ratio", response_model=DataResponse)
async def get_pe_ratio_data(
    limit: Optional[int] = Query(None, description="Limit number of records"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
):
    """Get P/E Ratio data for S&P 500."""
    try:
        return data_service.get_pe_ratio_data(
            limit=limit, start_date=start_date, end_date=end_date
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/dividend-yield", response_model=DataResponse)
async def get_dividend_yield_data(
    limit: Optional[int] = Query(None, description="Limit number of records"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
):
    """Get Dividend Yield data for S&P 500."""
    try:
        return data_service.get_dividend_yield_data(
            limit=limit, start_date=start_date, end_date=end_date
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/return-on-assets", response_model=DataResponse)
async def get_return_on_assets_data(
    limit: Optional[int] = Query(None, description="Limit number of records"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
):
    """Get Return on Assets data from major S&P 500 companies."""
    try:
        return data_service.get_return_on_assets_data(
            limit=limit, start_date=start_date, end_date=end_date
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


# Legacy endpoints for backward compatibility
@router.get("/cpi", response_model=DataResponse)
async def get_cpi_data(
    limit: Optional[int] = Query(None, description="Limit number of records"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
):
    """Get Consumer Price Index data."""
    try:
        return data_service.get_cpi_data(
            limit=limit, start_date=start_date, end_date=end_date
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/unemployment", response_model=DataResponse)
async def get_unemployment_data(
    limit: Optional[int] = Query(None, description="Limit number of records"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
):
    """Get Unemployment Rate data."""
    try:
        return data_service.get_unrate_data(
            limit=limit, start_date=start_date, end_date=end_date
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
