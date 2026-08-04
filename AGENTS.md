# AGENTS.md

## Project overview

This repository contains the GreenPeak S&P 500 analytics dashboard. It is split into two applications:

- `front2/`: Next.js App Router frontend using React, JavaScript/TypeScript, Tailwind CSS, Radix/shadcn-style UI components, Recharts, and Lightweight Charts.
- `backend2/`: FastAPI backend using Pydantic, pandas, MongoDB when available, and CSV/XLS/XLSX files as local data sources or fallbacks.

Deployment and server-management files live at the repository root. Treat those scripts and nginx/systemd configuration as production-sensitive.

The product groups analytics into monetary policy, corporate earnings, sector performance, liquidity flows, valuation, derivatives, market internals, intermarket, sentiment, macro calendar, and institutional analysis. Preserve the financial-dashboard context when adding routes, labels, charts, or data sources.

## Important paths

- `front2/app/`: routes, layouts, and Next.js route handlers.
- `front2/components/`: reusable UI, charts, dashboard, authentication, and analytics components.
- `front2/hooks/`: client-side data-fetching and data-transformation hooks.
- `front2/api/api.js`: central FastAPI endpoint map. Development points to `http://localhost:8000/api/v1`; production currently points to `https://greenpeak.tech/api/v1`.
- `backend2/src/api/v1/endpoints/`: FastAPI routers.
- `backend2/src/services/`: data access and business logic.
- `backend2/src/models/schemas.py`: Pydantic request/response models.
- `backend2/src/core/config.py`: environment-backed application settings.
- `backend2/src/ETL/`: external-data ingestion and MongoDB update scripts.
- `backend2/src/data/raw/`: checked-in market and economic source files. Do not rewrite or replace these large datasets unless the task explicitly requires it.
- `QUICK_START_UBUNTU.md` and `DEPLOYMENT_UBUNTU.md`: historical Ubuntu/Docker deployment runbooks.
- `sp500-manage.sh`: production Docker-management wrapper intended for `/opt/sp500-dashboard`.
- `nginx.conf` and `nginx-complete.conf`: reverse-proxy configuration for the frontend on port 3000 and the backend on port 8000.
- `sp500-dashboard.service`: optional systemd unit that invokes Docker Compose under the dedicated `sp500user` account.

## Rate feature pipeline architecture

GreenPeak Technical Step 1 implements a deterministic, versioned feature pipeline for exactly two rate indicators:

- `us_10y_treasury_yield`: primary raw indicator `ten_year_treasury`, FRED series `DGS10`, daily percent values.
- `federal_funds_rate`: primary raw indicator `federal_funds_rate`, FRED series `DFF`, daily percent values. Do not silently replace it with monthly `FEDFUNDS`.

The production-oriented flow is:

```text
MongoDB monetary_policy raw observations
  -> canonical Python adapter
  -> validation, sorting, and de-duplication
  -> deterministic Python rate features
  -> Pydantic-validated versioned snapshot
  -> gp_indicator_feature_snapshots
  -> FastAPI latest-snapshot endpoint
  -> Next.js monetary-policy analysis card
```

The browser must not calculate z-scores, percentiles, slopes, volatility, historical deltas, or cross-series spreads. Python in `backend2/src/services/rate_features/` is the sole source of truth for financial feature formulas. No LLM or ML model is part of this pipeline.

### Rate feature files

