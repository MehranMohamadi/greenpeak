from datetime import UTC, datetime, timedelta
import sqlite3

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.api.v1.endpoints import llm_admin
from src.api.v1.endpoints.auth import require_user
from src.core.config import Settings
from src.services.llm_engine.control import ConfigurationConflict, LLMControlStore, configured_models
from src.services.llm_engine.provider import InvalidLLMResponse
from src.services.llm_engine.routing import create_llm_provider


@pytest.fixture
def setup(tmp_path, monkeypatch):
    settings = Settings(_env_file=None, greenpeak_llm_providers=[
        {'provider_id': 'groq', 'model': 'groq-test', 'api_key': 'private-groq-key'},
        {'provider_id': 'cloudflare', 'model': 'cf-test', 'api_key': 'private-cf-key',
         'base_url': 'https://cloudflare.invalid/v1'},
    ], greenpeak_llm_router_db_path=tmp_path / 'router.db')
    monkeypatch.setattr(llm_admin, 'get_settings', lambda: settings)
    store = LLMControlStore(settings.greenpeak_llm_router_db_path)
    return settings, store, configured_models(settings)


def rows(models, limit=None):
    return [{'id': m['id'], 'daily_token_limit': limit} for m in models]


def response(url, content='{}', usage=None, headers=None, status=200):
    return httpx.Response(status, request=httpx.Request('POST', url), headers=headers,
                          json={'choices': [{'message': {'content': content}}], 'usage': usage})


def test_priority_applies_to_existing_router_and_survives_recreation(setup, monkeypatch):
    settings, store, models = setup
    router = create_llm_provider(settings)
    calls = []
    monkeypatch.setattr(httpx, 'post', lambda url, **_: calls.append(url) or response(url))
    store.save(models, rows(list(reversed(models))), 0, 'admin')
    router.generate_json('secret-prompt', {'private_data': 'secret-evidence'})
    assert calls == ['https://cloudflare.invalid/v1/chat/completions']
    assert create_llm_provider(settings).provider_id == 'cloudflare'
    assert [m['id'] for m in store.overview(models)['models']] == [m['id'] for m in reversed(models)]
    raw = store.path.read_bytes()
    for secret in [b'private-groq-key', b'private-cf-key', b'secret-prompt', b'secret-evidence']:
        assert secret not in raw


def test_all_http_attempts_and_invalid_paid_output_are_counted(setup, monkeypatch):
    settings, store, models = setup

    def post(url, **kwargs):
        if 'groq' in url:
            return response(url, status=503)
        return response(url, content='broken', usage={'prompt_tokens': 10, 'completion_tokens': 4, 'total_tokens': 14})

    monkeypatch.setattr(httpx, 'post', post)
    with pytest.raises(InvalidLLMResponse):
        create_llm_provider(settings).generate_json('system', {})
    primary, secondary = store.overview(models)['models']
    assert primary['requests'] == primary['failed_requests'] == primary['unmetered_requests'] == 1
    assert primary['total_tokens'] is None
    assert secondary['requests'] == 1 and secondary['total_tokens'] == 14


def test_transport_failure_is_counted_and_fallback_tokens_are_recorded(setup, monkeypatch):
    settings, store, models = setup

    def post(url, **kwargs):
        if 'groq' in url:
            raise httpx.ReadTimeout('private-error')
        return response(url, usage={'prompt_tokens': 5, 'completion_tokens': 2})

    monkeypatch.setattr(httpx, 'post', post)
    assert create_llm_provider(settings).generate_json('system', {}) == {}
    primary, secondary = store.overview(models)['models']
    assert primary['failed_requests'] == 1
    assert secondary['input_tokens'] == 5 and secondary['output_tokens'] == 2
    assert secondary['total_tokens'] == 7


def test_groq_header_window_is_separate_from_daily_estimate(setup, monkeypatch):
    settings, store, models = setup
    monkeypatch.setattr(httpx, 'post', lambda url, **_: response(url,
        usage={'prompt_tokens': 5, 'completion_tokens': 2, 'total_tokens': 7}, headers={
            'x-ratelimit-remaining-tokens': '7993', 'x-ratelimit-limit-tokens': '8000',
            'x-ratelimit-remaining-requests': '999', 'x-ratelimit-limit-requests': '1000',
            'authorization': 'private-header'}))
    create_llm_provider(settings).generate_json('system', {})
    model = store.overview(models)['models'][0]
    assert model['estimated_remaining_tokens'] is None
    assert model['reported_quota']['remaining_tokens'] == 7993
    store.save(models, rows(models, 200000), 0, 'admin')
    model = store.overview(models)['models'][0]
    assert model['estimated_remaining_tokens'] == 199993
    assert b'private-header' not in store.path.read_bytes()


