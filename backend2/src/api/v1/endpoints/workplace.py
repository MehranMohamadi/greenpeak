"""Server-enforced staff ownership and administrator workplace operations."""

import sqlite3
from datetime import date
from functools import lru_cache
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pymongo.errors import PyMongoError

from ....models.workplace import (ActivitiesInput, ClockOutInput, CorrectionInput,
                                  EmployeeReport, ManualSessionInput, PendingRequests,
                                  ReviewInput, WorkReport, WorkSession)
from ....services.auth import AuthStorageError
from ....services.workplace import WorkplaceService
from ....services.workplace_repository import WorkplaceError, WorkplaceRepository
from .auth import get_auth_service, no_store, require_admin, require_user

router = APIRouter(prefix="/workplace", tags=["Workplace"], dependencies=[Depends(no_store)])


def require_staff(user: Annotated[dict, Depends(require_user)]):
    if user.get("role") not in {"staff", "admin"}:
        raise HTTPException(403, "دسترسی کارمند یا مدیر لازم است.")
    return user


@lru_cache(maxsize=8)
def workplace_repository(auth):
    return WorkplaceRepository(auth.collection)


def get_workplace_service(auth=Depends(get_auth_service)):
    try:
        return WorkplaceService(workplace_repository(auth), auth)
    except (sqlite3.Error, AuthStorageError, PyMongoError) as exc:
        raise HTTPException(503, "پایگاه داده میز کار در دسترس نیست.") from exc


def run(operation, *args):
    try:
        return operation(*args)
    except WorkplaceError as exc:
        raise HTTPException(exc.status_code, str(exc)) from exc
    except (sqlite3.Error, AuthStorageError, PyMongoError) as exc:
        raise HTTPException(503, "ذخیره یا دریافت اطلاعات میز کار ممکن نشد؛ تازه‌سازی و دوباره بررسی کنید.") from exc


Staff = Annotated[dict, Depends(require_staff)]
Admin = Annotated[dict, Depends(require_admin)]
Service = Annotated[WorkplaceService, Depends(get_workplace_service)]


@router.get("/me/report", response_model=WorkReport)
def my_report(start_date: date, end_date: date, actor: Staff, service: Service):
    return run(service.report, actor["id"], start_date, end_date)


@router.post("/me/clock-in", response_model=WorkSession, status_code=201)
def clock_in(actor: Staff, service: Service):
    return run(service.clock_in, actor)


@router.post("/me/clock-out", response_model=WorkSession)
def clock_out(body: ClockOutInput, actor: Staff, service: Service):
    return run(service.clock_out, actor, body)


@router.put("/me/sessions/{session_id}/activities", response_model=WorkSession)
def activities(session_id: str, body: ActivitiesInput, actor: Staff, service: Service):
    return run(service.activities, actor, session_id, body)


@router.post("/me/sessions/{session_id}/corrections", response_model=WorkSession, status_code=201)
def correction(session_id: str, body: CorrectionInput, actor: Staff, service: Service):
    return run(service.request_correction, actor, session_id, body)


@router.get("/admin/employees", response_model=EmployeeReport)
def employees(start_date: date, end_date: date, actor: Admin, service: Service):
    return run(service.employees, start_date, end_date)


@router.get("/admin/employees/{user_id}/report", response_model=WorkReport)
def employee_report(user_id: str, start_date: date, end_date: date, actor: Admin, service: Service):
    return run(service.report, user_id, start_date, end_date)


@router.post("/admin/employees/{user_id}/sessions", response_model=WorkSession, status_code=201)
def manual_session(user_id: str, body: ManualSessionInput, actor: Admin, service: Service):
    return run(service.manual_session, actor, user_id, body)


@router.put("/admin/sessions/{session_id}/times", response_model=WorkSession)
def correct_times(session_id: str, body: CorrectionInput, actor: Admin, service: Service):
    return run(service.correct, actor, session_id, body)


@router.get("/admin/corrections", response_model=PendingRequests)
def pending_corrections(actor: Admin, service: Service):
    return run(service.pending)


@router.post("/admin/sessions/{session_id}/corrections/{request_id}/review", response_model=WorkSession)
def review(session_id: str, request_id: str, body: ReviewInput, actor: Admin, service: Service):
    return run(service.review, actor, session_id, request_id, body)
