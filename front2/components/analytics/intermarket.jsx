"use client"
import { Coins, DollarSign, Droplets, Globe2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import useIntermarketSymbol from "@/hooks/useIntermarketSymbol"
import GroupAnalysisLayout from "./group-analysis-layout"

const factors = [
  { id: "dxy", series: "DXY", indicatorId: "ice_us_dollar_index", title: "U.S. Dollar Index (DXY)", group: "Currencies", icon: DollarSign },
  { id: "gold", series: "GOLDAMGBD228NLBM", indicatorId: "gold_price", title: "Gold", group: "Commodities", icon: Coins },
  { id: "wti", series: "DCOILWTICO", indicatorId: "wti_crude_oil", title: "WTI Crude Oil", group: "Commodities", icon: Droplets },
  { id: "copper", series: "PCOPPUSDM", indicatorId: "copper_price", title: "Copper", group: "Commodities", icon: Globe2 },
]
const periods = ["1M", "6M", "1Y", "5Y", "10Y", "MAX"]
const slicePeriod = (data, period) => { if (period === "MAX" || !data.length) return data; const end = new Date(`${data.at(-1).date}T00:00:00Z`); const start = new Date(end); const amount = Number.parseInt(period, 10); if (period.endsWith("M")) start.setUTCMonth(start.getUTCMonth() - amount); else start.setUTCFullYear(start.getUTCFullYear() - amount); return data.filter((point) => new Date(`${point.date}T00:00:00Z`) >= start) }
const getData = (result) => result?.data || []
const getMetadata = (result) => result?.metadata
const getError = (result) => result?.error

function percentageChange(data, days = 90) {
  const valid = (data || []).filter((point) => point?.date && Number.isFinite(Number(point?.value)))
  if (valid.length < 2) return null
  const latest = valid.at(-1)
  const latestDate = new Date(`${latest.date}T00:00:00Z`)
  if (Number.isNaN(latestDate.getTime())) return null
  const target = new Date(latestDate)
  target.setUTCDate(target.getUTCDate() - days)
  const baseline = valid.filter((point) => new Date(`${point.date}T00:00:00Z`) <= target).at(-1) || valid[0]
  const start = Number(baseline.value)
  return start ? (Number(latest.value) - start) / Math.abs(start) * 100 : null
}

function directionLabel(value) {
  if (value == null) return { label: "داده ناکافی", className: "text-muted-foreground" }
  if (value > 0.5) return { label: "صعودی", className: "text-emerald-700 dark:text-emerald-300" }
  if (value < -0.5) return { label: "نزولی", className: "text-rose-700 dark:text-rose-300" }
  return { label: "تقریباً خنثی", className: "text-amber-700 dark:text-amber-300" }
}

function intermarketSummary(rows) {
  const byId = Object.fromEntries(rows.map((row) => [row.id, row]))
  const dollar = byId.dxy?.changePct
  const commodities = [byId.gold?.changePct, byId.wti?.changePct, byId.copper?.changePct].filter(Number.isFinite)
  if (dollar == null || commodities.length < 2) return "برای جمع‌بندی بین‌بازاری هنوز داده هم‌زمان کافی از دلار و کالاها دریافت نشده است."
  const commodityAverage = commodities.reduce((sum, value) => sum + value, 0) / commodities.length
  if (dollar > 0.5 && commodityAverage < -0.5) return "در سه ماه اخیر، تقویت دلار با ضعف متوسط سبد کالایی این صفحه هم‌زمان بوده است."
  if (dollar < -0.5 && commodityAverage > 0.5) return "در سه ماه اخیر، تضعیف دلار با رشد متوسط سبد کالایی این صفحه هم‌زمان بوده است."
  if ((byId.wti?.changePct || 0) > 0.5 && (byId.copper?.changePct || 0) > 0.5) return "نفت و مس هر دو در بازه سه‌ماهه صعودی‌اند؛ مؤلفه‌های کالایی چرخه‌ای فعلاً هم‌جهت دیده می‌شوند."
  if ((byId.gold?.changePct || 0) > 0.5 && (byId.copper?.changePct || 0) < -0.5) return "طلا و مس در جهت‌های متفاوت حرکت کرده‌اند؛ ترکیب فعلی بیشتر واگرایی میان دارایی دفاعی و کالای چرخه‌ای را نشان می‌دهد."
  return "حرکت دلار و کالاهای اصلی در بازه سه‌ماهه یک‌دست نیست؛ فعلاً نتیجه‌گیری رژیمی قطعی از این مجموعه مناسب نیست."
}

function IntermarketGroupAnalysis({ results }) {
  const rows = factors.map((factor) => {
    const result = results[factor.id]
    const data = result?.data || []
    const latest = data.at(-1)
    return {
      id: factor.id,
      title: factor.title,
      changePct: percentageChange(data),
      date: result?.metadata?.observation_date || latest?.date,
      loading: result?.loading,
      error: result?.error,
    }
  })
  const loading = rows.some((row) => row.loading)
  return <div className="text-right">
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <h3 className="me-auto text-lg font-semibold">تحلیل بین‌بازاری گروه هشتم</h3>
      <Badge variant="outline">قاعده‌محور · بازه ۳ماهه</Badge>
    </div>
    {loading ? <p role="status" className="text-sm text-muted-foreground">در حال دریافت داده‌های دلار و کالاها…</p> : <>
      <p className="text-sm font-medium leading-7">{intermarketSummary(rows)}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {rows.map((row) => {
          const direction = directionLabel(row.error ? null : row.changePct)
          return <div key={row.id} className="rounded-lg border border-border/80 bg-muted/20 px-3 py-2.5">
            <div className="flex items-center justify-between gap-2"><span className="truncate text-xs text-muted-foreground">{row.title}</span><span className={`shrink-0 text-[10px] font-medium ${direction.className}`}>{direction.label}</span></div>
            <p className="mt-1 font-semibold tabular-nums" dir="ltr">{row.changePct == null || row.error ? "—" : `${row.changePct > 0 ? "+" : ""}${row.changePct.toFixed(2)}%`}</p>
            <p className="mt-0.5 text-[9px] text-muted-foreground" dir="ltr">{row.date || "date unavailable"}</p>
          </div>
        })}
      </div>
      <p className="mt-3 text-[10px] leading-5 text-muted-foreground">این جمع‌بندی فقط هم‌جهتی و واگرایی قیمت‌ها را توصیف می‌کند؛ هم‌زمانی به معنی رابطه علّی یا سیگنال معامله نیست.</p>
    </>}
  </div>
}

export default function Intermarket() {
  const dollar = useIntermarketSymbol("DXY")
  const gold = useIntermarketSymbol("GOLDAMGBD228NLBM")
  const wti = useIntermarketSymbol("DCOILWTICO")
  const copper = useIntermarketSymbol("PCOPPUSDM")
  const results = { dxy: dollar, gold, wti, copper }
  return <GroupAnalysisLayout page="intermarket" title="Capital Flows & Intermarket" domainId="capital_flows_intermarket" factors={factors} periods={periods} results={results} getData={getData} getMetadata={getMetadata} getError={getError} slicePeriod={slicePeriod} formatValue={(value) => Number.isFinite(value) ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value) : "N/A"} domainAnalysis={<IntermarketGroupAnalysis results={results} />} />
}
