from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class UpdatePrompt(BaseModel):
    model_config = ConfigDict(extra="forbid")
    content: str = Field(min_length=1, max_length=100_000)
    expected_revision: int = Field(ge=0, strict=True)

    @field_validator("content")
    @classmethod
    def valid_text(cls, value):
        if not value.strip() or "\x00" in value:
            raise ValueError("Prompt must contain non-empty text without null characters")
        return value


class PromptDocument(BaseModel):
    id: str
    title: str
    description: str
    content: str
    default_content: str
    version: str
    revision: int
    customized: bool
    updated_at: datetime | None
    effective_content: str
    effective_hash: str


class PromptCatalog(BaseModel):
    prompts: list[PromptDocument]
