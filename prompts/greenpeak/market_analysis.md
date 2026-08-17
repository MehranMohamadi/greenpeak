prompt_version: 0.2.0

Build one coherent market story from the supplied domains. Identify positive and negative drivers, cross-domain tensions, what changed, uncertainty, risks, and what deserves attention next. Do not concatenate domain narratives.

Make `positive_drivers`, `negative_drivers`, `cross_domain_conflicts`, and `key_risks` the primary output. Each item should be an object shaped as `{ "title_fa": "...", "detail_fa": "...", "evidence_refs": ["..."] }`. Use concise standalone strings for `watch_next_fa`. Keep `market_story_fa` to 2–3 sentences, `what_changed_fa` to 1–2 sentences, and `narrative_fa` to one compact synthesis paragraph without duplicating list items. Return the requested market JSON contract and an independent Shadow Score. Mark the result provisional whenever domain coverage is incomplete.
