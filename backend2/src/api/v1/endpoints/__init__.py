"""Endpoints package initialization."""

from .market import router as market_router
from .monetary import router as monetary_router
from .economic import router as economic_router
from .system import router as system_router
from .systemrisk import router as systemrisk_router
from .liquidity import router as liquidity_router
from .macroeco import router as macroeco_router
from .corporate import router as corporate_router
from .valuation import router as valuation_router
from .sectors import router as sectors_router
from .features import router as features_router
from .analysis import router as analysis_router
from .rules import router as rules_router
from .mt5 import router as mt5_router

__all__ = ["market_router", "monetary_router", "economic_router", "system_router", "systemrisk_router", "liquidity_router", "macroeco_router", "corporate_router", "valuation_router", "sectors_router", "features_router", "analysis_router", "rules_router", "mt5_router"]
