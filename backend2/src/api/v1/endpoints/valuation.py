"""Valuation endpoints."""

from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from ....models.schemas import DataResponse
from ....services.data_service import DataService
from ....services.valuation_sources import ValuationSourceError

router = APIRouter(prefix="/valuation", tags=["Valuation Data"])
data_service = DataService()


@router.get("/pe-ratio", response_model=DataResponse)
async def get_valuation_pe_ratio_data(
    limit: Optional[int] = Query(None, description="Limit number of records"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
):
    """Get the published S&P 500 trailing P/E series from Multpl."""
    try:
        return data_service.get_valuation_pe_ratio_data(
            limit=limit, start_date=start_date, end_date=end_date
        )
    except ValuationSourceError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/forward-pe", response_model=DataResponse)
async def get_forward_pe_data(
    limit: Optional[int] = Query(None, description="Limit number of records"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
):
    """Get the Fed's published aggregate S&P 500 12-month Forward P/E series."""
    try:
        return data_service.get_forward_pe_data(
            limit=limit, start_date=start_date, end_date=end_date
        )
    except ValuationSourceError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/price-to-book", response_model=DataResponse)
async def get_price_to_book_data(
    limit: Optional[int] = Query(None, description="Limit number of records"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
):
    """Get the published S&P 500 Price-to-Book series from Multpl."""
    try:
        return data_service.get_price_to_book_data(
            limit=limit, start_date=start_date, end_date=end_date
        )
    except ValuationSourceError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/price-to-sales", response_model=DataResponse)
async def get_price_to_sales_data(
    limit: Optional[int] = Query(None, description="Limit number of records"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
):
    """Get the published S&P 500 Price-to-Sales series from Multpl."""
    try:
        return data_service.get_price_to_sales_data(
            limit=limit, start_date=start_date, end_date=end_date
        )
    except ValuationSourceError as e:
        raise HTTPException(status_code=502, detail=str(e))
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
    """Get the published S&P 500 Dividend Yield series from Multpl."""
    try:
        return data_service.get_valuation_dividend_yield_data(
            limit=limit, start_date=start_date, end_date=end_date
        )
    except ValuationSourceError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
