# GreenPeak Technical Status

Repository state reviewed at commit `61b21dc` on 2026-08-10. This is an implementation inventory, not a future design. The Feature Pipeline currently covers exactly `DGS10` and `DFF`; no ML/LLM inference is executed.

## 1. Repository architecture

- `backend2/`: FastAPI/Pydantic backend.
  - `src/api/v1/endpoints/`: thin HTTP routers; `features.py` exposes the Feature Pipeline.
  - `src/services/`: data access/business logic. `rate_features/` is the deterministic Step 1 subsystem; `data_service.py` serves MongoDB data with file fallbacks; `mongodb_service.py` is the older general MongoDB wrapper.
  - `src/ETL/`: standalone external-source ingestion scripts. `monetary_policy_fetcher.py` ingests FRED data into MongoDB.
  - `src/data/raw/`: checked-in CSV/XLS/XLSX fallback/source files.
  - `tests/`: pytest tests.
- `front2/`: Next.js App Router frontend.
  - `app/`: routes and layouts; analytics routes are under `app/analytics/`.
  - `components/analytics/`: domain views, including the rate feature card and pipeline inspector.
  - `hooks/`: fetch/transform hooks for existing chart APIs.
  - `api/api.js`: central FastAPI URL map.
- `docs/`: architecture documentation.
- Repository root: npm workspace metadata plus production-sensitive nginx, systemd, deployment, and hardening scripts. Several deployment documents reference files absent from this checkout.

## 2. Feature Pipeline change set

Created in commit `5878a2b` and still present:

- `backend2/src/services/rate_features/{config,cleaning,engine,builder,schemas,repository,job,cli}.py` and `__init__.py`
- `backend2/src/api/v1/endpoints/features.py`
- `backend2/tests/test_rate_features.py`
- `front2/components/analytics/rate-feature-card.jsx`
- `front2/components/analytics/feature-pipeline-debug.jsx`
- `front2/app/analytics/feature-pipeline-debug/page.jsx`

Significantly modified for integration/fixes:

- `backend2/src/main.py`, `backend2/src/api/v1/endpoints/__init__.py`, `backend2/src/services/data_service.py`, `backend2/README.md`
- `front2/api/api.js`, `front2/components/analytics/monetary-policy.jsx`, `front2/app/settings/page.jsx`, `front2/components/kokonutui/top-nav.jsx`
- `AGENTS.md`

The same initial commit also added a generic `services/analysis/` Rule Engine, schemas, endpoint, tests, and UI. Commit `bf77f2e` deleted that entire path. It is historical, not current architecture.

## 3. Current data flow

### Persisted production-oriented path

```text
FRED API (DGS10, DFF)
  -> ETL/monetary_policy_fetcher.py: MonetaryPolicyFetcher
  -> MongoDB monetary_policy (raw upsert by indicator + date)
  -> MongoFeatureRepository.load_raw_documents/load_observations
  -> adapt_mongo_documents -> clean_observations
  -> calculate_rate_features (+ DFF last change; + cross-series spread)
  -> build_snapshot -> IndicatorFeatureSnapshot validation
  -> run_feature_job/CLI
  -> gp_indicator_definitions + gp_indicator_feature_snapshots + gp_feature_runs
  -> GET /api/v1/indicators/{id}/features/latest
  -> RateFeatureCard in the monetary-policy detail view
```

### Availability fallback/preview path

```text
GET /api/v1/monetary/{10year|dff}
  -> DataService: MongoDB monetary_policy, else checked-in file
     DFF.csv for DFF; merged-treasury-rates-2000-2025.csv `10 Yr` for DGS10 display
  -> browser sends observations to POST /api/v1/indicators/features/pipeline-preview
  -> the same Python adapter/builder (no persistence)
  -> feature card or public stage-by-stage JSON viewer
```

The frontend selects, fetches, and formats results; all financial feature calculations remain in Python. The fallback Treasury file is a daily Treasury curve export, not `GS10.csv` (monthly). It must not be used to persist production snapshots.

## 4. Implementation status

