"""FastAPI application factory and configuration."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .core.config import get_settings
from .api.v1.endpoints import market_router, monetary_router, economic_router, system_router, systemrisk_router, liquidity_router, macroeco_router, corporate_router, valuation_router, sectors_router


def create_app() -> FastAPI:
    """Create and configure FastAPI application."""
    settings = get_settings()
    
    app = FastAPI(
        title=settings.api_title,
        description=settings.api_description,
        version=settings.api_version,
        debug=settings.debug,
        docs_url="/docs" if settings.environment != "development" else None,
        redoc_url="/redoc" if settings.environment != "development" else None,
    )
    
    # Add CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=settings.cors_allow_credentials,
        allow_methods=settings.cors_allow_methods,
        allow_headers=settings.cors_allow_headers,
    )
    
    # Root endpoint for health check
    @app.get("/")
    async def root():
        """Health check endpoint."""
        return {
            "message": "SP500 Dashboard API",
            "status": "healthy",
            "version": settings.api_version
        }
    
    @app.get("/health")
    async def health_check():
        """Health check endpoint."""
        return {"status": "healthy", "service": "sp500-dashboard-api"}
    
    # Include routers
    app.include_router(system_router, prefix="/api/v1")
    app.include_router(market_router, prefix="/api/v1")
    app.include_router(monetary_router, prefix="/api/v1")
    app.include_router(economic_router, prefix="/api/v1")
    app.include_router(systemrisk_router, prefix="/api/v1")
    app.include_router(liquidity_router, prefix="/api/v1")
    app.include_router(macroeco_router, prefix="/api/v1")
    app.include_router(corporate_router, prefix="/api/v1")
    app.include_router(valuation_router, prefix="/api/v1")
    app.include_router(sectors_router, prefix="/api/v1")

    return app


# Create the app instance
app = create_app()
