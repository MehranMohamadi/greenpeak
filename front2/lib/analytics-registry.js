import {
  BarChart3,
  Building2,
  DollarSign,
  Globe,
  Layers3,
  LineChart,
  MessageSquare,
  Shield,
} from "lucide-react"

// Canonical product taxonomy. Navigation and indicator ownership must stay
// aligned with these eight groups.
export const marketAnalysisCategories = [
  {
    name: "Monetary Policy & System Liquidity",
    aliases: ["Monetary Policy", "Liquidity Flows"],
    shortName: "Monetary & Liquidity",
    page: "monetary-policy",
    icon: DollarSign,
    color: "from-blue-600 to-indigo-600",
    description: "Policy rates, selected nominal and real rates, money supply, and Federal Reserve liquidity facilities.",
    subgroups: ["Policy & expectations", "Market rates", "System liquidity"],
  },
  {
    name: "Growth, Inflation & Labor",
    aliases: ["Macroeconomic"],
    shortName: "Growth, Inflation & Labor",
    page: "macroeconomic",
    icon: BarChart3,
    color: "from-indigo-600 to-purple-600",
    description: "Economic growth and demand, price pressure, and labor-market conditions.",
    subgroups: ["Growth & demand", "Inflation", "Labor"],
  },
  {
    name: "Credit & Financial Stability",
    aliases: ["Systemic Risk"],
    shortName: "Credit & Stability",
    page: "systemic-risk",
    icon: Shield,
    color: "from-red-600 to-rose-600",
    description: "Credit spreads, the Treasury yield curve, funding stress, and financial-system stability indicators.",
    subgroups: ["Credit pricing", "Credit access", "Stress & fragility", "Yield curve"],
  },
  {
    name: "Corporate Fundamentals & Earnings",
    aliases: ["Corporate Earnings"],
    shortName: "Corporate Fundamentals",
    page: "corporate-earnings",
    icon: Building2,
    color: "from-pink-600 to-rose-600",
    description: "Earnings, revenue, margins, and balance-sheet fundamentals.",
    subgroups: ["Earnings", "Revenue", "Margins & balance sheets"],
  },
  {
    name: "Valuation",
    aliases: [],
    shortName: "Valuation",
    page: "valuation",
    icon: LineChart,
    color: "from-cyan-600 to-blue-600",
    description: "Market multiples, earnings yield, dividend yield, and valuation history.",
    subgroups: ["Multiples", "Yields", "Historical comparison"],
  },
  {
    name: "Market Structure, Sectors & Concentration",
    aliases: ["Market Internals", "Sector Performance"],
    shortName: "Structure & Sectors",
    page: "market-internals",
    icon: Layers3,
    color: "from-orange-600 to-amber-600",
    description: "Index concentration, sector leadership, and style composition.",
    subgroups: ["Concentration", "Sectors", "Styles"],
  },
  {
    name: "Positioning, Sentiment & Volatility",
    aliases: ["Positioning & Sentiment", "Derivatives"],
    shortName: "Positioning & Volatility",
    page: "sentiment",
    icon: MessageSquare,
    color: "from-fuchsia-600 to-pink-600",
    description: "Investor positioning, survey sentiment, options measures, and implied volatility.",
    subgroups: ["Positioning", "Sentiment", "Volatility"],
  },
  {
    name: "Capital Flows & Intermarket",
    aliases: ["Institutional"],
    shortName: "Flows & Intermarket",
    page: "intermarket",
    icon: Globe,
    color: "from-emerald-600 to-teal-600",
    description: "Capital flows and relationships across equities, currencies, and commodities.",
    subgroups: ["Capital flows", "Currencies", "Commodities & cross-asset"],
  },
]

export const legacyAnalyticsRoutes = {
  "liquidity-flows": "monetary-policy",
  "sector-performance": "market-internals",
  derivatives: "sentiment",
  institutional: "intermarket",
}

// Events are shared context, not a ninth analysis group.
export const sharedAnalyticsRoutes = ["events"]

export const indicatorOwnership = {
  monetary_policy: ["DFF", "DGS10", "SOFR", "REAINTRATREARAT10Y", "WALCL", "M2SL", "RRPONTSYD"],
  macroeconomic: ["GDPC1", "CPIAUCSL", "UNRATE", "PAYEMS", "RSAFS"],
  systemic_risk: ["BAMLH0A0HYM2", "BAMLC0A4CBBB", "STLFSI4", "T10Y2Y"],
  corporate_earnings: ["sp500_eps", "revenue_growth", "profit_margins"],
  valuation: ["sp500_pe", "earnings_yield", "dividend_yield"],
  market_internals: ["sector_performance", "index_concentration", "style_composition"],
  sentiment: ["VIXCLS", "spx_put_call_ratio", "aaii_bull_bear_spread", "cftc_sp500_positioning", "vix_term_structure"],
  intermarket: ["SP500", "DTWEXBGS", "GOLDAMGBD228NLBM", "DCOILWTICO", "PCOPPUSDM"],
}

// Compatibility export for older analysis components.
export const analyticsCategories = marketAnalysisCategories

export const getMarketAnalysisCategory = (page) =>
  marketAnalysisCategories.find((category) => category.page === page)

export const getCategoryByName = (name) =>
  marketAnalysisCategories.find(
    (category) => category.name === name || category.aliases.includes(name),
  )

export const getCategoryByPage = (page) =>
  marketAnalysisCategories.find((category) => category.page === page)

export const getCategoryIndex = (name) =>
  marketAnalysisCategories.findIndex(
    (category) => category.name === name || category.aliases.includes(name),
  )
