from fastapi import APIRouter, HTTPException

from ....models.market_comparison import ComparisonRequest, ComparisonResponse
from ....services.market_comparison.service import get_comparison_service

router = APIRouter(prefix="/market-comparison", tags=["Market comparisons"])


@router.get("/symbols")
def comparison_symbols():
    return get_comparison_service().catalog()


@router.post("/compare", response_model=ComparisonResponse)
def compare_markets(request: ComparisonRequest):
    try:
        return get_comparison_service().compare(request)
    except ValueError:
        raise HTTPException(status_code=422, detail="Unsupported comparison selection") from None
