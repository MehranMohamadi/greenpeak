"""Offline attendance coverage, role isolation, races and Tehran boundaries."""

from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from datetime import date, datetime, timedelta, timezone
from types import SimpleNamespace
from threading import Lock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pymongo.errors import DuplicateKeyError, ServerSelectionTimeoutError

from src.api.v1.endpoints import auth, workplace
from src.services.auth import AuthService, LocalUserCollection
from src.services.workplace import WorkplaceService
from src.services.workplace_repository import WorkplaceError, WorkplaceRepository

UTC = timezone.utc
PREFIX = "/api/v1/workplace"
RANGE = "?start_date=2026-10-23&end_date=2026-11-21"  # Aban 1405


class MemoryMongo:
    """Implement only Mongo operations used by the workplace repository."""
    def __init__(self):
        self.rows, self.indexes, self.guard = {}, [], Lock()

    def create_index(self, keys, **kwargs):
        self.indexes.append((keys, kwargs))

    @staticmethod
    def matches(row, query):
        for key, value in query.items():
            if isinstance(value, dict):
                if "$lte" in value and row[key] > value["$lte"]:
                    return False
                if "$gt" in value and row[key] <= value["$gt"]:
                    return False
            elif row.get(key) != value:
                return False
        return True

    def find(self, query):
        with self.guard:
            return deepcopy([row for row in self.rows.values() if self.matches(row, query)])

    def find_one(self, query):
        return next(iter(self.find(query)), None)

    def find_one_and_update(self, query, update, **kwargs):
        with self.guard:
            row = self.rows.get(query["_id"])
            if row and not self.matches(row, query):
                raise DuplicateKeyError("lease held")
            self.rows[query["_id"]] = {"_id": query["_id"], **deepcopy(update["$set"])}
            return deepcopy(self.rows[query["_id"]])

    def insert_one(self, document):
        with self.guard:
            if document["_id"] in self.rows or (document["check_out"] is None and any(
                row["user_id"] == document["user_id"] and row["check_out"] is None for row in self.rows.values())):
                raise DuplicateKeyError("open interval")
            self.rows[document["_id"]] = deepcopy(document)

    def replace_one(self, query, document):
        with self.guard:
            row = self.rows.get(query["_id"])
            matched = bool(row and self.matches(row, query))
            if matched:
                self.rows[query["_id"]] = deepcopy(document)
            return SimpleNamespace(matched_count=int(matched))

    def delete_one(self, query):
        with self.guard:
            if self.rows.get(query["_id"]) and self.matches(self.rows[query["_id"]], query):
                del self.rows[query["_id"]]


@pytest.fixture(params=["sqlite", "mongo"])
def harness(tmp_path, request):
    identity = AuthService(LocalUserCollection(tmp_path / "auth.db"), "test-secret")
    users, headers = {}, {}
    for name, role in (("admin", "admin"), ("employee", "staff"), ("developer", "staff"), ("member", "user")):
        identifier = identity.collection.insert_one({"username": name, "username_normalized": name,
            "role": role, "password_hash": "unchanged", "is_active": True, "can_view_premium_analysis": name == "employee"}).inserted_id
        users[name] = {"id": str(identifier), "username": name, "role": role}
        headers[name] = {"Authorization": "Bearer " + identity.create_token(users[name])}
    if request.param == "mongo":
        database = SimpleNamespace(gp_work_sessions=MemoryMongo(), gp_workplace_locks=MemoryMongo())
        repo = WorkplaceRepository(SimpleNamespace(database=database))
    else:
        repo = WorkplaceRepository(identity.collection)
    clock = [datetime(2026, 10, 25, 5, 30, tzinfo=UTC)]  # 09:00 Tehran
    service = WorkplaceService(repo, identity, clock=lambda: clock[0])
    app = FastAPI()
    app.include_router(auth.router, prefix="/api/v1")
    app.include_router(workplace.router, prefix="/api/v1")
    app.dependency_overrides[auth.get_auth_service] = lambda: identity
    app.dependency_overrides[workplace.get_workplace_service] = lambda: service
    return SimpleNamespace(client=TestClient(app), service=service, identity=identity, repo=repo, users=users, headers=headers, clock=clock)


def call(h, method, path, name="employee", body=None):
    return h.client.request(method, PREFIX + path, headers=h.headers[name] if name else {}, **({"json": body} if body is not None else {}))


