"""Normalization for analysis inputs."""

from datetime import datetime, timezone
from typing import Any

from ...models.analysis_schemas import AnalysisRequest, MetricInput, Unit


class AnalysisNormalizer:
    def normalize(self, request: AnalysisRequest) -> tuple[list[dict[str, Any]], list[str]]:
        items: list[dict[str, Any]] = []
        warnings: list[str] = []
        seen: set[tuple[str, str, datetime | None]] = set()
        as_of = self._utc(request.as_of)

        for item in request.items:
            normalized = self._normalize_item(item)
            timestamp = self._item_timestamp(normalized)
            key = (normalized["type"], normalized["id"], timestamp)
            if key in seen:
                warnings.append(f"Duplicate item detected: {normalized['type']}:{normalized['id']} at {timestamp.isoformat() if timestamp else 'no timestamp'}")
            seen.add(key)
            if timestamp and timestamp > as_of:
                warnings.append(f"Item {normalized['type']}:{normalized['id']} is dated after as_of")
            items.append(normalized)

        return items, warnings

    def _normalize_item(self, item: Any) -> dict[str, Any]:
        data = item.model_dump()
        if isinstance(item, MetricInput):
            data["timestamp"] = self._utc(item.timestamp)
            data["normalized_value"] = self._normalized_value(item.value, item.unit)
            data["display_value"] = self._display_value(item.value, item.unit)
        elif item.type == "time_series":
            data["points"] = sorted(
                ({"timestamp": self._utc(point.timestamp), "value": point.value} for point in item.points),
                key=lambda point: point["timestamp"],
            )
        elif item.type == "news":
            data["published_at"] = self._utc(item.published_at)
        else:
            data["scheduled_at"] = self._utc(item.scheduled_at)
        return data

    @staticmethod
    def _utc(value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)

    @staticmethod
    def _normalized_value(value: float, unit: Unit) -> float:
        if unit == Unit.PERCENT:
            return value / 100
        if unit == Unit.BASIS_POINT:
            return value / 10_000
        return value

    @staticmethod
    def _display_value(value: float, unit: Unit) -> str:
        number = f"{value:g}"
        if unit == Unit.PERCENT:
            return f"{number}%"
        if unit == Unit.BASIS_POINT:
            return f"{number} bps"
        return number

    @staticmethod
    def _item_timestamp(item: dict[str, Any]) -> datetime | None:
        if item["type"] == "metric":
            return item["timestamp"]
        if item["type"] == "news":
            return item["published_at"]
        if item["type"] == "calendar_event":
            return item["scheduled_at"]
        points = item.get("points", [])
        return points[-1]["timestamp"] if points else None
