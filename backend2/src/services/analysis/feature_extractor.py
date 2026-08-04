"""Feature extraction for normalized analysis items."""

from typing import Any


class AnalysisFeatureExtractor:
    def extract(self, items: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
        features: dict[str, dict[str, Any]] = {}
        for item in items:
            item_type = item["type"]
            if item_type == "metric":
                result = {
                    "type": item_type,
                    "current_value": item["value"],
                    "normalized_value": item["normalized_value"],
                }
            elif item_type == "time_series":
                values = [point["value"] for point in item["points"]]
                result = {"type": item_type, "point_count": len(values)}
                if values:
                    result.update(last_value=values[-1], min_value=min(values), max_value=max(values))
                if len(values) >= 2:
                    previous, current = values[-2], values[-1]
                    result.update(previous_value=previous, absolute_change=current - previous)
                    result["percent_change"] = None if previous == 0 else ((current - previous) / previous) * 100
            elif item_type == "news":
                result = {"type": item_type, "published_at": item["published_at"], "symbol_count": len(item["symbols"])}
            else:
                result = {"type": item_type, "scheduled_at": item["scheduled_at"], "importance": item["importance"]}
            features[item["id"]] = result
        return features
