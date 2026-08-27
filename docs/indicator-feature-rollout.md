# Indicator feature and narrative rollout

## Scope

The first production rollout covers 30 single-series charts that already have a
real backend data source. All 30 are now registered, supported by the unit-aware
feature job and LLM evidence pipeline, exposed by latest/debug/preview APIs, and
connected to the shared frontend analysis card.

The browser remains a presentation layer. It must not calculate financial
features or invoke an LLM. The server pipeline is:

```text
raw observation -> canonical adapter -> deterministic feature template
-> validated/versioned snapshot -> deterministic rules -> persisted LLM narrative
```

An indicator is not eligible merely because the UI renders a chart. It must
have a real, attributable time series and an explicit unit/frequency contract.

## Production inventory (30)

| # | Domain | Indicator ID | Backend series/source | Unit | Frequency | Initial status |
|---:|---|---|---|---|---|---|
| 1 | monetary_liquidity | `federal_funds_rate` | DFF | percent | daily | implemented |
| 2 | monetary_liquidity | `us_10y_treasury_yield` | DGS10 | percent | daily | implemented |
| 3 | monetary_liquidity | `fed_balance_sheet` | WALCL | millions USD | weekly | planned |
| 4 | monetary_liquidity | `sofr_rate` | SOFR | percent | daily | planned |
| 5 | monetary_liquidity | `real_interest_rate_10y` | REAINTRATREARAT10Y | percent | monthly | planned |
| 6 | growth_inflation_labor | `real_gdp` | GDPC1 | billions of chained 2012 USD | quarterly | planned |
| 7 | growth_inflation_labor | `unemployment_rate` | macro unemployment collection | percent | monthly | planned |
| 8 | growth_inflation_labor | `nonfarm_payrolls` | macro payroll collection | thousands of persons | monthly | planned |
| 9 | growth_inflation_labor | `consumer_confidence` | UMCSENT | index | monthly | planned |
| 10 | growth_inflation_labor | `cpi_index` | CPIAUCSL | index | monthly | planned |
| 11 | growth_inflation_labor | `retail_sales` | RSXFS | millions USD | monthly | planned |
| 12 | credit_financial_risk | `vix` | VIX | index | daily | planned |
| 13 | credit_financial_risk | `high_yield_credit_spread` | BAMLH0A0HYM2 | percent | daily | planned |
| 14 | credit_financial_risk | `treasury_2y10y_spread` | T10Y2Y | percent | daily | planned |
| 15 | credit_financial_risk | `bbb_credit_spread` | BAMLC0A4CBBB | percent | daily | planned |
| 16 | credit_financial_risk | `financial_stress_index` | STLFSI4 | index | weekly | planned |
| 17 | monetary_liquidity | `money_supply_m2` | M2SL | billions USD | monthly | planned |
| 18 | monetary_liquidity | `reverse_repo_operations` | RRPONTSYD | millions USD | daily | planned |
| 19 | corporate_fundamentals | `sp500_eps` | performance graph dataset | USD/share | quarterly | planned |
| 20 | corporate_fundamentals | `revenue_growth` | corporate_earnings | percent | quarterly | planned |
| 21 | corporate_fundamentals | `profit_margins` | corporate_earnings | percent | quarterly | planned |
| 22 | corporate_fundamentals | `corporate_pe_ratio` | corporate_earnings | ratio | monthly | planned |
| 23 | corporate_fundamentals | `corporate_dividend_yield` | corporate_earnings | percent | monthly | planned |
| 24 | corporate_fundamentals | `return_on_assets` | corporate_earnings | percent | quarterly | planned |
| 25 | valuation | `valuation_pe_ratio` | valuation | ratio | monthly | planned |
| 26 | valuation | `forward_pe_ratio` | valuation | ratio | daily | planned |
| 27 | valuation | `price_to_book_ratio` | valuation | ratio | daily | planned |
| 28 | valuation | `price_to_sales_ratio` | valuation | ratio | daily | planned |
| 29 | valuation | `peg_ratio` | valuation | ratio | daily | planned |
| 30 | valuation | `valuation_dividend_yield` | valuation | percent | monthly | planned |

The two P/E and two dividend-yield series are intentionally distinct. They are
stored in different collections and may differ in source, sampling, or history;
they must not silently share snapshots.

## Explicitly deferred charts

The current `equity_fund_flows`, `etf_inflows`, `margin_debt`, and
`institutional_flows` endpoints can return empty placeholder responses. They
remain outside the production registry until a real provider and history are
available. Missing data must never be converted to zero or synthesized for the
LLM.

Multi-series sector charts, derivatives mock data, browser-side intermarket
routes, sentiment/news, institutional mock data, and event calendars require
separate contracts. They are not part of this 30-indicator single-series wave.

## Feature families

The rollout must use semantic templates instead of applying interest-rate
formulas to every series:

1. `daily_rate`: percent levels and changes in basis points; existing DFF/DGS10
   behavior remains unchanged.
2. `periodic_percent`: monthly/quarterly percent values; percentage-point
   changes, release-aware lookbacks, z-score, percentile, and trend.
3. `positive_level`: currency, population, and index levels; absolute and
   percentage changes, rolling growth, z-score, percentile, and trend.
4. `ratio_level`: valuation ratios; absolute/percentage changes, historical
   percentile, z-score, and mean/median distance.
5. `stress_or_spread`: stress indexes and credit/yield spreads; level, change,
   percentile, z-score, threshold state, and inversion where semantically valid.

Calendar-day lookups still select the latest observation on or before the
target date. Sparse monthly and quarterly data must additionally expose
observation/release counts so an LLM cannot mistake repeated calendar windows
for independent releases.

## Delivery gates

Each indicator is complete only when all of these are present:

- strict registry definition, source collection/series, unit, frequency, and
  semantic direction;
- canonical cleaning with invalid and duplicate flags;
- versioned deterministic features and Pydantic validation;
- idempotent snapshot persistence and sanitized debug/preview output;
- deterministic rule coverage and persisted LLM evidence input;
- frontend latest-snapshot/narrative display with a non-LLM preview fallback;
- focused offline tests for malformed, empty, sparse, stale, and duplicate data.
