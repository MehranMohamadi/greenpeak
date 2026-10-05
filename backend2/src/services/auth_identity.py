"""Google identities and single-use email verification/password recovery."""

import hashlib
import hmac
import re
import secrets
import smtplib
import ssl
import time
from datetime import datetime, timezone
from email.message import EmailMessage
from urllib.parse import urlencode

from pymongo.errors import DuplicateKeyError

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
        if not self.settings.smtp_host or not self.settings.smtp_from:
            raise AuthStorageError("Email delivery is not configured.")

    def send(self, email, purpose, token):
        self.check()
        settings = self.settings
        route = "verify-email" if purpose == "verification" else "reset-password"
        link = f"{settings.auth_public_url.rstrip('/')}/{route}#{urlencode({'token': token})}"
        message = EmailMessage()
        message["From"] = settings.smtp_from
        message["To"] = email
        message["Subject"] = "Verify your GreenPeak email" if purpose == "verification" else "Reset your GreenPeak password"
        message.set_content(f"{message['Subject']}\n\n{link}\n\nThis link expires in {settings.auth_email_token_ttl_seconds // 60} minutes and can be used once. If you did not request this, ignore this email.")
        try:
            factory = smtplib.SMTP_SSL if settings.smtp_ssl else smtplib.SMTP
            options = {"context": ssl.create_default_context()} if settings.smtp_ssl else {}
            with factory(settings.smtp_host, settings.smtp_port, timeout=15, **options) as server:
                if settings.smtp_starttls and not settings.smtp_ssl:
                    server.starttls(context=ssl.create_default_context())
                if settings.smtp_username:
                    server.login(settings.smtp_username, settings.smtp_password)
                server.send_message(message)
        except (OSError, smtplib.SMTPException) as exc:
            raise AuthStorageError("Email delivery is temporarily unavailable.") from exc


def verify_google(credential, client_id):
    if not client_id:
        raise AuthStorageError("Google sign-in is not configured.")
    try:
        from google.auth.exceptions import GoogleAuthError
        from google.auth.transport.requests import Request
        from google.oauth2.id_token import verify_oauth2_token
    except ImportError as exc:
        raise AuthStorageError("Google sign-in is temporarily unavailable.") from exc

    class TimedRequest(Request):
        def __call__(self, *args, **kwargs):
            kwargs["timeout"] = 10
            return super().__call__(*args, **kwargs)

    try:
        # google-auth validates signature, audience, expiry and Google issuer.
        return verify_oauth2_token(credential, TimedRequest(), client_id)
    except ValueError as exc:
        raise AuthError("Invalid Google sign-in. Please try again.") from exc
    except GoogleAuthError as exc:
        raise AuthStorageError("Google verification is temporarily unavailable.") from exc


class IdentityService:
    def __init__(self, auth, settings, sender=None, google_verifier=None):
        self.auth = auth
        self.users = auth.collection
        self.settings = settings
        self.sender = sender or EmailSender(settings)
        self.google_verifier = google_verifier or verify_google

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
        if purpose == "reset" and not document.get("password_hash"):
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

    def google(self, credential, nonce, current_user=None):
        claims = self.google_verifier(credential, self.settings.google_client_id)
        if not nonce or not hmac.compare_digest(str(claims.get("nonce", "")).encode(), nonce.encode()):
            raise AuthError("Google sign-in expired. Refresh the page and try again.")
        if not claims.get("sub") or claims.get("email_verified") is not True:
            raise AuthError("Google did not provide a verified email.")
        email = normalize_email(claims.get("email", ""))
        subject = str(claims["sub"])
        self.auth.ensure_indexes()
        document = self.users.find_one({"google_sub": subject})
        if current_user:
            if document and str(document["_id"]) != current_user["id"]:
                raise AuthError("This Google account is linked to another account.")
            own = self.users.find_one({"username_normalized": current_user["username"].casefold()})
            if own.get("google_sub") and own["google_sub"] != subject:
                raise AuthError("A different Google account is already linked.")
            if own.get("google_sub") == subject:
                return current_user, None
            try:
                result = self.users.update_one({"_id": own["_id"], "google_sub": own.get("google_sub")}, {"$set": {"google_sub": subject}})
                if not result.modified_count:
                    raise AuthError("Account changed. Please refresh and try again.")
            except DuplicateKeyError as exc:
                raise AuthError("This Google account is already linked.") from exc
            return current_user, None
        if document is None:
            if self.users.find_one({"email_normalized": email}):
                raise AuthError("An account with this email already exists. Sign in first, then connect Google in Settings.")
            authoritative = email.endswith("@gmail.com") or bool(claims.get("hd"))
            if not authoritative:
                self.sender.check()
            username = "google_" + secrets.token_hex(10)
            document = {"username": username, "username_normalized": username, "email_normalized": email,
                        "google_sub": subject, "email_verified": authoritative, "password_hash": "",
                        "role": "user", "is_active": True, "created_at": datetime.now(timezone.utc),
                        "updated_at": datetime.now(timezone.utc), "session_version": 0}
            try:
                document["_id"] = self.users.insert_one(document).inserted_id
            except DuplicateKeyError as exc:
                raise AuthError("Account already exists. Please try signing in again.") from exc
        if not document.get("is_active", True):
            raise AuthError("This account is disabled.")
        if document.get("email_verified") is False:
            self.send_link(document, "verification")
            return None, None
        user = {"id": str(document["_id"]), "username": document["username"], "role": document.get("role", "user")}
        return user, self.auth.create_token({**user, "session_version": document.get("session_version", 0)})
