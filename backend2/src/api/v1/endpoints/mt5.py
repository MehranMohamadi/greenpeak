"""Authenticated MT5 snapshot ingestion and dashboard reads."""

from datetime import datetime, timezone
from hmac import compare_digest

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from pymongo.errors import PyMongoError

from ....core.config import get_settings
from ....models.mt5_schemas import MT5Snapshot, MT5SnapshotReceipt
from ....services.mt5_snapshot_service import MT5SnapshotService

router = APIRouter(prefix="/mt5", tags=["mt5"])


def _configured_tokens() -> tuple[str, ...]:
    return tuple(
        token.strip()
        for token in get_settings().greenpeak_mt5_api_tokens.split(",")
        if token.strip()
    )


def require_mt5_token(authorization: str | None = Header(default=None)) -> None:
    tokens = _configured_tokens()
    supplied = ""
    if authorization and authorization.startswith("Bearer "):
        supplied = authorization[7:].strip()
    if not tokens or not supplied or not any(compare_digest(supplied, token) for token in tokens):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid MT5 API token")


def snapshot_service() -> MT5SnapshotService:
    return MT5SnapshotService()


@router.post("/snapshots", response_model=MT5SnapshotReceipt, dependencies=[Depends(require_mt5_token)])
def ingest_snapshot(
    snapshot: MT5Snapshot,
    service: MT5SnapshotService = Depends(snapshot_service),
) -> MT5SnapshotReceipt:
    try:
        result = service.store(snapshot)
    except PyMongoError as exc:
        raise HTTPException(status_code=503, detail="Snapshot storage unavailable") from exc
    return MT5SnapshotReceipt(
        status=result,
        snapshot_id=snapshot.snapshot_id,
        received_at_utc=datetime.now(timezone.utc),
    )


@router.get("/snapshots/latest", response_model=MT5Snapshot, dependencies=[Depends(require_mt5_token)])
def latest_snapshot(
    account_identifier: str | None = Query(default=None, max_length=128),
    service: MT5SnapshotService = Depends(snapshot_service),
) -> MT5Snapshot:
    try:
        snapshot = service.latest(account_identifier)
    except PyMongoError as exc:
        raise HTTPException(status_code=503, detail="Snapshot storage unavailable") from exc
    if snapshot is None:
        raise HTTPException(status_code=404, detail="No MT5 snapshot found")
    return MT5Snapshot.model_validate(snapshot)
