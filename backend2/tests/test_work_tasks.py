"""Offline workflow, ACL, notification privacy and attendance regression tests."""

from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pymongo.errors import DuplicateKeyError, ServerSelectionTimeoutError

from src.api.v1.endpoints import auth, work_tasks, workplace
from src.models.work_tasks import TaskCommentInput, TaskReview
from src.services.auth import AuthService, LocalUserCollection
from src.services.work_tasks import WorkTasksService
from src.services.work_tasks_repository import WorkTasksRepository
from src.services.workplace_repository import WorkplaceError
from test_workplace import MemoryMongo

PREFIX = "/api/v1/workplace/tasks"


class TasksMongo(MemoryMongo):
    def insert_one(self, document):
        with self.guard:
            if document["_id"] in self.rows:
                raise DuplicateKeyError("duplicate")
            self.rows[document["_id"]] = deepcopy(document)


@pytest.fixture(params=["sqlite", "mongo"])
def harness(tmp_path, request):
    identity = AuthService(LocalUserCollection(tmp_path / "auth.db"), "test-secret")
    users, headers = {}, {}
    for name, role in (("admin", "admin"), ("worker", "staff"), ("other", "staff"), ("regular", "user"), ("reviewer", "admin")):
        identifier = identity.collection.insert_one({"username": name, "username_normalized": name,
            "role": role, "password_hash": "untouched", "is_active": True}).inserted_id
        users[name] = {"id": str(identifier), "username": name, "role": role}
        headers[name] = {"Authorization": "Bearer " + identity.create_token(users[name])}
    store = identity.collection if request.param == "sqlite" else SimpleNamespace(database=SimpleNamespace(gp_work_tasks=TasksMongo()))
    repo = WorkTasksRepository(store)
    clock = [datetime(2026, 10, 26, 5, 30, tzinfo=timezone.utc)]
    service = WorkTasksService(repo, identity, clock=lambda: clock[0])
    app = FastAPI()
    app.include_router(work_tasks.router, prefix="/api/v1")
    app.dependency_overrides[auth.get_auth_service] = lambda: identity
    app.dependency_overrides[work_tasks.get_tasks_service] = lambda: service
    return SimpleNamespace(client=TestClient(app), identity=identity, repo=repo, service=service,
                           users=users, headers=headers, clock=clock, local=repo.local)


def call(h, method, path="", name="worker", body=None):
    return h.client.request(method, PREFIX + path, headers=h.headers[name] if name else {},
                            **({"json": body} if body is not None else {}))


def create(h, name="worker", **fields):
    body = {"title": "گزارش روزانه", **({"assignee_id": "2"} if name in {"admin", "reviewer"} else {}), **fields}
    response = call(h, "POST", name=name, body=body)
    assert response.status_code == 201, response.text
    return response.json()


def action(h, task, command, name="worker", **fields):
    return call(h, "POST", f"/{task['id']}/{command}", name, {"revision": task["revision"], **fields})


@pytest.mark.parametrize("method,path,body,admin_only", [
    ("GET", "", None, False), ("POST", "", {"title": "work"}, False),
    ("GET", "/some-id", None, False), ("GET", "/notifications", None, False),
    ("POST", "/notifications/work/event/read", None, False),
    ("PUT", "/some-id", {"revision": 1, "title": "edited"}, False),
    ("POST", "/some-id/start", {"revision": 1}, False),
    ("POST", "/some-id/submit", {"revision": 1}, False),
    ("POST", "/some-id/comments", {"text": "hello"}, False),
    ("GET", "/people", None, True),
    ("POST", "/some-id/review", {"revision": 1, "decision": "approved"}, True),
    ("POST", "/some-id/cancel", {"revision": 1}, True),
    ("POST", "/some-id/reopen", {"revision": 1, "reason": "again"}, True),
])
def test_role_boundaries(harness, method, path, body, admin_only):
    h = harness
    assert call(h, method, path, None, body).status_code == 401
    assert call(h, method, path, "regular", body).status_code == 403
    if admin_only:
        assert call(h, method, path, "worker", body).status_code == 403


