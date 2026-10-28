# LLM administration

Admins can open `/workplace?tab=llm` to inspect usage and reorder configured
models. The server checks the current admin role for both reads and writes:

- `GET /api/v1/admin/llm`: today's observed usage, current order and budgets.
- `PUT /api/v1/admin/llm`: replace the order and optional local daily budgets.
- `POST /api/v1/admin/llm/{model_id}/test`: send a short structured-response
  connectivity probe directly to the selected configured model.

Each model has a connection-test button. It reports success, elapsed milliseconds
and a sanitized error category/HTTP status. The test uses the existing 30-second
request timeout and records usage like other model requests. It bypasses routing
priority and cooldowns for this diagnostic request, does not try fallback models,
and never changes preferences or sends Telegram messages. The panel refreshes
usage after testing without discarding unsaved priority/budget edits.

Writes require the response's `revision` as `expected_revision` and every
currently configured model exactly once. Stale edits return 409. Unknown or
duplicate model IDs are rejected. The panel cannot change model credentials,
URLs or definitions; those stay in the server environment.

Priorities take effect on the next model call, including calls through already
created routers. Provider cooldowns still apply. New environment-configured
models are appended to saved priorities; removed models disappear.

## What the counters mean

Every actual HTTP attempt through the configured provider factory records its
UTC completion time, model identity, HTTP status and the `usage` token counters
reported by the provider. This includes retries/failover, background analysis,
and paid responses rejected by JSON/schema validation. Prompts, responses,
credentials, account URLs and arbitrary headers are not stored or returned.

Missing counters remain unknown. The panel shows their request count alongside
known token totals. Counts only cover this installation after tracking started;
they do not reconstruct earlier usage or see other applications using the same
provider account. Telemetry write failures are logged without turning a valid
model response into a retry.

Local daily counters use **00:00 UTC**. The optional daily token budget is set
by the admin, not discovered from billing. Remaining daily tokens are a local
estimate against that budget, not an authoritative provider balance, and this
budget does not enforce a spending limit. Leave it blank if unknown.
If any attempt lacks a token count, the remaining-token estimate is also
unknown rather than assuming that attempt cost zero tokens.

For Groq, the last response's allowlisted rate-limit headers are also displayed
with their observation time. Token headers describe **tokens per minute**;
request headers describe **requests per day**. These are snapshots, may be stale
and must not be presented as the daily token balance. Other providers without
an authoritative token balance remain unknown rather than receiving a guessed
free-tier quota. Cloudflare Neurons are not interchangeable with tokens.
See [Groq rate-limit headers](https://console.groq.com/docs/rate-limits).

## Persistence

`llm_control.db` is stored next to `GREENPEAK_LLM_ROUTER_DB_PATH`. The default
router path is now `backend2/instance/llm/llm_router.db`; the production deployment
links this directory to `/root/sp500-dashboard/backend2/instance/llm` so usage,
priorities, cooldowns and test receipts survive release switches. Existing
custom router paths must likewise point to persistent storage.

The old release-local default router database held only temporary cooldowns.
It is not copied into the new directory; those cooldowns expire normally while
the new shared store starts fresh. No old usage history is available to import.
