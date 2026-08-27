"""Versioned contracts for read-only MetaTrader 5 account snapshots."""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class MT5Section(BaseModel):
    """Forward-compatible object emitted by the versioned EA."""

    model_config = ConfigDict(extra="allow")


class MT5Source(MT5Section):
    ea_name: str
    ea_version: str
    terminal_build: int | None = None
    broker_company: str
    trade_server: str
    account_identifier: str
    send_mode: Literal["manual", "automatic"]


class MT5Account(MT5Section):
    currency: str
    balance: float
    equity: float
    used_margin: float
    free_margin: float
    margin_level_pct: float | None = None
    floating_profit_loss: float


class MT5PortfolioMetrics(MT5Section):
    net_portfolio_exposure_usd: float | None = None
    gross_portfolio_exposure_usd: float | None = None
    net_portfolio_leverage: float | None = None
    gross_portfolio_leverage: float | None = None
    account_current_drawdown_pct: float | None = None


class MT5Snapshot(BaseModel):
    """Complete immutable snapshot. Unknown additive fields remain preserved."""

    model_config = ConfigDict(extra="allow")

    schema_version: str = Field(pattern=r"^1(?:\.\d+){1,2}$")
    snapshot_id: str = Field(min_length=8, max_length=160)
    timestamp_utc: datetime
    source: MT5Source
    account: MT5Account
    portfolio_metrics: MT5PortfolioMetrics
    symbol_metrics: list[dict[str, Any]] = Field(default_factory=list)
    positions: list[dict[str, Any]] = Field(default_factory=list)
    pending_orders: list[dict[str, Any]] = Field(default_factory=list)
    broker_symbol_data: list[dict[str, Any]] = Field(default_factory=list)
    swap_metrics: dict[str, Any] = Field(default_factory=dict)
    trade_history_delta: list[dict[str, Any]] = Field(default_factory=list)
    calculation_status: dict[str, Any] = Field(default_factory=dict)

    @field_validator("timestamp_utc")
    @classmethod
    def require_utc_timestamp(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("timestamp_utc must include a UTC offset")
        if value.utcoffset().total_seconds() != 0:
            raise ValueError("timestamp_utc must be UTC")
        return value


class MT5SnapshotReceipt(BaseModel):
    status: Literal["accepted", "already_exists"]
    snapshot_id: str
    received_at_utc: datetime
