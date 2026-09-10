"use client"
import { BadgeDollarSign, Building2, Percent, Scale } from "lucide-react"
import useCorporateEarningsData from "@/hooks/useCorporateEarningsData"
import GroupAnalysisLayout from "./group-analysis-layout"

const factors = [
  { id: "sp500-eps", key: "sp500eps", indicatorId: "sp500_eps", title: "S&P 500 EPS", group: "Earnings", icon: BadgeDollarSign, unit: "USD", description: "Aggregate index earnings per share." },
  { id: "revenue-growth", key: "revenue", indicatorId: "revenue_growth", title: "Revenue Growth", group: "Revenue", icon: Building2, unit: "%", description: "Stored aggregate revenue-growth observations." },
  { id: "profit-margins", key: "margins", indicatorId: "profit_margins", title: "Profit Margins", group: "Margins", icon: Percent, unit: "%", description: "Stored aggregate profit-margin observations." },
  { id: "return-on-assets", key: "returnOnAssets", indicatorId: "return_on_assets", title: "Return on Assets", group: "Margins", icon: Scale, unit: "%", description: "Stored aggregate net-income-to-assets observations." },
]
const periods = ["1Y", "5Y", "10Y", "MAX"]
const slicePeriod = (data, period) => { if (period === "MAX" || !data.length) return data; const end = new Date(`${data.at(-1).date}T00:00:00Z`); const start = new Date(end); start.setUTCFullYear(start.getUTCFullYear() - Number.parseInt(period, 10)); return data.filter((point) => new Date(`${point.date}T00:00:00Z`) >= start) }
const getData = (result, factor) => result?.data?.[factor.key] || []
const getMetadata = (result, factor) => result?.metadata?.[factor.key]
const getError = (result, factor) => result?.errors?.[factor.key]

export default function CorporateEarnings() {
  const source = useCorporateEarningsData()
  const results = Object.fromEntries(factors.map((factor) => [factor.id, { data: source.data, metadata: source.metadata, errors: source.errors, loading: source.loading, error: source.error }]))
  return <GroupAnalysisLayout page="corporate-earnings" title="Corporate Fundamentals & Earnings" domainId="corporate_fundamentals" factors={factors} periods={periods} results={results} getData={getData} getMetadata={getMetadata} getError={getError} slicePeriod={slicePeriod} formatValue={(value, factor) => `${value.toFixed(2)}${factor.unit === "USD" ? " USD" : factor.unit === "%" ? "%" : ""}`} />
}
