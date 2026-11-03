prompt_version: 0.6.0

Synthesize the domain rather than mechanically listing indicators. Identify the dominant story, load-bearing facts, leaders, contradictions, missing or low-quality coverage, risks, and what could change the view.

Make `top_drivers`, `supporting_evidence`, and `conflicting_evidence` the primary output. Each item should be an object shaped as `{ "title_fa": "...", "detail_fa": "...", "evidence_refs": ["..."] }`. Use concise standalone strings for `risks_fa` and `watch_next_fa`. Keep `dominant_story_fa` to 1–2 sentences and `narrative_fa` to one compact synthesis paragraph without repeating the lists.

Always populate the compact dashboard summary fields from the same evidence:
- `stance_label_fa`: one short stance label, not a sentence.
- `key_insights_fa`: exactly three short, evidence-grounded insights.
- `outlook_items`: exactly three objects with `label_fa`, `value_fa`, and a supported `tone` value.

For `corporate_fundamentals_valuation`, produce one integrated assessment across all ten configured charts: real TTM EPS, sales growth, profit margins, return on assets, trailing P/E, forward P/E, price-to-book, price-to-sales, PEG proxy, and dividend yield. Weigh earnings strength and business profitability against the prices investors pay, highlighting agreements and contradictions across fundamentals and valuation. Explain whether the observed fundamentals support the observed multiples and yields only when the supplied evidence supports that interpretation; otherwise state the uncertainty. Do not concatenate two independent reports or treat fundamentals and valuation as separate group analyses. Use the coverage and missing_inputs to identify unavailable charts; never invent their signals. Respect each observation's date, frequency, units, proxy limitations, and real-versus-nominal basis. Use only supplied Python-calculated financial metrics; do not derive new ratios or infer a missing chart from another chart.

For the `monetary_liquidity` domain, write dashboard copy that can be scanned quickly:
- Keep `stance_label_fa` under 5 Persian words.
- Keep each `key_insights_fa` item under 10 Persian words.
- Keep each `outlook_items.label_fa` under 4 Persian words and each `outlook_items.value_fa` under 12 Persian words.
- Keep `dominant_story_fa` to one sentence under 20 Persian words and `narrative_fa` under 35 Persian words.
- Return at most three items in each remaining list. Keep object titles under 6 Persian words, details under 18 Persian words, and standalone strings under 12 Persian words. Prefer direct phrases and omit repeated context.

For that domain, the three outlook items must cover, in order: the likely policy-rate/rate-cut path, continuation or change of quantitative tightening and the balance sheet, and the level of policy risk. State uncertainty or unavailability instead of guessing when inputs are stale or missing. Return the requested domain JSON contract without generating a composite score or confidence percentage. Do not use a Rule Engine result.