def test_defaults_creator_identity_and_assignment_are_enforced(harness):
    h = harness
    task = create(h)
    assert task["assignee"] == {"id": "2", "username": "worker"}
    assert task["created_by"] == task["assignee"]
    assert task["created_at"] == "2026-10-26T05:30:00Z"
    assert task["requires_approval"] and task["priority"] == "normal" and task["visibility"] == "team"
    assert call(h, "GET", f"/{task['id']}", "other").status_code == 200
    assert call(h, "POST", body={"title": "x", "assignee_id": "3"}).status_code == 403
    assert call(h, "POST", body={"title": "x", "requires_approval": False}).status_code == 403
    assert call(h, "POST", body={"title": "x", "created_by": {"id": "1", "username": "admin"}}).status_code == 422
    assert call(h, "POST", body={"title": "   "}).status_code == 422
    assert call(h, "POST", name="admin", body={"title": "x"}).status_code == 422
    assert call(h, "POST", name="admin", body={"title": "x", "assignee_id": "4"}).status_code == 422
    admins_work = create(h, "admin")
    assert admins_work["visibility"] == "team"
    assert admins_work["created_by"]["id"] == "1" and admins_work["assignee"]["id"] == "2"
    assert "storage_revision" not in task
    assert "recipients" not in task["history"][0] and "read_by" not in task["history"][0]
    assert h.identity.collection.find_one({"_id": 1})["role"] == "admin"


def test_restricted_work_does_not_leak_via_search_counts_notifications_or_actions(harness):
    h = harness
    task = create(h, "admin", title="SECRET INTERNAL TITLE", visibility="restricted")
    for suffix in ("?view=mine", "?view=team", "?search=SECRET", "?deadline=overdue"):
        response = call(h, "GET", suffix, "other")
        assert response.status_code == 200
        assert response.json()["items"] == [] and response.json()["total"] == 0
        assert response.json()["counts"] == {"mine": 0, "team": 0, "all": None, "pending": None}
        assert "SECRET" not in response.text
    assert call(h, "GET", f"/{task['id']}", "other").status_code == 404
    assert call(h, "GET", "?view=all", "other").status_code == 403
    assert call(h, "GET", "?view=pending", "other").status_code == 403
    assert call(h, "GET", "?assignee_id=2", "other").status_code == 403
    assert call(h, "POST", f"/{task['id']}/comments", "other", {"text": "x"}).status_code == 404
    assert call(h, "PUT", f"/{task['id']}", "other", {"revision": 1, "visibility": "team"}).status_code == 404
    assert action(h, task, "start", "other").status_code == 404
    assert action(h, task, "submit", "other").status_code == 404
    assert call(h, "GET", "/notifications", "other").json() == {"items": [], "unread_count": 0}
    assert call(h, "GET", "?view=all", "admin").json()["total"] == 1


def test_team_view_is_internal_and_other_employees_are_read_only(harness):
    h = harness
    task = create(h, "admin", visibility="team")
    detail = call(h, "GET", f"/{task['id']}", "other")
    assert detail.status_code == 200
    assert not any(detail.json()["permissions"].values())
    assert call(h, "GET", "?view=team", "other").json()["total"] == 1
    assert action(h, task, "start", "other").status_code == 403
    assert action(h, task, "submit", "other").status_code == 403
    assert call(h, "POST", f"/{task['id']}/comments", "other", {"text": "viewer"}).status_code == 403
    assert call(h, "PUT", f"/{task['id']}", "other", {"revision": 1, "title": "viewer edit"}).status_code == 403
    assert call(h, "GET", f"/{task['id']}", "regular").status_code == 403
    assert call(h, "GET", "/notifications", "other").json()["unread_count"] == 0
    assert action(h, task, "start", "admin").status_code == 403  # Only the assignee starts/delivers.


