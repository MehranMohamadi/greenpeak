"""Offline security/contract checks for email authentication."""

import time
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.api.v1.endpoints import auth as routes
from src.services.auth import AuthError, AuthService, AuthStorageError, LocalUserCollection
from src.services.auth_email import EmailSender, EmailAuthService


class Mailbox:
    def __init__(self):
        self.messages = []

    def check(self):
        pass

    def send(self, email, purpose, token):
        self.messages.append((email, purpose, token))


@pytest.fixture
def setup(tmp_path):
    settings = SimpleNamespace(auth_email_token_ttl_seconds=3600,
                               auth_public_url="http://localhost:3000", auth_secret_key="test-secret",
                               auth_token_ttl_seconds=60, environment="development", auth_local_test_user_enabled=False)
    mailbox = Mailbox()
    auth = AuthService(LocalUserCollection(tmp_path / "auth.db"), "test-secret")
    identity = EmailAuthService(auth, settings, mailbox)
    return auth, identity, mailbox, settings


def test_verification_persists_across_restart_and_is_single_use(setup):
    auth, identity, mailbox, _ = setup
    identity.signup("person", "PERSON@example.com", "password12")
    token = mailbox.messages[-1][2]
    raw = auth.collection.find_one({"email_normalized": "person@example.com"})
    assert token not in str(raw)
    with pytest.raises(AuthError, match="verify"):
        auth.login("person@example.com", "password12")
    restarted = AuthService(LocalUserCollection(auth.collection.database_path), "test-secret")
    identity.auth = restarted
    identity.users = restarted.collection
    identity.consume_link(token, "verification")
    assert restarted.login("person@example.com", "password12")[0]["username"] == "person"
    with pytest.raises(AuthError):
        identity.consume_link(token, "verification")


def test_expired_invalid_and_superseded_links_rejected(setup):
    auth, identity, mailbox, _ = setup
    identity.signup("person", "person@example.com", "password12")
    token = mailbox.messages[-1][2]
    auth.collection.update_one({"username_normalized": "person"}, {"$set": {"verification_expires": int(time.time()) - 1, "verification_sent_at": 1}})
    with pytest.raises(AuthError):
        identity.consume_link(token, "verification")
    identity.request_link("person@example.com", "verification")
    with pytest.raises(AuthError):
        identity.consume_link(token, "verification")
    identity.consume_link(mailbox.messages[-1][2], "verification")


def test_recovery_revokes_sessions_and_preserves_other_accounts(setup):
    auth, identity, mailbox, _ = setup
    identity.signup("person", "person@example.com", "password12")
    identity.consume_link(mailbox.messages[-1][2], "verification")
    user, previous = auth.login("person", "password12")
    identity.request_link("person@example.com", "reset")
    reset = mailbox.messages[-1][2]
    with pytest.raises(AuthError):
        identity.consume_link(reset, "verification")
    identity.consume_link(reset, "reset", "newpassword12")
    with pytest.raises(AuthError):
        auth.user_from_token(previous)
    with pytest.raises(AuthError):
        auth.login("person", "password12")
    assert auth.login("person", "newpassword12")[0] == user
    with pytest.raises(AuthError):
        identity.consume_link(reset, "reset", "anotherpass12")


def test_resend_throttled_and_missing_accounts_not_disclosed(setup):
    _, identity, mailbox, _ = setup
    identity.signup("person", "person@example.com", "password12")
    identity.request_link("person@example.com", "verification")
    identity.request_link("missing@example.com", "verification")
    identity.request_link("missing@example.com", "reset")
    assert len(mailbox.messages) == 1
    identity.signup("other", "person@example.com", "changedpass12")
    assert len(mailbox.messages) == 1


def test_missing_mail_configuration_fails_without_creating_user(setup):
    auth, identity, _, settings = setup
    settings.resend_api_key = ""
    settings.auth_email_from = ""
    identity.sender = EmailSender(settings)
    with pytest.raises(AuthStorageError, match="unavailable"):
        identity.signup("person", "person@example.com", "password12")
    assert auth.collection.find_one({"username_normalized": "person"}) is None


def test_existing_sqlite_database_migrates_without_losing_users(tmp_path):
    import sqlite3
    path = tmp_path / "old.db"
    with sqlite3.connect(path) as db:
        db.execute("CREATE TABLE gp_users (id INTEGER PRIMARY KEY, username TEXT NOT NULL, username_normalized TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT DEFAULT 'user', is_active INTEGER DEFAULT 1, created_at TEXT, updated_at TEXT, is_local_test_user INTEGER DEFAULT 0)")
        from src.services.auth import hash_password
        db.execute("INSERT INTO gp_users (username, username_normalized, password_hash) VALUES (?, ?, ?)", ("legacy", "legacy", hash_password("password12")))
    auth = AuthService(LocalUserCollection(path), "test-secret")
    assert auth.login("legacy", "password12")[0]["username"] == "legacy"


