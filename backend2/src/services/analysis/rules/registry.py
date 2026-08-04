"""Simple registry for deterministic analysis rules."""

from .base import AnalysisRule
from .interest_rate import InterestRateRule

RULES: list[AnalysisRule] = [InterestRateRule()]
