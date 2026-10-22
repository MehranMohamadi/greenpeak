# Market comparisons and relationships

The former S&P Group 8 is a standalone navigation destination at
`/market-comparison`, alongside S&P 500 and Gold. The former
`/analytics/intermarket` URL redirects there; the legacy intermarket API remains
available for its existing consumers. The S&P navigation now has seven groups.

The page contains two internal tabs: multi-market comparison and the relationship
between two markets. Each tab has its own chart and analysis box. Selections,
currency and period are independent and remain selected when switching tabs.
The sidebar keeps one standalone link, without nested tab navigation.
Both tabs use the site's Card, Button, searchable Command/Popover and Tabs
components. The first chart uses Lightweight Charts; the second uses the existing
Recharts library for an XY scatter plot. Text comes from deterministic Python calculations for the
requested selection, rather than a saved report for another selection or an LLM.

## Sources and the actual live check

Sources were tested on **2026-10-22**. These results establish observed coverage,
not a guarantee that an upstream service has supplied its complete history.

| Instrument | Exact source | Verified observations | Observed coverage |
| --- | --- | ---: | --- |
| S&P 500 | Yahoo `^GSPC` | 6741 | 2000-01-03 – 2026-10-21 |
| Nasdaq 100 | Yahoo `^NDX` | 6741 | 2000-01-03 – 2026-10-21 |
| Russell 2000 | Yahoo `^RUT` | 6741 | 2000-01-03 – 2026-10-21 |
| Gold futures | Yahoo `GC=F` | 6561 | 2000-08-30 – 2026-10-21 |
| Silver futures | Yahoo `SI=F` | 6562 | 2000-08-30 – 2026-10-21 |
| WTI futures | Yahoo `CL=F` | 6568 | 2000-08-23 – 2026-10-20 |
| Iran total index | TSETMC `32097828799138957` | 4311 | 2008-12-04 – 2026-10-21 |
| Iran equal-weight total index | TSETMC `67130298613737946` | 3032 | 2014-03-19 – 2026-10-21 |
| Iran cap-weighted price index | TSETMC `5798407779416661` | 4313 | 2008-12-04 – 2026-10-21 |
| Broad trade-weighted dollar | FRED `DTWEXBGS` | 5212 | 2006-01-02 – 2026-10-16 |
| Ten-year real Treasury yield | FRED `DFII10` | 5954 | 2003-01-02 – 2026-10-20 |

