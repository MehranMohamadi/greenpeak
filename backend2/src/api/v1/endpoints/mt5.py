"""Per-user MT5 pairing, authenticated ingestion, and private dashboard reads."""

from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response, status
from pydantic import BaseModel, Field
from pymongo.errors import PyMongoError

from ....models.mt5_schemas import MT5Snapshot, MT5SnapshotReceipt
from ....services.mt5_connection_service import MT5ConnectionService
from ....services.mt5_snapshot_service import MT5SnapshotService
from .auth import require_user


router = APIRouter(prefix="/mt5", tags=["mt5"])


class ConnectionCreate(BaseModel):
    label: str = Field(default="MetaTrader 5", min_length=1, max_length=80)


class ConnectionResponse(BaseModel):
    id: str
    label: str
    status: str
    account_identity: dict[str, str] | None = None
    created_at: datetime
    last_seen_at: datetime | None = None


class PairingResponse(BaseModel):
    connection: ConnectionResponse
    pairing_token: str


def snapshot_service() -> MT5SnapshotService:
    return MT5SnapshotService()


def connection_service() -> MT5ConnectionService:
    return MT5ConnectionService()


def _bearer_token(authorization: str | None) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        return ""
    return authorization[7:].strip()


@router.post("/connections", response_model=PairingResponse, status_code=status.HTTP_201_CREATED)
def create_connection(
    body: ConnectionCreate,
    user: Annotated[dict, Depends(require_user)],
    service: Annotated[MT5ConnectionService, Depends(connection_service)],
):
    try:
        connection, token = service.create(user["id"], body.label)
        return PairingResponse(connection=ConnectionResponse(**connection), pairing_token=token)
    except PyMongoError as exc:
        raise HTTPException(status_code=503, detail="MT5 connection storage unavailable") from exc


@router.get("/connections", response_model=list[ConnectionResponse])
def list_connections(
    user: Annotated[dict, Depends(require_user)],
    service: Annotated[MT5ConnectionService, Depends(connection_service)],
):
    try:
        return [ConnectionResponse(**item) for item in service.list_for_user(user["id"])]
    except PyMongoError as exc:
        raise HTTPException(status_code=503, detail="MT5 connection storage unavailable") from exc


@router.delete("/connections/{connection_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_connection(
    connection_id: str,
    user: Annotated[dict, Depends(require_user)],
    service: Annotated[MT5ConnectionService, Depends(connection_service)],
):
    try:
        if not service.revoke(user["id"], connection_id):
            raise HTTPException(status_code=404, detail="MT5 connection not found")
    except PyMongoError as exc:
        raise HTTPException(status_code=503, detail="MT5 connection storage unavailable") from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/snapshots", response_model=MT5SnapshotReceipt)
def ingest_snapshot(
    snapshot: MT5Snapshot,
    snapshots: Annotated[MT5SnapshotService, Depends(snapshot_service)],
    connections: Annotated[MT5ConnectionService, Depends(connection_service)],
    authorization: str | None = Header(default=None),
) -> MT5SnapshotReceipt:
    token = _bearer_token(authorization)
    if not token:
        raise HTTPException(status_code=401, detail="MT5 pairing token required")
    try:
        connection = connections.resolve_and_bind(token, snapshot.source.model_dump())
        if connection is None:
            raise HTTPException(status_code=401, detail="Invalid pairing token or account mismatch")
        result = snapshots.store(snapshot, connection["user_id"], str(connection["_id"]))
    except PyMongoError as exc:
        raise HTTPException(status_code=503, detail="Snapshot storage unavailable") from exc
    return MT5SnapshotReceipt(status=result, snapshot_id=snapshot.snapshot_id, received_at_utc=datetime.now(timezone.utc))


@router.get("/snapshots", response_model=list[MT5Snapshot])
def all_snapshots(
    user: Annotated[dict, Depends(require_user)],
    service: Annotated[MT5SnapshotService, Depends(snapshot_service)],
) -> list[MT5Snapshot]:
    try:
        items = service.all_snapshots(user["id"])
    except PyMongoError as exc:
        raise HTTPException(status_code=503, detail="Snapshot storage unavailable") from exc
    return [MT5Snapshot.model_validate(item) for item in items]


@router.get("/snapshots/latest", response_model=MT5Snapshot)
def latest_snapshot(
    user: Annotated[dict, Depends(require_user)],
    service: Annotated[MT5SnapshotService, Depends(snapshot_service)],
    account_identifier: str | None = Query(default=None, max_length=128),
) -> MT5Snapshot:
    try:
        snapshot = service.latest(user["id"], account_identifier)
    except PyMongoError as exc:
        raise HTTPException(status_code=503, detail="Snapshot storage unavailable") from exc
    if snapshot is None:
        raise HTTPException(status_code=404, detail="No MT5 snapshot found")
    return MT5Snapshot.model_validate(snapshot)


@router.get("/snapshots/latest-by-account", response_model=list[MT5Snapshot])
def latest_snapshots_by_account(
    user: Annotated[dict, Depends(require_user)],
    service: Annotated[MT5SnapshotService, Depends(snapshot_service)],
) -> list[MT5Snapshot]:
    try:
        items = service.latest_by_account(user["id"])
    except PyMongoError as exc:
        raise HTTPException(status_code=503, detail="Snapshot storage unavailable") from exc
    return [MT5Snapshot.model_validate(item) for item in items]
