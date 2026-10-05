"""Offline security/contract checks for email and Google authentication."""

import time
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.api.v1.endpoints import auth as routes
from src.services.auth import AuthError, AuthService, AuthStorageError, LocalUserCollection
from src.services.auth_identity import EmailSender, IdentityService


class Mailbox:
    def __init__(self):
        self.messages = []

    def check(self):
        pass

    def send(self, email, purpose, token):
        self.messages.append((email, purpose, token))


@pytest.fixture
def setup(tmp_path):
    settings = SimpleNamespace(google_client_id="client-id", auth_email_token_ttl_seconds=3600,
                               auth_public_url="http://localhost:3000", auth_secret_key="test-secret",
                               auth_token_ttl_seconds=60, environment="development", auth_local_test_user_enabled=False)
    mailbox = Mailbox()
    auth = AuthService(LocalUserCollection(tmp_path / "auth.db"), "test-secret")
    verifier = Mock(return_value={"sub": "google-user", "email": "person@gmail.com", "email_verified": True, "nonce": "nonce"})
    identity = IdentityService(auth, settings, mailbox, verifier)
    return auth, identity, mailbox, settings, verifier


def test_verification_persists_across_restart_and_is_single_use(setup):
    auth, identity, mailbox, _, _ = setup
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
    auth, identity, mailbox, _, _ = setup
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
    auth, identity, mailbox, _, _ = setup
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
    _, identity, mailbox, _, _ = setup
    identity.signup("person", "person@example.com", "password12")
    identity.request_link("person@example.com", "verification")
    identity.request_link("missing@example.com", "verification")
    identity.request_link("missing@example.com", "reset")
    assert len(mailbox.messages) == 1
    identity.signup("other", "person@example.com", "changedpass12")
    assert len(mailbox.messages) == 1


def test_google_uses_subject_and_rejects_invalid_nonce_or_email(setup):
    auth, identity, _, _, verifier = setup
    with pytest.raises(AuthError):
        identity.google("credential", "wrong")
    user, token = identity.google("credential", "nonce")
    assert auth.user_from_token(token) == user
    verifier.return_value = {**verifier.return_value, "email": "changed@gmail.com"}
    assert identity.google("credential", "nonce")[0] == user
    verifier.return_value = {**verifier.return_value, "email_verified": False}
    with pytest.raises(AuthError):
        identity.google("credential", "nonce")


def test_google_external_email_requires_independent_verification(setup):
    auth, identity, mailbox, _, verifier = setup
    verifier.return_value = {**verifier.return_value, "email": "person@example.com"}
    assert identity.google("credential", "nonce") == (None, None)
    assert len(mailbox.messages) == 1
    identity.consume_link(mailbox.messages[0][2], "verification")
    user, token = identity.google("credential", "nonce")
    assert auth.user_from_token(token) == user


def test_google_existing_account_requires_explicit_authenticated_link(setup):
    auth, identity, mailbox, _, verifier = setup
    identity.signup("person", "person@gmail.com", "password12")
    identity.consume_link(mailbox.messages[-1][2], "verification")
    with pytest.raises(AuthError, match="already exists"):
        identity.google("credential", "nonce")
    user, _ = auth.login("person", "password12")
    identity.google("credential", "nonce", current_user=user)
    assert identity.google("credential", "nonce")[0] == user
    other, _ = auth.signup("another", "password12")
    with pytest.raises(AuthError, match="another account"):
        identity.google("credential", "nonce", current_user=other)
    verifier.return_value = {**verifier.return_value, "sub": "different-sub"}
    with pytest.raises(AuthError, match="different Google"):
        identity.google("credential", "nonce", current_user=user)


def test_duplicate_emails_and_subjects_enforced_by_sqlite(setup):
    from pymongo.errors import DuplicateKeyError
    auth, identity, _, _, _ = setup
    identity.google("credential", "nonce")
    existing = auth.collection.find_one({"google_sub": "google-user"})
    with pytest.raises(DuplicateKeyError):
        auth.collection.insert_one({**existing, "username": "other", "username_normalized": "other"})


def test_missing_mail_configuration_fails_without_creating_user(setup):
    auth, identity, _, settings, _ = setup
    settings.smtp_host = ""
    settings.smtp_from = ""
    identity.sender = EmailSender(settings)
    with pytest.raises(AuthStorageError, match="not configured"):
        identity.signup("person", "person@example.com", "password12")
    assert auth.collection.find_one({"username_normalized": "person"}) is None


def test_api_google_challenge_origin_cookie_and_link_protection(setup, monkeypatch):
    auth, identity, _, settings, verifier = setup
    routes._attempts.clear()
    app = FastAPI()
    app.include_router(routes.router, prefix="/api/v1")
    app.dependency_overrides[routes.get_auth_service] = lambda: auth
    app.dependency_overrides[routes.get_identity_service] = lambda: identity
    monkeypatch.setattr(routes, "get_settings", lambda: settings)
    client = TestClient(app)
    challenge = client.get("/api/v1/auth/google/challenge")
    nonce = challenge.json()["nonce"]
    verifier.return_value = {**verifier.return_value, "nonce": nonce}
    body = {"credential": "fake-credential-for-offline-test", "nonce": nonce}
    assert client.post("/api/v1/auth/google", json=body).status_code == 403
    assert client.post("/api/v1/auth/google", json=body, headers={"Origin": "https://evil.example"}).status_code == 403
    assert client.post("/api/v1/auth/google/link", json=body).status_code == 401
    login = client.post("/api/v1/auth/google", json=body, headers={"Origin": settings.auth_public_url})
    assert login.status_code == 200
    assert "HttpOnly" in login.headers["set-cookie"]
    assert client.get("/api/v1/auth/session").status_code == 200
    assert client.post("/api/v1/auth/google", json=body, headers={"Origin": settings.auth_public_url}).status_code == 403
    client.post("/api/v1/auth/logout")
    assert client.get("/api/v1/auth/session").status_code == 401


def test_api_rate_limit(setup, monkeypatch):
    _, _, _, settings, _ = setup
    routes._attempts.clear()
    monkeypatch.setattr(routes, "get_settings", lambda: settings)
    app = FastAPI()
    app.include_router(routes.router, prefix="/api/v1")
    client = TestClient(app)
    for _ in range(30):
        assert client.get("/api/v1/auth/google/challenge").status_code == 200
    assert client.get("/api/v1/auth/google/challenge").status_code == 429
    routes._attempts.clear()


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
    auth, identity, mailbox, settings, _ = setup
    routes._attempts.clear()
    # Start the actual app lifespan without scheduled external jobs.
    for factory in ("create_daily_analysis_scheduler", "create_news_scheduler", "create_official_sentiment_scheduler"):
        monkeypatch.setattr(main, factory, lambda: None)
    monkeypatch.setattr(routes, "get_settings", lambda: settings)
    app = main.create_app()
    app.dependency_overrides[routes.get_auth_service] = lambda: auth
    app.dependency_overrides[routes.get_identity_service] = lambda: identity
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