def test_usage_resets_at_utc_midnight_and_does_not_fabricate_missing_tokens(setup):
    _, store, models = setup
    now = datetime(2026, 10, 28, 0, 1, tzinfo=UTC)
    store.record(models[0]['id'], 200, {'usage': {'total_tokens': 100}}, {}, 'groq', now=now - timedelta(minutes=2))
    store.record(models[0]['id'], 200, {'usage': {'total_tokens': 3}}, {}, 'groq', now=now)
    store.record(models[0]['id'], 200, {'usage': {'total_tokens': True}}, {}, 'groq', now=now)
    model = store.overview(models, now=now)['models'][0]
    assert model['requests'] == 2 and model['total_tokens'] == 3
    assert model['unmetered_requests'] == 1
    assert model['estimated_remaining_tokens'] is None
    store.save(models, rows(models, 1000), 0, 'admin')
    assert store.overview(models, now=now)['models'][0]['estimated_remaining_tokens'] is None


def test_concurrent_configuration_change_is_rejected(setup):
    _, store, models = setup
    store.save(models, rows(models), 0, 'admin')
    with pytest.raises(ConfigurationConflict):
        store.save(models, rows(list(reversed(models))), 0, 'other-admin')
    with pytest.raises(ValueError):
        store.save(models, rows([models[0], models[0]]), 1, 'admin')


def test_missing_new_and_removed_models_reconcile_with_saved_priority(setup):
    _, store, models = setup
    store.save(models, rows(list(reversed(models))), 0, 'admin')
    new = {'id': 'f' * 24, 'provider': 'new', 'model': 'new-model'}
    assert [m['id'] for m in store.overview([models[0], new])['models']] == [models[0]['id'], new['id']]


def test_telemetry_write_failure_does_not_retry_valid_completion(setup, monkeypatch):
    settings, _, _ = setup
    router = create_llm_provider(settings)
    calls = []

    def fail(*args, **kwargs):
        raise sqlite3.OperationalError('private-storage-detail')

    monkeypatch.setattr(LLMControlStore, 'record', fail)
    monkeypatch.setattr(httpx, 'post', lambda url, **_: calls.append(url) or response(url))
    assert router.generate_json('system', {}) == {}
    assert len(calls) == 1


def client_for(role=None):
    app = FastAPI()
    app.include_router(llm_admin.router, prefix='/api/v1')
    if role:
        app.dependency_overrides[require_user] = lambda: {'id': 'actor', 'role': role}
    return TestClient(app)


@pytest.mark.parametrize('role,status', [(None, 401), ('user', 403), ('staff', 403)])
def test_management_requires_verified_admin(setup, role, status):
    client = client_for(role)
    assert client.get('/api/v1/admin/llm').status_code == status
    assert client.put('/api/v1/admin/llm', json={'expected_revision': 0, 'models': []}).status_code == status
    assert client.post('/api/v1/admin/llm/' + 'a' * 24 + '/test').status_code == status


def test_admin_round_trip_no_secrets_and_conflict_handling(setup):
    _, store, models = setup
    client = client_for('admin')
    result = client.get('/api/v1/admin/llm')
    assert result.status_code == 200 and result.headers['cache-control'] == 'no-store'
    assert 'private' not in result.text and 'api_key' not in result.text and 'base_url' not in result.text
    body = {'expected_revision': 0, 'models': rows(list(reversed(models)), 1000)}
    result = client.put('/api/v1/admin/llm', json=body)
    assert result.status_code == 200 and result.json()['revision'] == 1
    assert result.json()['models'][0]['provider'] == 'cloudflare'
    assert client.put('/api/v1/admin/llm', json=body).status_code == 409
    body['expected_revision'] = 1
    body['models'] = rows([models[0], models[0]])
    assert client.put('/api/v1/admin/llm', json=body).status_code == 400
    body['models'] = rows(models, -1)
    assert client.put('/api/v1/admin/llm', json=body).status_code == 422


