import { BadgeDollarSign, BookOpenCheck, Building2, CircleDollarSign, Database, Percent, Scale, TrendingUp } from "lucide-react"

export const corporateFactors = [
  { id: "sp500-eps", key: "sp500eps", indicatorId: "sp500_eps", title: "S&P 500 Real TTM EPS", group: "Earnings", icon: BadgeDollarSign, unit: "USD", description: "Monthly 12-month real earnings per share from Multpl. The source inflation-adjusts the series and may restate historical values when its reference month changes." },
  { id: "sales-growth", key: "revenue", indicatorId: "revenue_growth", title: "Sales Growth", group: "Sales", icon: Building2, unit: "%", description: "Quarterly nominal growth in S&P 500 trailing 12-month sales per share, as published by Multpl." },
  { id: "profit-margins", key: "margins", indicatorId: "profit_margins", title: "Profit Margins", group: "Margins", icon: Percent, unit: "%", description: "Aggregate SEC-filed net income divided by aggregate revenue." },
  { id: "return-on-assets", key: "returnOnAssets", indicatorId: "return_on_assets", title: "Return on Assets", group: "Margins", icon: Scale, unit: "%", description: "Aggregate net income over each company's latest four fiscal quarters divided by aggregate average assets. SPY weights measure data coverage only." },
]

export const valuationFactors = [
  { id: "pe-ratio", key: "peRatio", indicatorId: "valuation_pe_ratio", title: "P/E Ratio", group: "Multiples", icon: TrendingUp, unit: "x" },
  { id: "forward-pe", key: "forwardPE", indicatorId: "forward_pe_ratio", title: "Forward P/E", group: "Multiples", icon: BookOpenCheck, unit: "x" },
  { id: "price-to-book", key: "priceToBook", indicatorId: "price_to_book_ratio", title: "Price-to-Book", group: "Multiples", icon: Scale, unit: "x" },
  { id: "price-to-sales", key: "priceToSales", indicatorId: "price_to_sales_ratio", title: "Price-to-Sales", group: "Multiples", icon: CircleDollarSign, unit: "x" },
  { id: "peg-ratio", key: "pegRatio", indicatorId: "peg_ratio", title: "PEG Proxy (5Y)", group: "Multiples", icon: Database, unit: "x", description: "Trailing S&P 500 P/E divided by five-year annualized nominal EPS growth. Periods with non-positive growth are omitted." },
  { id: "dividend-yield", key: "dividendYield", indicatorId: "valuation_dividend_yield", title: "Dividend Yield", group: "Yields", icon: Percent, unit: "%" },
]

export const corporateValuationFactors = [...corporateFactors, ...valuationFactors]

export const corporateValuationDomains = [
  { id: "corporate_fundamentals", title: "تحلیل بنیادهای شرکتی و سودآوری" },
  { id: "valuation", title: "تحلیل ارزش‌گذاری" },
]

export function buildCorporateValuationResults(corporate, valuation) {
  return Object.fromEntries([
    ...corporateFactors.map((factor) => [factor.id, corporate]),
    ...valuationFactors.map((factor) => [factor.id, valuation]),
  ])
}

export const formatCorporateValuationValue = (value, factor) => `${value.toFixed(2)}${factor.unit === "USD" ? " USD" : factor.unit}`