| Area | Status | Current implementation |
|---|---|---|
| 10-Year Treasury Yield | Implemented | `us_10y_treasury_yield`, FRED `DGS10`, raw key `ten_year_treasury`; MongoDB-first chart/API data plus daily-file fallback; shared and pair features. |
| Federal Funds Rate | Implemented | `federal_funds_rate`, daily effective rate `DFF` (not monthly `FEDFUNDS`); MongoDB-first plus `DFF.csv`; shared features and last-change fields. |
| Feature engineering | Implemented for two rates | Deterministic calendar-window calculations in `engine.py`; missing history is `null` with a reason. |
| Standardized indicator schema | Implemented, rate-specific | Canonical DataFrame columns plus versioned Pydantic snapshot. It is not yet a repository-wide indicator standard. |
| Semantic/LLM-ready fields | Implemented as data only | Persian definitions, relevance, limitations, facts, deterministic summary, and guardrails. No LLM call or generated analysis exists. |
| Rule Engine | Not present | The generic Rule Engine was deleted. Only experimental `direction_90d` threshold classification exists. |
| MongoDB storage | Implemented but operationally separate | Raw `monetary_policy`; definitions, snapshots, and run collections with indexes/idempotency. Snapshot generation requires an explicit CLI/job invocation; no scheduler is wired. |
| API endpoints | Implemented | Stored latest, Mongo-backed pipeline debug, and non-persisting preview endpoints are mounted under `/api/v1/indicators`. Existing `/api/v1/monetary/*` endpoints supply charts/fallback input. |
| Frontend display | Implemented | `RateFeatureCard` appears only for the two selected factors; stored-first/preview-fallback behavior. Public `/analytics/feature-pipeline-debug` displays five JSON stages. |

## 5. What the “Rule Engine” currently does

There is no current Rule Engine class, registry, rule set, or Rule Engine endpoint. The former `backend2/src/services/analysis/rules/` implementation and `/api/v1/analysis/prepare` path were removed.

The only rule-like behavior is inside `calculate_rate_features()`:

```text
delta_90d_bp > +15  -> direction_90d = "rising"
delta_90d_bp < -15  -> direction_90d = "falling"
otherwise           -> direction_90d = "stable"
missing delta       -> direction_90d = "unknown"
```

The 15 bp threshold is configurable in `COMMON_CONFIG`, and the snapshot explicitly marks this state experimental. Quality status is separately assigned by `build_snapshot()`: stale if freshness exceeds 7 calendar days; otherwise insufficient-history if any feature reason exists; otherwise ok. Neither mechanism produces investment recommendations.

## 6. Calculated features and formulas

Let `x(t)` be a rate in percent, `T` the latest valid observation on or before requested `as_of`, and `lookup(d)` the latest valid observation on or before date `d`. One percentage point is 100 bp.

- `current_value_pct = x(T)`
- `delta_{7,30,90,180,365}d_bp = 100 * [x(T) - x(lookup(T-d))]`
- `mean_{30,90,365}d_pct = arithmetic mean of observations in [T-d, T]`
- `distance_to_mean_365d_bp = 100 * [x(T) - mean_365d_pct]`
- `zscore_365d = [x(T) - mean(window365)] / population_stddev(window365)` (`ddof=0`)
- `percentile_5y = 100 * [count(x < x(T)) + 0.5*count(x = x(T))] / N` over 1,826 calendar days (empirical mid-rank)
- `slope_90d_bp_per_30d = OLS_slope(percent per calendar day) * 30 * 100`
- `volatility_90d_bp = population_stddev(consecutive observed changes in percent) * 100`
- `direction_90d`: threshold classification described above.
- DFF only: `last_change_date` is the last row whose consecutive observed value differs; `last_change_bp = 100 * consecutive difference`; `days_since_last_change = as_of - last_change_date`.
- DGS10 only when both series are built: on latest common observation date `C`, `spread_to_fed_funds_bp = 100 * [DGS10(C)-DFF(C)]`; `spread_delta_90d_bp = current spread - spread at latest common date <= C-90 days`. Common/prior dates are also stored.

Minimum counts are 10/30/120 for 30/90/365-day means, 120 for z-score, 500 for percentile, and 30 for slope/volatility. Windows are calendar-day windows anchored to the latest valid observation; raw values are not forward-filled or interpolated.

