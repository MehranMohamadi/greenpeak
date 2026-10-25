"use client"
import useCorporateEarningsData from "@/hooks/useCorporateEarningsData"
import useValuationData from "@/hooks/useValuationData"
import { buildCorporateValuationResults, corporateValuationDomains, corporateValuationFactors, formatCorporateValuationValue } from "@/lib/corporate-valuation"
import GroupAnalysisLayout from "./group-analysis-layout"

const factors = corporateValuationFactors
const periods = ["1Y", "5Y", "10Y", "MAX"]
const slicePeriod = (data, period) => { if (period === "MAX" || !data.length) return data; const end = new Date(`${data.at(-1).date}T00:00:00Z`); const start = new Date(end); start.setUTCFullYear(start.getUTCFullYear() - Number.parseInt(period, 10)); return data.filter((point) => new Date(`${point.date}T00:00:00Z`) >= start) }
const getData = (result, factor) => result?.data?.[factor.key] || []
const getMetadata = (result, factor) => result?.metadata?.[factor.key]
const getError = (result, factor) => result?.errors?.[factor.key]

export default function CorporateEarnings() {
  const corporate = useCorporateEarningsData()
  const valuation = useValuationData()
  const results = buildCorporateValuationResults(corporate, valuation)
  return <GroupAnalysisLayout page="corporate-earnings" title="Corporate Fundamentals & Valuation" analysisDomains={corporateValuationDomains} factors={factors} periods={periods} results={results} getData={getData} getMetadata={getMetadata} getError={getError} slicePeriod={slicePeriod} formatValue={formatCorporateValuationValue} />
}
