"""Public signup/login endpoints and authenticated session lookup."""

from functools import lru_cache
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field
from pymongo.errors import PyMongoError

from ....core.config import get_settings
from ....services.auth import AuthError, AuthService, AuthStorageError


router = APIRouter(prefix="/auth", tags=["Authentication"])
bearer = HTTPBearer(auto_error=False)


class Credentials(BaseModel):
    username: str = Field(min_length=3, max_length=32)
    password: str = Field(min_length=6, max_length=128)


class UserResponse(BaseModel):
    id: str
    username: str
    role: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


@lru_cache(maxsize=1)
def get_auth_service() -> AuthService:
    try:
        return AuthService.from_settings(get_settings())
    except (AuthStorageError, PyMongoError) as exc:
        raise auth_failure(exc) from exc


def auth_failure(exc: Exception) -> HTTPException:
    if isinstance(exc, AuthError):
        return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc))
    return HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Authentication database is unavailable.")


@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def signup(credentials: Credentials, service: Annotated[AuthService, Depends(get_auth_service)]):
    try:
        user, token = service.signup(credentials.username, credentials.password)
        return AuthResponse(access_token=token, user=UserResponse(**user))
    except (AuthError, AuthStorageError, PyMongoError) as exc:
        error = auth_failure(exc)
        if isinstance(exc, AuthError) and "already registered" in str(exc):
            error.status_code = status.HTTP_409_CONFLICT
        raise error from exc


@router.post("/login", response_model=AuthResponse)
def login(credentials: Credentials, service: Annotated[AuthService, Depends(get_auth_service)]):
    try:
        settings = get_settings()
        if settings.environment == "development" and settings.auth_local_test_user_enabled:
            service.ensure_test_user(settings.auth_local_test_username, settings.auth_local_test_password)
        user, token = service.login(credentials.username, credentials.password)
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
