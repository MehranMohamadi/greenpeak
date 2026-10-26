"""Work management uses the existing staff/admin identity and authorization."""

import sqlite3
from datetime import date
from functools import lru_cache
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo.errors import PyMongoError

from ....models.work_tasks import (TaskCancel, TaskCommentInput, TaskCreate, TaskDetail, TaskList,
                                   TaskNotifications, TaskPatch, TaskPeople, TaskReadResult,
                                   TaskReopen, TaskReview, TaskRevision, TaskSubmit)
from ....services.auth import AuthStorageError
from ....services.work_tasks import WorkTasksService
from ....services.work_tasks_repository import WorkTasksRepository
from .auth import get_auth_service, no_store, require_admin
from .workplace import require_staff, run

router = APIRouter(prefix="/workplace/tasks", tags=["Workplace work"], dependencies=[Depends(no_store)])


@lru_cache(maxsize=8)
def tasks_repository(auth):
    return WorkTasksRepository(auth.collection)


def get_tasks_service(auth=Depends(get_auth_service)):
    try:
        return WorkTasksService(tasks_repository(auth), auth)
    except (sqlite3.Error, AuthStorageError, PyMongoError) as exc:
        raise HTTPException(503, "پایگاه داده کارها در دسترس نیست.") from exc


Staff = Annotated[dict, Depends(require_staff)]
Admin = Annotated[dict, Depends(require_admin)]
Service = Annotated[WorkTasksService, Depends(get_tasks_service)]


@router.get("", response_model=TaskList)
def list_tasks(actor: Staff, service: Service,
               view: Literal["mine", "team", "all", "pending"] = "mine",
               status: Literal["active", "all", "not_started", "in_progress", "awaiting_approval", "completed", "cancelled"] = "active",
               search: str = Query(default="", max_length=180),
               deadline: Literal["any", "overdue", "today", "no_due"] = "any",
               assignee_id: str | None = Query(default=None, max_length=64),
               due_from: date | None = None, due_to: date | None = None,
               offset: int = Query(default=0, ge=0), limit: int = Query(default=30, ge=1, le=100)):
    return run(service.list, actor, view, status, search, deadline, assignee_id, due_from, due_to, offset, limit)


@router.post("", response_model=TaskDetail, status_code=201)
def create_task(body: TaskCreate, actor: Staff, service: Service):
    return run(service.create, actor, body)


@router.get("/people", response_model=TaskPeople)
def people(actor: Admin, service: Service):
    return run(service.people, actor)


@router.get("/notifications", response_model=TaskNotifications)
def notifications(actor: Staff, service: Service, limit: int = Query(default=50, ge=1, le=100)):
    return run(service.notifications, actor, limit)


@router.post("/notifications/{task_id}/{event_id}/read", response_model=TaskReadResult)
def read_notification(task_id: str, event_id: str, actor: Staff, service: Service):
    return run(service.read_notification, actor, task_id, event_id)


@router.get("/{task_id}", response_model=TaskDetail)
def task_detail(task_id: str, actor: Staff, service: Service):
    return run(service.get, actor, task_id)


@router.put("/{task_id}", response_model=TaskDetail)
def update_task(task_id: str, body: TaskPatch, actor: Staff, service: Service):
    return run(service.patch, actor, task_id, body)


@router.post("/{task_id}/start", response_model=TaskDetail)
def start_task(task_id: str, body: TaskRevision, actor: Staff, service: Service):
    return run(service.start, actor, task_id, body)


@router.post("/{task_id}/submit", response_model=TaskDetail)
def submit_task(task_id: str, body: TaskSubmit, actor: Staff, service: Service):
    return run(service.submit, actor, task_id, body)


@router.post("/{task_id}/review", response_model=TaskDetail)
def review_task(task_id: str, body: TaskReview, actor: Admin, service: Service):
    return run(service.review, actor, task_id, body)


@router.post("/{task_id}/cancel", response_model=TaskDetail)
def cancel_task(task_id: str, body: TaskCancel, actor: Admin, service: Service):
    return run(service.cancel, actor, task_id, body)


@router.post("/{task_id}/reopen", response_model=TaskDetail)
def reopen_task(task_id: str, body: TaskReopen, actor: Admin, service: Service):
    return run(service.reopen, actor, task_id, body)


@router.post("/{task_id}/comments", response_model=TaskDetail, status_code=201)
def comment(task_id: str, body: TaskCommentInput, actor: Staff, service: Service):
    return run(service.comment, actor, task_id, body)
