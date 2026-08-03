"""Session and system endpoints."""

from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from ....models.schemas import SessionResponse, HealthCheckResponse
from ....services.session_service import SessionService

router = APIRouter(prefix="/system", tags=["System & Sessions"])
session_service = SessionService()


@router.get("/health", response_model=HealthCheckResponse)
async def health_check():
    """Health check endpoint."""
    try:
        return HealthCheckResponse(
            status="ok",
            message="SP500 Dashboard API is running",
            version="2.0.0"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Health check failed: {str(e)}")


@router.get("/session", response_model=SessionResponse)
async def get_session_data():
    """Get forex market session statuses and overlaps."""
    try:
        return session_service.calculate_sessions()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Session calculation failed: {str(e)}")
