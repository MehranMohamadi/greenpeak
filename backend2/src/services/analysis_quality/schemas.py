"""Administrator contracts for the analysis improvement loop."""
from datetime import datetime
from typing import Literal
from urllib.parse import urlsplit

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

Horizon = Literal["pulse", "short", "medium"]


class Command(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True, protected_namespaces=())


class Feedback(Command):
    accuracy: int = Field(ge=1, le=5, strict=True)
    evidence: int = Field(ge=1, le=5, strict=True)
    clarity: int = Field(ge=1, le=5, strict=True)
    uncertainty: int = Field(ge=1, le=5, strict=True)
    usefulness: int = Field(ge=1, le=5, strict=True)
    note: str = Field(default="", max_length=3000)
    correction: str = Field(default="", max_length=5000)
    approved_example: bool = False
    expected_revision: int = Field(ge=0, strict=True)


class CaseSelection(Command):
    split: Literal["none", "development", "holdout"]
    category: Literal["quiet", "inflation", "fed", "earnings", "selloff", "weekend", "conflicting", "other"] = "other"
    expected_revision: int = Field(ge=0, strict=True)


class SourceInput(Command):
    title: str = Field(min_length=3, max_length=240)
    publisher: str = Field(min_length=2, max_length=120)
    author: str = Field(default="", max_length=160)
    source_url: str = Field(max_length=2000)
    published_at: datetime
    expires_at: datetime
    horizon: Horizon
    kind: Literal["official", "research", "opinion"]
    topics: str = Field(default="", max_length=300)
    content: str = Field(min_length=80, max_length=200000)

    @field_validator("source_url")
    @classmethod
    def url(cls, value):
        parsed = urlsplit(value)
        if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
            raise ValueError("Use an HTTPS source URL without credentials")
        return value

    @model_validator(mode="after")
    def dated(self):
        if not self.published_at.tzinfo or not self.expires_at.tzinfo:
            raise ValueError("Source timestamps need a timezone")
        if self.expires_at <= self.published_at:
            raise ValueError("Expiry must follow publication")
        return self


class SourceReview(Command):
    approved: bool
    expected_revision: int = Field(ge=0, strict=True)


class FetchSource(Command):
    source_url: str = Field(max_length=2000)


class ExtractDocument(Command):
    filename: str = Field(min_length=1, max_length=240)
    data_base64: str = Field(min_length=1, max_length=7_000_000)


class HypothesisInput(Command):
    report_id: str = Field(min_length=1, max_length=100)
    title: str = Field(min_length=5, max_length=240)
    horizon: Literal["short", "medium"]
    thesis: str = Field(min_length=10, max_length=1500)
    evidence_refs: list[str] = Field(min_length=1, max_length=10)
    invalidation: str = Field(min_length=5, max_length=1000)
    due_at: datetime

    @field_validator("due_at")
    @classmethod
    def timezone(cls, value):
        if value.tzinfo is None:
            raise ValueError("Review timestamp needs a timezone")
        return value


class HypothesisReview(Command):
    status: Literal["active", "strengthened", "weakened", "realized", "invalidated", "inconclusive"]
    note: str = Field(min_length=10, max_length=2000)
    evidence_url: str = Field(min_length=8, max_length=2000)
    evidence_at: datetime
    expected_revision: int = Field(ge=0, strict=True)

    _url = field_validator("evidence_url")(SourceInput.url.__func__)
    _timezone = field_validator("evidence_at")(HypothesisInput.timezone.__func__)


class CandidateInput(Command):
    title: str = Field(min_length=3, max_length=160)
    amendment: str = Field(min_length=20, max_length=4000)


class EvaluationInput(Command):
    case_ids: list[str] = Field(min_length=1, max_length=5)
    candidate_id: str | None = Field(default=None, max_length=100)
    model_id: str | None = Field(default=None, max_length=100)

    @field_validator("case_ids")
    @classmethod
    def unique(cls, value):
        if len(set(value)) != len(value):
            raise ValueError("Cases must be unique")
        return value


class ComparisonReview(Command):
    decision: Literal["candidate", "baseline", "tie"]
    note: str = Field(min_length=10, max_length=2000)
    expected_revision: int = Field(ge=0, strict=True)


class PromoteCandidate(Command):
    expected_prompt_revision: int = Field(ge=0, strict=True)


class QualityOverview(BaseModel):
    reports: list[dict]
    sources: list[dict]
    hypotheses: list[dict]
    candidates: list[dict]
    evaluations: list[dict]
    critiques: list[dict]
    suggestions: list[dict]
    models: list[dict]
    counts: dict
    metrics: dict
    collection_status: str
