# News source page access review

The news tabs use five publishers from the supplied GreenPeak news source review:
Bloomberg Markets (default), CNBC's combined sections, WSJ Business, New York Times Economy,
and The Economist Finance and Economics. These are section feeds, not complete
publisher coverage. Direct publisher feeds are used, including the NYT and
Economist feeds verified on 2026-11-03 instead of Google News intermediary links.
Legacy stored Alpha Vantage and Investing.com source endpoints remain readable;
they are no longer fetched by this scheduler.

CNBC uses Economy, Earnings, and US Top News as its primary feeds, with Finance
as a supplement, based on rows 6–9 of GreenPeak_CNBC_Sections.xlsx. Market Insider
and Technology are optional suggestions in that workbook and are not enabled.
The four feeds are merged into one CNBC tab in publication order. Overlapping
article URLs are deduplicated, with all observed section memberships retained.
Section membership is also stored in `gp_news_item_sections`, allowing existing
raw news records to remain unchanged. Per-section fetch results are recorded in
ingestion run metrics. A failed section does not discard the successful feeds.
The UI shows the coverage and the known sections of each story. These are
publisher feed memberships, not inferred US relevance or importance scores.
No automatic country/company exclusions are inferred from the workbook's
editorial suggestions. The existing calendar and page-text analysis are unchanged.

`GREENPEAK_CNBC_RSS_URL` remains the Economy override. Additional overrides are
`GREENPEAK_CNBC_EARNINGS_RSS_URL`, `GREENPEAK_CNBC_US_TOP_NEWS_RSS_URL`, and
`GREENPEAK_CNBC_FINANCE_RSS_URL`. CNBC still counts as one publisher in the
ten-day review, with at most three daily page samples from the merged feed;
this change does not reset the existing review window.

## Ten-day observation window

The existing news scheduler fetches the five RSS feeds every ten minutes when
`GREENPEAK_NEWS_ENABLED=true`. On the first ingestion, MongoDB atomically stores
the start date in `gp_news_access_reviews` using review ID
`publisher-page-access-v1`. The window covers that date plus nine more calendar
dates in Asia/Tehran. Restarts do not reset the window. After it ends, ingestion
continues but automatic page probes stop. No deployment or production review was
started by the code change itself.

Each source is sampled once per date, using up to three distinct latest links
from its feed. Results are idempotent `news_access_review` runs in `gp_news_runs`.
Empty feeds and feed errors are recorded separately from page failures. A day
when the application or MongoDB is unavailable is missing, not successful. The
report shows sampled dates so outages cannot look like ten days of evidence.

`GET /api/v1/news/access-review` returns the report without triggering requests.
The expandable review panel in the news card displays counts and the sampled
links. It refreshes every minute and has a manual refresh button. `completed`
means that the time window elapsed; inspect sampled dates and attempts before
drawing conclusions about reliability.

## What is measured

The server requests public pages as `GreenPeak-News-Analysis/1.0`, without login,
paid access, proxies, CAPTCHA workarounds, or LLM calls. It records the link,
date, HTTP status, extraction result, and character count. Article text is not
stored in review results. Subscription declarations and known challenge pages
do not count as successful extraction. Redirect targets are validated.

`page_text_available` means readable text was extracted from an article/main
element or an article-body container (including CNBC's div layout). It does not prove the complete article was returned, confirm publisher
permission for AI processing, or establish access by a different AI crawler.
The HTML heuristic can miss unmarked teasers or JavaScript-only article bodies.
Results depend on the server's network/location and must be observed on the
deployment where the dashboard actually runs.

For a selected news story, the existing analysis flow reads the linked page
before sending evidence to the configured model. If reading fails, it can still
analyze the RSS summary, but the UI explicitly labels this limited evidence and
shows the access failure. These on-demand analyses are independent of the
bounded daily samples and may call the configured LLM as before.

Feed URLs are environment-configurable with `GREENPEAK_BLOOMBERG_RSS_URL`,
`GREENPEAK_CNBC_RSS_URL`, `GREENPEAK_WSJ_RSS_URL`,
`GREENPEAK_NYTIMES_RSS_URL`, and `GREENPEAK_ECONOMIST_RSS_URL`.

## Initial read-only spot check (2026-11-03)

All five direct RSS feeds returned valid items from the development network.
One current link per feed was checked without writing production review records:

| Publisher | Feed items | Page sample result |
| --- | ---: | --- |
| Bloomberg | 20 | Subscription declaration in HTTP 200 page |
| CNBC | 30 | Page text extracted, 1,786 characters |
| WSJ | 85 | HTTP 401, authentication required |
| New York Times | 20 | Subscription declaration in HTTP 200 page |
| The Economist | 300 | HTTP 403, blocked |

These are single-page observations, not a ten-day conclusion or a guarantee
about other articles. The deployed server's observations remain authoritative
for evaluating access from that environment.
