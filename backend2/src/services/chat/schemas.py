from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class ConversationCreate(StrictModel):
    scope: Literal["site", "account"] = "site"
    connection_id: str | None = Field(default=None, pattern=r"^[a-fA-F0-9]{24}$")
    account_data_consent: bool = False

    @model_validator(mode="after")
    def require_account_consent(self):
        if self.scope == "account" and (not self.connection_id or not self.account_data_consent):
            raise ValueError("Account selection and consent are required")
        if self.scope == "site" and self.connection_id:
            raise ValueError("Site conversations cannot select an account")
        return self


class MessageRequest(StrictModel):
    content: str = Field(min_length=1, max_length=2000)
    request_id: UUID
    page_path: str = Field(default="/dashboard", max_length=180, pattern=r"^/[a-zA-Z0-9/_-]*$")


class Retrieval(StrictModel):
    kind: Literal["indicator", "analysis", "prices", "news", "calendar", "account", "positions"]
    subject: str = Field(default="", max_length=80)
    symbol: str = Field(default="", max_length=40)
    order: Literal["worst", "best"] = "worst"


class RetrievalPlan(StrictModel):
    requests: list[Retrieval] = Field(default_factory=list, max_length=4)


class Answer(StrictModel):
    answer_fa: str = Field(min_length=1, max_length=10000)
    evidence_refs: list[str] = Field(default_factory=list, max_length=12)
