"""Valuation endpoints."""

from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from ....models.schemas import DataResponse
from ....services.data_service import DataService

router = APIRouter(prefix="/valuation", tags=["Valuation Data"])
data_service = DataService()


@router.get("/pe-ratio", response_model=DataResponse)
async def get_valuation_pe_ratio_data(
    limit: Optional[int] = Query(None, description="Limit number of records"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
):
    """Get S&P 500 P/E Ratio data from valuation metrics."""
    try:
        return data_service.get_valuation_pe_ratio_data(
            limit=limit, start_date=start_date, end_date=end_date
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/forward-pe", response_model=DataResponse)
async def get_forward_pe_data(
    limit: Optional[int] = Query(None, description="Limit number of records"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
):
    """Get Forward P/E Ratio data from major S&P 500 companies."""
    try:
        return data_service.get_forward_pe_data(
            limit=limit, start_date=start_date, end_date=end_date
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/price-to-book", response_model=DataResponse)
async def get_price_to_book_data(
    limit: Optional[int] = Query(None, description="Limit number of records"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
):
    """Get Price-to-Book ratio data."""
    try:
        return data_service.get_price_to_book_data(
            limit=limit, start_date=start_date, end_date=end_date
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/price-to-sales", response_model=DataResponse)
async def get_price_to_sales_data(
    limit: Optional[int] = Query(None, description="Limit number of records"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
):
    """Get Price-to-Sales ratio data."""
    try:
        return data_service.get_price_to_sales_data(
            limit=limit, start_date=start_date, end_date=end_date
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/peg-ratio", response_model=DataResponse)
async def get_peg_ratio_data(
    limit: Optional[int] = Query(None, description="Limit number of records"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
):
    """Get PEG Ratio data."""
    try:
        return data_service.get_peg_ratio_data(
            limit=limit, start_date=start_date, end_date=end_date
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/dividend-yield", response_model=DataResponse)
async def get_valuation_dividend_yield_data(
    limit: Optional[int] = Query(None, description="Limit number of records"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
):
    """Get Dividend Yield data from valuation metrics."""
    try:
        return data_service.get_valuation_dividend_yield_data(
            limit=limit, start_date=start_date, end_date=end_date
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
