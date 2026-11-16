# Market report editions

The scheduled market narrative uses analysis version `0.6.0` and edition contract
`1.0.0`. Existing `0.5.0` snapshots remain readable. Raw data and deterministic
financial feature formulas are unchanged.

Default start times are in `Asia/Tehran`; the existing environment settings still
control the two slot times. They are start times, not guaranteed completion times.

| Days | 16:00 | 21:30 |
| --- | --- | --- |
| Monday | `weekly`: week ahead, short-term and 6–12 month assessments | `session`: current-session news and mood |
| Tuesday–Friday | `daily`: today's pulse and short-term review | `session`: current-session news and mood |
| Saturday–Sunday | `weekend`: today's news atmosphere | No run |

The schedule follows weekdays, not an exchange holiday calendar. On a U.S.
holiday, before opening, or with missing/stale observations, the report must not
invent a current trading reaction. It identifies the actual observed session.
Weekend reports describe the news atmosphere and conditional reopening relevance.

## Generation and retention

- Weekday afternoon runs build the existing indicator/domain pipeline. Monday
  assesses both outlooks; Tuesday–Friday normally reassess only short-term. An
  exceptional material change may update an existing medium-term view when the
  model explicitly identifies the change and cites current supplied source objects.
  Unchanged conditions, missing evidence and retained earlier sources do not qualify.
- Session/weekend runs collect current context and reuse stored dated domains.
  They can produce a provisional pulse even when no domains exist. Their reduced
  model output contract excludes outlooks and factors.
- Python retains previous outlooks/factors and their original assessment times;
  it ignores out-of-scope model output. An absent assessment stays absent.
- `short_term_view` and `medium_term_view` contain `summary_fa`,
  `change_condition_fa`, `detail_fa`, `change_summary_fa`, `change_status`,
  `assessed_at`, and `data_as_of`. Python supplies dates. A claim of changed or
  unchanged needs a prior assessment; the prompt requires an evidence-based review.
- The model receives the previous report as comparison context, not fresh evidence.
  Python separates news published on the report's Tehran day into `today_market_news`;
  session/weekend input excludes earlier news. Broader news remains available for
  weekday outlook and factor assessment, with original publication times.
  Cached official sentiment observations retain source, frequency, observation date
  and quality. Daily/weekly surveys and positioning are never called live sentiment.
- Pulse-only visible reports are limited to 70 words; daily to 110; weekly to 300.
  These limits count Persian whitespace-separated words and are validated before
  persistence. Factor details are separate from these visible-report limits.
- The prompt and edition instructions are hashed together. Prompt edits made in
  the admin interface remain active; mandatory edition scope is appended at runtime.

## Website and Telegram

The website shows a visible pulse next to the chart, followed by independently
dated short- and medium-term cards. Each card exposes its summary and change
condition, with expandable reasons and comparison. Monday's focus/events are
retained with their weekly assessment time. Legacy prose is available in details;
it is not relabelled as a newly assessed structured outlook. Existing premium
access restrictions apply to all new outlook fields and weekly analysis.

Telegram uses the same persisted edition: session/weekend send only the pulse and
  one watch-next item; daily adds the short-term summary/condition (and a brief
  medium-term alert only after an exceptional material reassessment); weekly includes
the week's focus, up to three events, and both outlooks. No extra five-point summary
is sent for the new editions. The existing bot, chat and market topic are reused.
Scheduled notification retries look up the exact generated revision, so an evening
snapshot cannot replace the afternoon report in a delayed notification.

Normal API/page reads never generate analysis or send notifications. Changes to
these source files require the normal server restart/deployment to take effect;
this change does not deploy or send a real Telegram message as validation.
