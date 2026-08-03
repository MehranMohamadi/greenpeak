"""Liquidity & Fund Flows Data."""

from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query
from ....models.schemas import OHLCDataPoint, DataResponse, TreasuryRatePoint
from ....services.data_service import DataService

router = APIRouter(prefix="/liquidity", tags=["Liquidity & Fund Flows Data"])
data_service = DataService()


@router.get("/m2", response_model=DataResponse)
async def get_m2_data(
    limit: Optional[int] = Query(None, description="Limit number of records"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
):
    """Get M2 Money Supply data."""
    try:
        return data_service.get_m2_data(
            limit=limit, start_date=start_date, end_date=end_date
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/reverse_repo", response_model=DataResponse)
async def get_reverse_repo_data(
    limit: Optional[int] = Query(None, description="Limit number of records"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
):
    """Get Reverse Repo data."""
    try:
        return data_service.get_reverse_repo_data(
            limit=limit, start_date=start_date, end_date=end_date
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/etf-inflows", response_model=DataResponse)
async def get_etf_inflows_data(
    limit: Optional[int] = Query(None, description="Limit number of records"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
):
    """Get ETF Inflows data - Major ETF Volume Analysis from Yahoo Finance."""
    try:
        return data_service.get_etf_inflows_data(
            limit=limit, start_date=start_date, end_date=end_date
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/equity-fund-flows", response_model=DataResponse)
async def get_equity_fund_flows_data(
    limit: Optional[int] = Query(None, description="Limit number of records"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
):
    """Get Equity Fund Flows data (Placeholder - Future: Paid API)."""
    try:
        return data_service.get_equity_fund_flows_data(
            limit=limit, start_date=start_date, end_date=end_date
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/margin-debt", response_model=DataResponse)
async def get_margin_debt_data(
    limit: Optional[int] = Query(None, description="Limit number of records"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
):
    """Get Margin Debt data (Placeholder - Future: Paid API)."""
    try:
        return data_service.get_margin_debt_data(
            limit=limit, start_date=start_date, end_date=end_date
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/institutional-flows", response_model=DataResponse)
async def get_institutional_flows_data(
    limit: Optional[int] = Query(None, description="Limit number of records"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
):
    """Get Institutional Flows data (Placeholder - Future: Paid API)."""
    try:
        return data_service.get_institutional_flows_data(
            limit=limit, start_date=start_date, end_date=end_date
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
