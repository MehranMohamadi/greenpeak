# Dashboard market watch

All six cards are keyboard-accessible buttons. Clicking one opens its timestamped series in a responsive dialog with a value tooltip, source, interval and observation time in Tehran. The dialog uses the same observations as the card and follows its five-minute refresh; opening it does not trigger an additional provider request.

| Card | Provider / source symbol | Observation interval |
| --- | --- | --- |
| S&P 500 | Yahoo Finance / `^GSPC` | 5 minutes |
| 10Y T Yield | Yahoo Finance / Cboe `^TNX` | 5 minutes |
| VIX | Yahoo Finance / `^VIX` | 5 minutes |
| Dollar index | Yahoo Finance / `DX-Y.NYB` | 5 minutes |
| Gold spot | Twelve Data / `XAU/USD` | 5 minutes |
| S&P 500 trailing P/E | Multpl monthly table | Monthly |

`GET /api/market/watch?series=<spx|treasury-10y|vix|dollar-index|gold>` is a Next.js server route. The five-day Yahoo window and up to 1,500 gold observations are bounded, cached for five minutes and never interpolated. Actual last observation dates remain visible outside trading hours. Yahoo Treasury values are already percentages; they are not divided by ten. The Cboe yield benchmark is distinct from FRED daily DGS10. P/E keeps its published monthly frequency rather than manufacturing intraday values.

All three listeners in `nginx.conf` explicitly proxy `/api/market/watch` to Next.js on port 3000. The broader `/api/` backend forwarding remains unchanged. Deployment validates nginx before activating the release.

## Gold configuration

Set `TWELVE_DATA_API_KEY` (or the compatible alias `TWELVEDATA_API_KEY`) in the **server-side frontend** environment. Never use a `NEXT_PUBLIC_` variable or commit an actual key. The existing production deployment preserves `/root/sp500-dashboard/front2/.env` as each release's `.env.production.local`; put the key there or supply it to the frontend process environment and restart/redeploy the frontend. The repository-root backend `.env` is not automatically exported to the frontend.

The Twelve Data account must allow the `XAU/USD` time series and the intended display use. A free API key alone does not guarantee commodity entitlement. Missing keys, exhausted quota, upstream failures and malformed observations produce a clear unavailable state; the route does not silently substitute gold futures or another provider. Provider error messages and keys are never returned to the browser.

References: [Twelve Data commodity coverage](https://twelvedata.com/exchanges/commodity?group=core), [time-series parameters](https://github.com/twelvedata/twelvedata-python#time-series), [timezone settings](https://support.twelvedata.com/en/articles/5745849-timezones), [current plans](https://twelvedata.com/pricing).