def start(h, name="employee"):
    response = call(h, "POST", "/me/clock-in", name)
    assert response.status_code == 201, response.text
    return response.json()


def close(h, session, hours=1, name="employee", activities="task one\ntask two"):
    h.clock[0] += timedelta(hours=hours)
    response = call(h, "POST", "/me/clock-out", name, {"session_id": session["id"], "revision": session["revision"], "activities": activities})
    assert response.status_code == 200, response.text
    return response.json()


@pytest.mark.parametrize("method,path,body,admin_only", [
    ("GET", "/me/report" + RANGE, None, False),
    ("POST", "/me/clock-in", None, False),
    ("POST", "/me/clock-out", {"session_id": "x", "revision": 1, "activities": ""}, False),
    ("PUT", "/me/sessions/x/activities", {"revision": 1, "activities": ""}, False),
    ("POST", "/me/sessions/x/corrections", {"revision": 1, "check_in": "2026-10-24T05:00:00Z", "check_out": None, "reason": "test"}, False),
    ("GET", "/admin/employees" + RANGE, None, True),
    ("GET", "/admin/employees/1/report" + RANGE, None, True),
    ("GET", "/admin/corrections", None, True),
    ("PUT", "/admin/sessions/x/times", {"revision": 1, "check_in": "2026-10-24T05:00:00Z", "check_out": None, "reason": "test"}, True),
    ("POST", "/admin/sessions/x/corrections/y/review", {"decision": "approved"}, True),
    ("POST", "/admin/employees/2/sessions", {"check_in": "2026-10-24T05:00:00Z", "check_out": None, "reason": "test"}, True),
])
def test_role_boundaries(harness, method, path, body, admin_only):
    h = harness
    assert call(h, method, path, None, body).status_code == 401
    assert call(h, method, path, "member", body).status_code == 403
    if admin_only:
        assert call(h, method, path, "employee", body).status_code == 403


def test_server_clock_multiple_intervals_activities_and_persistence(harness):
    h = harness
    first = start(h)
    assert first["check_in"] == "2026-10-25T05:30:00Z"
    assert call(h, "POST", "/me/clock-in").status_code == 409
    saved = call(h, "PUT", f"/me/sessions/{first['id']}/activities", body={"revision": 1, "activities": "first\nsecond"})
    assert saved.status_code == 200
    first = close(h, saved.json(), 2)
    assert call(h, "POST", "/me/clock-out", body={"session_id": first["id"], "revision": first["revision"], "activities": ""}).status_code == 409
    h.clock[0] += timedelta(hours=1)
    second = close(h, start(h), 3)
    report = call(h, "GET", "/me/report" + RANGE)
    assert report.headers["cache-control"] == "no-store"
    data = report.json()
    assert data["total_seconds"] == 5 * 3600
    assert len(data["days"]) == 1 and len(data["days"][0]["entries"]) == 2
    assert data["active_session"] is None
    assert len(data["sessions"]) == 2
    own = h.repo.get(second["id"])
    assert own["activities"] == "task one\ntask two"
    assert own["audit"][-1]["actor"]["username"] == "employee"
    if h.repo.local:
        restarted = WorkplaceRepository(LocalUserCollection(h.identity.collection.database_path))
        assert restarted.get(second["id"])["activities"] == own["activities"]


def test_ownership_stale_writes_and_live_role_revocation(harness):
    h = harness
    session = start(h)
    other = start(h, "developer")
    assert call(h, "GET", "/me/report" + RANGE, "developer").json()["sessions"][0]["id"] == other["id"]
    assert call(h, "PUT", f"/me/sessions/{session['id']}/activities", "developer", {"revision": 1, "activities": "stolen"}).status_code == 404
    assert call(h, "POST", "/me/clock-out", "developer", {"session_id": session["id"], "revision": 1, "activities": ""}).status_code == 404
    assert call(h, "POST", f"/me/sessions/{session['id']}/corrections", "developer", {"revision": 1, "check_in": session["check_in"], "check_out": None, "reason": "test"}).status_code == 404
    response = call(h, "PUT", f"/me/sessions/{session['id']}/activities", body={"revision": 1, "activities": "new"})
    assert response.status_code == 200
    assert call(h, "PUT", f"/me/sessions/{session['id']}/activities", body={"revision": 1, "activities": "stale"}).status_code == 409
    h.identity.collection.update_one({"_id": 2}, {"$set": {"role": "user"}})
    assert call(h, "GET", "/me/report" + RANGE).status_code == 403
    assert call(h, "GET", "/admin/employees/2/report" + RANGE, "admin").status_code == 200


