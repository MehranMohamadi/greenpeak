"""Workplace API contracts. Instants are offset-aware; ranges are Tehran dates."""

from datetime import date, datetime
from typing import Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ActivitiesInput(Input):
    activities: str = Field(max_length=10000)
    revision: int = Field(ge=1)


class ClockOutInput(Input):
    session_id: str = Field(min_length=1, max_length=64)
    revision: int = Field(ge=1)
    activities: str = Field(max_length=10000)


class TimesInput(Input):
    check_in: AwareDatetime
    check_out: AwareDatetime | None
    reason: str = Field(min_length=3, max_length=2000)


class CorrectionInput(TimesInput):
    revision: int = Field(ge=1)


class ManualSessionInput(TimesInput):
    activities: str = Field(default="", max_length=10000)


class ReviewInput(Input):
    decision: Literal["approved", "rejected"]
    note: str = Field(default="", max_length=2000)


class StaffRoleInput(Input):
    role: Literal["user", "staff"]


class Actor(BaseModel):
    id: str
    username: str


class TimePair(BaseModel):
    check_in: datetime
    check_out: datetime | None


class Correction(TimePair):
    id: str
    reason: str
    status: Literal["pending", "approved", "rejected"]
    created_at: datetime
    requested_by: Actor
    original: TimePair
    reviewed_at: datetime | None = None
    reviewed_by: Actor | None = None
    review_note: str = ""


class AuditEntry(BaseModel):
    action: str
    at: datetime
    actor: Actor
    reason: str = ""
    before: dict | None = None
    after: dict | None = None


class WorkSession(TimePair):
    id: str
    user_id: str
    username: str
    activities: str
    revision: int
    requests: list[Correction]
    audit: list[AuditEntry]


class DayEntry(BaseModel):
    session_id: str
    seconds: int


class WorkDay(BaseModel):
    date: date
    seconds: int
    entries: list[DayEntry]


class WorkReport(BaseModel):
    user_id: str
    start_date: date
    end_date: date
    timezone: str = "Asia/Tehran"
    generated_at: datetime
    total_seconds: int
    days: list[WorkDay]
    sessions: list[WorkSession]
    active_session: WorkSession | None


class EmployeeSummary(BaseModel):
    id: str
    username: str
    role: str
    is_active: bool
    present: bool
    check_in: datetime | None
    total_seconds: int
    pending_requests: int


class EmployeeReport(BaseModel):
    start_date: date
    end_date: date
    timezone: str = "Asia/Tehran"
    generated_at: datetime
    employees: list[EmployeeSummary]


class PendingRequest(BaseModel):
    session_id: str
    user_id: str
    username: str
    request: Correction


class PendingRequests(BaseModel):
    requests: list[PendingRequest]