- `backend2/src/services/rate_features/config.py`: indicator definitions, series IDs, semantic text, versions, windows, minimum counts, stale thresholds, and the experimental direction threshold.
- `backend2/src/services/rate_features/cleaning.py`: raw-document adapter and canonical observation cleaning.
- `backend2/src/services/rate_features/engine.py`: single-series rate features, DFF last-change features, and DGS10/DFF common-date spread features.
- `backend2/src/services/rate_features/builder.py`: quality evaluation, provenance, deterministic Persian context, and final snapshot construction.
- `backend2/src/services/rate_features/schemas.py`: Pydantic snapshot and feature-run contracts.
- `backend2/src/services/rate_features/repository.py`: read-only raw access plus definitions, snapshots, run records, and indexes.
- `backend2/src/services/rate_features/job.py`: batch orchestration and pair-feature coordination.
- `backend2/src/services/rate_features/cli.py`: dry-run and MongoDB-write command entry point.
- `backend2/src/api/v1/endpoints/features.py`: latest snapshot, raw pipeline inspection, and API-backed preview endpoints.
- `backend2/tests/test_rate_features.py`: unit and offline vertical-slice tests.
- `front2/components/analytics/rate-feature-card.jsx`: stored feature card shown for the two rate charts.
- `front2/components/analytics/feature-pipeline-debug.jsx`: public stage-by-stage JSON viewer.
- `front2/app/analytics/feature-pipeline-debug/page.jsx`: route `/analytics/feature-pipeline-debug`.
- `front2/app/settings/page.jsx`: contains the navigation button to the pipeline JSON viewer.

The earlier generic `/analytics/analysis-pipeline`, `/api/v1/analysis/prepare`, and `backend2/src/services/analysis/` architecture was removed. Do not restore or build new work on that deleted path unless the user explicitly requests a separate generic pipeline.

### Raw and canonical contracts

The primary MongoDB raw collection is `monetary_policy`. Existing ETL documents use:

```text
date, indicator, value, fred_series_id, updated_at, metadata
```

The adapter maps them into:

```text
indicator_id, observation_date, value_pct, source_provider,
source_series_id, ingested_at, raw_document_id, is_valid, validation_flags
```

Raw records are immutable input. Feature code must never update, delete, interpolate, or add analytical fields to raw documents. Invalid values remain represented through flags; duplicate dates select the latest valid ingestion record and create a quality flag.

MongoDB is the primary source. When it is unavailable, the existing monetary API can serve checked-in files. DFF falls back to daily `DFF.csv`. The 10-year display/preview fallback uses the daily `10 Yr` column in `merged-treasury-rates-2000-2025.csv`; it is a U.S. Treasury daily curve export, not the monthly `GS10.csv`. Do not present monthly `GS10.csv` as daily DGS10 or use the fallback to write production feature snapshots.

### Feature calculation rules

- Rate levels remain in percent. Rate-level changes are expressed in basis points; one percentage point equals 100 bp.
- Required shared outputs include current value; 7/30/90/180/365-day deltas; 30/90/365-day means; distance to the annual mean; annual z-score; five-year empirical mid-rank percentile; 90-day calendar-day OLS slope; and 90-day consecutive-change volatility.
- Historical lookups select the latest valid observation on or before the target calendar date. Do not forward-fill raw data.
- Feature windows are anchored to the latest valid observation date, so stale data still produces meaningful historical features. `freshness_days` and `quality.status` are evaluated against the requested `as_of_date`; stale data must remain visibly stale.
- Missing history produces `null` plus a `feature_reasons` code. Never convert missing values to zero.
- `direction_90d` is experimental and uses the configurable basis-point threshold in `config.py`; it is not investment advice.
- DGS10/DFF spread calculations use the latest valid common date. The 90-day spread comparison is anchored to that common date.
- Keep full floating-point precision internally. Display rounding belongs in serializers or UI formatting.
- Formula or threshold changes require an intentional `feature_version` update. Source/frequency/meaning changes require a `definition_version` update. Breaking JSON changes require a `schema_version` update.

### Storage and idempotency

Analytical output is separate from raw data:

- `gp_indicator_definitions`: versioned indicator definitions.
- `gp_indicator_feature_snapshots`: validated feature snapshots.
- `gp_feature_runs`: batch execution records.

Snapshot identity is `(indicator_id, as_of_date, feature_version, definition_version)`. Repeated identical work returns `already_exists`; changed code/config under the same identity returns `version_conflict`. Increment the relevant version rather than overwriting incompatible results.

Run the job from `backend2/`:

```powershell
$env:DEBUG = "false"
.\.venv\Scripts\python.exe -m src.services.rate_features.cli build `
  --indicators us_10y_treasury_yield,federal_funds_rate `
  --as-of latest --dry-run --output-json .\artifacts\feature_preview.json

.\.venv\Scripts\python.exe -m src.services.rate_features.cli build `
  --indicators us_10y_treasury_yield,federal_funds_rate `
  --as-of latest --write-mongo
```

