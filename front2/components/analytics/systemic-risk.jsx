"use client"
import { Activity, BadgeAlert, GitCompareArrows, ShieldAlert } from "lucide-react"
import useSystemicRiskData from "@/hooks/useSystemicRiskData"
import GroupAnalysisLayout from "./group-analysis-layout"

const factors = [
  { id: "high-yield-spread", key: "highYieldSpread", indicatorId: "high_yield_credit_spread", title: "High-Yield Option-Adjusted Spread", group: "Credit pricing", icon: ShieldAlert, unit: "bp", description: "ICE BofA U.S. High Yield Index option-adjusted spread." },
  { id: "bbb-spread", key: "bbbSpread", indicatorId: "bbb_credit_spread", title: "BBB Corporate Option-Adjusted Spread", group: "Credit pricing", icon: BadgeAlert, unit: "bp", description: "ICE BofA BBB U.S. Corporate Index option-adjusted spread." },
  { id: "financial-stress", key: "financialStress", indicatorId: "financial_stress_index", title: "St. Louis Fed Financial Stress Index", group: "Stress", icon: Activity, description: "Weekly composite financial-stress index." },
  { id: "yield-curve", key: "yieldCurve", indicatorId: "treasury_2y10y_spread", title: "10-Year Minus 2-Year Treasury Spread", group: "Yield curve", icon: GitCompareArrows, unit: "%", description: "Treasury-curve slope from the T10Y2Y series." },
]
const periods = ["1Y", "5Y", "10Y", "MAX"]
const slicePeriod = (data, period) => { if (period === "MAX" || !data.length) return data; const end = new Date(`${data.at(-1).date}T00:00:00Z`); const start = new Date(end); start.setUTCFullYear(start.getUTCFullYear() - Number.parseInt(period, 10)); return data.filter((point) => new Date(`${point.date}T00:00:00Z`) >= start) }
const getData = (result, factor) => result?.data?.[factor.key] || []
const getMetadata = (result, factor) => result?.metadata?.[factor.key]
const getError = (result, factor) => result?.errors?.[factor.key]

export default function SystemicRisk() {
  const source = useSystemicRiskData()
  const results = Object.fromEntries(factors.map((factor) => [factor.id, { data: source.data, metadata: source.metadata, errors: source.errors, loading: source.loading, error: source.error }]))
  return <GroupAnalysisLayout page="systemic-risk" title="Credit & Financial Stability" domainId="credit_financial_risk" factors={factors} periods={periods} results={results} getData={getData} getMetadata={getMetadata} getError={getError} slicePeriod={slicePeriod} formatValue={(value, factor) => factor.unit === "bp" ? `${value.toFixed(0)} bp` : factor.unit === "%" ? `${value.toFixed(2)}%` : value.toFixed(2)} />
}
