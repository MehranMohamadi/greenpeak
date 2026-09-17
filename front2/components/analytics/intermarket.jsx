"use client"
import { BarChart3, Coins, DollarSign, Droplets, Globe2 } from "lucide-react"
import useIntermarketSymbol from "@/hooks/useIntermarketSymbol"
import GroupAnalysisLayout from "./group-analysis-layout"

const factors = [
  { id: "sp500", series: "SP500", indicatorId: "sp500_index", title: "S&P 500", group: "Equities", icon: BarChart3 },
  { id: "broad-dollar", series: "DTWEXBGS", indicatorId: "broad_trade_weighted_dollar", title: "Broad Trade-Weighted U.S. Dollar", group: "Currencies", icon: DollarSign },
  { id: "gold", series: "GOLDAMGBD228NLBM", indicatorId: "gold_price", title: "Gold", group: "Commodities", icon: Coins },
  { id: "wti", series: "DCOILWTICO", indicatorId: "wti_crude_oil", title: "WTI Crude Oil", group: "Commodities", icon: Droplets },
  { id: "copper", series: "PCOPPUSDM", indicatorId: "copper_price", title: "Copper", group: "Commodities", icon: Globe2 },
]
const periods = ["1M", "6M", "1Y", "5Y", "10Y", "MAX"]
const slicePeriod = (data, period) => { if (period === "MAX" || !data.length) return data; const end = new Date(`${data.at(-1).date}T00:00:00Z`); const start = new Date(end); const amount = Number.parseInt(period, 10); if (period.endsWith("M")) start.setUTCMonth(start.getUTCMonth() - amount); else start.setUTCFullYear(start.getUTCFullYear() - amount); return data.filter((point) => new Date(`${point.date}T00:00:00Z`) >= start) }
const getData = (result) => result?.data || []
const getMetadata = (result) => result?.metadata
const getError = (result) => result?.error

export default function Intermarket() {
  const sp500 = useIntermarketSymbol("SP500")
  const dollar = useIntermarketSymbol("DTWEXBGS")
  const gold = useIntermarketSymbol("GOLDAMGBD228NLBM")
  const wti = useIntermarketSymbol("DCOILWTICO")
  const copper = useIntermarketSymbol("PCOPPUSDM")
  const results = { sp500, "broad-dollar": dollar, gold, wti, copper }
  return <GroupAnalysisLayout page="intermarket" title="Capital Flows & Intermarket" domainId="capital_flows_intermarket" factors={factors} periods={periods} results={results} getData={getData} getMetadata={getMetadata} getError={getError} slicePeriod={slicePeriod} formatValue={(value) => Number.isFinite(value) ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value) : "N/A"} />
}