CLI exit codes are `0` for success, `2` for partial output, and `1` for failure. Never print connection strings or credentials in run errors.

### Feature API and UI contracts

FastAPI endpoints under `/api/v1` are:

```text
GET  /indicators/{indicator_id}/features/latest
GET  /indicators/{indicator_id}/features/pipeline-debug
POST /indicators/features/pipeline-preview
```

`latest` reads stored snapshots. `pipeline-debug` inspects Mongo-backed intermediate stages. `pipeline-preview` accepts observations already returned by the existing monetary endpoints and runs the same Python adapter/builder without persisting them. The public frontend viewer uses `pipeline-preview` so it still works when local MongoDB is unavailable. Both inspection endpoints are intentionally public in production per product-owner decision; keep raw samples sanitized and never include secrets, arbitrary collections, stack traces, or MongoDB connection details.

The public viewer is `/analytics/feature-pipeline-debug` and shows sampled JSON for:

```text
raw_input -> canonical_adapter -> cleaned_series
-> calculated_features -> validated_snapshot
```

Use only whitelisted indicator IDs and require exact series matches (`DGS10` or `DFF`). The frontend may select, fetch, format, and display stages, but calculations must remain in Python.

## Setup and local development

Run frontend commands from `front2/`, not from the repository root:

```bash
cd front2
npm ci
npm run dev
```

The frontend is served at `http://localhost:3000` by default.

Set up and run the backend from `backend2/`:

```bash
cd backend2
python -m venv .venv
# Windows PowerShell: .\.venv\Scripts\Activate.ps1
# Linux/macOS: source .venv/bin/activate
python -m pip install -r requirements.txt
python main.py
```

The API is served at `http://localhost:8000`; versioned routes are under `/api/v1`. MongoDB defaults to `mongodb://127.0.0.1:27017`, but many services fall back to files in `backend2/src/data/raw/` when MongoDB is unavailable.

Useful local smoke checks after starting the backend are `GET /health` and `GET /api/v1/system/health`. FastAPI's `docs` and `redoc` paths are only enabled outside the `development` environment, so do not assume `/docs` is present in local development.

Configuration is loaded from the repository-root `.env`. Common variables include `FRED_API_KEY`, `MONGODB_URL`, `MONGODB_DATABASE`, `HOST`, `PORT`, `DEBUG`, `RELOAD`, and `ENVIRONMENT`. Next.js route handlers also use `ALPHA_VANTAGE_KEY` and `FRED_API_KEY`. Never commit secrets or print them in logs.

## Validation

Use the narrowest relevant checks first, then run the broader checks before handing off a change.

Frontend:

```bash
cd front2
npx tsc --noEmit
npm run build
```

`next.config.js` currently sets `typescript.ignoreBuildErrors: true`, so a successful Next.js build does not replace the explicit TypeScript check. `npm run lint` points to `next lint`, which is not available in newer Next.js versions; do not claim lint passed unless the script has been repaired or a working lint command has been configured.

Backend:

```bash
cd backend2
python -m pytest
python -m compileall src
```

The repository currently has little or no conventional automated test coverage. For API changes, add focused pytest tests where practical and at minimum start the app and exercise the affected endpoint plus `/health`. Do not require live MongoDB or third-party APIs for unit tests; mock them or verify the CSV fallback path.

## API and data contracts

- Backend routers are mounted below `/api/v1`: `system`, `market`, `monetary`, `economic`, `systemrisk`, `liquidity`, `macroeco`, `corporate`, `valuation`, and `sectors`.
- Common list endpoints support `limit`, `start_date`, and `end_date`; retain their expected `YYYY-MM-DD` semantics when extending them.
- Market data includes S&P 500 OHLC, VIX, Treasury rates, DFF, 10-year rates, and SOFR. Economic and analytics routes serve the other indicator categories listed above.
- The frontend also contains Next.js API routes under `front2/app/api/` for S&P 500 and intermarket data. These use different response shapes and external providers from the FastAPI backend; keep their behavior separate.
- Frontend production API resolution is currently hard-coded in `front2/api/api.js`, whereas Next.js route handlers read API keys from environment variables. Changes to either path require checking the affected consumers and deployment proxy rules.

