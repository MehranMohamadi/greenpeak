"""Contracts for small-team work management, separate from attendance sessions."""

from datetime import date, datetime
from typing import Annotated, Literal
from urllib.parse import urlsplit
from uuid import UUID

from pydantic import BaseModel, Field, StrictBool, StringConstraints, field_validator, model_validator

from .workplace import Actor, Input

Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=180)]
Identifier = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=64)]
Priority = Literal["normal", "high"]
Visibility = Literal["restricted", "team"]
TaskState = Literal["not_started", "in_progress", "awaiting_approval", "completed", "cancelled"]


class TaskCreate(Input):
    request_id: UUID | None = None
    title: Title
    assignee_id: Identifier | None = None
    description: str = Field(default="", max_length=10000)
    expected_output: str = Field(default="", max_length=10000)
    due_date: date | None = None
    priority: Priority = "normal"
    requires_approval: StrictBool = True
    visibility: Visibility = "team"


class TaskRevision(Input):
    revision: int = Field(ge=1)


class TaskPatch(TaskRevision):
    title: Title | None = None
    assignee_id: Identifier | None = None
    description: str | None = Field(default=None, max_length=10000)
    expected_output: str | None = Field(default=None, max_length=10000)
    due_date: date | None = None
    priority: Priority | None = None
    requires_approval: StrictBool | None = None
    visibility: Visibility | None = None

    @model_validator(mode="after")
    def explicit_nulls(self):
        for name in self.model_fields_set - {"due_date"}:
            if getattr(self, name) is None:
                raise ValueError("Only due_date can be cleared with null.")
        return self


class TaskSubmit(TaskRevision):
    note: str = Field(default="", max_length=5000)
    result_url: str | None = Field(default=None, max_length=2048)

    @field_validator("result_url")
    @classmethod
    def safe_link(cls, value):
        if not value or not value.strip():
            return None
        value = value.strip()
        try:
            parsed = urlsplit(value)
            if parsed.scheme not in {"http", "https"} or not parsed.hostname or parsed.username or parsed.password:
                raise ValueError("Use an HTTP or HTTPS link without credentials.")
            if any(character.isspace() or ord(character) < 32 for character in value):
                raise ValueError("Invalid result link.")
        except ValueError as exc:
            raise ValueError("Invalid result link.") from exc
        return value


class TaskReview(TaskRevision):
    decision: Literal["approved", "changes_requested"]
    reason: str = Field(default="", max_length=2000)


class TaskCancel(TaskRevision):
    reason: str = Field(default="", max_length=2000)


class TaskReopen(TaskRevision):
    reason: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=2000)]


class TaskCommentInput(Input):
    text: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=5000)]


class TaskComment(BaseModel):
    id: str
    author: Actor
    created_at: datetime
    text: str


class TaskSubmission(BaseModel):
    id: str
    submitted_by: Actor
    submitted_at: datetime
    note: str
    result_url: str | None
    due_date_at_submission: date | None
    delivered_late: bool | None
    review_status: Literal["pending", "approved", "changes_requested", "not_required", "cancelled"]
    reviewed_by: Actor | None = None
    reviewed_at: datetime | None = None
    review_reason: str = ""


class TaskEvent(BaseModel):
    id: str
    kind: str
    actor: Actor
    created_at: datetime
    details: dict = Field(default_factory=dict)


class TaskTelegramDelivery(BaseModel):
    status: Literal["pending", "blocked", "retry", "sending", "sent", "skipped", "failed", "uncertain"] = "pending"
    attempts: int = 0
    next_attempt_at: datetime | None = None
    claimed_at: datetime | None = None
    claim_id: str | None = None
    sent_at: datetime | None = None
    message_id: int | None = None
    error_code: str | None = None
    context: dict = Field(default_factory=dict)


class StoredTaskEvent(TaskEvent):
    recipients: list[str] = Field(default_factory=list)
    read_by: list[str] = Field(default_factory=list)
    telegram: TaskTelegramDelivery | None = None


class TaskRecord(BaseModel):
    id: str
    revision: int
    storage_revision: int = 1
    creation_request_hash: str | None = None
    title: str
    assignee: Actor
    created_by: Actor
    created_at: datetime
    updated_at: datetime
    description: str
    expected_output: str
    due_date: date | None
    priority: Priority
    requires_approval: bool
    visibility: Visibility
    state: TaskState
    first_submitted_at: datetime | None = None
    submitted_at: datetime | None = None
    approved_at: datetime | None = None
    approved_by: Actor | None = None
    completed_at: datetime | None = None
    completion_mode: Literal["approved", "no_approval"] | None = None
    submissions: list[TaskSubmission] = Field(default_factory=list)
    comments: list[TaskComment] = Field(default_factory=list)
    events: list[StoredTaskEvent] = Field(default_factory=list)


class TaskPermissions(BaseModel):
    edit_fields: bool
    change_visibility: bool
    comment: bool
    start: bool
    submit: bool
    review: bool
    cancel: bool
    reopen: bool


class TaskSummary(BaseModel):
    id: str
    revision: int
    title: str
    assignee: Actor
    created_by: Actor
    created_at: datetime
    updated_at: datetime
    due_date: date | None
    priority: Priority
    requires_approval: bool
    visibility: Visibility
    state: TaskState
    first_submitted_at: datetime | None
    submitted_at: datetime | None
    approved_at: datetime | None
    approved_by: Actor | None
    completed_at: datetime | None
    completion_mode: Literal["approved", "no_approval"] | None
    overdue: bool
    delivered_late: bool | None
    permissions: TaskPermissions


class TaskDetail(TaskSummary):
    description: str
    expected_output: str
    submissions: list[TaskSubmission]
    comments: list[TaskComment]
    history: list[TaskEvent]


class TaskCounts(BaseModel):
    mine: int
    team: int
    all: int | None = None
    pending: int | None = None


class TaskList(BaseModel):
    items: list[TaskSummary]
    total: int
    offset: int
    limit: int
    counts: TaskCounts


class TaskPeople(BaseModel):
    people: list[Actor]


class TaskNotification(BaseModel):
    id: str
    task_id: str
    task_title: str
    kind: str
    actor: Actor
    created_at: datetime
    read: bool


class TaskNotifications(BaseModel):
    items: list[TaskNotification]
    unread_count: int


class TaskReadResult(BaseModel):
    read: bool = True
