"""Macroeconomic Analysis Data."""

from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from ....models.schemas import DataResponse
from ....services.data_service import DataService

router = APIRouter(prefix="/macroeco", tags=["Macroeconomic Analysis Data"])
data_service = DataService()


@router.get("/gdp", response_model=DataResponse)
async def get_gdp_data(
    limit: Optional[int] = Query(None, description="Limit number of records"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
):
    """Get GDP Growth Rate data from MongoDB or fallback to CSV."""
    try:
        return data_service.get_macro_gdp_growth_rate_data(
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
    """Get Unemployment Rate data from MongoDB or fallback to CSV."""
    try:
        return data_service.get_macro_unemployment_rate_data(
            limit=limit, start_date=start_date, end_date=end_date
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/employment", response_model=DataResponse)
async def get_employment_data(
    limit: Optional[int] = Query(None, description="Limit number of records"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
):
    """Get Employment data - alias for unemployment rate."""
    try:
        return data_service.get_macro_unemployment_rate_data(
            limit=limit, start_date=start_date, end_date=end_date
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
    

@router.get("/payroll", response_model=DataResponse)
async def get_payroll_data(
    limit: Optional[int] = Query(None, description="Limit number of records"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
):
    """Get Nonfarm Payrolls data from MongoDB or fallback to CSV."""
    try:
        return data_service.get_macro_nonfarm_payrolls_data(
            limit=limit, start_date=start_date, end_date=end_date
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
    

@router.get("/confidence", response_model=DataResponse)
async def get_confidence_data(
    limit: Optional[int] = Query(None, description="Limit number of records"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
):
    """Get Consumer Confidence data from MongoDB or fallback to CSV."""
    try:
        return data_service.get_macro_consumer_confidence_data(
            limit=limit, start_date=start_date, end_date=end_date
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/cpi", response_model=DataResponse)
async def get_cpi_data(
    limit: Optional[int] = Query(None, description="Limit number of records"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
):
    """Get CPI Inflation data from MongoDB or fallback to CSV."""
    try:
        return data_service.get_macro_cpi_inflation_data(
            limit=limit, start_date=start_date, end_date=end_date
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/retail-sales", response_model=DataResponse)
async def get_retail_sales_data(
    limit: Optional[int] = Query(None, description="Limit number of records"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
):
    """Get Retail Sales data from MongoDB or fallback to CSV."""
    try:
        return data_service.get_macro_retail_sales_data(
            limit=limit, start_date=start_date, end_date=end_date
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
