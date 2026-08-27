"""Versioned indicator definitions and feature configuration."""

from copy import deepcopy

from ..greenpeak_config import load_registry, stable_hash

SCHEMA_VERSION = "1.1"
FEATURE_VERSION = "0.2.0"
DEFINITION_VERSION = "1.0"

def _definitions() -> dict:
    _, templates, indicators = load_registry()
    result = {}
    for indicator_id, item in indicators.items():
        template = templates[item.feature_template]
        feature_config = template.model_dump(exclude={"template_id", "feature_config_version", "required_features", "optional_features"})
        feature_config.update(item.feature_overrides)
        result[indicator_id] = {
            "indicator_id": indicator_id,
            "name_en": item.display.name_en, "name_fa": item.display.name_fa,
            "source": {"provider": item.source.provider, "series_id": item.source.series_id, "collection": item.source.collection},
            "data": {"frequency": item.source.frequency, "unit": item.display.unit, "delta_unit": template.change_unit, "timezone": "UTC"},
            "raw_indicator": item.raw_indicator, "semantics": item.semantics,
            "classification": item.classification.model_dump(), "feature_config": feature_config,
            "feature_config_version": template.feature_config_version,
            "feature_config_hash": stable_hash({"template": template.model_dump(), "overrides": item.feature_overrides}),
            "definition_version": item.definition_version,
        }
    return result


DEFINITIONS = _definitions()


def get_definition(indicator_id: str) -> dict:
    definition = deepcopy(DEFINITIONS[indicator_id])
    definition.update(schema_version=SCHEMA_VERSION, active=True)
    return definition
