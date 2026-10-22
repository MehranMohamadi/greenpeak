from functools import lru_cache
from pathlib import Path

from ...core.config import get_settings
from .definitions import DEFINITIONS, PRESETS
from .engine import build_comparison
from .providers import DailyMarketStore


class MarketComparisonService:
    def __init__(self, store):
        self.store = store

    def catalog(self):
        verified_fx = self.store.fx_verified()
        return {"symbols": [{"id": key, **{name: value for name, value in definition.items() if name != "provider"}} for key, definition in DEFINITIONS.items()],
                "presets": [{**preset, "enabled": preset["id"] != "iran_gold" or verified_fx,
                    "reason": None if preset["id"] != "iran_gold" or verified_fx else "نیازمند تاریخچه تأییدشده دلار آزاد؛ شاخص قیمت بدون سود نقدی استفاده خواهد شد"} for preset in PRESETS],
                "fx_verified": verified_fx}

    def compare(self, request):
        if set(request.symbols) - set(DEFINITIONS):
            raise ValueError("Unsupported comparison symbol")
        need_fx = any(DEFINITIONS[key]["kind"] == "asset" and DEFINITIONS[key]["currency"] != request.currency for key in request.symbols)
        sources = self.store.load_many(request.symbols)
        fx = self.store.load("usdirr") if need_fx and self.store.fx_verified() else None
        return build_comparison(request, sources, today=self.store.now().date(), fx=fx)


@lru_cache(maxsize=1)
def get_comparison_service():
    settings = get_settings()
    return MarketComparisonService(DailyMarketStore(settings.market_comparison_cache_dir,
        fred_key=settings.fred_api_key, navasan_key=settings.navasan_api_key,
        navasan_unit=settings.navasan_quote_unit,
        fallback_directory=Path(__file__).resolve().parents[2] / "data" / "fallback" / "market_comparison"))
