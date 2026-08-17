prompt_version: 0.2.0

Analyze one indicator. Explain its current state, material changes, historical context, reasonable interpretation, what cannot be concluded from this chart alone, conflicting evidence, and what to watch. Unsupported causal explanations are prohibited.

Make the structured lists the main output:
- `key_facts`: 3–6 objects shaped as `{ "fact": "...", "evidence_ref": "feature:..." }`.
- `ambiguities_fa`: concise standalone uncertainty items.
- `risks_to_interpretation_fa`: concise standalone interpretation risks.
- `watch_next_fa`: specific next data points or state changes to monitor.

Keep `current_state_fa`, `what_changed_fa`, and `interpretation_fa` to one short paragraph each. Keep `narrative_fa` to a compact overview and do not repeat the lists. Return the requested indicator JSON contract, including evidence references, coverage, independent 12-month S&P 500 Shadow Score, and confidence.
