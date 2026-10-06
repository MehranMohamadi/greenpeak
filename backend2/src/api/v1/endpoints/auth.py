"""Public signup/login endpoints and authenticated session lookup."""

from functools import lru_cache
from typing import Annotated
import time
from collections import deque
from threading import Lock

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field
from pymongo.errors import PyMongoError

from ....core.config import get_settings
from ....services.auth import AuthError, AuthService, AuthStorageError
from ....services.auth_email import EmailAuthService


router = APIRouter(prefix="/auth", tags=["Authentication"])
bearer = HTTPBearer(auto_error=False)


class Credentials(BaseModel):
    username: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=6, max_length=128)


class UserResponse(BaseModel):
    id: str
    username: str
    role: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class SignupCredentials(BaseModel):
    username: str = Field(min_length=3, max_length=32)
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=8, max_length=128)


class EmailRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)


class LinkRequest(BaseModel):
    token: str = Field(min_length=20, max_length=256)


class ResetRequest(LinkRequest):
    password: str = Field(min_length=8, max_length=128)


class MessageResponse(BaseModel):
    message: str
    verification_required: bool = False


@lru_cache(maxsize=1)
def get_auth_service() -> AuthService:
    try:
        return AuthService.from_settings(get_settings())
    except (AuthStorageError, PyMongoError) as exc:
        raise auth_failure(exc) from exc


def get_email_auth_service(service: Annotated[AuthService, Depends(get_auth_service)]):
    return EmailAuthService(service, get_settings())


_attempts = {}
_attempt_lock = Lock()


def limit_auth_requests(request: Request):
    # Per-process guard; deploy an edge/global limiter for multiple workers.
    key = request.client.host if request.client else "unknown"
    now = time.monotonic()
    with _attempt_lock:
        expired = [key for key, values in _attempts.items() if not values or values[-1] <= now - 600]
        for expired_key in expired:
            del _attempts[expired_key]
        attempts = _attempts.setdefault(key, deque())
        while attempts and attempts[0] <= now - 600:
            attempts.popleft()
        if len(attempts) >= 30 or len(_attempts) > 10000:
            raise HTTPException(429, "Too many attempts. Please try again later.", headers={"Retry-After": "600"})
        attempts.append(now)


def auth_failure(exc: Exception) -> HTTPException:
    if isinstance(exc, AuthError):
        return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc))
    detail = str(exc) if isinstance(exc, AuthStorageError) else "Authentication database is unavailable."
    return HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=detail)


def set_session_cookie(response, token):
    settings = get_settings()
    response.set_cookie("gp_session", token, max_age=settings.auth_token_ttl_seconds,
                        httponly=True, secure=settings.auth_public_url.startswith("https://"), samesite="lax", path="/")
    response.headers["Cache-Control"] = "no-store"


def check_browser_origin(request):
    origin = request.headers.get("origin")
    if origin and origin != get_settings().auth_public_url.rstrip("/"):
        raise HTTPException(403, "Invalid request origin.")


@router.post("/signup", response_model=MessageResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(limit_auth_requests)])
def signup(credentials: SignupCredentials, service: Annotated[EmailAuthService, Depends(get_email_auth_service)]):
    try:
        service.signup(credentials.username, credentials.email, credentials.password)
        return MessageResponse(message="Check your email to verify your account. If already registered, sign in or recover your password.", verification_required=True)
    except (AuthError, AuthStorageError, PyMongoError) as exc:
        error = auth_failure(exc)
        if isinstance(exc, AuthError) and "already registered" in str(exc):
            error.status_code = status.HTTP_409_CONFLICT
        raise error from exc