def test_creator_edits_before_first_submission_visibility_and_admin_management(harness):
    h = harness
    task = create(h)
    updated = call(h, "PUT", f"/{task['id']}", body={"revision": task["revision"], "title": "ویرایش", "description": "شرح کار", "expected_output": "خروجی", "priority": "high", "due_date": "2026-10-27", "visibility": "team"})
    assert updated.status_code == 200
    task = updated.json()
    assert task["title"] == "ویرایش" and task["visibility"] == "team"
    assert call(h, "PUT", f"/{task['id']}", body={"revision": task["revision"], "requires_approval": True}).status_code == 403
    assert call(h, "PUT", f"/{task['id']}", body={"revision": task["revision"], "assignee_id": "2"}).status_code == 403
    pending = action(h, task, "submit").json()
    assert call(h, "PUT", f"/{task['id']}", body={"revision": pending["revision"], "title": "too late"}).status_code == 403
    changed = call(h, "PUT", f"/{task['id']}", body={"revision": pending["revision"], "visibility": "restricted"})
    assert changed.status_code == 200
    assert call(h, "GET", f"/{task['id']}", "other").status_code == 404
    admin_edit = call(h, "PUT", f"/{task['id']}", "admin", {"revision": changed.json()["revision"], "title": "مدیر"})
    assert admin_edit.status_code == 200
    assert call(h, "PUT", f"/{task['id']}", "admin", {"revision": admin_edit.json()["revision"], "created_by": {"id": "3"}}).status_code == 422
    assigned = create(h, "admin")
    assert call(h, "PUT", f"/{assigned['id']}", body={"revision": 1, "title": "not creator"}).status_code == 403
    assert call(h, "POST", f"/{assigned['id']}/comments", body={"text": "پرسش درباره کار"}).status_code == 201


def test_direct_delivery_approval_and_admin_review_delay_do_not_mark_delivery_late(harness):
    h = harness
    task = create(h, "admin", due_date="2026-10-26")
    pending_response = action(h, task, "submit")
    assert pending_response.status_code == 200
    pending = pending_response.json()
    assert pending["state"] == "awaiting_approval" and pending["completed_at"] is None
    assert pending["delivered_late"] is False and not pending["overdue"]
    assert call(h, "GET", "?view=pending", "admin").json()["counts"]["pending"] == 1
    assert call(h, "GET", "?status=completed").json()["total"] == 0
    h.clock[0] += timedelta(days=4)
    waiting = call(h, "GET", f"/{task['id']}").json()
    assert not waiting["overdue"] and waiting["delivered_late"] is False
    assert call(h, "GET", "?deadline=overdue").json()["total"] == 0
    response = action(h, pending, "review", "reviewer", decision="approved")
    assert response.status_code == 200, response.text
    done = response.json()
    assert done["state"] == "completed" and done["completion_mode"] == "approved"
    assert done["approved_by"] == {"id": "5", "username": "reviewer"}
    assert done["submitted_at"] == pending["submitted_at"] != done["approved_at"]
    assert done["submissions"][0]["delivered_late"] is False
    assert call(h, "GET").json()["total"] == 0
    assert call(h, "GET", "?status=completed").json()["total"] == 1
    assert action(h, pending, "review", "admin", decision="approved").status_code == 409


def test_revision_request_reason_and_resubmission_preserve_previous_results(harness):
    h = harness
    task = create(h, "admin")
    started = action(h, task, "start")
    assert started.status_code == 200 and started.json()["state"] == "in_progress"
    pending = action(h, started.json(), "submit", note="خروجی اول", result_url="https://example.com/first").json()
    assert action(h, pending, "review", "admin", decision="changes_requested", reason="  ").status_code == 422
    returned = action(h, pending, "review", "admin", decision="changes_requested", reason="اصلاح خروجی لازم است")
    assert returned.status_code == 200
    returned = returned.json()
    assert returned["state"] == "in_progress"
    h.clock[0] += timedelta(hours=2)
    again = action(h, returned, "submit", note="خروجی اصلاح‌شده", result_url="https://example.com/final").json()
    assert len(again["submissions"]) == 2
    assert again["first_submitted_at"] == pending["first_submitted_at"]
    assert again["submissions"][0]["note"] == "خروجی اول"
    assert again["submissions"][0]["review_status"] == "changes_requested"
    assert again["submissions"][1]["review_status"] == "pending"
    assert action(h, again, "review", "admin", decision="approved").status_code == 200


