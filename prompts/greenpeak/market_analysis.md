prompt_version: 0.6.0

Build one coherent market story from the supplied domains. Identify positive and negative drivers, cross-domain tensions, what changed, uncertainty, risks, and what deserves attention next. Do not concatenate domain narratives.

Populate the structured dashboard fields from supplied evidence only:
- `current_market_move_fa`: 1 to 2 concise Persian lines about the direction of the most recent completed S&P 500 session. When `sp500_session_move.session_scope` is `today_late_or_closed`, discuss today's move; otherwise discuss the previous completed session. Explain only evidence-supported drivers, distinguish association from causality, and explicitly say when the reason is uncertain or market-move evidence is unavailable.
- `current_analysis_fa`: the comprehensive current-state analysis previously carried by the general synthesis. Consider every supplied domain, including policy, yields, liquidity, growth, inflation, labor, credit, earnings, valuation, market internals, positioning, sentiment, volatility, capital flows, and intermarket evidence. Preserve important conflicts and missing coverage.
- `short_term_outlook_fa`: a Persian outlook from the next several days through the next several weeks. Give the greatest weight to `recent_market_news`, `upcoming_us_events`, sentiment, positioning, volatility, and the conditions that could change the near-term path. Do not turn scheduled events into known outcomes.
- `medium_term_outlook_fa`: a fundamental six-to-twelve-month Persian outlook for the broad U.S. equity market. Use all supplied domain narratives and their underlying chart/indicator evidence. Give relatively low weight to current news and individual calendar events, and emphasize policy, liquidity, growth, inflation, earnings, valuation, credit, and market breadth.
- `summary_points_fa`: exactly five concise Persian strings synthesizing the current state, short-term outlook, medium-term outlook, principal risk, and forward-looking conclusion. These must summarize the other three horizon fields rather than introduce new claims.
- `status_summary`: market condition, risk level, sentiment, daily change intensity, and confidence level. Judge `change_intensity` only against the previous completed U.S. trading session close, using the supplied latest and prior S&P 500 closing values or percentage change when available. A roughly 2% one-day index move is high intensity; calibrate smaller index moves proportionately. Day-to-day shifts in market condition or sentiment are usually limited, so do not call them high intensity by themselves. Use `unknown` when prior-close evidence is unavailable. Confidence must reflect evidence completeness and consistency; use `unknown` when evidence is insufficient.
- `market_drivers`: only the 3 to 5 most material current drivers. Include current, previous, and forecast values only when supplied; also include why the driver matters, impact, sentiment, duration, reversal conditions, and evidence references.
- `market_conflicts`: opposing signals, the current balance, and the condition that could reverse that balance.
- `risk_monitor`: active risks with severity, why each is active, escalation conditions, and easing conditions.
- `important_changes`: meaningful comparable changes with previous/current values and market meaning. Leave this empty when comparable values are unavailable.
- `systemic_synthesis_fa`: a compact backward-compatible synthesis consistent with `current_analysis_fa`.
- `glance_summary`: concise supportive, pressuring, uncertainty, and regime-shifter lists.

All Persian text must be concise and suitable for an RTL dashboard. Keep English metric identifiers and evidence references unchanged. Never create calendar events, news, dates, percentages, prices, forecasts, or previous values that are absent from evidence.

Use `market_drivers`, `market_potentials`, and `risk_monitor` as the primary factor output. Retain `positive_drivers`, `negative_drivers`, `cross_domain_conflicts`, and `key_risks` for backward compatibility. Each item should be an object shaped as `{ "title_fa": "...", "detail_fa": "...", "evidence_refs": ["..."] }`. Use concise standalone strings for `watch_next_fa`. Keep `market_story_fa` to 2–3 sentences, `what_changed_fa` to 1–2 sentences, and `narrative_fa` to one compact synthesis paragraph without duplicating list items. Return the requested market JSON contract without a composite score or confidence percentage. Mark the result provisional whenever domain coverage is incomplete.


Dashboard factor horizons:
- `market_drivers`, `positive_drivers`, and `negative_drivers` describe short-term news, releases, and events (days to weeks). An employment release belongs here; classify its direction only from supplied evidence.
- `market_potentials`: medium-term (six-to-twelve-month) upside opportunities, each with `title_fa`, `detail_fa`, and `evidence_refs`. Explain the evidence-supported growth mechanism and realization conditions. Do not relabel conflicting signals as opportunities. Return an empty list when unsupported.
- `risk_monitor` and `key_risks`: medium-term fundamental or structural downside risks. An AI valuation bubble belongs here only when supported by supplied evidence. Individual employment releases belong among short-term drivers instead.
- Keep material evidence-supported factors without duplicating structured entries in legacy lists; use legacy driver/risk lists only when their structured counterpart is empty.
