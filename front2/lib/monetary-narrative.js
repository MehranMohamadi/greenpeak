export const monetaryNarrativeIds = {
  "fed-funds-rate": "federal_funds_rate",
  "ten-year-treasury": "us_10y_treasury_yield",
  "sofr-rate": "sofr_rate",
  "real-interest-rate": "real_interest_rate_10y",
  "fed-balance-sheet": "fed_balance_sheet",
  "money-supply-m2": "money_supply_m2",
  "reverse-repo": "reverse_repo_operations",
}

export function matchingNarrative(body, indicatorId) {
  const analysis = body?.data
  return analysis?.level === "indicator" && analysis.subject_id === indicatorId ? analysis : null
}