TSETMC was checked **before connecting it to the page** using HTTPS
`https://cdn.tsetmc.com/api/Index/GetIndexB2History/{id}`. The adapter validates
each `insCode`, Gregorian `dEven` and finite `xNivInuClMresIbs`. No missing-date
rows or synthetic observations are generated. The endpoint and identifiers are
documented by [finpy-tse's source](https://github.com/ARahimiQuant/finpy-tse/blob/main/finpy_tse/__init__.py).
There were no invalid or duplicate rows in these three live index responses.
The largest observed calendar gap was ten days (around Nowruz). This check
does not certify completeness against an official Iranian trading calendar.
The reported coverage starts at the first received observation, with no claim
that earlier history does not exist. Holidays and upstream omissions remain gaps.

All three Iran identities differ: the first two include cash distributions;
TEPIX is price-only. A total-return index is never silently exchanged for TEPIX.
Gold, silver and oil are explicitly labelled continuous futures prices, not spot
prices or investable total returns; contract rolls can affect their changes.

`DTWEXBGS` is the [Federal Reserve's broad dollar index](https://fred.stlouisfed.org/series/DTWEXBGS),
**not ICE DXY**. `DFII10` is the [daily inflation-indexed ten-year market yield](https://fred.stlouisfed.org/series/DFII10).
An existing `FRED_API_KEY` is used when configured; otherwise the public FRED
CSV export is used. The public CSV was verified using the already-installed
`curl-cffi` transport; ordinary requests timed out in this environment. Missing
FRED values (`.`) remain missing, including on holidays.

[BrsAPI's index documentation](https://brsapi.ir/bourse-api-index-webservice/)
describes current index snapshots. Historical index coverage was not verified;
it is not connected as a history fallback and its sample API key is not used.

## Free-market USD/IRR and the Iran/gold preset

[Navasan](https://www.navasan.tech/webserviceguide/) documents `ohlcSearch` for
`usd_sell`. No Navasan credential was available for a live authenticated check.
Consequently **the Iran/gold preset is disabled**, and cross-currency requests
return an explicit incompatible result until verified daily FX history exists.
No official FX rate, present-day FX rate or made-up history is substituted.

An operator can configure `NAVASAN_API_KEY` and an explicitly confirmed
`NAVASAN_QUOTE_UNIT` (`IRR` or `IRT`) and run the source probe with `--include-fx`.
The unit must be checked against the subscribed response; the adapter never
guesses rial versus toman. Toman quotes are multiplied by ten for IRR/USD.
The parser requires a list of timestamped daily closing values and at least 60
valid daily observations before recording a verified FX cache. Unexpected
response shapes fail closed. The preset becomes available only after that live
check succeeds. It uses **TEPIX versus gold in USD**, with both price-only.

## Calculation rules

* Periods are anchored to the server's current date, not stale observations.
  The actual common start/end dates are returned and displayed.
* All selected available series are intersected on exact observation dates.
  Each non-rate series is `100 * value / value_on_first_common_date`. A
  nonpositive baseline is rejected. No interpolation or forward fill occurs.
* Cross-currency asset values use the USD/IRR close on the **same date**:
  IRR to USD divides by FX; USD to IRR multiplies. FX dates also participate in
  the intersection. Original source units remain disclosed.
* Asset dividend bases must match. TEDPIX/equal-weight can be compared together
  in IRR; mixed price/total-return requests are rejected with an explanation.
* Pearson correlation uses consecutive common-date simple returns, not levels.
  For a rate leg it uses consecutive changes in **basis points**. At least 20
  common intervals and nonzero variance are required. Nonpositive asset prices
  make return correlation unavailable. Dates can span multiple calendar days;
  trading sessions in different timezones need not close simultaneously.
* The relationship chart uses each day's **raw, currency-converted levels**:
  the second selected symbol is X and the first selected symbol is Y. It does
  not plot time or base-100 display values on either axis. A date is retained
  only in the point's tooltip. Axis metadata carries the correct displayed
  units and currency. This level plot is distinct from the change-based
  correlation statistic in the analysis box.
* Rates retain their percent values on whichever XY axis they occupy and
  never appear in asset performance rankings. Dollar indexes also stay out of
  asset rankings. Missing observations and insufficient history produce null.
* Missing selected instruments are explicit. A partial overview has no ranking;
  a pair with a missing leg has neither chart nor relationship analysis.

## API, cache and verification

`GET /api/v1/market-comparison/symbols` returns the whitelist and preset readiness.
`POST /api/v1/market-comparison/compare` takes `symbols`, `period`, `view`
(`performance` or `relationship`) and `currency` (`USD` or `IRR`). JSON contracts
live in `backend2/src/models/market_comparison.py`. Requests cannot supply URLs,
paths, arbitrary provider series, duplicate symbols or more than eight symbols.
Response schema `1.1.0` adds the nullable `relationship` object containing
`x_axis`, `y_axis` and date-matched `points` (`date`, `x`, `y`). It is null for
multi-market requests and unavailable/incompatible relationships. The existing
series data and change-based correlation fields retain their meanings.

The server stores source observations atomically under
`backend2/instance/market_comparison/`, separately from raw market datasets.
The refresh interval is 12 hours. Cache failures fall back to a visibly stale
validated cache; observation freshness is also checked. No ETL, raw collection,
MongoDB or LLM writes take place. For persistence across production releases,
set `MARKET_COMPARISON_CACHE_DIR` to a persistent server-owned directory.
Secrets and upstream exception text are never included in response errors.

From `backend2/`, reproduce source verification (network required):

```powershell
$env:DEBUG = "false"
.\.venv\Scripts\python.exe -m src.services.market_comparison.cli --symbols iran_total,iran_equal,iran_price
.\.venv\Scripts\python.exe -m src.services.market_comparison.cli --symbols sp500,gold,broad_dollar,real_yield_10y
# Only with configured and verified Navasan credentials/units:
.\.venv\Scripts\python.exe -m src.services.market_comparison.cli --include-fx
.\.venv\Scripts\python.exe -m pytest tests/test_market_comparison.py
```
