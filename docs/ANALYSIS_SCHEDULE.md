# Analysis schedule

The default market-report schedule has two daily runs, including weekends:

| Start time | Timezone | Work |
| --- | --- | --- |
| 16:00 | Asia/Tehran | Existing full feature → indicator → domain → market pipeline |
| 21:30 | Asia/Tehran | Market report with fresh market/news/calendar context and validated stored domain narratives |

These are start times; generating the report takes additional time. The evening run uses the existing market prompt and JSON contract, including the current market-flow tab. It does not regenerate indicator/domain narratives or write raw observations or rate features. Dates on reused domain evidence are preserved; absent domain evidence leaves the report incomplete instead of inventing inputs.

The existing `GREENPEAK_DAILY_ANALYSIS_HOUR`, `GREENPEAK_DAILY_ANALYSIS_MINUTE`, and `GREENPEAK_DAILY_ANALYSIS_TIMEZONE` retain control of the first run. The second run defaults are:

```text
GREENPEAK_MARKET_EVENING_ANALYSIS_ENABLED=true
GREENPEAK_MARKET_EVENING_ANALYSIS_HOUR=21
GREENPEAK_MARKET_EVENING_ANALYSIS_MINUTE=30
GREENPEAK_MARKET_EVENING_ANALYSIS_TIMEZONE=Asia/Tehran
```

`GREENPEAK_DAILY_ANALYSIS_ENABLED=false` disables both automatic runs. A configured LLM provider is also required. The admin prompt catalog displays defaults and differing server settings. Changes to environment settings take effect when the backend restarts.

Runs retain independent shared MongoDB keys (`daily:YYYY-MM-DD` and `market-evening:YYYY-MM-DD`) and retry budgets. Failed/incomplete work is checked every five minutes, up to three attempts per slot. Startup recovery executes only today's due slots, in chronological order. Existing Telegram notification handling applies to each completed market run, with delivery retries every two minutes. Reading the dashboard does not generate analysis.

The latest-analysis API reports the next scheduled run across both slots. Freshness is checked against the most recent due slot, so an afternoon report becomes overdue at 21:30 until a new report is generated.