## 7. Important schemas

Raw MongoDB observation (`monetary_policy`):

```json
{
  "_id": "ObjectId",
  "date": "YYYY-MM-DD",
  "indicator": "ten_year_treasury | federal_funds_rate",
  "value": 4.25,
  "fred_series_id": "DGS10 | DFF",
  "updated_at": "datetime",
  "metadata": {"frequency": "Daily", "unit": "Percent", "source": "FRED", "fred_metadata": {}}
}
```

Canonical adapter row (`CANONICAL_COLUMNS`):

```json
{
  "indicator_id": "us_10y_treasury_yield",
  "observation_date": "date",
  "value_pct": 4.25,
  "source_provider": "FRED",
  "source_series_id": "DGS10",
  "ingested_at": "datetime|null",
  "raw_document_id": "string|null",
  "is_valid": true,
  "validation_flags": []
}
```

Snapshot shape (`IndicatorFeatureSnapshot`; abbreviated):

```json
{
  "indicator_id": "...",
  "schema_version": "1.0",
  "feature_version": "0.1.0",
  "definition_version": "1.0",
  "as_of_date": "date",
  "calculated_at": "datetime",
  "run_id": "uuid",
  "source": {"provider": "FRED", "series_id": "DFF", "latest_observation_date": "date"},
  "current": {"value_pct": 5.25, "unit": "percent"},
  "features": {"current_value_pct": 5.25, "delta_90d_bp": 0.0},
  "feature_reasons": {},
  "derived_features": {},
  "state": {"direction_90d": "stable", "materiality_threshold_bp": 15.0, "state_is_experimental": true},
  "quality": {"status": "ok", "freshness_days": 0, "missing_ratio_1y": 0.0, "observation_count_1y": 366, "flags": []},
  "semantics": {}, "llm_context": {}, "provenance": {}
}
```

Preview request is `{indicator_id, source_series_id, source_provider?, observations:[{date,value}]}` (1–10,000 observations). API responses wrap payloads as `{ "ok": true, "data": ... }`. `FeatureRun` stores run timestamps/status, requested indicators, versions, counts, warnings, and sanitized errors.

Snapshot uniqueness is `(indicator_id, as_of_date, feature_version, definition_version)`. Identical version/config/code returns `already_exists`; changed config/code under that identity returns `version_conflict` rather than overwriting.

## 8. Tests

Current suite: 13 pytest tests.

- `backend2/tests/test_rate_features.py` (11): bp conversion/weekend lookup; invalid and duplicate cleaning; known z-score/percentile/slope/volatility; zero variance and insufficient history; DFF change and common-date spread; stale/deterministic snapshots; correct daily DGS10 fallback; offline two-series vertical slice/idempotency; latest endpoint; pipeline-debug stages; preview shape/series rejection.
- `backend2/tests/test_health.py` (2): root and versioned health endpoints.

Status on this review: **not executed**. `python -m pytest` failed before collection because no `python` command or project virtual environment exists in the current environment. This is an environment limitation, not a test failure; no current passing result can be claimed. The tests are designed not to require live MongoDB/FRED. No frontend unit/component tests exist.

## 9. Beyond original Step 1

Assuming Step 1 meant deterministic features and storage/API/UI for the two rates, the checkout also includes:

- Public, sampled five-stage pipeline inspection and an API-backed preview that functions without MongoDB.
- Stored-first UI fallback to live Python preview.
- Cross-series DGS10-minus-DFF spread features.
- DFF last-change features.
- Persian semantic context, LLM-ready facts/summary/guardrails, quality/provenance, versioning, idempotency, run audit records, and CLI dry-run JSON output.
- A corrected daily Treasury fallback instead of mislabeling monthly `GS10.csv` as DGS10.

The broader dashboard, ETL suites, many analytics categories, Next.js provider routes, deployment scripts, and architecture viewer predate or sit outside this two-rate scope.

## 10. Missing, incomplete, duplicated, or potentially unnecessary