## Change guidelines

- Preserve the existing split between endpoint handlers, services, models, and utilities. Keep route handlers thin and put data/business logic in `backend2/src/services/`.
- When adding a backend endpoint, update the relevant router export/import, define or reuse Pydantic response models, and update `front2/api/api.js` if the frontend consumes it.
- Preserve API response shapes expected by existing hooks and charts. Many backend responses use `{ data, metadata }`, while some local Next.js API routes return arrays directly; inspect the consumer before changing either shape.
- Use the `@/` alias for frontend imports. Add `"use client"` only to components that need browser APIs, hooks, state, effects, or event handlers.
- Follow nearby file style. The codebase intentionally mixes `.jsx`, `.js`, `.tsx`, and `.ts`; do not perform unrelated conversions or broad formatting.
- Reuse components in `front2/components/ui/` and existing chart/data utilities before introducing another UI primitive or dependency.
- Keep financial dates, timestamps, units, sorting order, and missing-value behavior explicit. Validate both empty data and malformed upstream records.
- Do not silently hard-code new production domains or credentials. Prefer environment-driven configuration when touching API base URLs.
- Avoid editing generated or dependency artifacts such as `node_modules/`, `.next/`, caches, lockfiles unrelated to a dependency change, or runtime logs.
- If dependencies change, update only the lockfile for the package manager used by the change. The frontend currently contains both npm and pnpm lockfiles; default to npm because the documented deterministic command is `npm ci`, unless the task explicitly selects pnpm.

## ETL and data safety

- ETL scripts can call FRED/Yahoo Finance and write to MongoDB or local data files. Inspect flags and target collections/files before running them.
- Do not run `backend2/src/ETL/run_all_etl.py`, bulk refreshes, cleanup scripts, deployment scripts, or security-hardening scripts as routine validation.
- Never fabricate market data. Keep source attribution, observation dates, and frequency metadata consistent with the upstream series.
- A missing external API key or unavailable MongoDB should be handled clearly and should not trigger destructive fallback behavior.

## Documentation and infrastructure status

Documentation is useful context, not automatically a source of executable truth. The repository's guides describe multiple historical deployment approaches (Docker Compose, PM2, and direct processes), and several referenced files are not currently tracked: `docker-compose.yml`, `.env.example`, `deploy-frontend.sh`, the backend `start.sh`/`start.bat`, and PM2 configuration. Before acting on a documented command, verify its target files, paths, environment variables, and service names in the current checkout.

In particular, do not run the Ubuntu one-line installer, `deploy-ubuntu.sh`, `sp500-manage.sh`, or `sp500-dashboard.service` locally as a default setup path. They assume Ubuntu, Docker, privileged access, `/opt/sp500-dashboard`, production secrets, and in some cases alter firewall, cron, users, packages, or services.

## Deployment safety

- `.github/workflows/deploy.yml` deploys pushes to `master` over SSH. Root deployment scripts may modify system packages, firewall rules, Docker, cron, nginx, or systemd.
- The GitHub Actions workflow calls `./deploy-frontend.sh` from `/root/sp500-dashboard`; that script is not present in this checkout. Treat workflow changes as an operations task and repair/verify the server-side deployment contract before relying on it.
- Nginx configuration targets `greenpeak.tech`/`www.greenpeak.tech` and proxies to localhost ports 3000 and 8000. Preserve the `/api/` forwarding behavior when changing public API paths.
- Do not run deployment, hardening, service-management, or nginx replacement commands unless the user explicitly requests deployment/operations work.
- When deployment configuration changes, verify referenced files and paths actually exist; some documentation and scripts describe older layouts and may be stale.

## Completion checklist

Before finishing:

1. Review `git diff` and preserve unrelated user changes.
2. Run the relevant frontend and/or backend checks above.
3. Confirm API consumers still match response contracts.
4. Report checks that passed, checks that failed, and any checks not run because they require credentials, external services, or production access.