def test_no_approval_completion_reopen_and_cancellation_have_distinct_history(harness):
    h = harness
    task = create(h, "admin", requires_approval=False)
    done = action(h, task, "submit").json()
    assert done["state"] == "completed" and done["completion_mode"] == "no_approval"
    assert done["approved_by"] is None and done["approved_at"] is None
    assert done["submissions"][0]["review_status"] == "not_required"
    assert action(h, done, "reopen", "admin", reason=" ").status_code == 422
    opened = action(h, done, "reopen", "admin", reason="ادامه کار لازم است").json()
    assert opened["state"] == "in_progress" and opened["completed_at"] is None
    assert len(opened["submissions"]) == 1
    assert opened["history"][-1]["details"]["previous_completion_mode"] == "no_approval"
    cancelled = action(h, opened, "cancel", "admin").json()
    assert cancelled["state"] == "cancelled" and cancelled["completion_mode"] is None
    assert call(h, "GET").json()["total"] == 0
    assert call(h, "GET", "?status=cancelled").json()["total"] == 1
    assert call(h, "GET", "?status=completed").json()["total"] == 0
    assert action(h, cancelled, "submit").status_code == 403


def test_admin_turning_off_approval_after_submission_records_explicit_completion(harness):
    h = harness
    pending = action(h, create(h, "admin"), "submit").json()
    response = call(h, "PUT", f"/{pending['id']}", "admin", {"revision": pending["revision"], "requires_approval": False})
    assert response.status_code == 200
    result = response.json()
    assert result["state"] == "completed" and result["completion_mode"] == "no_approval"
    assert result["history"][-1]["kind"] == "completed_without_approval"
    assert result["submitted_at"] == pending["submitted_at"]


def test_deadline_filters_search_priority_and_assignee_filters(harness):
    h = harness
    late = create(h, "admin", title="گزارش عقب‌افتاده", due_date="2026-10-25", priority="high")
    create(h, "admin", title="گزارش امروز", due_date="2026-10-26", assignee_id="3")
    create(h, "admin", title="بدون مهلت")
    assert call(h, "GET", "?view=all&deadline=overdue", "admin").json()["items"][0]["id"] == late["id"]
    assert call(h, "GET", "?view=all&deadline=today", "admin").json()["total"] == 1
    assert call(h, "GET", "?view=all&deadline=no_due", "admin").json()["total"] == 1
    assert call(h, "GET", "?view=all&assignee_id=3", "admin").json()["total"] == 1
    assert call(h, "GET", "?view=all&due_from=2026-10-25&due_to=2026-10-26", "admin").json()["total"] == 2
    assert call(h, "GET", "?view=all&search=NOT-FOUND", "admin").json()["total"] == 0
    assert call(h, "GET", "?due_from=2026-10-27&due_to=2026-10-25").status_code == 422
    assert call(h, "GET", "?view=all&limit=1&offset=1", "admin").json()["total"] == 3
    pending = action(h, late, "submit").json()
    assert pending["delivered_late"] is True and not pending["overdue"]


def test_notifications_related_people_read_receipts_and_permission_revocation(harness):
    h = harness
    task = create(h, "admin", visibility="team")
    notices = call(h, "GET", "/notifications").json()
    assert notices["unread_count"] == 1 and notices["items"][0]["kind"] == "created"
    notice = notices["items"][0]
    assert call(h, "POST", f"/notifications/{task['id']}/{notice['id']}/read").status_code == 200
    assert call(h, "GET", "/notifications").json()["unread_count"] == 0
    assert call(h, "GET", f"/{task['id']}").json()["revision"] == task["revision"]
    pending = action(h, task, "submit").json()  # Receipt did not invalidate this revision.
    assert call(h, "GET", "/notifications", "admin").json()["unread_count"] == 1
    assert call(h, "GET", "/notifications", "reviewer").json()["unread_count"] == 1
    assert call(h, "GET", "/notifications", "other").json()["unread_count"] == 0
    commented = call(h, "POST", f"/{task['id']}/comments", "reviewer", {"text": "توضیح جدید"}).json()
    assert any(item["kind"] == "commented" for item in call(h, "GET", "/notifications").json()["items"])
    assert not any(item["kind"] == "commented" for item in call(h, "GET", "/notifications", "reviewer").json()["items"])
    changed = call(h, "PUT", f"/{task['id']}", "admin", {"revision": commented["revision"], "assignee_id": "3", "visibility": "restricted"})
    assert changed.status_code == 200
    assert call(h, "GET", "/notifications").json() == {"items": [], "unread_count": 0}
    assert call(h, "GET", f"/{task['id']}").status_code == 404
    assert call(h, "POST", f"/notifications/{task['id']}/{notice['id']}/read").status_code == 404
    assert call(h, "GET", "/notifications", "other").json()["unread_count"] == 1