def test_request_approval_is_atomic_audited_and_cannot_be_replayed(harness):
    h = harness
    session = close(h, start(h), 2)
    payload = {"revision": session["revision"], "check_in": "2026-10-25T05:00:00Z", "check_out": session["check_out"], "reason": "ورود ثبت نشده بود"}
    response = call(h, "POST", f"/me/sessions/{session['id']}/corrections", body=payload)
    assert response.status_code == 201, response.text
    pending = response.json()
    assert pending["check_in"] == session["check_in"]
    payload["revision"] = pending["revision"]
    assert call(h, "POST", f"/me/sessions/{session['id']}/corrections", body=payload).status_code == 409
    queue = call(h, "GET", "/admin/corrections", "admin").json()["requests"]
    assert len(queue) == 1
    url = f"/admin/sessions/{session['id']}/corrections/{queue[0]['request']['id']}/review"
    approved = call(h, "POST", url, "admin", {"decision": "approved", "note": "تأیید مدیر"})
    assert approved.status_code == 200, approved.text
    row = approved.json()
    assert row["check_in"] == payload["check_in"]
    assert row["requests"][0]["status"] == "approved"
    assert row["requests"][0]["reviewed_by"]["username"] == "admin"
    assert row["audit"][-1]["before"]["check_in"] == session["check_in"]
    assert row["audit"][-1]["actor"]["id"] == "1"
    assert call(h, "POST", url, "admin", {"decision": "approved"}).status_code == 409
    assert call(h, "GET", "/me/report" + RANGE).json()["total_seconds"] == 9000


def test_changed_times_require_rejection_and_do_not_overwrite_notes(harness):
    h = harness
    session = close(h, start(h))
    response = call(h, "POST", f"/me/sessions/{session['id']}/corrections", body={"revision": session["revision"], "check_in": "2026-10-25T05:00:00Z", "check_out": session["check_out"], "reason": "اصلاح ورود"})
    pending = response.json()
    corrected = call(h, "PUT", f"/admin/sessions/{session['id']}/times", "admin", {"revision": pending["revision"], "check_in": "2026-10-25T04:00:00Z", "check_out": session["check_out"], "reason": "تغییر ساعت مدیر"})
    assert corrected.status_code == 200
    url = f"/admin/sessions/{session['id']}/corrections/{pending['requests'][0]['id']}/review"
    assert call(h, "POST", url, "admin", {"decision": "approved"}).status_code == 409
    rejected = call(h, "POST", url, "admin", {"decision": "rejected", "note": "اطلاعات تغییر کرده"})
    assert rejected.status_code == 200
    assert rejected.json()["check_in"] == "2026-10-25T04:00:00Z"
    assert rejected.json()["activities"] == session["activities"]


def test_tehran_midnight_month_clipping_and_open_session_outside_selected_month(harness):
    h = harness
    h.clock[0] = datetime(2026, 10, 22, 20, tzinfo=UTC)  # 23:30 Mehr 30
    session = start(h)
    close(h, session, 2)  # 01:30 Aban 1
    report = call(h, "GET", "/me/report" + RANGE).json()
    assert report["total_seconds"] == 5400
    assert report["days"][0]["date"] == "2026-10-23"
    assert report["sessions"][0]["check_in"].startswith("2026-10-22")
    full = call(h, "GET", "/me/report?start_date=2026-10-22&end_date=2026-10-23").json()
    assert [day["seconds"] for day in full["days"]] == [5400, 1800]
    h.clock[0] = datetime(2026, 10, 24, 8, tzinfo=UTC)
    active = start(h)
    h.clock[0] += timedelta(hours=1)
    past = call(h, "GET", "/me/report?start_date=2026-09-23&end_date=2026-10-22").json()
    assert past["active_session"]["id"] == active["id"]
    current = call(h, "GET", "/me/report" + RANGE).json()
    assert current["total_seconds"] == 9000


