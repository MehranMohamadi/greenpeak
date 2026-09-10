"use client"

import dynamic from "next/dynamic"
import { useTheme } from "next-themes"
import DomainUnderstandingPanel from "./domain-understanding-panel"
import { IndicatorNarrativeAnalysis } from "./monetary-indicator-analysis"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useMemo, useRef, useState } from "react"
import { BriefcaseBusiness, Building2, Gauge, LineChart, ShoppingCart, Users, Maximize2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import useMacroEcoData from "@/hooks/useMacroEcoData"
import { AnalysisFactorCard, AnalysisPageHeader, AnalysisPageShell, AnalysisState } from "./analysis-page"

const MultiLineChart = dynamic(() => import("../charts/multi-line-chart"), { ssr: false })

const MiniChart = dynamic(() => import("./mini-chart"), { ssr: false })

const FACTORS = [
  { id: "gdp-growth", indicatorId: "real_gdp", key: "gdp", title: "Real GDP Growth", group: "Growth & demand", icon: LineChart, format: "percent", detail: "Annualized quarter-over-quarter growth calculated from GDPC1 levels." },
  { id: "retail-sales", indicatorId: "retail_sales", key: "retailSales", title: "Retail Sales Level", group: "Growth & demand", icon: ShoppingCart, format: "millions", detail: "Seasonally adjusted retail and food-services sales level; not a growth rate." },
  { id: "consumer-confidence", indicatorId: "consumer_confidence", key: "confidence", title: "Consumer Confidence", group: "Growth & demand", icon: Gauge, format: "index", detail: "Consumer-confidence index level, with its exact series identified in metadata." },
  { id: "cpi-inflation", indicatorId: "cpi_index", key: "cpi", title: "CPI Inflation", group: "Inflation", icon: Building2, format: "percent", detail: "12-month percent change calculated from the CPIAUCSL index level." },
  { id: "unemployment-rate", indicatorId: "unemployment_rate", key: "unemployment", title: "Unemployment Rate", group: "Labor", icon: Users, format: "percent", detail: "Share of the labor force that is unemployed, seasonally adjusted." },
  { id: "nonfarm-payrolls", indicatorId: "nonfarm_payrolls", key: "payroll", title: "Total Nonfarm Payrolls", group: "Labor", icon: BriefcaseBusiness, format: "payroll", detail: "Total payroll-employment level in thousands of persons; not the monthly change." },
]

const PERIODS = ["1Y", "5Y", "10Y", "MAX"]

function formatValue(value, format) {
  if (!Number.isFinite(value)) return "N/A"
  if (format === "percent") return `${value.toFixed(2)}%`
  if (format === "millions") return `$${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value)}M`
  if (format === "payroll") return `${(value / 1000).toFixed(2)}M`
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value)
}

function slicePeriod(data, period) {
  if (period === "MAX" || data.length === 0) return data
  const end = new Date(`${data.at(-1).date}T00:00:00Z`)
  const start = new Date(end)
  start.setUTCFullYear(start.getUTCFullYear() - Number.parseInt(period, 10))
  return data.filter((point) => new Date(`${point.date}T00:00:00Z`) >= start)
}

