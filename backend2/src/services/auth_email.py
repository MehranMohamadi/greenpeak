"""Single-use email verification and password recovery via the Resend API."""

import hashlib
import re
import secrets
import time
from datetime import datetime, timezone
from html import escape
from urllib.parse import urlencode

from pymongo.errors import DuplicateKeyError
import requests

from .auth import AuthError, AuthStorageError, USERNAME_PATTERN, hash_password


def normalize_email(value):
    if not isinstance(value, str):
        raise AuthError("Enter a valid email address.")
    value = value.strip().casefold()
    if len(value) > 254 or not re.fullmatch(r"[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+", value):
        raise AuthError("Enter a valid email address.")
    return value


class EmailSender:
    def __init__(self, settings):
        self.settings = settings

    def check(self):
        if not self.settings.resend_api_key or not self.settings.auth_email_from:
            raise AuthStorageError("Email service is temporarily unavailable. Please try again later.")

    def send(self, email, purpose, token):
        self.check()
        settings = self.settings
        route = "verify-email" if purpose == "verification" else "reset-password"
        link = f"{settings.auth_public_url.rstrip('/')}/{route}#{urlencode({'token': token})}"
        subject = "Verify your GreenPeak email" if purpose == "verification" else "Reset your GreenPeak password"
        action = "Verify email" if purpose == "verification" else "Reset password"
        footer = f"This link expires in {settings.auth_email_token_ttl_seconds // 60} minutes and can be used once. If you did not request this, ignore this email."
        payload = {"from": settings.auth_email_from, "to": [email], "subject": subject,
                   "text": f"{subject}\n\n{link}\n\n{footer}",
                   "html": f'<h1>{subject}</h1><p><a href="{escape(link, quote=True)}">{action}</a></p><p>{footer}</p>'}
        try:
            response = requests.post(
                "https://api.resend.com/emails", json=payload, timeout=15, allow_redirects=False,
                headers={"Authorization": f"Bearer {settings.resend_api_key}",
                         "Idempotency-Key": f"auth-{purpose}-{hashlib.sha256(token.encode()).hexdigest()}"},
            )
            if not 200 <= response.status_code < 300:
                raise AuthStorageError("Email delivery is temporarily unavailable.")
        except requests.RequestException as exc:
            raise AuthStorageError("Email delivery is temporarily unavailable.") from exc


class EmailAuthService:
    def __init__(self, auth, settings, sender=None):
        self.auth = auth
        self.users = auth.collection
        self.settings = settings
        self.sender = sender or EmailSender(settings)

    def signup(self, username, email, password):
        email = normalize_email(email)
        username = username.strip()
        if not USERNAME_PATTERN.fullmatch(username):
            raise AuthError("Username must be 3-32 characters: letters, numbers, dot, dash or underscore.")
        self.validate_password(password)
        self.sender.check()
        self.auth.ensure_indexes()
        if self.users.find_one({"email_normalized": email}):
            # Never replace an existing account/password via a signup request.
            return
        now = datetime.now(timezone.utc)
        document = {"username": username, "username_normalized": username.casefold(),
                    "email_normalized": email, "email_verified": False,
                    "password_hash": hash_password(password), "role": "user", "is_active": True,
                    "created_at": now, "updated_at": now, "session_version": 0}
        try:
            result = self.users.insert_one(document)
        except DuplicateKeyError as exc:
            raise AuthError("This username or email is already registered.") from exc
        document["_id"] = result.inserted_id
        self.send_link(document, "verification")

    @staticmethod
    def validate_password(password):
        if not 8 <= len(password) <= 128:
            raise AuthError("Password must be between 8 and 128 characters.")

    def send_link(self, document, purpose):
        self.sender.check()
        now = int(time.time())
        last_sent = document.get(f"{purpose}_sent_at", 0)
        if last_sent > now - 60:
            return
        token = secrets.token_urlsafe(32)
        fields = {f"{purpose}_hash": hashlib.sha256(token.encode()).hexdigest(),
                  f"{purpose}_expires": now + self.settings.auth_email_token_ttl_seconds,
                  f"{purpose}_sent_at": now}
        query = {"_id": document["_id"]}
        # Atomic throttle prevents concurrent email requests for the same user.
        if last_sent:
            query[f"{purpose}_sent_at"] = last_sent
        else:
            query[f"{purpose}_sent_at"] = None
        if not self.users.update_one(query, {"$set": fields}).modified_count:
            return
        try:
            self.sender.send(document["email_normalized"], purpose, token)
        except AuthStorageError:
            self.users.update_one({"_id": document["_id"], f"{purpose}_hash": fields[f"{purpose}_hash"]},
                                  {"$unset": {key: "" for key in fields}})
            raise

    def request_link(self, email, purpose):
        email = normalize_email(email)
        self.sender.check()
        document = self.users.find_one({"email_normalized": email})
        if not document or not document.get("is_active", True):
            return
        if purpose == "verification" and document.get("email_verified") is not False:
            return
        self.send_link(document, purpose)

    def consume_link(self, token, purpose, password=None):
        digest = hashlib.sha256(token.encode()).hexdigest()
        document = self.users.find_one({f"{purpose}_hash": digest})
        if not document or not document.get("is_active", True) or document.get(f"{purpose}_expires", 0) <= time.time():
            raise AuthError("This link is invalid or expired. Please request a new one.")
        fields = {"updated_at": datetime.now(timezone.utc)}
        if purpose == "verification":
            fields["email_verified"] = True
        else:
            self.validate_password(password)
            fields["password_hash"] = hash_password(password)
            # Recovery also proves email ownership; old sessions are revoked.
            fields["email_verified"] = True
        update = {"$set": fields, "$unset": {f"{purpose}_{key}": "" for key in ("hash", "expires", "sent_at")}}
        if purpose == "reset":
            update["$inc"] = {"session_version": 1}
        if not self.users.update_one({"_id": document["_id"], f"{purpose}_hash": digest}, update).modified_count:
            raise AuthError("This link has already been used.")

