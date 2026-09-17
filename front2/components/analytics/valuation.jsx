"use client"
import { BookOpenCheck, CircleDollarSign, Database, Percent, Scale, TrendingUp } from "lucide-react"
import useValuationData from "@/hooks/useValuationData"
import GroupAnalysisLayout from "./group-analysis-layout"

const factors = [
  { id: "pe-ratio", key: "peRatio", indicatorId: "valuation_pe_ratio", title: "P/E Ratio", group: "Multiples", icon: TrendingUp, unit: "x" },
  { id: "forward-pe", key: "forwardPE", indicatorId: "forward_pe_ratio", title: "Forward P/E", group: "Multiples", icon: BookOpenCheck, unit: "x" },
  { id: "price-to-book", key: "priceToBook", indicatorId: "price_to_book_ratio", title: "Price-to-Book", group: "Multiples", icon: Scale, unit: "x" },
  { id: "price-to-sales", key: "priceToSales", indicatorId: "price_to_sales_ratio", title: "Price-to-Sales", group: "Multiples", icon: CircleDollarSign, unit: "x" },
  { id: "peg-ratio", key: "pegRatio", indicatorId: "peg_ratio", title: "PEG Ratio", group: "Multiples", icon: Database, unit: "x" },
  { id: "dividend-yield", key: "dividendYield", indicatorId: "valuation_dividend_yield", title: "Dividend Yield", group: "Yields", icon: Percent, unit: "%" },
]
const periods = ["1Y", "5Y", "10Y", "MAX"]
const slicePeriod = (data, period) => { if (period === "MAX" || !data.length) return data; const end = new Date(`${data.at(-1).date}T00:00:00Z`); const start = new Date(end); start.setUTCFullYear(start.getUTCFullYear() - Number.parseInt(period, 10)); return data.filter((point) => new Date(`${point.date}T00:00:00Z`) >= start) }
const getData = (result, factor) => result?.data?.[factor.key] || []
const getMetadata = (result, factor) => result?.metadata?.[factor.key]
const getError = (result, factor) => result?.errors?.[factor.key]

export default function Valuation() {
  const source = useValuationData()
  const results = Object.fromEntries(factors.map((factor) => [factor.id, { data: source.data, metadata: source.metadata, errors: source.errors, loading: source.loading, error: source.error }]))
  return <GroupAnalysisLayout page="valuation" title="Valuation" domainId="valuation" factors={factors} periods={periods} results={results} getData={getData} getMetadata={getMetadata} getError={getError} slicePeriod={slicePeriod} formatValue={(value, factor) => `${value.toFixed(2)}${factor.unit}`} />
}