- No scheduler/worker invokes `run_feature_job`; persisted snapshots can become absent/stale unless the CLI is operated externally.
- The Rule Engine and generic analysis API do not exist. Any design assuming them is stale.
- “Standardized schema” is isolated to rates; existing `DataResponse`, ETL documents, and frontend route responses retain different shapes.
- `latest` returns a reduced schema unless `mode=debug`; preview returns the full snapshot. The card therefore receives different shapes/provenance depending on source.
- `pipeline-debug` says “available only outside production” in its docstring, but code contains no environment guard. Project notes indicate public access was intentional; code/comment/security intent should be reconciled.
- Preview accepts client-supplied observations and computes server-side, but those values are not authoritative persisted source data.
- Pair features are attached only when both indicators are requested in the same job; single-indicator runs omit them.
- The ETL uses upserts (`$set`) on raw rows although pipeline guidance calls raw input immutable; clarify whether source corrections are allowed.
- `missing_ratio_1y` counts invalid rows but does not measure missing expected business/calendar dates, so its name is broader than its formula.
- Any missing feature reason makes overall status `insufficient_history`, including optional long-history outputs; this may overstate failure.
- Pydantic leaves `features`, `derived_features`, `semantics`, `llm_context`, and `provenance` largely as untyped dictionaries, weakening schema guarantees.
- `as_of=latest` means UTC today, not latest source date; calculations correctly anchor to latest observation but snapshot identity/freshness uses today.
- No API tests cover unavailable MongoDB, version conflicts, malformed dates/values, 10,000-item boundary, or production exposure. No CLI tests, live persistence integration tests, frontend tests, or end-to-end tests exist.
- Existing general `MongoDBService` and direct `MongoFeatureRepository` connection logic duplicate MongoDB concerns.
- Both npm and pnpm lockfiles exist (root and/or frontend); the documented default is npm.
- Multiple similarly named analytics components (`*-new.jsx`, older variants) and two frontend theme-provider implementations suggest legacy duplication outside Step 1.
- Persian strings render as mojibake in the inspected source/output, including `config.py`, `builder.py`, and `rate-feature-card.jsx`; encoding and production rendering require confirmation.
- Frontend production API base is hard-coded to `https://greenpeak.tech/api/v1` despite comments mentioning relative nginx proxy paths.

## 11. Decisions to confirm before coding

1. Is the next architecture only the deterministic two-rate pipeline, or should a generic multi-indicator Rule Engine be reintroduced? Define its output contract and ownership before implementation.
2. Should production read only scheduled, persisted snapshots, or retain client-triggered preview fallback? Decide authority, freshness SLA, and failure behavior.
3. What is the canonical repository-wide indicator contract, and which fields must be strongly typed/versioned across raw, canonical, snapshot, API, and frontend layers?
4. Are raw ETL rows immutable append-only observations or correction-capable upserts? Define revision/provenance policy.
5. Should pair features always be materialized, computed on read, or represented as a separate pair indicator?
6. Are pipeline debug/preview endpoints intentionally public in production? If yes, set rate limits/payload limits/observability; if no, add an explicit environment/auth policy.
7. Define quality semantics: expected-frequency missingness, optional versus required features, stale thresholds for weekends/holidays, and whether `as_of_date` identifies request date or feature anchor date.
8. Confirm Persian text source encoding and whether semantic content belongs in code, versioned definitions in MongoDB, or a localization/content layer.
9. Choose one MongoDB connection/repository lifecycle and one frontend package manager/API-base configuration strategy.

## 12. Recommended next three steps (do not implement yet)

1. **Freeze contracts and operational policy.** Resolve the decisions above; publish typed JSON schemas for definition, canonical observation, snapshot, run, and public response; explicitly decide Rule Engine scope and debug/preview exposure.
2. **Make persistence production-operable and observable.** Design a scheduled job for both indicators together, freshness/run monitoring, version migration behavior, immutable/correctable raw-data policy, and documented recovery/rebuild procedures.
3. **Close validation gaps before expansion.** Restore a reproducible Python environment/CI run, add repository/API/CLI failure-path and Mongo integration tests, add frontend contract/component tests, verify UTF-8 Persian rendering, then use those contracts as the template for the next indicator family.
