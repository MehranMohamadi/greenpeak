# US500 status cards — method 1.0.0

Only the five summary cards use this method. Narratives, outlooks, factors and
calendar tables keep their existing contracts. The cards do not use the model's
legacy `status_summary` labels or its prose to infer a market state.

`GET /api/v1/market/status-summary` reads the existing validated market snapshot
and existing source adapters. It never runs the LLM or writes a narrative.
The UI fetches this bounded response every 60 seconds and on returning to the
tab. The backend coalesces source reads in a 60-second cache; existing official
source caches retain their own published refresh/freshness rules. Upstream
failures yield explicit unknown states, not zeroes or a silent stale label.
Each card exposes its rule, actual source dates, explanation and measurements.

## Daily change intensity

Use Yahoo `^GSPC` daily OHLC from the same provider as the live chart, including
the evolving current regular session. All trading dates use America/New_York.
No checked-in historical CSV is presented as today's quote.

For each session, `TR% = 100 * max(high-low, abs(high-previous_close),
abs(low-previous_close)) / previous_close`. This is normalized True Range,
not ATR, signed return, model sentiment, or an annualized volatility forecast.
The [True Range definition](https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/atr)
captures gaps and is independent of price direction.

Compute the lower/upper empirical terciles of the previous 252 valid completed
sessions, excluding today. Use inclusive linear sample quantiles (Hyndman–Fan
type 7; [NIST's description of sample percentiles](https://itl.nist.gov/div898/software/dataplot/refman2/auxillar/percenti.htm)).
At/below the lower tercile is low, above it through the upper tercile is medium,
and above the upper tercile is high. At least 126 reference sessions and distinct
tercile boundaries are required. These are GreenPeak's documented relative
classification policy, not universal industry boundaries or an assumed 2% move.
The 252-session window approximates a trading year; the 126-session floor is an
explicit minimum-history quality gate, not an estimated financial observation.

Intraday, the result compares **observed range so far** with completed daily
ranges and is explicitly provisional; it is not adjusted or extrapolated for
the remaining trading time. A quiet morning can therefore be low before the
range expands. The API returns the actual thresholds and reference count.
Before the open, on holidays/weekends, or when today's quote is unavailable,
intensity is unknown instead of using yesterday's move. Quotes more than 20
minutes old during trading, or lacking a sufficiently recent end-of-session
observation after the close, are rejected. Source session start/end times are
used when supplied (including early closes); ordinary NY session times are
the documented fallback.

## Sentiment

Use existing AAII weekly bullish/neutral/bearish shares and CFTC E-mini S&P 500
Asset Manager net positions. Survey dates must align, percentages must be valid,
and two consecutive CFTC reports must be 4–14 calendar days apart. Reuse the
existing adapters' 10-calendar-day weekly freshness limits.

Positive requires a bullish AAII plurality **and** an increase in Asset Manager
net positioning; negative requires a bearish plurality **and** a decrease.
Ties, neutral plurality, unchanged positioning or opposing directions are
neutral. If either input is missing/stale, the aggregate is unknown. This is a
transparent two-source weekly sentiment/positioning proxy, not comprehensive
real-time sentiment, a contrarian signal or a forecast of the index return.
It uses neither the price change nor the count/tone of news articles.

## Current market risk

Reuse Cboe VIX/VIX9D/VIX3M and the existing high-importance US calendar. The
VIX level is classified against the preceding 252 observations' terciles,
with the same 126-observation minimum. VIX9D and VIX3M must share a fresh
observation date; the source adapter's 5-day daily freshness limit applies.
Do not use a same-day daily Cboe close before the normal session close.

- High: upper-tercile VIX or VIX9D above VIX3M, indicating elevated near-term
  expected volatility relative to the longer horizon.
- Medium: middle-tercile VIX or at least one high-importance release within
  24 hours. Duplicating calendar items never increases severity.
- Low: lower-tercile VIX, non-inverted term structure and a successfully read
  calendar without an imminent high-importance event.
- Unknown: a required input is unavailable, unless a known high-risk signal
  already establishes a high floor. Missing inputs still reduce confidence.

These are explicit GreenPeak operational rules based on observed data, not
LLM scores or universal risk boundaries. Cboe documents the
[different expected-volatility horizons](https://www.cboe.com/tradable_products/vix/term_structure).
This card measures current volatility/event risk; the existing separate factors
section covers structural multi-year risks. It never counts negative headlines
or converts the model's wording/severity labels into a numeric risk score.

## Overall conditions and confidence

Overall conditions synthesize the two sourced states: positive sentiment plus
low current risk is favorable; negative sentiment plus high current risk is
challenging; other known combinations are mixed. A missing component yields
unknown. The explanation states the components; it does not reinterpret the
short-/medium-term narrative or claim a future price direction.

Confidence is about evidence quality, never the model's belief in a forecast:

- Low when an essential quote/sentiment/volatility/calendar input is absent,
  the analysis timestamp is future or older than 36 hours, coverage is absent,
  or its source data date is missing, future or older than 5 calendar days.
- High only with those essential inputs present, full pipeline-computed
  coverage and no missing inputs, no stale-cache flag, and no disagreement
  between survey direction and positioning direction.
- Medium otherwise: essential inputs exist, but coverage is partial, the
  source refresh failed, or the sentiment witnesses disagree.

The 36-hour analysis and 5-day source-date gates are versioned freshness policy,
not probabilities or empirical claims about predictive accuracy. Normal weekly
publication intervals are checked using the existing weekly source thresholds.
An expected absence of a current session before the open/weekend is distinct
from a quote outage; a recent validated prior quote can support data-quality
assessment but is never used to fabricate today's intensity. Identical source
data/quality/timestamps yield identical states even if all narrative text and
legacy AI status labels change.
