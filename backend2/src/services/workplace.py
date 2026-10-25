"""Attendance and free-text work logs, independent of financial analytics."""

from collections import defaultdict
from datetime import date, datetime, time, timedelta, timezone
from uuid import uuid4

import pytz

from ..models.workplace import WorkSession
from .workplace_repository import WorkplaceError

TEHRAN = pytz.timezone("Asia/Tehran")


def instant(value):
    try:
        result = datetime.fromisoformat(value) if isinstance(value, str) else value
        if result.tzinfo is None:
            raise WorkplaceError("زمان باید منطقه زمانی مشخص داشته باشد.", 422)
        return result.astimezone(timezone.utc)
    except (OverflowError, ValueError) as exc:
        raise WorkplaceError("زمان واردشده معتبر نیست.", 422) from exc


def times(session):
    return {key: session[key] for key in ("check_in", "check_out")}


def actor_info(actor):
    return {key: actor[key] for key in ("id", "username")}


def bounds(start_date, end_date):
    if end_date < start_date or (end_date - start_date).days > 62 or start_date == date.min or end_date == date.max:
        raise WorkplaceError("بازه گزارش باید حداکثر ۶۳ روز و به ترتیب تاریخ باشد.", 422)
    return (TEHRAN.localize(datetime.combine(start_date, time.min)).astimezone(timezone.utc),
            TEHRAN.localize(datetime.combine(end_date + timedelta(days=1), time.min)).astimezone(timezone.utc))


