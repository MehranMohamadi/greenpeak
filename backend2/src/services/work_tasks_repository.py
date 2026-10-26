"""One atomic document per work, including its history and notification receipts.

Optimistic compare-and-swap works on standalone MongoDB. SQLite uses the same
authentication database and one write transaction. Read receipts do not change
the public revision used for editing work specifications.
"""

import json

from pymongo import ASCENDING

from .auth import LocalUserCollection
from .workplace_repository import WorkplaceError


class WorkTasksRepository:
    def __init__(self, users):
        self.users = users
        self.local = isinstance(users, LocalUserCollection)
        if self.local:
            with users._connect() as connection:
                connection.execute("CREATE TABLE IF NOT EXISTS gp_work_tasks (id TEXT PRIMARY KEY, payload TEXT NOT NULL)")
        else:
            self.collection = users.database.gp_work_tasks
            self.collection.create_index([("assignee.id", ASCENDING), ("state", ASCENDING)])
            self.collection.create_index([("created_by.id", ASCENDING)])
            self.collection.create_index([("visibility", ASCENDING), ("state", ASCENDING)])

    @staticmethod
    def _document(row):
        return {key: value for key, value in row.items() if key != "_id"}

    def all(self):
        if self.local:
            with self.users._connect() as connection:
                return [json.loads(row[0]) for row in connection.execute("SELECT payload FROM gp_work_tasks")]
        return [self._document(row) for row in self.collection.find({})]

    def get(self, task_id):
        if self.local:
            with self.users._connect() as connection:
                row = connection.execute("SELECT payload FROM gp_work_tasks WHERE id = ?", (task_id,)).fetchone()
                return json.loads(row[0]) if row else None
        row = self.collection.find_one({"_id": task_id})
        return self._document(row) if row else None

    def create(self, document):
        if self.local:
            with self.users._connect() as connection:
                connection.execute("INSERT INTO gp_work_tasks VALUES (?, ?)", (document["id"], json.dumps(document)))
        else:
            self.collection.insert_one({"_id": document["id"], **document})
        return document

    def mutate(self, task_id, apply):
        if self.local:
            with self.users._connect() as connection:
                connection.execute("BEGIN IMMEDIATE")
                row = connection.execute("SELECT payload FROM gp_work_tasks WHERE id = ?", (task_id,)).fetchone()
                if not row:
                    raise WorkplaceError("کار پیدا نشد.", 404)
                current = json.loads(row[0])
                changed = apply(current)
                changed["storage_revision"] = current["storage_revision"] + 1
                connection.execute("UPDATE gp_work_tasks SET payload = ? WHERE id = ?", (json.dumps(changed), task_id))
                return changed
        for _ in range(4):
            current = self.get(task_id)
            if not current:
                raise WorkplaceError("کار پیدا نشد.", 404)
            previous = current["storage_revision"]
            changed = apply(current)
            changed["storage_revision"] = previous + 1
            result = self.collection.replace_one(
                {"_id": task_id, "storage_revision": previous}, {"_id": task_id, **changed})
            if result.matched_count == 1:
                return changed
        raise WorkplaceError("اطلاعات هم‌زمان تغییر کرده است؛ تازه‌سازی و دوباره تلاش کنید.")
