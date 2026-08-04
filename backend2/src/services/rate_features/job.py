"""Batch orchestration for rate feature snapshots."""

import subprocess
from datetime import UTC, date, datetime
from uuid import uuid4

from pymongo.errors import PyMongoError

from .builder import build_snapshot
from .config import DEFINITIONS, FEATURE_VERSION, get_definition
from .engine import calculate_pair_features
from .schemas import FeatureRun


def code_version() -> str:
    try:
        commit = subprocess.run(["git", "rev-parse", "--short", "HEAD"], capture_output=True, text=True, timeout=2, check=True).stdout.strip()
        return f"git:{commit}"
    except (OSError, subprocess.SubprocessError):
        return "runtime:unknown"


def run_feature_job(repository, indicator_ids: list[str], as_of_date: date, write: bool) -> tuple[list[dict], FeatureRun]:
    run_id = str(uuid4()); started = datetime.now(UTC); version = code_version()
    snapshots = []; clean_frames = {}; warnings = []; errors = []; read_count = 0; valid_count = 0; written = 0
    for indicator_id in indicator_ids:
        try:
            definition = get_definition(indicator_id); definition["indicator_id"] = indicator_id
            raw = repository.load_observations(definition, as_of_date); read_count += len(raw)
            snapshot, clean = build_snapshot(definition, raw, as_of_date, run_id, version)
            valid_count += len(clean); clean_frames[indicator_id] = clean
            if snapshot is None:
                warnings.append(f"{indicator_id}:no_valid_observations"); continue
            snapshots.append(snapshot)
        except PyMongoError:
            errors.append(f"{indicator_id}:feature_store_unavailable")
        except Exception as exc:
            errors.append(f"{indicator_id}:{type(exc).__name__}:{exc}")
    if "us_10y_treasury_yield" in clean_frames and "federal_funds_rate" in clean_frames:
        pair, pair_reasons = calculate_pair_features(clean_frames["us_10y_treasury_yield"], clean_frames["federal_funds_rate"], as_of_date)
        treasury = next((item for item in snapshots if item.indicator_id == "us_10y_treasury_yield"), None)
        if treasury:
            treasury.derived_features.update(pair); treasury.feature_reasons.update(pair_reasons)
    if write:
        repository.ensure_indexes()
        for snapshot in snapshots:
            definition = get_definition(snapshot.indicator_id); definition["indicator_id"] = snapshot.indicator_id
            repository.save_definition(definition)
            result = repository.save_snapshot(snapshot.model_dump(mode="json"))
            if result == "inserted": written += 1
            elif result == "version_conflict": errors.append(f"{snapshot.indicator_id}:version_conflict")
            else: warnings.append(f"{snapshot.indicator_id}:{result}")
    status = "failed" if not snapshots else "partial" if errors or len(snapshots) != len(indicator_ids) else "success"
    run = FeatureRun(run_id=run_id, started_at=started, finished_at=datetime.now(UTC), status=status, requested_indicators=indicator_ids, feature_version=FEATURE_VERSION, code_version=version, counts={"read": read_count, "valid": valid_count, "written": written}, warnings=warnings, errors=errors)
    if write:
        repository.save_run(run.model_dump(mode="json"))
    return [item.model_dump(mode="json") for item in snapshots], run
