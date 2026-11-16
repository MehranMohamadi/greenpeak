"""Private, durable quality records beside the existing LLM administration DBs."""
from contextlib import contextmanager
from datetime import UTC, datetime
from hashlib import sha256
import json
from pathlib import Path
import sqlite3
from uuid import uuid4


class Conflict(ValueError):
    pass


class Missing(KeyError):
    pass


def now_iso():
    return datetime.now(UTC).isoformat()


def encode(value):
    return json.dumps(value, ensure_ascii=False, default=str, sort_keys=True)


def digest(value):
    return sha256(encode(value).encode()).hexdigest()


class QualityStore:
    def __init__(self, router_path):
        self.path = Path(router_path).with_name("analysis_quality.db")
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as db:
            db.execute("""CREATE TABLE IF NOT EXISTS records (
                kind TEXT NOT NULL, id TEXT NOT NULL, revision INTEGER NOT NULL,
                created_at TEXT NOT NULL, updated_at TEXT NOT NULL, value TEXT NOT NULL,
                PRIMARY KEY(kind,id))""")
            db.execute("""CREATE TABLE IF NOT EXISTS audit (
                sequence INTEGER PRIMARY KEY, kind TEXT NOT NULL, id TEXT NOT NULL,
                revision INTEGER NOT NULL, actor TEXT NOT NULL, at TEXT NOT NULL, value TEXT NOT NULL)""")

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path, timeout=10)
        db.row_factory = sqlite3.Row
        try:
            with db:
                yield db
        finally:
            db.close()

    @staticmethod
    def unpack(row):
        return {**json.loads(row["value"]), "id": row["id"], "revision": row["revision"],
                "created_at": row["created_at"], "updated_at": row["updated_at"]}

    def get(self, kind, item_id):
        with self.connect() as db:
            row = db.execute("SELECT * FROM records WHERE kind=? AND id=?", (kind, item_id)).fetchone()
        if row is None:
            raise Missing(item_id)
        return self.unpack(row)

    def list(self, kind, limit=100):
        with self.connect() as db:
            rows = db.execute("SELECT * FROM records WHERE kind=? ORDER BY created_at DESC,id DESC LIMIT ?",
                              (kind, min(limit, 500))).fetchall()
        return [self.unpack(row) for row in rows]

    def save(self, kind, value, actor, *, item_id=None, expected_revision=0):
        item_id = item_id or str(uuid4())
        clean = {key: value for key, value in value.items() if key not in {"id", "revision", "created_at", "updated_at"}}
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            row = db.execute("SELECT * FROM records WHERE kind=? AND id=?", (kind, item_id)).fetchone()
            revision = row["revision"] if row else 0
            if revision != expected_revision:
                raise Conflict("Record changed; reload before saving")
            at = now_iso()
            created = row["created_at"] if row else at
            db.execute("INSERT INTO records VALUES (?,?,?,?,?,?) ON CONFLICT(kind,id) DO UPDATE SET "
                       "revision=excluded.revision,updated_at=excluded.updated_at,value=excluded.value",
                       (kind, item_id, revision + 1, created, at, encode(clean)))
            db.execute("INSERT INTO audit(kind,id,revision,actor,at,value) VALUES (?,?,?,?,?,?)",
                       (kind, item_id, revision + 1, actor, at, encode(clean)))
        return self.get(kind, item_id)

    def create_once(self, kind, value, item_id, actor="pipeline"):
        try:
            return self.save(kind, value, actor, item_id=item_id)
        except Conflict:
            return self.get(kind, item_id)

    def enqueue(self, kind, value, actor):
        item_id, at = str(uuid4()), now_iso()
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            active = db.execute("SELECT id FROM records WHERE kind IN ('evaluation','critique','suggestion') "
                                "AND json_extract(value,'$.status') IN ('queued','running') LIMIT 1").fetchone()
            if active:
                raise ValueError("Another quality job is active; wait or cancel it before starting another")
            value = {**value, "status": "queued"}
            db.execute("INSERT INTO records VALUES (?,?,?,?,?,?)", (kind, item_id, 1, at, at, encode(value)))
            db.execute("INSERT INTO audit(kind,id,revision,actor,at,value) VALUES (?,?,?,?,?,?)",
                       (kind, item_id, 1, actor, at, encode(value)))
        return self.get(kind, item_id)

    def claim(self, kind, item_id, expected="queued"):
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            row = db.execute("SELECT * FROM records WHERE kind=? AND id=?", (kind, item_id)).fetchone()
            if not row or json.loads(row["value"]).get("status") != expected:
                return False
            value = json.loads(row["value"])
            value.update(status="running", started_at=now_iso())
            db.execute("UPDATE records SET value=?,revision=revision+1,updated_at=? WHERE kind=? AND id=?",
                       (encode(value), now_iso(), kind, item_id))
            return True

    def finish(self, kind, item_id, value):
        current = self.get(kind, item_id)
        if current.get("status") == "cancelled":
            return current
        return self.save(kind, {**current, **value}, "worker", item_id=item_id,
                         expected_revision=current["revision"])

    def counts(self):
        with self.connect() as db:
            return {row[0]: row[1] for row in db.execute("SELECT kind,COUNT(*) FROM records GROUP BY kind")}