def test_invalid_periods_overlap_and_naive_dates_are_rejected(harness):
    h = harness
    first = close(h, start(h))
    h.clock[0] += timedelta(hours=1)
    second = close(h, start(h))
    base = {"revision": second["revision"], "check_in": first["check_in"], "check_out": second["check_out"], "reason": "اصلاح ساعت"}
    url = f"/admin/sessions/{second['id']}/times"
    assert call(h, "PUT", url, "admin", base).status_code == 409
    assert call(h, "PUT", url, "admin", {**base, "check_in": second["check_out"]}).status_code == 422
    assert call(h, "PUT", url, "admin", {**base, "check_in": "2030-01-01T00:00:00Z"}).status_code == 422
    assert call(h, "PUT", url, "admin", {**base, "check_in": "2026-10-25T00:00:00"}).status_code == 422
    assert call(h, "GET", "/me/report?start_date=2026-01-01&end_date=2026-12-31").status_code == 422
    assert call(h, "GET", "/me/report?start_date=2026-10-25&end_date=2026-10-24").status_code == 422
    assert call(h, "GET", "/me/report?start_date=9999-12-31&end_date=9999-12-31").status_code == 422
    assert call(h, "GET", "/me/report?start_date=0001-01-01&end_date=0001-01-01").status_code == 422
    assert h.repo.get(second["id"])["check_in"] == second["check_in"]


def test_staff_assignment_preserves_existing_admin_and_analysis_access(harness):
    h = harness
    def role(identifier, value, name="admin"):
        return h.client.put(f"/api/v1/auth/users/{identifier}/staff-role", headers=h.headers[name], json={"role": value})
    assert role("2", "user", "employee").status_code == 403
    assert role("1", "staff").status_code == 409
    assert role("4", "admin").status_code == 422
    assert role("2", "user").status_code == 200
    assert role("2", "staff").status_code == 200
    assert role("4", "staff").status_code == 200
    assert call(h, "GET", "/me/report" + RANGE, "member").status_code == 200
    assert h.identity.collection.find_one({"_id": 2})["can_view_premium_analysis"] is True
    admin = h.identity.collection.find_one({"_id": 1})
    assert admin["role"] == "admin" and admin["password_hash"] == "unchanged"
    assert len(h.identity.list_users()) == 4
    assert h.client.get("/api/v1/auth/admins", headers=h.headers["admin"]).status_code == 200


def test_manual_entry_admin_report_and_historical_records_survive_role_changes(harness):
    h = harness
    response = call(h, "POST", "/admin/employees/3/sessions", "admin", {"check_in": "2026-10-24T05:00:00Z", "check_out": "2026-10-24T07:00:00Z", "reason": "اصلاح فراموشی", "activities": "توسعه نرم‌افزار"})
    assert response.status_code == 201
    assert response.json()["audit"][0]["actor"]["username"] == "admin"
    start(h)
    h.clock[0] += timedelta(hours=1)
    rows = call(h, "GET", "/admin/employees" + RANGE, "admin").json()["employees"]
    employee = next(row for row in rows if row["username"] == "employee")
    assert employee["present"] and employee["total_seconds"] == 3600
    developer = next(row for row in rows if row["username"] == "developer")
    assert not developer["present"] and developer["total_seconds"] == 7200
    h.identity.collection.update_one({"_id": 3}, {"$set": {"role": "user", "is_active": False, "deleted_at": "deleted"}})
    rows = call(h, "GET", "/admin/employees" + RANGE, "admin").json()["employees"]
    assert next(row for row in rows if row["id"] == "3")["total_seconds"] == 7200
    assert call(h, "GET", "/admin/employees/3/report" + RANGE, "admin").json()["sessions"][0]["activities"] == "توسعه نرم‌افزار"


def test_concurrent_clockins_allow_exactly_one_open_session(harness):
    h = harness
    def attempt():
        try:
            h.service.clock_in(h.users["employee"])
            return 201
        except WorkplaceError as error:
            return error.status_code
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: attempt(), range(2)))
    assert sorted(results) == [201, 409]
    assert len(h.repo.all_sessions("2")) == 1


def test_storage_errors_do_not_expose_connection_details(harness, monkeypatch):
    h = harness
    def unavailable(*args):
        raise ServerSelectionTimeoutError("mongodb://private:secret@internal")
    monkeypatch.setattr(h.repo, "all_sessions", unavailable)
    response = call(h, "GET", "/me/report" + RANGE)
    assert response.status_code == 503
    assert "secret" not in response.text and "mongodb" not in response.text