class WorkplaceService:
    def __init__(self, repository, auth, clock=None):
        self.repository, self.auth = repository, auth
        self.clock = clock or (lambda: datetime.now(timezone.utc))

    def _now(self):
        return instant(self.clock())

    @staticmethod
    def _find(rows, session_id):
        session = next((row for row in rows if row["id"] == session_id), None)
        if not session:
            raise WorkplaceError("بازه حضور پیدا نشد.", 404)
        return session

    @staticmethod
    def _revision(session, revision):
        if session["revision"] != revision:
            raise WorkplaceError("اطلاعات تغییر کرده است؛ ابتدا تازه‌سازی کنید.")

    @staticmethod
    def _reason(reason):
        if len(reason.strip()) < 3:
            raise WorkplaceError("دلیل اصلاح را وارد کنید.", 422)
        return reason.strip()

    @staticmethod
    def _validate_period(check_in, check_out, rows, now, exclude=None):
        start, end = instant(check_in), instant(check_out) if check_out else None
        if start > now or (end and end > now):
            raise WorkplaceError("ثبت زمان آینده مجاز نیست.", 422)
        if end and end <= start:
            raise WorkplaceError("خروج باید بعد از ورود باشد.", 422)
        for row in rows:
            if row["id"] == exclude:
                continue
            other_start = instant(row["check_in"])
            other_end = instant(row["check_out"]) if row["check_out"] else None
            if (end is None or other_start < end) and (other_end is None or start < other_end):
                raise WorkplaceError("این زمان با بازه حضور دیگری هم‌پوشانی دارد.")

    @staticmethod
    def _audit(session, actor, now, action, before=None, after=None, reason=""):
        session["audit"].append({"action": action, "at": now.isoformat(), "actor": actor_info(actor),
                                 "reason": reason, "before": before, "after": after})

    @staticmethod
    def _save(employee, session, previous=None):
        # The persisted document follows the same contract returned by the API.
        validated = WorkSession.model_validate(session).model_dump(mode="json")
        employee.save(validated, previous)
        return validated

    def _new(self, user, check_in, check_out=None, activities=""):
        return {"id": str(uuid4()), "user_id": user["id"], "username": user["username"],
                "check_in": instant(check_in).isoformat(),
                "check_out": instant(check_out).isoformat() if check_out else None,
                "activities": activities, "revision": 1, "requests": [], "audit": []}

    def clock_in(self, actor):
        with self.repository.employee(actor["id"]) as employee:
            rows = employee.all()
            now = self._now()
            self._validate_period(now, None, rows, now)
            session = self._new(actor, now)
            self._audit(session, actor, now, "clock_in", after=times(session))
            return self._save(employee, session)

    def clock_out(self, actor, body):
        with self.repository.employee(actor["id"]) as employee:
            rows = employee.all()
            session = self._find(rows, body.session_id)
            self._revision(session, body.revision)
            if session["check_out"]:
                raise WorkplaceError("خروج این بازه قبلاً ثبت شده است.")
            now = self._now()
            self._validate_period(session["check_in"], now, rows, now, session["id"])
            before = {**times(session), "activities": session["activities"]}
            session.update(check_out=now.isoformat(), activities=body.activities, revision=session["revision"] + 1)
            self._audit(session, actor, now, "clock_out", before,
                        {**times(session), "activities": session["activities"]})
            return self._save(employee, session, body.revision)

    def activities(self, actor, session_id, body):
        with self.repository.employee(actor["id"]) as employee:
            session = self._find(employee.all(), session_id)
            self._revision(session, body.revision)
            before = {"activities": session["activities"]}
            session.update(activities=body.activities, revision=session["revision"] + 1)
            self._audit(session, actor, self._now(), "activities_updated", before, {"activities": body.activities})
            return self._save(employee, session, body.revision)

    def request_correction(self, actor, session_id, body):
        with self.repository.employee(actor["id"]) as employee:
            rows = employee.all()
            session = self._find(rows, session_id)
            self._revision(session, body.revision)
            if any(request["status"] == "pending" for request in session["requests"]):
                raise WorkplaceError("این بازه یک درخواست در انتظار بررسی دارد.")
            now = self._now()
            self._validate_period(body.check_in, body.check_out, rows, now, session_id)
            reason = self._reason(body.reason)
            correction = {"id": str(uuid4()), "check_in": body.check_in.isoformat(),
                          "check_out": body.check_out.isoformat() if body.check_out else None,
                          "reason": reason, "status": "pending", "created_at": now.isoformat(),
                          "requested_by": actor_info(actor), "original": times(session)}
            session["requests"].append(correction)
            session["revision"] += 1
            self._audit(session, actor, now, "correction_requested", after=correction.copy(), reason=reason)
            return self._save(employee, session, body.revision)

    def owner(self, session_id):
        session = self.repository.get(session_id)
        if not session:
            raise WorkplaceError("بازه حضور پیدا نشد.", 404)
        return session["user_id"]

    def correct(self, actor, session_id, body):
        with self.repository.employee(self.owner(session_id)) as employee:
            rows = employee.all()
            session = self._find(rows, session_id)
            self._revision(session, body.revision)
            now = self._now()
            self._validate_period(body.check_in, body.check_out, rows, now, session_id)
            reason = self._reason(body.reason)
            before = times(session)
            session.update(check_in=body.check_in.isoformat(), check_out=body.check_out.isoformat() if body.check_out else None,
                           revision=session["revision"] + 1)
            self._audit(session, actor, now, "admin_time_correction", before, times(session), reason)
            return self._save(employee, session, body.revision)

    def manual_session(self, actor, user_id, body):
        users = {user["id"]: user for user in self.auth.list_users()}
        user = users.get(user_id)
        if not user or user["role"] not in {"staff", "admin"} or not user["is_active"]:
            raise WorkplaceError("کارمند فعال پیدا نشد.", 404)
        with self.repository.employee(user_id) as employee:
            now = self._now()
            self._validate_period(body.check_in, body.check_out, employee.all(), now)
            session = self._new(user, body.check_in, body.check_out, body.activities)
            self._audit(session, actor, now, "admin_session_created", after=times(session), reason=self._reason(body.reason))
            return self._save(employee, session)

    def review(self, actor, session_id, request_id, body):
        with self.repository.employee(self.owner(session_id)) as employee:
            rows = employee.all()
            session = self._find(rows, session_id)
            request = next((item for item in session["requests"] if item["id"] == request_id), None)
            if not request:
                raise WorkplaceError("درخواست پیدا نشد.", 404)
            if request["status"] != "pending":
                raise WorkplaceError("این درخواست قبلاً بررسی شده است.")
            now, revision = self._now(), session["revision"]
            before = times(session)
            if body.decision == "approved":
                original = request["original"]
                if (instant(original["check_in"]) != instant(session["check_in"]) or
                    (instant(original["check_out"]) if original["check_out"] else None) !=
                        (instant(session["check_out"]) if session["check_out"] else None)):
                    raise WorkplaceError("ساعت‌ها پس از درخواست تغییر کرده‌اند؛ درخواست را رد و دوباره بررسی کنید.")
                self._validate_period(request["check_in"], request["check_out"], rows, now, session_id)
                session.update(check_in=request["check_in"], check_out=request["check_out"])
            request.update(status=body.decision, reviewed_at=now.isoformat(), reviewed_by=actor_info(actor), review_note=body.note)
            session["revision"] += 1
            self._audit(session, actor, now, "correction_" + body.decision, before,
                        {**times(session), "request_id": request_id, "review_note": body.note}, request["reason"])
            return self._save(employee, session, revision)

    def pending(self):
        return {"requests": [{"session_id": row["id"], "user_id": row["user_id"], "username": row["username"], "request": request}
                             for row in self.repository.all_sessions() for request in row["requests"] if request["status"] == "pending"]}

    def report(self, user_id, start_date, end_date, rows=None, now=None):
        lower, upper = bounds(start_date, end_date)
        now = now or self._now()
        rows = self.repository.all_sessions(user_id) if rows is None else rows
        days = defaultdict(lambda: {"seconds": 0, "entries": []})
        sessions = []
        for row in sorted(rows, key=lambda item: instant(item["check_in"])):
            start, end = instant(row["check_in"]), instant(row["check_out"]) if row["check_out"] else now
            if start >= upper or end <= lower:
                continue
            sessions.append(row)
            cursor, finish = max(start, lower), min(end, upper, now)
            while cursor < finish:
                day = cursor.astimezone(TEHRAN).date()
                next_midnight = TEHRAN.localize(datetime.combine(day + timedelta(days=1), time.min)).astimezone(timezone.utc)
                segment_end = min(finish, next_midnight)
                seconds = int((segment_end - cursor).total_seconds())
                days[day]["seconds"] += seconds
                days[day]["entries"].append({"session_id": row["id"], "seconds": seconds})
                cursor = segment_end
        return {"user_id": user_id, "start_date": start_date, "end_date": end_date, "generated_at": now,
                "total_seconds": sum(day["seconds"] for day in days.values()),
                "days": [{"date": day, **values} for day, values in sorted(days.items(), reverse=True)],
                "sessions": sessions, "active_session": next((row for row in rows if row["check_out"] is None), None)}

    def employees(self, start_date, end_date):
        bounds(start_date, end_date)
        now = self._now()
        rows = self.repository.all_sessions()
        grouped = defaultdict(list)
        users = {user["id"]: user for user in self.auth.list_users()}
        for row in rows:
            grouped[row["user_id"]].append(row)
            users.setdefault(row["user_id"], {"id": row["user_id"], "username": row["username"], "role": "user", "is_active": False})
        result = []
        for user in users.values():
            if user["role"] not in {"staff", "admin"} and user["id"] not in grouped:
                continue
            sessions = grouped[user["id"]]
            report = self.report(user["id"], start_date, end_date, sessions, now)
            active = report["active_session"]
            result.append({**{key: user[key] for key in ("id", "username", "role", "is_active")},
                           "present": bool(active), "check_in": active["check_in"] if active else None,
                           "total_seconds": report["total_seconds"],
                           "pending_requests": sum(item["status"] == "pending" for session in sessions for item in session["requests"])})
        return {"start_date": start_date, "end_date": end_date, "generated_at": now,
                "employees": sorted(result, key=lambda item: item["username"].casefold())}
