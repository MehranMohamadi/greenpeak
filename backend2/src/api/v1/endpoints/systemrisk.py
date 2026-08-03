"""Systemic Risk Data."""

from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from ....models.schemas import DataResponse
from ....services.data_service import DataService

router = APIRouter(prefix="/systemrisk", tags=["Systemic Risk Data"])
data_service = DataService()


@router.get("/vix", response_model=DataResponse)
async def get_vix_data(
    limit: Optional[int] = Query(None, description="Limit number of records"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)")
):
    """Get VIX volatility index data."""
    try:
        return data_service.get_vix_data(
            limit=limit, start_date=start_date, end_date=end_date
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/credit", response_model=DataResponse)
async def get_credit_spread(
    limit: Optional[int] = Query(None, description="Limit number of records"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)")
):
    """Get ICE BofA US High Yield Index Option-Adjusted Spread data."""
    try:
        return data_service.get_credit_spread_data(
            limit=limit, start_date=start_date, end_date=end_date
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/2y10y", response_model=DataResponse)
async def get_2y10y_data(
    limit: Optional[int] = Query(None, description="Limit number of records"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
):
    """Get 2-Year/10-Year Treasury Yield Curve data."""
    try:
        return data_service.get_2y10y_yieldcurve(
            limit=limit, start_date=start_date, end_date=end_date
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/cds", response_model=DataResponse)
async def get_cds_data(
    limit: Optional[int] = Query(None, description="Limit number of records"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
):
    """Get CDS Spreads data."""
    try:
        return data_service.get_cds_spreads(
            limit=limit, start_date=start_date, end_date=end_date
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/stress", response_model=DataResponse)
async def get_stress_index_data(
    limit: Optional[int] = Query(None, description="Limit number of records"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
):
    """Get Fed Financial Stress Index (STLFSI4) data."""
    try:
        return data_service.get_stress_index(
            limit=limit, start_date=start_date, end_date=end_date
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/dollar-index", response_model=DataResponse)
async def get_dollar_index_data(
    limit: Optional[int] = Query(None, description="Limit number of records"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
):
    """Get US Dollar Index data."""
    try:
        return data_service.get_dollar_index_data(
            limit=limit, start_date=start_date, end_date=end_date
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/gold", response_model=DataResponse)
async def get_gold_data(
    limit: Optional[int] = Query(None, description="Limit number of records"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
):
    """Get Gold Futures data."""
    try:
        return data_service.get_gold_data(
            limit=limit, start_date=start_date, end_date=end_date
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
    