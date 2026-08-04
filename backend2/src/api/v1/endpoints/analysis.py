"""Endpoints for deterministic analysis preparation."""

from fastapi import APIRouter

from ....models.analysis_schemas import AnalysisRequest, AnalysisResponse
from ....services.analysis import AnalysisService

router = APIRouter(prefix="/analysis", tags=["Analysis"])
analysis_service = AnalysisService()


@router.post("/prepare", response_model=AnalysisResponse)
async def prepare_analysis(request: AnalysisRequest) -> AnalysisResponse:
    context = analysis_service.prepare(request)
    return AnalysisResponse(
        data=context,
        metadata={"pipeline": "deterministic_v1", "item_count": len(request.items)},
    )
