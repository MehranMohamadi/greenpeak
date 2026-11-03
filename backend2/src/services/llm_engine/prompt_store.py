"""Versioned administrator prompt edits, persisted outside release files."""

from contextlib import contextmanager
from datetime import UTC, datetime
from hashlib import sha256
from pathlib import Path
import sqlite3


class PromptConflict(ValueError):
    pass


class PromptStore:
    def __init__(self, router_db_path):
        self.path = Path(router_db_path).with_name("llm_prompts.db")
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as db:
            db.execute("""CREATE TABLE IF NOT EXISTS prompt_revisions (
                prompt_id TEXT NOT NULL,
                revision INTEGER NOT NULL,
                content TEXT NOT NULL,
                base_version TEXT NOT NULL,
                content_hash TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                updated_by TEXT NOT NULL,
                PRIMARY KEY (prompt_id, revision)
            )""")

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path, timeout=10)
        db.row_factory = sqlite3.Row
        try:
            with db:
                yield db
        finally:
            db.close()

    def current(self):
        with self.connect() as db:
            rows = db.execute("""SELECT p.* FROM prompt_revisions p
                JOIN (SELECT prompt_id, MAX(revision) revision FROM prompt_revisions GROUP BY prompt_id) h
                ON p.prompt_id = h.prompt_id AND p.revision = h.revision""").fetchall()
        return {row["prompt_id"]: dict(row) for row in rows}

    def save(self, prompt_id, content, base_version, expected_revision, actor_id):
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            previous = db.execute("SELECT revision, content FROM prompt_revisions WHERE prompt_id=? ORDER BY revision DESC LIMIT 1",
                                  (prompt_id,)).fetchone()
            revision = previous["revision"] if previous else 0
            if revision != expected_revision:
                raise PromptConflict("Prompt changed; reload before saving")
            if previous and previous["content"] == content:
                return revision
            revision += 1
            db.execute("INSERT INTO prompt_revisions VALUES (?, ?, ?, ?, ?, ?, ?)", (
                prompt_id, revision, content, base_version,
                "sha256:" + sha256(content.encode("utf-8")).hexdigest(),
                datetime.now(UTC).isoformat(), actor_id,
            ))
            return revision