def test_full_application_lifespan_health_and_email_api_round_trip(setup, monkeypatch):
    from src import main
    auth, identity, mailbox, settings = setup
    routes._attempts.clear()
    # Start the actual app lifespan without scheduled external jobs.
    for factory in ("create_daily_analysis_scheduler", "create_news_scheduler", "create_official_sentiment_scheduler"):
        monkeypatch.setattr(main, factory, lambda: None)
    monkeypatch.setattr(routes, "get_settings", lambda: settings)
    app = main.create_app()
    app.dependency_overrides[routes.get_auth_service] = lambda: auth
    app.dependency_overrides[routes.get_email_auth_service] = lambda: identity
    with TestClient(app) as client:
        assert client.get("/health").status_code == 200
        assert client.get("/api/v1/system/health").status_code == 200
        signup = client.post("/api/v1/auth/signup", json={"username": "person", "email": "person@example.com", "password": "password12"})
        assert signup.status_code == 201
        assert client.post("/api/v1/auth/resend-verification", json={"email": "person@example.com"}).status_code == 200
        assert len(mailbox.messages) == 1
        assert client.post("/api/v1/auth/verify-email", json={"token": mailbox.messages[-1][2]}).status_code == 200
        login = client.post("/api/v1/auth/login", json={"username": "person@example.com", "password": "password12"})
        assert login.status_code == 200
        assert client.get("/api/v1/auth/session").status_code == 200
        assert client.post("/api/v1/auth/forgot-password", json={"email": "person@example.com"}).status_code == 200
        assert client.post("/api/v1/auth/reset-password", json={"token": mailbox.messages[-1][2], "password": "newpassword12"}).status_code == 200
        assert client.get("/api/v1/auth/session").status_code == 401
        assert client.post("/api/v1/auth/login", json={"username": "person", "password": "newpassword12"}).status_code == 200
        assert client.post("/api/v1/auth/logout").status_code == 200
    routes._attempts.clear()


def test_resend_sends_verification_and_reset_with_safe_idempotency_keys(setup, monkeypatch):
    _, _, _, settings = setup
    settings.resend_api_key = "re_test_private_key"
    settings.auth_email_from = "GreenPeak <no-reply@auth.example.com>"
    post = Mock(return_value=SimpleNamespace(status_code=200))
    monkeypatch.setattr("src.services.auth_email.requests.post", post)
    sender = EmailSender(settings)
    sender.send("person@example.com", "verification", "test-token")
    sender.send("person@example.com", "reset", "test-token")
    url = post.call_args_list[0].args[0]
    verification = post.call_args_list[0].kwargs
    reset = post.call_args_list[1].kwargs
    assert url == "https://api.resend.com/emails"
    assert verification["json"]["from"] == settings.auth_email_from
    assert verification["json"]["to"] == ["person@example.com"]
    assert "http://localhost:3000/verify-email#token=test-token" in verification["json"]["text"]
    assert "http://localhost:3000/reset-password#token=test-token" in reset["json"]["html"]
    assert verification["headers"]["Authorization"] == "Bearer re_test_private_key"
    assert "test-token" not in verification["headers"]["Idempotency-Key"]
    assert verification["headers"]["Idempotency-Key"] != reset["headers"]["Idempotency-Key"]
    assert verification["timeout"] == 15
    assert verification["allow_redirects"] is False


@pytest.mark.parametrize("status", [301, 401, 403, 429, 500])
def test_resend_failure_sanitized_and_retry_does_not_replace_account(setup, monkeypatch, status):
    auth, identity, _, settings = setup
    settings.resend_api_key = "re_private_key"
    settings.auth_email_from = "GreenPeak <no-reply@auth.example.com>"
    post = Mock(return_value=SimpleNamespace(status_code=status, text="secret provider response"))
    monkeypatch.setattr("src.services.auth_email.requests.post", post)
    identity.sender = EmailSender(settings)
    with pytest.raises(AuthStorageError) as failure:
        identity.signup("person", "person@example.com", "password12")
    assert "re_private_key" not in str(failure.value)
    assert "secret provider response" not in str(failure.value)
    document = auth.collection.find_one({"username_normalized": "person"})
    assert document["email_verified"] is False
    assert "verification_hash" not in document
    assert "verification_sent_at" not in document
    post.return_value = SimpleNamespace(status_code=200)
    identity.request_link("person@example.com", "verification")
    assert auth.collection.find_one({"username_normalized": "person"})["verification_hash"]


def test_resend_timeout_is_sanitized(setup, monkeypatch):
    import requests
    _, _, _, settings = setup
    settings.resend_api_key = "re_private_key"
    settings.auth_email_from = "no-reply@auth.example.com"
    monkeypatch.setattr("src.services.auth_email.requests.post", Mock(side_effect=requests.Timeout("secret response")))
    with pytest.raises(AuthStorageError, match="temporarily unavailable"):
        EmailSender(settings).send("person@example.com", "verification", "test-token")


def test_auth_write_rate_limit(setup, monkeypatch):
    auth, identity, _, settings = setup
    routes._attempts.clear()
    monkeypatch.setattr(routes, "get_settings", lambda: settings)
    app = FastAPI()
    app.include_router(routes.router, prefix="/api/v1")
    app.dependency_overrides[routes.get_auth_service] = lambda: auth
    app.dependency_overrides[routes.get_email_auth_service] = lambda: identity
    client = TestClient(app)
    for _ in range(30):
        assert client.post("/api/v1/auth/forgot-password", json={"email": "missing@example.com"}).status_code == 200
    assert client.post("/api/v1/auth/forgot-password", json={"email": "missing@example.com"}).status_code == 429
    routes._attempts.clear()