@router.post("/login", response_model=AuthResponse, dependencies=[Depends(limit_auth_requests)])
def login(credentials: Credentials, request: Request, response: Response, service: Annotated[AuthService, Depends(get_auth_service)]):
    check_browser_origin(request)
    try:
        settings = get_settings()
        if settings.environment == "development" and settings.auth_local_test_user_enabled:
            service.ensure_test_user(settings.auth_local_test_username, settings.auth_local_test_password)
        user, token = service.login(credentials.username, credentials.password)
        set_session_cookie(response, token)
        return AuthResponse(access_token=token, user=UserResponse(**user))
    except (AuthError, AuthStorageError, PyMongoError) as exc:
        raise auth_failure(exc) from exc


@router.get("/me", response_model=UserResponse)
def me(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    service: Annotated[AuthService, Depends(get_auth_service)],
):
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")
    try:
        return UserResponse(**service.user_from_token(credentials.credentials))
    except (AuthError, AuthStorageError, PyMongoError) as exc:
        raise auth_failure(exc) from exc


def require_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    service: Annotated[AuthService, Depends(get_auth_service)],
) -> dict:
    """Resolve an authenticated dashboard user for other API routers."""
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")
    try:
        return service.user_from_token(credentials.credentials)
    except (AuthError, AuthStorageError, PyMongoError) as exc:
        raise auth_failure(exc) from exc


@router.post("/session/migrate", response_model=AuthResponse)
def migrate_session(request: Request, response: Response,
                    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
                    user: Annotated[dict, Depends(require_user)]):
    check_browser_origin(request)
    set_session_cookie(response, credentials.credentials)
    return AuthResponse(access_token=credentials.credentials, user=UserResponse(**user))


@router.get("/session", response_model=AuthResponse)
def session(request: Request, response: Response, service: Annotated[AuthService, Depends(get_auth_service)]):
    check_browser_origin(request)
    token = request.cookies.get("gp_session", "")
    try:
        user = service.user_from_token(token)
        response.headers["Cache-Control"] = "no-store"
        return AuthResponse(access_token=token, user=UserResponse(**user))
    except (AuthError, AuthStorageError, PyMongoError) as exc:
        raise auth_failure(exc) from exc


@router.post("/logout", response_model=MessageResponse)
def logout(request: Request, response: Response):
    check_browser_origin(request)
    response.delete_cookie("gp_session", path="/")
    response.headers["Cache-Control"] = "no-store"
    return MessageResponse(message="Signed out.")


@router.post("/verify-email", response_model=MessageResponse, dependencies=[Depends(limit_auth_requests)])
def verify_email(body: LinkRequest, service: Annotated[EmailAuthService, Depends(get_email_auth_service)]):
    try:
        service.consume_link(body.token, "verification")
        return MessageResponse(message="Email verified. You can now sign in.")
    except (AuthError, AuthStorageError, PyMongoError) as exc:
        raise auth_failure(exc) from exc


@router.post("/resend-verification", response_model=MessageResponse, dependencies=[Depends(limit_auth_requests)])
def resend_verification(body: EmailRequest, service: Annotated[EmailAuthService, Depends(get_email_auth_service)]):
    return request_email_link(body.email, "verification", service)


@router.post("/forgot-password", response_model=MessageResponse, dependencies=[Depends(limit_auth_requests)])
def forgot_password(body: EmailRequest, service: Annotated[EmailAuthService, Depends(get_email_auth_service)]):
    return request_email_link(body.email, "reset", service)


def request_email_link(email, purpose, service):
    try:
        service.request_link(email, purpose)
        return MessageResponse(message="If an eligible account exists, we have sent an email. Check your inbox and spam folder.")
    except (AuthError, AuthStorageError, PyMongoError) as exc:
        raise auth_failure(exc) from exc


@router.post("/reset-password", response_model=MessageResponse, dependencies=[Depends(limit_auth_requests)])
def reset_password(body: ResetRequest, service: Annotated[EmailAuthService, Depends(get_email_auth_service)]):
    try:
        service.consume_link(body.token, "reset", body.password)
        return MessageResponse(message="Password reset. Sign in with your new password.")
    except (AuthError, AuthStorageError, PyMongoError) as exc:
        raise auth_failure(exc) from exc