def test_storage_errors_are_sanitized(setup, monkeypatch):
    def fail(self, models):
        raise sqlite3.OperationalError('secret-path-and-key')

    monkeypatch.setattr(LLMControlStore, 'overview', fail)
    response = client_for('admin').get('/api/v1/admin/llm')
    assert response.status_code == 503 and 'secret' not in response.text


def test_full_application_exposes_admin_route_and_health(setup):
    from src.main import create_app

    app = create_app()
    app.dependency_overrides[require_user] = lambda: {'id': 'actor', 'role': 'admin'}
    client = TestClient(app)
    assert client.get('/health').status_code == 200
    response = client.get('/api/v1/admin/llm')
    assert response.status_code == 200
    assert [row['provider'] for row in response.json()['models']] == ['groq', 'cloudflare']


def test_connection_probe_targets_only_clicked_model_and_records_usage(setup, monkeypatch):
    _, store, models = setup
    calls = []

    def post(url, **kwargs):
        calls.append((url, kwargs['json']['model']))
        assert kwargs['timeout'] == 30
        return response(url, content='{"status":"ok"}',
                        usage={'prompt_tokens': 8, 'completion_tokens': 4, 'total_tokens': 12})

    monkeypatch.setattr(httpx, 'post', post)
    result = client_for('admin').post(f"/api/v1/admin/llm/{models[1]['id']}/test")
    assert result.status_code == 200 and result.headers['cache-control'] == 'no-store'
    assert result.json()['status'] == 'succeeded' and result.json()['provider'] == 'cloudflare'
    assert result.json()['elapsed_ms'] >= 0
    assert calls == [('https://cloudflare.invalid/v1/chat/completions', 'cf-test')]
    overview = store.overview(models)
    assert overview['models'][0]['requests'] == 0
    assert overview['models'][1]['total_tokens'] == 12
    assert overview['revision'] == 0
    assert [row['id'] for row in overview['models']] == [row['id'] for row in models]


@pytest.mark.parametrize('status,code', [(401, 'access_denied'), (403, 'access_denied'),
    (402, 'quota_exhausted'), (429, 'rate_limited'), (503, 'provider_unavailable')])
def test_failed_connection_probe_is_sanitized_and_does_not_fail_over(setup, monkeypatch, status, code):
    _, store, models = setup
    calls = []

    def post(url, **kwargs):
        calls.append(url)
        return response(url, status=status, content='private-provider-error-and-key')

    monkeypatch.setattr(httpx, 'post', post)
    result = client_for('admin').post(f"/api/v1/admin/llm/{models[0]['id']}/test")
    assert result.status_code == 200
    assert result.json()['status'] == 'failed'
    assert result.json()['error_code'] == code and result.json()['http_status'] == status
    assert 'private' not in result.text
    assert len(calls) == 1 and 'groq' in calls[0]
    assert store.overview(models)['models'][0]['requests'] == 1


@pytest.mark.parametrize('error,code', [(httpx.ReadTimeout('secret-timeout'), 'timeout'),
                                      (httpx.ConnectError('secret-connection'), 'connection_failed')])
def test_network_probe_errors_do_not_fail_over(setup, monkeypatch, error, code):
    _, store, models = setup
    calls = []

    def post(url, **kwargs):
        calls.append(url)
        raise error

    monkeypatch.setattr(httpx, 'post', post)
    result = client_for('admin').post(f"/api/v1/admin/llm/{models[0]['id']}/test")
    assert result.json()['error_code'] == code and result.json()['http_status'] is None
    assert 'secret' not in result.text and len(calls) == 1
    assert store.overview(models)['models'][0]['failed_requests'] == 1


@pytest.mark.parametrize('content', ['invalid JSON', '{"status":"wrong"}'])
def test_probe_requires_valid_structured_response(setup, monkeypatch, content):
    _, _, models = setup
    calls = []
    monkeypatch.setattr(httpx, 'post', lambda url, **_: calls.append(url) or response(url, content=content))
    result = client_for('admin').post(f"/api/v1/admin/llm/{models[0]['id']}/test")
    assert result.json()['error_code'] == 'invalid_response' and len(calls) == 1


def test_unknown_model_probe_never_calls_external_service(setup, monkeypatch):
    def unexpected(*args, **kwargs):
        pytest.fail('Unknown model must not make an external request')

    monkeypatch.setattr(httpx, 'post', unexpected)
    assert client_for('admin').post('/api/v1/admin/llm/not-configured/test').status_code == 404
