# GreenPeak Analysis Pipeline v0.2

The implemented vertical slice preserves the deterministic DGS10/DFF feature engine and adds config-driven definitions, persisted narratives, an independent Rule Engine skeleton, and persisted-only frontend reads.

## Manual execution

From `backend2/` with the project virtual environment:

```powershell
$env:DEBUG = "false"
\.venv\Scripts\python.exe -m src.services.pipeline_cli run --as-of latest --dry-run
\.venv\Scripts\python.exe -m src.services.pipeline_cli run --as-of 2026-08-16
```

`--dry-run` reads raw data and evaluates deterministic features/rules without writing snapshots or calling an LLM. `--force-llm` explicitly bypasses LLM input-hash reuse. Exit codes are `0` success, `2` partial, and `1` failure.

The command is suitable for later invocation by cron, a systemd timer, or a worker, but this change intentionally does not edit production scheduling or deployment files.

## Configuration

- `config/greenpeak/domains.yaml`: eight stable domains.
- `config/greenpeak/indicators/*.yaml`: one definition per registered indicator.
- `config/greenpeak/feature_templates/*.yaml`: analyst-editable windows, minimum counts, and thresholds.
- `config/greenpeak/rules/`: disabled example rules and market aggregation configuration.
- `prompts/greenpeak/*.md`: versioned core and three analysis-level prompts.

Python owns formulas, validation, whitelisted rule operators, hashing, orchestration, and persistence. YAML contains definitions and parameters only; unknown keys are rejected and no expression evaluation exists.

## Runtime settings

```text
GREENPEAK_ENABLE_PIPELINE_PREVIEW=false
GREENPEAK_LLM_PROVIDER=disabled | openai-compatible
GREENPEAK_LLM_MODEL=<provider model ID>
GREENPEAK_LLM_API_KEY=<secret>
GREENPEAK_LLM_BASE_URL=https://api.openai.com/v1
```

Preview/debug endpoints return 404 unless explicitly enabled. Normal GET endpoints never calculate features, execute rules, or call an LLM. LLM calls use persisted feature snapshots for the exact requested `as_of_date`, and inputs never contain Rule Engine outputs.

## Persisted collections

- Existing: `gp_indicator_definitions`, `gp_indicator_feature_snapshots`, `gp_feature_runs`
- New: `gp_indicator_narrative_snapshots`, `gp_domain_narrative_snapshots`, `gp_market_narrative_snapshots`, `gp_rule_score_snapshots`, `gp_llm_runs`

Narrative reuse is keyed by a stable hash of level, subject, date, evidence, versions, prompt, provider, and model. Forced regenerations create a new immutable revision. No existing snapshot is overwritten or migrated.

## Read-only APIs

```text
GET /api/v1/indicators/{id}/analysis/latest
GET /api/v1/domains/{id}/analysis/latest
GET /api/v1/market/analysis/latest
GET /api/v1/rules/{level}/{id}/latest
```

Missing output returns `ANALYSIS_NOT_GENERATED` / `RULE_RESULT_NOT_GENERATED`; storage outages return a sanitized 503 response.
