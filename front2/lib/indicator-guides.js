import guides from "./indicator-guides.json"

// Explicit identities only. In particular, ICE DXY is not the broad dollar index.
const ALIASES = {
  us_10y_treasury_yield: "ten-year-treasury", ten_year_treasury: "ten-year-treasury", "treasury-10y": "ten-year-treasury",
  federal_funds_rate: "fed-funds-rate", sofr_rate: "sofr-rate",
  real_interest_rate: "real-interest-rate", real_yield_10y: "real-interest-rate",
  "pe-ratio": "valuation_pe_ratio",
}

export function getIndicatorGuide(indicatorId) {
  const key = ALIASES[indicatorId] || indicatorId
  return Object.hasOwn(guides.entries, key) ? guides.entries[key] : null
}

export function indicatorGuideNote(indicatorId) {
  if (indicatorId === "sp500_eps") {
    return "این نمودار EPS واقعی دوازده‌ماههٔ گذشته از Multpl را نمایش می‌دهد؛ متن فایل راهنما دربارهٔ EPS عملیاتی است. این دو تعریف یکسان نیستند."
  }
  return null
}
