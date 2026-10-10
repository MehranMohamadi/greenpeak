"""Bounded SQLite chat history for one application host, shared by its workers."""

import json
import sqlite3
import time
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4


class ChatError(Exception):
    def __init__(self, code: str, message: str, status: int = 400):
        self.code, self.message, self.status = code, message, status
        super().__init__(message)


def now_iso():
    return datetime.now(UTC).isoformat()


class ChatStore:
    def __init__(self, path: Path, retention_days: int = 30, daily_limit: int = 100):
        self.path = Path(path)
        self.retention_days = max(1, retention_days)
        self.daily_limit = max(1, daily_limit)
        try:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            with self.connect() as db:
                db.execute("PRAGMA journal_mode=WAL")
                db.executescript("""
                    CREATE TABLE IF NOT EXISTS chat_conversations (
                        id TEXT PRIMARY KEY, user_id TEXT NOT NULL, scope TEXT NOT NULL,
                        connection_id TEXT, title TEXT NOT NULL, created_at TEXT NOT NULL,
                        updated_at TEXT NOT NULL, updated_epoch REAL NOT NULL,
                        lease TEXT, busy_until REAL NOT NULL DEFAULT 0
                    );
                    CREATE INDEX IF NOT EXISTS chat_owner ON chat_conversations(user_id, updated_epoch);
                    CREATE INDEX IF NOT EXISTS chat_expiry ON chat_conversations(updated_epoch);
                    CREATE TABLE IF NOT EXISTS chat_turns (
                        conversation_id TEXT NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
                        request_id TEXT NOT NULL, request_json TEXT NOT NULL, response_json TEXT NOT NULL,
                        created_at TEXT NOT NULL, PRIMARY KEY(conversation_id, request_id)
                    );
                    CREATE TABLE IF NOT EXISTS chat_attempts (user_id TEXT NOT NULL, at REAL NOT NULL);
                    CREATE INDEX IF NOT EXISTS chat_attempt_owner ON chat_attempts(user_id, at);
                    CREATE INDEX IF NOT EXISTS chat_attempt_expiry ON chat_attempts(at);
                """)
        except OSError as exc:
            raise ChatError("CHAT_STORAGE_UNAVAILABLE", "ذخیره‌سازی گفت‌وگو در دسترس نیست.", 503) from exc

    @contextmanager
    def connect(self):
        db = None
        try:
            db = sqlite3.connect(self.path, timeout=5)
            db.row_factory = sqlite3.Row
            db.execute("PRAGMA foreign_keys=ON")
            with db:
                yield db
        except sqlite3.Error as exc:
            raise ChatError("CHAT_STORAGE_UNAVAILABLE", "ذخیره‌سازی گفت‌وگو در دسترس نیست.", 503) from exc
        finally:
            if db is not None:
                db.close()

    def cleanup(self, db):
        current = time.time()
        db.execute("DELETE FROM chat_conversations WHERE updated_epoch < ? AND busy_until < ?",
                   (current - self.retention_days * 86400, current))
        db.execute("DELETE FROM chat_attempts WHERE at < ?", (current - 86400,))

    @staticmethod
    def owned(db, user_id, conversation_id):
        row = db.execute("SELECT * FROM chat_conversations WHERE id=? AND user_id=?",
                         (conversation_id, user_id)).fetchone()
        if row is None:
            raise ChatError("CHAT_NOT_FOUND", "گفت‌وگو پیدا نشد.", 404)
        return dict(row)

    @staticmethod
    def public(row):
        return {key: row[key] for key in ("id", "scope", "connection_id", "title", "created_at", "updated_at")}

    def create(self, user_id, scope, connection_id):
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            self.cleanup(db)
            count = db.execute("SELECT COUNT(*) FROM chat_conversations WHERE user_id=?", (user_id,)).fetchone()[0]
            if count >= 100:
                raise ChatError("CHAT_HISTORY_FULL", "برای گفت‌وگوی جدید، یکی از گفت‌وگوهای قبلی را حذف کنید.", 409)
            row = dict(id=str(uuid4()), user_id=user_id, scope=scope, connection_id=connection_id,
                       title="گفت‌وگوی جدید", created_at=now_iso(), updated_at=now_iso(), updated_epoch=time.time())
            db.execute("INSERT INTO chat_conversations (id,user_id,scope,connection_id,title,created_at,updated_at,updated_epoch) VALUES (:id,:user_id,:scope,:connection_id,:title,:created_at,:updated_at,:updated_epoch)", row)
            return self.public(row)

    def list(self, user_id):
        with self.connect() as db:
            self.cleanup(db)
            rows = db.execute("SELECT * FROM chat_conversations WHERE user_id=? ORDER BY updated_epoch DESC LIMIT 100", (user_id,)).fetchall()
            return [self.public(dict(row)) for row in rows]

    @staticmethod
    def messages(db, conversation_id):
        rows = db.execute("SELECT * FROM chat_turns WHERE conversation_id=? ORDER BY rowid", (conversation_id,)).fetchall()
        result = []
        for row in rows:
            request = json.loads(row["request_json"])
            result.append({"id": row["request_id"] + ":user", "role": "user", "content": request["content"], "created_at": row["created_at"]})
            result.append(json.loads(row["response_json"]))
        return result

    def get(self, user_id, conversation_id):
        with self.connect() as db:
            self.cleanup(db)
            row = self.owned(db, user_id, conversation_id)
            return {**self.public(row), "messages": self.messages(db, conversation_id)}

    def acquire(self, user_id, conversation_id, request):
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            self.cleanup(db)
            row = self.owned(db, user_id, conversation_id)
            previous = db.execute("SELECT request_json,response_json FROM chat_turns WHERE conversation_id=? AND request_id=?",
                                  (conversation_id, str(request.request_id))).fetchone()
            if previous:
                if json.loads(previous[0])["content"] != request.content:
                    raise ChatError("CHAT_REQUEST_CONFLICT", "شناسهٔ پیام قبلاً برای پیام دیگری استفاده شده است.", 409)
                return row, None, json.loads(previous[1]), []
            current = time.time()
            if row["busy_until"] > current:
                raise ChatError("CHAT_BUSY", "پاسخ قبلی هنوز در حال آماده‌شدن است.", 409)
            history = self.messages(db, conversation_id)
            if len(history) >= 100:
                raise ChatError("CHAT_TOO_LONG", "برای ادامه، گفت‌وگوی جدیدی بسازید.", 409)
            minute_count = db.execute("SELECT COUNT(*) FROM chat_attempts WHERE user_id=? AND at>?", (user_id, current - 60)).fetchone()[0]
            day_count = db.execute("SELECT COUNT(*) FROM chat_attempts WHERE user_id=? AND at>?", (user_id, current - 86400)).fetchone()[0]
            if minute_count >= 10 or day_count >= self.daily_limit:
                raise ChatError("CHAT_RATE_LIMIT", "سقف درخواست‌ها رسیده است؛ کمی بعد دوباره تلاش کنید.", 429)
            db.execute("INSERT INTO chat_attempts VALUES (?,?)", (user_id, current))
            lease = str(uuid4())
            db.execute("UPDATE chat_conversations SET lease=?,busy_until=? WHERE id=? AND user_id=?", (lease, current + 300, conversation_id, user_id))
            return row, lease, None, history[-10:]

    def complete(self, user_id, conversation_id, lease, request, answer):
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            row = self.owned(db, user_id, conversation_id)
            if row["lease"] != lease:
                raise ChatError("CHAT_LEASE_EXPIRED", "مهلت پاسخ تمام شد؛ دوباره تلاش کنید.", 409)
            count = db.execute("SELECT COUNT(*) FROM chat_turns WHERE conversation_id=?", (conversation_id,)).fetchone()[0]
            db.execute("INSERT INTO chat_turns VALUES (?,?,?,?,?)", (conversation_id, str(request.request_id), request.model_dump_json(), json.dumps(answer, ensure_ascii=False, allow_nan=False), now_iso()))
            db.execute("UPDATE chat_conversations SET title=?,updated_at=?,updated_epoch=?,lease=NULL,busy_until=0 WHERE id=? AND user_id=?",
                       (request.content[:70] if count == 0 else row["title"], now_iso(), time.time(), conversation_id, user_id))

    def release(self, user_id, conversation_id, lease):
        with self.connect() as db:
            db.execute("UPDATE chat_conversations SET lease=NULL,busy_until=0 WHERE id=? AND user_id=? AND lease=?", (conversation_id, user_id, lease))

    def delete(self, user_id, conversation_id):
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            row = self.owned(db, user_id, conversation_id)
            if row["busy_until"] > time.time():
                raise ChatError("CHAT_BUSY", "پس از دریافت پاسخ، گفت‌وگو را حذف کنید.", 409)
            db.execute("DELETE FROM chat_conversations WHERE id=? AND user_id=?", (conversation_id, user_id))
