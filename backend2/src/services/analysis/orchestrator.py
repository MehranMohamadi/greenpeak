"""Orchestration of the deterministic analysis preparation stages."""

from ...models.analysis_schemas import AnalysisRequest, PreparedAnalysisContext
from .feature_extractor import AnalysisFeatureExtractor
from .normalizer import AnalysisNormalizer
from .rules.registry import RULES


class AnalysisService:
    def __init__(self) -> None:
        self.normalizer = AnalysisNormalizer()
        self.feature_extractor = AnalysisFeatureExtractor()

    def prepare(self, request: AnalysisRequest) -> PreparedAnalysisContext:
        items, warnings = self.normalizer.normalize(request)
        context = PreparedAnalysisContext(
            market=request.market,
            as_of=self.normalizer._utc(request.as_of),
            normalized_items=items,
            features=self.feature_extractor.extract(items),
            data_quality={"warnings": warnings, "warning_count": len(warnings)},
        )
        for rule in RULES:
            context.signals.extend(rule.evaluate(context))
        return context
