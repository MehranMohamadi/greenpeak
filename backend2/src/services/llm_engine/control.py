"""Shared provider preferences and observed usage; never stores credentials/content."""

from contextlib import contextmanager
from datetime import UTC, datetime, time, timedelta
from hashlib import sha256
import json
from pathlib import Path
import sqlite3


def model_key(provider_id, model, base_url):
    return sha256(json.dumps([provider_id, model, base_url.rstrip('/')]).encode()).hexdigest()[:24]


def configured_models(settings):
    from .routing import DIRECT_URLS, llm_is_configured

    if settings.greenpeak_llm_providers:
        entries = [(p.provider_id, p.model, p.base_url or DIRECT_URLS.get(p.provider_id, ''))
                   for p in settings.greenpeak_llm_providers]
    elif llm_is_configured(settings):
        entries = [(settings.greenpeak_llm_provider, settings.greenpeak_llm_model,
                    settings.greenpeak_llm_base_url)]
    else:
        entries = []
    return [{"id": model_key(provider, model, url), "provider": provider, "model": model}
            for provider, model, url in entries]


def count(value):
    return value if type(value) is int and 0 <= value <= 10**15 else None


class ConfigurationConflict(ValueError):
    pass


class LLMControlStore:
    def __init__(self, router_db_path):
        self.path = Path(router_db_path).with_name('llm_control.db')
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as db:
            db.execute('CREATE TABLE IF NOT EXISTS preferences '
                       '(id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, value TEXT NOT NULL)')
            db.execute('INSERT OR IGNORE INTO preferences VALUES (1, 0, ?)',
                       (json.dumps({"order": [], "budgets": {}, "tracking_since": datetime.now(UTC).isoformat()}),))
            db.execute('CREATE TABLE IF NOT EXISTS usage_events '
                       '(id INTEGER PRIMARY KEY, model_key TEXT NOT NULL, recorded_at TEXT NOT NULL, '
                       'http_status INTEGER, input_tokens INTEGER, output_tokens INTEGER, total_tokens INTEGER, '
                       'quota TEXT)')
            db.execute('CREATE INDEX IF NOT EXISTS usage_model_time ON usage_events(model_key, recorded_at)')

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path, timeout=10)
        db.row_factory = sqlite3.Row
        try:
            with db:
                yield db
        finally:
            db.close()

    def preferences(self):
        with self.connect() as db:
            row = db.execute('SELECT revision, value FROM preferences WHERE id=1').fetchone()
        return row['revision'], json.loads(row['value'])

    def ordered(self, models):
        _, preferences = self.preferences()
        ranks = {key: i for i, key in enumerate(preferences['order'])}
        return sorted(models, key=lambda item: ranks.get(item['id'], len(ranks)))

    def save(self, models, rows, expected_revision, actor_id):
        ids = [item['id'] for item in rows]
        if len(ids) != len(set(ids)) or set(ids) != {m['id'] for m in models}:
            raise ValueError('Include each currently configured model exactly once')
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            row = db.execute('SELECT revision, value FROM preferences WHERE id=1').fetchone()
            if row['revision'] != expected_revision:
                raise ConfigurationConflict('Configuration changed; refresh before saving')
            value = json.loads(row['value'])
            value.update(order=ids, budgets={r['id']: r['daily_token_limit'] for r in rows},
                         updated_at=datetime.now(UTC).isoformat(), updated_by=actor_id)
            db.execute('UPDATE preferences SET revision=revision+1, value=? WHERE id=1', (json.dumps(value),))

    def record(self, key, status, payload, headers, provider_id, *, now=None):
        usage = payload.get('usage', {}) if isinstance(payload, dict) else {}
        if not isinstance(usage, dict):
            usage = {}
        incoming, outgoing = count(usage.get('prompt_tokens')), count(usage.get('completion_tokens'))
        total = count(usage.get('total_tokens'))
        if total is None and incoming is not None and outgoing is not None:
            total = incoming + outgoing
        quota = {}
        if provider_id == 'groq':
            for name in ['limit-tokens', 'remaining-tokens', 'limit-requests', 'remaining-requests']:
                raw = headers.get('x-ratelimit-' + name, '')
                if isinstance(raw, str) and raw.isascii() and raw.isdigit() and len(raw) <= 15:
                    quota[name.replace('-', '_')] = int(raw)
        with self.connect() as db:
            db.execute('INSERT INTO usage_events '
                       '(model_key,recorded_at,http_status,input_tokens,output_tokens,total_tokens,quota) '
                       'VALUES (?,?,?,?,?,?,?)', (key, (now or datetime.now(UTC)).isoformat(), status,
                                                incoming, outgoing, total, json.dumps(quota) if quota else None))

    def overview(self, models, *, now=None):
        now = now or datetime.now(UTC)
        day_start = datetime.combine(now.date(), time.min, UTC)
        revision, preferences = self.preferences()
        ranks = {key: i for i, key in enumerate(preferences['order'])}
        rows = []
        with self.connect() as db:
            for model in sorted(models, key=lambda item: ranks.get(item['id'], len(ranks))):
                usage = dict(db.execute('SELECT COUNT(*) AS requests, SUM(input_tokens) AS input_tokens, '
                    'SUM(output_tokens) AS output_tokens, SUM(total_tokens) AS total_tokens, '
                    'COUNT(CASE WHEN total_tokens IS NULL THEN 1 END) AS unmetered_requests, '
                    'COUNT(CASE WHEN http_status IS NULL OR http_status >= 400 THEN 1 END) AS failed_requests '
                    'FROM usage_events WHERE model_key=? AND recorded_at>=? AND recorded_at<?',
                    (model['id'], day_start.isoformat(), (day_start + timedelta(days=1)).isoformat())).fetchone())
                last = db.execute('SELECT recorded_at,quota FROM usage_events WHERE model_key=? '
                                  'AND quota IS NOT NULL ORDER BY recorded_at DESC,id DESC LIMIT 1',
                                  (model['id'],)).fetchone()
                limit = preferences['budgets'].get(model['id'])
                # This is only a local estimate against the admin's explicit budget.
                observed = usage['total_tokens']
                remaining = (max(0, limit - (observed or 0))
                             if limit is not None and usage['unmetered_requests'] == 0 else None)
                rows.append({**model, **usage, 'priority': len(rows) + 1,
                             'daily_token_limit': limit, 'estimated_remaining_tokens': remaining,
                             'reported_quota': {**json.loads(last['quota']), 'observed_at': last['recorded_at']}
                             if last else None})
        return {'revision': revision, 'day': now.date().isoformat(), 'timezone': 'UTC',
                'tracking_since': preferences['tracking_since'], 'models': rows}
