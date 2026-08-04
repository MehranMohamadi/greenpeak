"""Interface shared by deterministic analysis rules."""

from typing import Protocol

from ....models.analysis_schemas import PreparedAnalysisContext, Signal


class AnalysisRule(Protocol):
    rule_id: str

    def evaluate(self, context: PreparedAnalysisContext) -> list[Signal]: ...
