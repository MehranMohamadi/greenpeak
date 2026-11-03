"""Public support feedback, persisted before independent notifications."""

import re
import time
from collections import deque
from threading import Lock
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field, field_validator

from ....core.config import get_settings
from ....services.auth import AuthStorageError
from ....services.support_notifications import SupportNotifications, process_support_notifications


router = APIRouter(prefix="/support", tags=["Support"])


class SupportFeedbackRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    email: str = Field(min_length=3, max_length=254)
    category: Literal["comment", "suggestion", "question", "bug"]
    message: str = Field(min_length=5, max_length=5000)

    @field_validator("name", "message")
    @classmethod
    def require_non_blank_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("This field cannot be blank.")
        return value

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        value = value.strip().casefold()
        if not re.fullmatch(r"[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+", value):
            raise ValueError("Enter a valid email address.")
        return value


class SupportFeedbackResponse(BaseModel):
    message: str


_feedback_attempts: dict[str, deque[float]] = {}
_feedback_lock = Lock()


def limit_feedback_requests(request: Request):
    """Limit public submissions to five per source IP per ten minutes."""
    key = request.client.host if request.client else "unknown"
    now = time.monotonic()
    with _feedback_lock:
        expired_keys = [
            client_key
            for client_key, attempts in _feedback_attempts.items()
            if not attempts or attempts[-1] <= now - 600
        ]
        for client_key in expired_keys:
            del _feedback_attempts[client_key]
        attempts = _feedback_attempts.setdefault(key, deque())
        while attempts and attempts[0] <= now - 600:
            attempts.popleft()
        if len(attempts) >= 5 or len(_feedback_attempts) > 10000:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="لطفاً کمی بعد دوباره پیام بفرستید.",
                headers={"Retry-After": "600"},
            )
        attempts.append(now)


@router.post(
    "/feedback",
    response_model=SupportFeedbackResponse,
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(limit_feedback_requests)],
)
def submit_support_feedback(payload: SupportFeedbackRequest, background_tasks: BackgroundTasks):
    try:
        identifier = SupportNotifications(get_settings()).submit(payload.model_dump())
    except AuthStorageError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ارسال پیام در حال حاضر ممکن نیست. لطفاً از ایمیل پشتیبانی استفاده کنید.",
        ) from exc
    background_tasks.add_task(process_support_notifications, identifier)
    return SupportFeedbackResponse(message="پیام شما برای پیگیری توسط تیم پشتیبانی ثبت شد.")
