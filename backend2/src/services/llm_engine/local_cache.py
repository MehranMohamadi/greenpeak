"""SQLite cache for validated narrative snapshots in local development."""

from __future__ import annotations

import json
import sqlite3
from datetime import date, datetime
from pathlib import Path
from typing import Any


class NarrativeCacheError(Exception):
    """The local narrative cache could not be read or written."""


class LocalNarrativeCache:
    """Store one latest snapshot per narrative level and subject."""

    def __init__(self, database_path: str | Path) -> None:
        self.database_path = Path(database_path)
        try:
            self.database_path.parent.mkdir(parents=True, exist_ok=True)
            with self._connect() as connection:
                connection.execute(
                    """
                    CREATE TABLE IF NOT EXISTS gp_narrative_cache (
                        level TEXT NOT NULL,
                        subject_id TEXT NOT NULL,
                        document_json TEXT NOT NULL,
                        cached_at TEXT NOT NULL,
                        PRIMARY KEY (level, subject_id)
                    )
                    """
                )
        except (OSError, sqlite3.Error) as exc:
            raise NarrativeCacheError("Local narrative cache is unavailable.") from exc

    def _connect(self) -> sqlite3.Connection:
        return sqlite3.connect(self.database_path, timeout=5)

    def save(self, level: str, subject_id: str, document: dict[str, Any]) -> None:
        try:
            payload = json.dumps(document, ensure_ascii=False, default=self._json_default)
            with self._connect() as connection:
                connection.execute(
                    """
                    INSERT INTO gp_narrative_cache (level, subject_id, document_json, cached_at)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(level, subject_id) DO UPDATE SET
                        document_json = excluded.document_json,
                        cached_at = excluded.cached_at
                    """,
                    (level, subject_id, payload, datetime.now().astimezone().isoformat()),
                )
        except (TypeError, ValueError, sqlite3.Error) as exc:
            raise NarrativeCacheError("Local narrative cache is unavailable.") from exc

    def latest(self, level: str, subject_id: str) -> dict[str, Any] | None:
        try:
            with self._connect() as connection:
                row = connection.execute(
                    """
                    SELECT document_json
                    FROM gp_narrative_cache
                    WHERE level = ? AND subject_id = ?
                    LIMIT 1
                    """,
                    (level, subject_id),
                ).fetchone()
            return json.loads(row[0]) if row else None
        except (json.JSONDecodeError, sqlite3.Error) as exc:
            raise NarrativeCacheError("Local narrative cache is unavailable.") from exc

    @staticmethod
    def _json_default(value: Any) -> str:
        if isinstance(value, (date, datetime)):
            return value.isoformat()
        raise TypeError(f"Unsupported cache value: {type(value).__name__}")
