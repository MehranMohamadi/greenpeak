import {
  Activity, BarChart3, Briefcase, Building2, Calendar, DollarSign, Globe,
  LineChart, MessageSquare, PieChart, Shield, Target, Users,
} from "lucide-react"

export const marketAnalysisCategories = [
  { name: "Monetary Policy", shortName: "Monetary & Liquidity", page: "monetary-policy", icon: DollarSign, color: "from-blue-600 to-indigo-600", description: "Federal Reserve policy tools, interest rates, and monetary conditions" },
  { name: "Macroeconomic", shortName: "Growth, Inflation & Labor", page: "macroeconomic", icon: BarChart3, color: "from-indigo-600 to-purple-600", description: "Growth, inflation, employment, and economic activity" },
  { name: "Systemic Risk", shortName: "Credit & Financial Risk", page: "systemic-risk", icon: Shield, color: "from-red-600 to-rose-600", description: "Credit conditions, financial stress, and stability indicators" },
  { name: "Corporate Earnings", shortName: "Corporate Fundamentals", page: "corporate-earnings", icon: Building2, color: "from-pink-600 to-rose-600", description: "Earnings performance, margins, and corporate fundamentals" },
  { name: "Valuation", shortName: "Valuation", page: "valuation", icon: LineChart, color: "from-cyan-600 to-blue-600", description: "Market multiples, pricing, and valuation conditions" },
  { name: "Market Internals", shortName: "Internals & Sectors", page: "market-internals", icon: Users, color: "from-orange-600 to-amber-600", description: "Breadth, volume, momentum, and internal market structure" },
  { name: "Positioning & Sentiment", shortName: "Positioning & Sentiment", page: "sentiment", icon: MessageSquare, color: "from-fuchsia-600 to-pink-600", description: "Investor psychology, positioning, volatility, and news sentiment" },
  { name: "Capital Flows & Intermarket", shortName: "Capital Flows & Intermarket", page: "intermarket", icon: Globe, color: "from-emerald-600 to-teal-600", description: "Cross-asset relationships, currencies, bonds, and commodities" },
]

const secondaryAnalyticsCategories = [
  { name: "Liquidity Flows", page: "liquidity-flows", icon: Activity, color: "from-blue-600 to-cyan-600", description: "Market liquidity and funding flows" },
  { name: "Sector Performance", page: "sector-performance", icon: PieChart, color: "from-teal-600 to-green-600", description: "Sector rotation and relative performance" },
  { name: "Derivatives", page: "derivatives", icon: Target, color: "from-yellow-600 to-orange-600", description: "Options, volatility, and derivatives positioning" },
  { name: "Macro Calendar", page: "macro-calendar", icon: Calendar, color: "from-slate-600 to-gray-700", description: "Economic releases and market events" },
  { name: "Institutional", page: "institutional", icon: Briefcase, color: "from-emerald-600 to-green-600", description: "Institutional flows and holdings" },
]

export const analyticsCategories = [...marketAnalysisCategories, ...secondaryAnalyticsCategories]
export const getMarketAnalysisCategory = (page) => marketAnalysisCategories.find((category) => category.page === page)
export const getCategoryByName = (name) => analyticsCategories.find((category) => category.name === name)
export const getCategoryByPage = (page) => analyticsCategories.find((category) => category.page === page)
export const getCategoryIndex = (name) => analyticsCategories.findIndex((category) => category.name === name)
