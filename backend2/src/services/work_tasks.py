"""Authorization, review workflow and durable notifications for internal work."""

from datetime import date, datetime, timezone
from hashlib import sha256
import json
import sqlite3
from uuid import NAMESPACE_URL, uuid4, uuid5

from pymongo.errors import DuplicateKeyError

from ..models.work_tasks import TaskRecord
from .workplace import TEHRAN, actor_info
from .workplace_repository import WorkplaceError
from .work_task_notifications import delivery_for_event

ACTIVE_STATES = {"not_started", "in_progress", "awaiting_approval"}


class WorkTasksService:
    def __init__(self, repository, auth, clock=None):
        self.repository, self.auth = repository, auth
        self.clock = clock or (lambda: datetime.now(timezone.utc))

    def _now(self):
        return self.clock().astimezone(timezone.utc)

    @staticmethod
    def _staff(actor):
        if actor.get("role") not in {"staff", "admin"}:
            raise WorkplaceError("دسترسی کارمند یا مدیر لازم است.", 403)

    @staticmethod
    def _admin(actor):
        if actor.get("role") != "admin":
            raise WorkplaceError("این اقدام فقط برای مدیر مجاز است.", 403)

    @staticmethod
    def can_read(task, actor):
        return actor.get("role") in {"staff", "admin"} and (
            actor["role"] == "admin" or task["visibility"] == "team" or
            actor["id"] in {task["assignee"]["id"], task["created_by"]["id"]})

    def _readable(self, task, actor):
        self._staff(actor)
        if not task or not self.can_read(task, actor):
            # Restricted work must not disclose even its existence.
            raise WorkplaceError("کار پیدا نشد.", 404)

    @staticmethod
    def permissions(task, actor):
        admin = actor["role"] == "admin"
        owner = task["assignee"]["id"] == actor["id"]
        creator = task["created_by"]["id"] == actor["id"]
        return {
            "edit_fields": admin or (creator and task["first_submitted_at"] is None and task["state"] in ACTIVE_STATES),
            "change_visibility": admin or creator,
            "comment": admin or creator or owner,
            "start": owner and task["state"] == "not_started",
            "submit": owner and task["state"] in {"not_started", "in_progress"},
            "review": admin and task["state"] == "awaiting_approval",
            "cancel": admin and task["state"] in ACTIVE_STATES,
            "reopen": admin and task["state"] == "completed",
        }

    def _people(self):
        return [row for row in self.auth.list_users() if row["is_active"] and row["role"] in {"staff", "admin"}]

    def people(self, actor):
        self._admin(actor)
        return {"people": [actor_info(row) for row in self._people()]}

    def _assignee(self, identifier):
        person = next((row for row in self._people() if row["id"] == identifier), None)
        if not person:
            raise WorkplaceError("مسئول کار باید یکی از کارکنان یا مدیران فعال باشد.", 422)
        return actor_info(person)

    def _admins(self):
        return {row["id"] for row in self._people() if row["role"] == "admin"}

    @staticmethod
    def _normalize(task):
        return TaskRecord.model_validate(task).model_dump(mode="json")

    @staticmethod
    def _event(task, actor, now, kind, details=None, recipients=()):
        task["events"].append({"id": str(uuid4()), "kind": kind, "actor": actor_info(actor),
                               "created_at": now.isoformat(), "details": details or {},
                               "recipients": sorted(set(recipients) - {actor["id"]}), "read_by": [],
                               "telegram": delivery_for_event(task, kind, details or {})})

    def _summary(self, task, actor, now=None):
        now = now or self._now()
        due = date.fromisoformat(task["due_date"]) if task["due_date"] else None
        keys = ("id", "revision", "title", "assignee", "created_by", "created_at", "updated_at", "due_date",
                "priority", "requires_approval", "visibility", "state", "first_submitted_at", "submitted_at",
                "approved_at", "approved_by", "completed_at", "completion_mode")
        return {**{key: task[key] for key in keys},
                "overdue": bool(due and now.astimezone(TEHRAN).date() > due and task["state"] in {"not_started", "in_progress"}),
                "delivered_late": task["submissions"][-1]["delivered_late"] if task["submissions"] else None,
                "permissions": self.permissions(task, actor)}

    def _detail(self, task, actor):
        return {**self._summary(task, actor), "description": task["description"], "expected_output": task["expected_output"],
                "submissions": task["submissions"], "comments": task["comments"],
                "history": [{key: event[key] for key in ("id", "kind", "actor", "created_at", "details")} for event in task["events"]]}

    def get(self, actor, task_id):
        task = self.repository.get(task_id)
        self._readable(task, actor)
        return self._detail(task, actor)

    def list(self, actor, view="mine", status="active", search="", deadline="any", assignee_id=None,
             due_from=None, due_to=None, offset=0, limit=30):
        self._staff(actor)
        if view in {"all", "pending"} or assignee_id is not None:
            self._admin(actor)
        if due_from and due_to and due_from > due_to:
            raise WorkplaceError("ابتدای بازه مهلت باید قبل از پایان آن باشد.", 422)
        now = self._now()
        # Authorization precedes search, filters, counters and pagination.
        visible = [task for task in self.repository.all() if self.can_read(task, actor)]
        active = [task for task in visible if task["state"] in ACTIVE_STATES]
        counts = {"mine": sum(task["assignee"]["id"] == actor["id"] for task in active),
                  "team": sum(task["visibility"] == "team" for task in active),
                  "all": len(active) if actor["role"] == "admin" else None,
                  "pending": sum(task["state"] == "awaiting_approval" for task in active) if actor["role"] == "admin" else None}
        results = []
        query = search.strip().casefold()
        today = now.astimezone(TEHRAN).date()
        for task in visible:
            if view == "mine" and task["assignee"]["id"] != actor["id"]:
                continue
            if view == "team" and task["visibility"] != "team":
                continue
            if view == "pending" and task["state"] != "awaiting_approval":
                continue
            if (status == "active" and task["state"] not in ACTIVE_STATES) or (status not in {"active", "all"} and task["state"] != status):
                continue
            if query and query not in task["title"].casefold():
                continue
            if assignee_id and task["assignee"]["id"] != assignee_id:
                continue
            due = date.fromisoformat(task["due_date"]) if task["due_date"] else None
            summary = self._summary(task, actor, now)
            if deadline == "overdue" and not (summary["overdue"] or (task["state"] in {"awaiting_approval", "completed"} and summary["delivered_late"])):
                continue
            if deadline == "today" and due != today:
                continue
            if deadline == "no_due" and due is not None:
                continue
            if (due_from and (not due or due < due_from)) or (due_to and (not due or due > due_to)):
                continue
            results.append(summary)
        results.sort(key=lambda task: task["created_at"], reverse=True)
        results.sort(key=lambda task: (task["priority"] != "high", task["due_date"] or "9999-12-31"))
        return {"items": results[offset:offset + limit], "total": len(results), "offset": offset, "limit": limit, "counts": counts}

    def create(self, actor, body):
        self._staff(actor)
        if actor["role"] == "admin":
            if not body.assignee_id:
                raise WorkplaceError("مسئول انجام کار را انتخاب کنید.", 422)
            assignee_id = body.assignee_id
        else:
            if body.assignee_id is not None and body.assignee_id != actor["id"]:
                raise WorkplaceError("فقط می‌توانید برای خودتان کار ایجاد کنید.", 403)
            if not body.requires_approval:
                raise WorkplaceError("فقط مدیر می‌تواند نیاز به تأیید را تغییر دهد.", 403)
            assignee_id = actor["id"]
        identifier = str(uuid5(NAMESPACE_URL, f"greenpeak-work:{actor['id']}:{body.request_id}")) if body.request_id else str(uuid4())
        request_hash = sha256(json.dumps(body.model_dump(mode="json", exclude={"request_id"}), sort_keys=True).encode()).hexdigest()
        def previous_result():
            existing = self.repository.get(identifier)
            if existing:
                if existing.get("creation_request_hash") != request_hash:
                    raise WorkplaceError("این درخواست قبلاً با اطلاعات دیگری ثبت شده است؛ کار قبلی را بررسی کنید.")
                self._readable(existing, actor)
                return self._detail(existing, actor)
            return None
        if body.request_id and (previous := previous_result()):
            return previous
        now = self._now()
        task = {"id": identifier, "creation_request_hash": request_hash, "revision": 1, "storage_revision": 1, "title": body.title,
                "assignee": self._assignee(assignee_id), "created_by": actor_info(actor),
                "created_at": now, "updated_at": now, "description": body.description,
                "expected_output": body.expected_output, "due_date": body.due_date, "priority": body.priority,
                "requires_approval": body.requires_approval, "visibility": body.visibility, "state": "not_started",
                "first_submitted_at": None, "submitted_at": None, "approved_at": None, "approved_by": None,
                "completed_at": None, "completion_mode": None, "submissions": [], "comments": [], "events": []}
        self._event(task, actor, now, "created", recipients={assignee_id})
        try:
            saved = self.repository.create(self._normalize(task))
        except (DuplicateKeyError, sqlite3.IntegrityError):
            if body.request_id and (previous := previous_result()):
                return previous
            raise
        return self._detail(saved, actor)

    def _mutate(self, actor, task_id, revision, apply):
        self._staff(actor)
        def change(task):
            self._readable(task, actor)
            if revision is not None and task["revision"] != revision:
                raise WorkplaceError("کار هم‌زمان تغییر کرده است؛ تازه‌سازی و دوباره بررسی کنید.")
            now = self._now()
            apply(task, now)
            task["revision"] += 1
            task["updated_at"] = now.isoformat()
            return self._normalize(task)
        return self._detail(self.repository.mutate(task_id, change), actor)

    @staticmethod
    def _allow(task, actor, permission):
        if not WorkTasksService.permissions(task, actor)[permission]:
            raise WorkplaceError("این اقدام برای شما یا وضعیت فعلی کار مجاز نیست.", 403)

    def patch(self, actor, task_id, body):
        changes = body.model_dump(mode="json", exclude_unset=True)
        changes.pop("revision")
        def apply(task, now):
            if "visibility" in changes:
                self._allow(task, actor, "change_visibility")
            if changes.keys() - {"visibility"}:
                self._allow(task, actor, "edit_fields")
            if changes.keys() & {"assignee_id", "requires_approval"}:
                self._admin(actor)
            before = {key: task["assignee"] if key == "assignee_id" else task[key] for key in changes}
            old_assignee = task["assignee"]["id"]
            for key, value in changes.items():
                if key == "assignee_id":
                    task["assignee"] = self._assignee(value)
                else:
                    task[key] = value
            after = {key: task["assignee"] if key == "assignee_id" else task[key] for key in changes}
            if "visibility" in changes and before["visibility"] != after["visibility"]:
                self._event(task, actor, now, "visibility_changed", {"before": before["visibility"], "after": after["visibility"]})
            metadata = changes.keys() - {"visibility"}
            if metadata:
                recipients = {task["assignee"]["id"]} if old_assignee != task["assignee"]["id"] else set()
                self._event(task, actor, now, "updated", {"before": {key: before[key] for key in metadata},
                                                         "after": {key: after[key] for key in metadata}}, recipients)
            if task["state"] == "awaiting_approval" and not task["requires_approval"]:
                task.update(state="completed", completed_at=now.isoformat(), completion_mode="no_approval")
                task["submissions"][-1]["review_status"] = "not_required"
                self._event(task, actor, now, "completed_without_approval", recipients={task["assignee"]["id"], task["created_by"]["id"]})
        return self._mutate(actor, task_id, body.revision, apply)

    def start(self, actor, task_id, body):
        def apply(task, now):
            self._allow(task, actor, "start")
            task["state"] = "in_progress"
            self._event(task, actor, now, "started")
        return self._mutate(actor, task_id, body.revision, apply)

    def submit(self, actor, task_id, body):
        def apply(task, now):
            self._allow(task, actor, "submit")
            due = date.fromisoformat(task["due_date"]) if task["due_date"] else None
            task["submissions"].append({"id": str(uuid4()), "submitted_by": actor_info(actor), "submitted_at": now.isoformat(),
                                        "note": body.note, "result_url": body.result_url, "due_date_at_submission": task["due_date"],
                                        "delivered_late": now.astimezone(TEHRAN).date() > due if due else None,
                                        "review_status": "pending" if task["requires_approval"] else "not_required"})
            task["first_submitted_at"] = task["first_submitted_at"] or now.isoformat()
            task["submitted_at"] = now.isoformat()
            task["state"] = "awaiting_approval" if task["requires_approval"] else "completed"
            self._event(task, actor, now, "submitted", {"note": body.note, "result_url": body.result_url},
                        self._admins() if task["requires_approval"] else {task["created_by"]["id"]})
            if not task["requires_approval"]:
                task.update(completed_at=now.isoformat(), completion_mode="no_approval")
                self._event(task, actor, now, "completed_without_approval")
        return self._mutate(actor, task_id, body.revision, apply)

    def review(self, actor, task_id, body):
        self._admin(actor)
        def apply(task, now):
            self._allow(task, actor, "review")
            if body.decision == "changes_requested" and len(body.reason.strip()) < 3:
                raise WorkplaceError("دلیل درخواست اصلاح را وارد کنید.", 422)
            submission = task["submissions"][-1]
            submission.update(review_status=body.decision, reviewed_by=actor_info(actor), reviewed_at=now.isoformat(), review_reason=body.reason.strip())
            if body.decision == "approved":
                task.update(state="completed", approved_at=now.isoformat(), approved_by=actor_info(actor),
                            completed_at=now.isoformat(), completion_mode="approved")
            else:
                task["state"] = "in_progress"
            self._event(task, actor, now, body.decision, {"reason": body.reason.strip(), "submission_id": submission["id"]},
                        {task["assignee"]["id"], task["created_by"]["id"]})
        return self._mutate(actor, task_id, body.revision, apply)

    def cancel(self, actor, task_id, body):
        self._admin(actor)
        def apply(task, now):
            self._allow(task, actor, "cancel")
            task["state"] = "cancelled"
            if task["submissions"] and task["submissions"][-1]["review_status"] == "pending":
                task["submissions"][-1]["review_status"] = "cancelled"
            self._event(task, actor, now, "cancelled", {"reason": body.reason.strip()}, {task["assignee"]["id"], task["created_by"]["id"]})
        return self._mutate(actor, task_id, body.revision, apply)

    def reopen(self, actor, task_id, body):
        self._admin(actor)
        def apply(task, now):
            self._allow(task, actor, "reopen")
            self._event(task, actor, now, "reopened", {"reason": body.reason, "previous_completion_mode": task["completion_mode"],
                                                      "previous_completed_at": task["completed_at"]},
                        {task["assignee"]["id"], task["created_by"]["id"]})
            task.update(state="in_progress", completed_at=None, completion_mode=None, approved_at=None, approved_by=None)
        return self._mutate(actor, task_id, body.revision, apply)

    def comment(self, actor, task_id, body):
        def apply(task, now):
            self._allow(task, actor, "comment")
            message = {"id": str(uuid4()), "author": actor_info(actor), "created_at": now.isoformat(), "text": body.text}
            task["comments"].append(message)
            self._event(task, actor, now, "commented", {"comment_id": message["id"]},
                        {task["assignee"]["id"], task["created_by"]["id"]} | self._admins())
        return self._mutate(actor, task_id, None, apply)

    def notifications(self, actor, limit=50):
        self._staff(actor)
        items = []
        for task in self.repository.all():
            if not self.can_read(task, actor):
                continue
            for event in task["events"]:
                if actor["id"] in event["recipients"]:
                    items.append({"id": event["id"], "task_id": task["id"], "task_title": task["title"],
                                  "kind": event["kind"], "actor": event["actor"], "created_at": event["created_at"],
                                  "read": actor["id"] in event["read_by"]})
        items.sort(key=lambda item: item["created_at"], reverse=True)
        items.sort(key=lambda item: item["read"])
        return {"items": items[:limit], "unread_count": sum(not item["read"] for item in items)}

    def read_notification(self, actor, task_id, event_id):
        def apply(task):
            self._readable(task, actor)
            event = next((event for event in task["events"] if event["id"] == event_id and actor["id"] in event["recipients"]), None)
            if not event:
                raise WorkplaceError("اعلان پیدا نشد.", 404)
            if actor["id"] not in event["read_by"]:
                event["read_by"].append(actor["id"])
            return self._normalize(task)
        self.repository.mutate(task_id, apply)
        return {"read": True}
