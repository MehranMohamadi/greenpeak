"use client"

import dynamic from "next/dynamic"
import { useMemo, useState } from "react"
import { Maximize2 } from "lucide-react"
import { useTheme } from "next-themes"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import DomainUnderstandingPanel from "./domain-understanding-panel"
import { AnalysisFactorCard, AnalysisPageHeader, AnalysisPageShell, AnalysisState } from "./analysis-page"
import { IndicatorNarrativeAnalysis } from "./monetary-indicator-analysis"

const MultiLineChart = dynamic(() => import("../charts/multi-line-chart"), { ssr: false })
const MiniChart = dynamic(() => import("./mini-chart"), { ssr: false })

export default function GroupAnalysisLayout({ page, title, description, domainId, factors, periods, results, getData, getMetadata, getError, getChartSeries, formatValue = (value) => Number.isFinite(value) ? value.toFixed(2) : "N/A", slicePeriod, selectedNote }) {
  const { resolvedTheme } = useTheme()
  const chartTextColor = resolvedTheme === "light" ? "#475569" : "#e0e0e0"
  const [selectedId, setSelectedId] = useState(factors[0]?.id)
  const [period, setPeriod] = useState(periods[0] || "5Y")
  const [fullScreen, setFullScreen] = useState(false)
  const [revision, setRevision] = useState(0)
  const selected = factors.find((factor) => factor.id === selectedId) || factors[0]
  const result = results[selected.id] ?? results[selected.key]
  const data = getData(result, selected) || []
  const metadata = getMetadata(result, selected)
  const error = getError(result, selected)
  const chartData = useMemo(() => slicePeriod(data, period), [data, period, slicePeriod])
  const detailedSeries = getChartSeries?.(result, selected) || []
  const chartSeries = detailedSeries.length ? detailedSeries.map((series) => ({ ...series, data: slicePeriod(series.data || [], period) })) : [{ label: selected.title, data: chartData }]
  const chartDataSets = chartSeries.map((series) => series.data)
  const hasChartData = chartDataSets.some((series) => series.length)
  const date = metadata?.observation_date || metadata?.latest_date || data.at(-1)?.date || "N/A"
  const latest = data.at(-1)?.value
  const unit = metadata?.unit || selected.unit || ""
  const sourceLine = <>{metadata?.source || "Source unavailable"} · {date} {unit && <>· {unit}</>}{metadata?.quality_status === "stale" && <span className="ml-2 text-amber-700 dark:text-amber-400">Data is outdated</span>}</>

  return <AnalysisPageShell>
    <AnalysisPageHeader page={page} title={title} showDescription={false} />
    <Card dir="rtl"><CardContent className="p-6"><DomainUnderstandingPanel domainId={domainId} simple onUpdated={() => setRevision((value) => value + 1)} /></CardContent></Card>
    <div dir="ltr" className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
      <Card className="min-w-0 lg:col-start-1 lg:row-start-1"><CardHeader className="space-y-3"><CardTitle className="flex items-start justify-between gap-3 text-base"><span className="min-w-0 break-words">{selected.title}</span><Button variant="outline" size="icon" aria-label="Expand chart" title="Expand chart" disabled={!hasChartData} onClick={() => setFullScreen(true)}><Maximize2 className="h-4 w-4" /></Button></CardTitle><CardDescription className="text-xs">{sourceLine}</CardDescription>{selected.description && <p className="text-xs leading-5 text-muted-foreground">{selected.description}</p>}<div className="flex flex-wrap gap-1">{periods.map((item) => <Button key={item} size="sm" variant={period === item ? "default" : "outline"} onClick={() => setPeriod(item)}>{item}</Button>)}</div></CardHeader><CardContent>{loadingState(result) || error ? <AnalysisState tone="neutral" title={error ? "Series unavailable" : "Loading observations"} description={error?.message || error} /> : !hasChartData ? <AnalysisState tone="neutral" title="No verified observations" description={metadata?.quality_reason || "No observations were returned."} /> : <><ChartLegend series={chartSeries} /><div className="h-[360px] w-full overflow-hidden"><MultiLineChart dataSets={chartDataSets} height={360} textColor={chartTextColor} /></div></>}</CardContent></Card>
      <div className="min-w-0 [overflow-wrap:anywhere] relative min-h-0 lg:col-start-2 lg:row-start-1"><IndicatorNarrativeAnalysis key={selected.indicatorId || selected.id} indicatorId={selected.indicatorId} title={selected.title} observationDate={date} revision={revision} note={selectedNote?.(selected)} /></div>
    </div>
    <section className="space-y-3"><h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title} Indicators</h2><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{factors.map((factor) => { const itemResult = results[factor.id] ?? results[factor.key]; const itemData = getData(itemResult, factor) || []; const itemMeta = getMetadata(itemResult, factor); const itemError = getError(itemResult, factor); const values = slicePeriod(itemData, period); const first = values.at(0)?.value; const last = values.at(-1)?.value; const trend = itemError || !Number.isFinite(first) || !Number.isFinite(last) ? "neutral" : last > first ? "up" : last < first ? "down" : "neutral"; const Icon = factor.icon; return <button key={factor.id} type="button" className="h-full min-w-0 text-left" aria-pressed={factor.id === selectedId} onClick={() => setSelectedId(factor.id)}><AnalysisFactorCard selected={factor.id === selectedId}><CardHeader className="p-4 pb-3"><p className="text-xs text-slate-500">{factor.group}</p><CardTitle className="flex items-center justify-between gap-3 text-base"><span className="min-w-0 break-words">{factor.title}</span><Icon className="h-4 w-4 shrink-0 text-indigo-600" /></CardTitle></CardHeader><CardContent className="p-4 pt-0"><div className="text-2xl font-semibold tabular-nums">{loadingState(itemResult) ? "Loading…" : itemError || !Number.isFinite(itemData.at(-1)?.value) ? "N/A" : formatValue(itemData.at(-1)?.value, factor)}</div><div className="pointer-events-none mt-3 h-20 rounded-lg p-2" aria-hidden="true">{loadingState(itemResult) ? <div className="h-full animate-pulse rounded bg-slate-100 dark:bg-slate-800" /> : <MiniChart data={values} trend={trend} />}</div><div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400"><Badge variant="outline">{itemError ? (itemMeta?.quality_status || "unavailable") : itemMeta?.quality_status === "stale" ? "stale" : (itemMeta?.frequency || "frequency N/A")}</Badge><span>{itemMeta?.observation_date || itemMeta?.latest_date || itemData.at(-1)?.date || "No observation date"}</span></div></CardContent></AnalysisFactorCard></button> })}</div></section>
    <Dialog open={fullScreen} onOpenChange={setFullScreen}><DialogContent className="w-[95vw] max-w-6xl"><DialogHeader><DialogTitle>{selected.title}</DialogTitle><DialogDescription>{sourceLine}</DialogDescription></DialogHeader><div className="flex flex-wrap gap-1">{periods.map((item) => <Button key={item} size="sm" variant={period === item ? "default" : "outline"} onClick={() => setPeriod(item)}>{item}</Button>)}</div>{fullScreen && <><ChartLegend series={chartSeries} /><MultiLineChart dataSets={chartDataSets} height={440} textColor={chartTextColor} /></>}</DialogContent></Dialog>
  </AnalysisPageShell>
}

function loadingState(result) { return Boolean(result?.loading) }

const CHART_COLORS = ["#26a69a", "#ef5350", "#42a5f5", "#ab47bc", "#ffa726"]
function ChartLegend({ series }) {
  if (series.length < 2) return null
  return <div className="mb-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">{series.map((item, index) => <span key={item.label} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />{item.label}</span>)}</div>
}