@pytest.mark.parametrize("link", ["javascript:alert(1)", "data:text/html,x", "file:///tmp/x", "//example.com", "https://user:pass@example.com", "https://[invalid", "https://example.com/\nfile"])
def test_unsafe_result_links_are_rejected(harness, link):
    h = harness
    task = create(h)
    assert action(h, task, "submit", result_url=link).status_code == 422


def test_stale_mutations_and_concurrent_reviews_preserve_one_decision(harness):
    h = harness
    pending = action(h, create(h), "submit").json()
    def review():
        try:
            h.service.review(h.users["admin"], pending["id"], TaskReview(revision=pending["revision"], decision="approved"))
            return 200
        except WorkplaceError as exc:
            return exc.status_code
    with ThreadPoolExecutor(max_workers=2) as pool:
        statuses = list(pool.map(lambda _: review(), range(2)))
    assert sorted(statuses) == [200, 409]
    saved = h.repo.get(pending["id"])
    assert len([event for event in saved["events"] if event["kind"] == "approved"]) == 1
    before = deepcopy(saved)
    assert call(h, "PUT", f"/{pending['id']}", "admin", {"revision": 1, "title": "stale"}).status_code == 409
    assert h.repo.get(pending["id"]) == before


def test_concurrent_comments_and_restart_preserve_messages_and_notifications(harness):
    h = harness
    task = create(h)
    def comment(name):
        return h.service.comment(h.users[name], task["id"], TaskCommentInput(text=name))
    with ThreadPoolExecutor(max_workers=2) as pool:
        list(pool.map(comment, ["worker", "admin"]))
    saved = h.repo.get(task["id"])
    assert {item["text"] for item in saved["comments"]} == {"worker", "admin"}
    assert saved["revision"] == 3
    if h.local:
        restarted = WorkTasksService(WorkTasksRepository(LocalUserCollection(h.identity.collection.database_path)), h.identity)
        assert len(restarted.get(h.users["worker"], task["id"])["comments"]) == 2
        assert restarted.notifications(h.users["worker"])["unread_count"] == 1


def test_live_roles_and_sanitized_storage_errors(harness, monkeypatch):
    h = harness
    task = create(h, visibility="team")
    h.identity.collection.update_one({"_id": 3}, {"$set": {"role": "user"}})
    assert call(h, "GET", f"/{task['id']}", "other").status_code == 403
    def unavailable():
        raise ServerSelectionTimeoutError("mongodb://private:secret@internal")
    monkeypatch.setattr(h.repo, "all", unavailable)
    response = call(h, "GET")
    assert response.status_code == 503 and "secret" not in response.text and "mongodb" not in response.text


def test_creator_keeps_restricted_access_after_admin_reassignment(harness):
    h = harness
    task = create(h, visibility="restricted")
    changed = call(h, "PUT", f"/{task['id']}", "admin", {"revision": 1, "assignee_id": "3"})
    assert changed.status_code == 200
    creator = call(h, "GET", f"/{task['id']}").json()
    assert creator["created_by"]["id"] == "2" and creator["assignee"]["id"] == "3"
    assert creator["permissions"]["comment"] and creator["permissions"]["change_visibility"]
    assert not creator["permissions"]["start"] and not creator["permissions"]["submit"]
    assert call(h, "POST", f"/{task['id']}/comments", body={"text": "توضیح ایجادکننده"}).status_code == 201