def test_approval_preserves_activities_edited_after_the_request(harness):
    h = harness
    session = close(h, start(h))
    pending = call(h, "POST", f"/me/sessions/{session['id']}/corrections", body={"revision": session["revision"], "check_in": "2026-10-25T05:00:00Z", "check_out": session["check_out"], "reason": "اصلاح ورود"}).json()
    updated = call(h, "PUT", f"/me/sessions/{session['id']}/activities", body={"revision": pending["revision"], "activities": "آخرین گزارش کار"})
    assert updated.status_code == 200
    url = f"/admin/sessions/{session['id']}/corrections/{pending['requests'][0]['id']}/review"
    approved = call(h, "POST", url, "admin", {"decision": "approved"})
    assert approved.status_code == 200
    assert approved.json()["activities"] == "آخرین گزارش کار"


def test_approval_rechecks_overlap_and_rejected_write_keeps_pending_request(harness):
    h = harness
    session = close(h, start(h))
    pending = call(h, "POST", f"/me/sessions/{session['id']}/corrections", body={"revision": session["revision"], "check_in": "2026-10-25T05:00:00Z", "check_out": session["check_out"], "reason": "اصلاح ورود"}).json()
    assert call(h, "POST", "/admin/employees/2/sessions", "admin", {"check_in": "2026-10-25T04:30:00Z", "check_out": "2026-10-25T05:15:00Z", "reason": "بازه فراموش‌شده"}).status_code == 201
    url = f"/admin/sessions/{session['id']}/corrections/{pending['requests'][0]['id']}/review"
    assert call(h, "POST", url, "admin", {"decision": "approved"}).status_code == 409
    assert h.repo.get(session["id"]) == pending


def test_concurrent_checkouts_do_not_duplicate_time_or_audit(harness):
    h = harness
    session = start(h)
    h.clock[0] += timedelta(hours=1)
    from src.models.workplace import ClockOutInput
    body = ClockOutInput(session_id=session["id"], revision=session["revision"], activities="complete")
    def attempt():
        try:
            h.service.clock_out(h.users["employee"], body)
            return 200
        except WorkplaceError as error:
            return error.status_code
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: attempt(), range(2)))
    assert sorted(results) == [200, 409]
    assert len(h.repo.get(session["id"])["audit"]) == 2


def test_full_application_lifespan_health_and_workplace_routes(harness, monkeypatch):
    h = harness
    from src import main
    for factory in ("create_daily_analysis_scheduler", "create_news_scheduler", "create_official_sentiment_scheduler", "create_work_task_notification_scheduler"):
        monkeypatch.setattr(main, factory, lambda: None)
    app = main.create_app()
    app.dependency_overrides[auth.get_auth_service] = lambda: h.identity
    # Exercise the actual workplace dependency/repository construction as well.
    from src.services.workplace import TEHRAN
    today = datetime.now(TEHRAN).date().isoformat()
    query = f"?start_date={today}&end_date={today}"
    with TestClient(app) as client:
        assert client.get("/health").status_code == 200
        assert client.get("/api/v1/system/health").status_code == 200
        assert client.post(PREFIX + "/me/clock-in", headers=h.headers["employee"]).status_code == 201
        response = client.get(PREFIX + "/me/report" + query, headers=h.headers["employee"])
        assert response.status_code == 200
        assert response.json()["active_session"]["user_id"] == "2"
        assert client.get(PREFIX + "/admin/employees" + query, headers=h.headers["admin"]).status_code == 200


def test_client_clock_and_extra_fields_cannot_override_owner_or_permissions(harness):
    h = harness
    response = call(h, "POST", "/me/clock-in", body={"check_in": "2000-01-01T00:00:00Z", "user_id": "3"})
    assert response.status_code == 201
    session = response.json()
    assert session["check_in"] == "2026-10-25T05:30:00Z" and session["user_id"] == "2"
    assert call(h, "PUT", f"/me/sessions/{session['id']}/activities", body={"revision": 1, "activities": "x", "user_id": "3"}).status_code == 422
    assert call(h, "PUT", f"/me/sessions/{session['id']}/activities", body={"revision": 1, "activities": "x" * 10001}).status_code == 422
    assert h.client.put("/api/v1/auth/users/4/staff-role", headers=h.headers["admin"], json={"role": "staff", "can_view_premium_analysis": True}).status_code == 422
    assert h.repo.get(session["id"])["revision"] == 1
