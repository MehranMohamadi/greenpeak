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
