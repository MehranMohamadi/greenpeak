# GreenPeak Indicator Mapping Audit

Audit date: 2026-08-17. This inventory covers analytical routes, chart components, hooks, backend endpoint groups, and checked-in fallback-backed series. Only DGS10 and DFF are registered in the versioned GreenPeak feature/analysis pipeline today. Other rows are discovery records, not promises of implemented features.

| Display / series | Internal ID | Source / current consumer | Route or component | Primary domain | Related domains | Status / notes |
|---|---|---|---|---|---|---|
| 10-Year Treasury Yield | `us_10y_treasury_yield` | FRED `DGS10`; Treasury CSV fallback | monetary policy / `useTenYearData` | `capital_flows_intermarket` | monetary, credit | REGISTERED |
| Federal Funds Rate | `federal_funds_rate` | FRED `DFF`; `DFF.csv` | monetary policy / `useDFFData` | `monetary_liquidity` | — | REGISTERED |
| Fed Balance Sheet | `fed_balance_sheet` | FRED/WALCL | monetary policy / `useWALCLData` | `monetary_liquidity` | — | DISCOVERED |
| SOFR | `sofr` | monetary API | monetary policy / `useSOFRData` | `monetary_liquidity` | credit | DISCOVERED |
| Real Interest Rate | `real_interest_rate` | monetary API | monetary policy / `useRealInterestRateData` | `monetary_liquidity` | valuation | DISCOVERED |
| Treasury curve tenors | `treasury_curve` | Treasury curve CSV/API | monetary policy | `credit_financial_risk` | intermarket | DISCOVERED; multi-series |
| GDP | `gdp` | economic API | macroeconomic / `useGDPData` | `growth_inflation_labor` | — | DISCOVERED |
| Unemployment Rate | `unemployment_rate` | FRED/economic API | macroeconomic / `useUNRATEData` | `growth_inflation_labor` | — | DISCOVERED |
| CPI/PCE/PMI/Retail Sales | — | macroeconomic API | `macroeconomic*.jsx` | `growth_inflation_labor` | — | NEEDS_CLASSIFICATION at series-ID level |
| VIX | `vix` | monetary/market API | systemic risk / sentiment | `positioning_sentiment_derivatives_volatility` | credit | DISCOVERED |
| Systemic-risk series | — | systemrisk API | `systemic-risk*.jsx` | `credit_financial_risk` | — | NEEDS_CLASSIFICATION at series-ID level |
| Liquidity and fund flows | — | liquidity API | `liquidity-flows*.jsx`, `fund-flows.jsx` | `capital_flows_intermarket` | monetary | NEEDS_CLASSIFICATION at series-ID level |
| Corporate earnings/EPS | — | corporate API | `corporate-earnings*.jsx` | `corporate_fundamentals` | — | DISCOVERED; multi-series |
| Valuation multiples | — | valuation API | `valuation*.jsx` | `valuation` | — | DISCOVERED; multi-series |
| Sector performance/rotation | — | sectors API | `sector-performance*.jsx` | `market_internals_sectors` | — | DISCOVERED; multi-series |
| Breadth/market internals | — | market API | `market-internals.jsx` | `market_internals_sectors` | — | DISCOVERED; multi-series |
| Put/Call, skew, futures, sentiment | — | derivatives/sentiment UI sources | `derivatives.jsx`, `sentiment*.jsx` | `positioning_sentiment_derivatives_volatility` | — | NEEDS_CLASSIFICATION at series-ID level |
| DXY, gold, oil, cross-asset series | symbols vary | Next.js/external providers | `intermarket*.jsx` | `capital_flows_intermarket` | — | NEEDS_CLASSIFICATION at symbol level |
| Institutional positioning | — | institutional UI sources | `institutional*.jsx` | `positioning_sentiment_derivatives_volatility` | flows | NEEDS_CLASSIFICATION at series-ID level |
| Macro calendar/events | — | calendar/news API | `macro-calendar.jsx`, `events-news.jsx` | — | — | HORIZONTAL: `events_calendar` / `news_narratives` |

The strict config loader validates that every registered indicator has exactly one valid primary domain, all related domains exist, IDs are unique, and horizontal layers cannot accidentally become primary domains because they are absent from the domain registry.