export default function Macroeconomic() {
  const { resolvedTheme } = useTheme()
  const chartTextColor = resolvedTheme === "light" ? "#475569" : "#e0e0e0"
  const chartRef = useRef(null)
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [revision, setRevision] = useState(0)
  const [selectedId, setSelectedId] = useState(FACTORS[0].id)
  const [period, setPeriod] = useState("5Y")
  const { data, metadata, errors, loading, error } = useMacroEcoData()
  const selected = FACTORS.find((factor) => factor.id === selectedId) || FACTORS[0]
  const selectedData = data[selected.key] || []
  const chartData = useMemo(() => slicePeriod(selectedData, period), [selectedData, period])
  const selectedMetadata = metadata[selected.key]

  const observationDate = selectedMetadata?.observation_date || selectedMetadata?.latest_date || selectedData.at(-1)?.date || "N/A"
  const unit = selected.format === "percent" ? "%" : selected.format === "millions" ? "USD millions" : selected.format === "payroll" ? "Thousands of persons" : "Index"
  const sourceLine = <>{selectedMetadata?.source || "Source unavailable"} · {observationDate} · {unit}{(selectedMetadata?.source_series_id || selectedMetadata?.fred_series) && <> · {selectedMetadata.source_series_id || selectedMetadata.fred_series}</>}{selectedMetadata?.quality_status === "stale" && <span className="ml-2 text-amber-700 dark:text-amber-400">Data is outdated</span>}</>
  const periodControls = <div className="flex flex-wrap gap-1">{PERIODS.map((item) => <Button key={item} size="sm" variant={period === item ? "default" : "outline"} onClick={() => setPeriod(item)}>{item}</Button>)}</div>

  return (
    <AnalysisPageShell>
      <AnalysisPageHeader page="macroeconomic" title="Growth, Inflation & Labor" showDescription={false} />
      <Card dir="rtl">
        <CardHeader><CardTitle className="text-lg">تحلیل گروه</CardTitle></CardHeader>
        <CardContent><DomainUnderstandingPanel domainId="growth_inflation_labor" simple onUpdated={() => setRevision((value) => value + 1)} /></CardContent>
      </Card>
      {error && <AnalysisState tone="neutral" title="Macroeconomic service unavailable" description={error} />}
      <div dir="ltr" className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
        <Card ref={chartRef} className="min-w-0 border-slate-200 bg-white lg:col-start-1 lg:row-start-1 dark:border-[#2B2B30] dark:bg-[#1F1F23]">
          <CardHeader className="space-y-3">
            <CardTitle className="flex items-start justify-between gap-3 text-base"><span className="min-w-0 break-words">{selected.title}</span><Button variant="outline" size="icon" title="Expand chart" aria-label="Expand chart" disabled={!chartData.length} onClick={() => setIsFullScreen(true)}><Maximize2 className="h-4 w-4" /></Button></CardTitle>
            <CardDescription className="text-xs">{sourceLine}</CardDescription>
            <p className="text-xs leading-5 text-muted-foreground">{selected.detail}</p>
            {periodControls}
          </CardHeader>
          <CardContent>
            {loading && <AnalysisState tone="neutral" title="Loading observations" />}
            {!loading && chartData.length === 0 && <AnalysisState tone="neutral" title="No verified observations" description={errors[selected.key] || selectedMetadata?.quality_reason || "No observations were returned."} />}
            {!loading && chartData.length > 0 && <div className="h-[360px] w-full overflow-hidden"><MultiLineChart dataSets={[chartData]} height={360} textColor={chartTextColor} /></div>}
          </CardContent>
        </Card>
        <div className="min-w-0 [overflow-wrap:anywhere] relative min-h-0 lg:col-start-2 lg:row-start-1">
          <IndicatorNarrativeAnalysis key={selected.indicatorId} indicatorId={selected.indicatorId} title={selected.title} observationDate={observationDate} revision={revision}
            note={selected.key === "gdp" ? "تحلیل مربوط به تولید ناخالص داخلی واقعی است؛ نمودار، نرخ رشد فصلی سالانه‌شدهٔ آن را نشان می‌دهد." : selected.key === "cpi" ? "تحلیل مربوط به شاخص قیمت مصرف‌کننده است؛ نمودار، تغییر دوازده‌ماههٔ آن را نشان می‌دهد." : undefined} />
        </div>
      </div>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Growth, Inflation & Labor Indicators</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FACTORS.map((factor) => {
            const series = slicePeriod(data[factor.key] || [], period)
            const meta = metadata[factor.key]
            const latest = series.at(-1)?.value
            const first = series.at(0)?.value
            const unavailable = errors[factor.key] || meta?.quality_status === "unavailable" || meta?.quality_status === "invalid" || (!loading && series.length === 0)
            const trend = unavailable || !Number.isFinite(latest) || !Number.isFinite(first) ? "neutral" : latest > first ? "up" : latest < first ? "down" : "neutral"
            const Icon = factor.icon
            return <button key={factor.id} type="button" className="h-full min-w-0 text-left" aria-pressed={selectedId === factor.id} onClick={() => { setSelectedId(factor.id); chartRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" }) }}>
              <AnalysisFactorCard selected={selectedId === factor.id}>
                <CardHeader className="p-4 pb-3"><p className="text-xs text-slate-500">{factor.group}</p><CardTitle className="flex items-center justify-between gap-3 text-base"><span className="min-w-0 break-words">{factor.title}</span><Icon className="h-4 w-4 shrink-0 text-blue-600" /></CardTitle></CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-2xl font-semibold tabular-nums">{loading ? "Loading…" : unavailable ? "N/A" : formatValue(latest, factor.format)}</div>
                  <div className="pointer-events-none mt-3 h-20 rounded-lg bg-transparent p-2 mini-chart-container" aria-hidden="true">{loading ? <div className="h-full animate-pulse rounded bg-slate-100 dark:bg-slate-800" /> : <MiniChart data={series} trend={trend} />}</div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400"><Badge variant="outline">{unavailable ? (meta?.quality_status || "unavailable") : meta?.quality_status === "stale" ? "stale" : (meta?.frequency || "frequency N/A")}</Badge><span>{meta?.observation_date || meta?.latest_date || series.at(-1)?.date || "No observation date"}</span></div>
                </CardContent>
              </AnalysisFactorCard>
            </button>
          })}
        </div>
      </section>
      <Dialog open={isFullScreen} onOpenChange={setIsFullScreen}>
        <DialogContent className="w-[95vw] max-w-6xl">
          <DialogHeader><DialogTitle>{selected.title}</DialogTitle><DialogDescription>{sourceLine}</DialogDescription></DialogHeader>
          {periodControls}
          {isFullScreen && <MultiLineChart dataSets={[chartData]} height={440} textColor={chartTextColor} />}
        </DialogContent>
      </Dialog>
    </AnalysisPageShell>
  )
}
