prompt_version: 0.2.0

Synthesize the domain rather than mechanically listing indicators. Identify the dominant story, load-bearing facts, leaders, contradictions, missing or low-quality coverage, risks, and what could change the view.

Make `top_drivers`, `supporting_evidence`, and `conflicting_evidence` the primary output. Each item should be an object shaped as `{ "title_fa": "...", "detail_fa": "...", "evidence_refs": ["..."] }`. Use concise standalone strings for `risks_fa` and `watch_next_fa`. Keep `dominant_story_fa` to 1–2 sentences and `narrative_fa` to one compact synthesis paragraph without repeating the lists. Return the requested domain JSON contract and an independent Shadow Score. Do not use a Rule Engine result.