def test_only_admin_can_remove_approval_from_employee_created_work(harness):
    h = harness
    task = create(h)
    changed = call(h, "PUT", f"/{task['id']}", "admin", {"revision": 1, "requires_approval": False})
    assert changed.status_code == 200
    assert changed.json()["created_by"]["id"] == "2"
    done = action(h, changed.json(), "submit")
    assert done.status_code == 200 and done.json()["completion_mode"] == "no_approval"


def test_cancel_pending_review_and_reopen_approved_work_keep_review_history(harness):
    h = harness
    pending = action(h, create(h), "submit").json()
    cancelled = action(h, pending, "cancel", "admin", reason="کار متوقف شد")
    assert cancelled.status_code == 200
    assert cancelled.json()["submissions"][0]["review_status"] == "cancelled"
    assert call(h, "GET", "?view=pending", "admin").json()["total"] == 0
    another = action(h, create(h), "submit").json()
    approved = action(h, another, "review", "reviewer", decision="approved").json()
    opened = action(h, approved, "reopen", "admin", reason="بازبینی خروجی لازم است").json()
    assert opened["approved_at"] is None and opened["approved_by"] is None
    assert opened["submissions"][0]["reviewed_by"]["id"] == "5"
    assert opened["submissions"][0]["reviewed_at"] == approved["approved_at"]
    assert call(h, "PUT", f"/{opened['id']}", body={"revision": opened["revision"], "title": "locked after first submission"}).status_code == 403


def test_older_unread_notifications_remain_reachable_and_receipts_are_idempotent(harness):
    h = harness
    task = create(h, "admin")
    h.clock[0] += timedelta(hours=1)
    comment = call(h, "POST", f"/{task['id']}/comments", "admin", {"text": "توضیح مدیر"}).json()
    latest = call(h, "GET", "/notifications?limit=1").json()["items"][0]
    assert latest["kind"] == "commented"
    path = f"/notifications/{task['id']}/{latest['id']}/read"
    assert call(h, "POST", path).status_code == 200
    assert call(h, "POST", path).status_code == 200
    remaining = call(h, "GET", "/notifications?limit=1").json()
    assert remaining["unread_count"] == 1 and remaining["items"][0]["kind"] == "created"
    assert call(h, "GET", f"/{task['id']}").json()["revision"] == comment["revision"]
    assert call(h, "GET").headers["cache-control"] == "no-store"


def test_full_app_work_and_attendance_coexist(harness, monkeypatch):
    from src import main
    from src.services.workplace import WorkplaceService
    from src.services.workplace_repository import WorkplaceRepository
    h = harness
    for factory in ("create_daily_analysis_scheduler", "create_news_scheduler", "create_official_sentiment_scheduler", "create_work_task_notification_scheduler"):
        monkeypatch.setattr(main, factory, lambda: None)
    app = main.create_app()
    app.dependency_overrides[auth.get_auth_service] = lambda: h.identity
    attendance = WorkplaceService(WorkplaceRepository(h.identity.collection), h.identity, clock=lambda: h.clock[0])
    app.dependency_overrides[workplace.get_workplace_service] = lambda: attendance
    with TestClient(app) as client:
        assert client.get("/health").status_code == 200
        assert client.get("/api/v1/system/health").status_code == 200
        entry = client.post("/api/v1/workplace/me/clock-in", headers=h.headers["worker"])
        assert entry.status_code == 201
        task = client.post(PREFIX, headers=h.headers["worker"], json={"title": "کار هنگام حضور"})
        assert task.status_code == 201
        submitted = client.post(PREFIX + f"/{task.json()['id']}/submit", headers=h.headers["worker"], json={"revision": 1})
        assert submitted.status_code == 200
        h.clock[0] += timedelta(hours=1)
        exit_response = client.post("/api/v1/workplace/me/clock-out", headers=h.headers["worker"], json={"session_id": entry.json()["id"], "revision": 1, "activities": "حضور مستقل از کارها"})
        assert exit_response.status_code == 200
        assert exit_response.json()["check_in"] == entry.json()["check_in"]
        assert client.get(PREFIX + "?view=pending", headers=h.headers["admin"]).json()["total"] == 1
