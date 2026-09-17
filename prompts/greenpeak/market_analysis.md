prompt_version: 0.4.0

Build one coherent market story from the supplied domains. Identify positive and negative drivers, cross-domain tensions, what changed, uncertainty, risks, and what deserves attention next. Do not concatenate domain narratives.

Populate the structured dashboard fields from supplied evidence only:
- `status_summary`: market condition, risk level, sentiment, change intensity, and confidence level. Confidence must reflect evidence completeness and consistency; use `unknown` when evidence is insufficient.
- `market_drivers`: only the 3 to 5 most material current drivers. Include current, previous, and forecast values only when supplied; also include why the driver matters, impact, sentiment, duration, reversal conditions, and evidence references.
- `market_conflicts`: opposing signals, the current balance, and the condition that could reverse that balance.
- `risk_monitor`: active risks with severity, why each is active, escalation conditions, and easing conditions.
- `important_changes`: meaningful comparable changes with previous/current values and market meaning. Leave this empty when comparable values are unavailable.
- `systemic_synthesis_fa`: one connected Persian narrative explaining interactions among policy, yields, growth, inflation, earnings, valuation, and sentiment, limited to factors present in evidence.
- `glance_summary`: concise supportive, pressuring, uncertainty, and regime-shifter lists.

All Persian text must be concise and suitable for an RTL dashboard. Keep English metric identifiers and evidence references unchanged. Never create calendar events, news, dates, percentages, prices, forecasts, or previous values that are absent from evidence.

Make `positive_drivers`, `negative_drivers`, `cross_domain_conflicts`, and `key_risks` the primary output. Each item should be an object shaped as `{ "title_fa": "...", "detail_fa": "...", "evidence_refs": ["..."] }`. Use concise standalone strings for `watch_next_fa`. Keep `market_story_fa` to 2–3 sentences, `what_changed_fa` to 1–2 sentences, and `narrative_fa` to one compact synthesis paragraph without duplicating list items. Return the requested market JSON contract without a composite score or confidence percentage. Mark the result provisional whenever domain coverage is incomplete.
