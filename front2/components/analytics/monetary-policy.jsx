"use client"

import dynamic from "next/dynamic"
import { useTheme } from "next-themes"
import { useMemo, useRef, useState } from "react"
import { Activity, Banknote, Landmark, Maximize2, Percent, Scale, WalletCards, Waves } from "lucide-react"

import { sliceChartPeriod } from "@/lib/chart-data"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import useDFFData from "@/hooks/useDFFData"
import useLiquidityData from "@/hooks/useLiquidityData"
import useRealInterestRateData from "@/hooks/useRealInterestRateData"
import useSOFRData from "@/hooks/useSOFRData"
import useTenYearData from "@/hooks/useTenYearData"
import useWALCLData from "@/hooks/useWALCLData"
import {
  processDFFData,
  processRealInterestRateData,
  processSOFRData,
  processTenYearData,
  processWALCLData,
} from "@/hooks/monetaryDataUtils"
import DomainUnderstandingPanel from "./domain-understanding-panel"
import MonetaryIndicatorAnalysis from "./monetary-indicator-analysis"
import { AnalysisFactorCard, AnalysisPageHeader, AnalysisPageShell, AnalysisState } from "./analysis-page"

const MultiLineChart = dynamic(() => import("../charts/multi-line-chart"), { ssr: false })
const MiniChart = dynamic(() => import("./mini-chart"), { ssr: false })
const PERIODS = ["1M", "6M", "1Y", "5Y", "10Y", "25Y", "MAX"]

function changeFor(data, changeUnit) {
  const first = data.at(0)?.value
  const last = data.at(-1)?.value
  if (!Number.isFinite(first) || !Number.isFinite(last)) return null
  if (changeUnit === "bp") return (last - first) * 100
  return first === 0 ? null : ((last - first) / first) * 100
}

function formatValue(value, format) {
  if (!Number.isFinite(value)) return "N/A"
  if (format === "rate") return `${value.toFixed(2)}%`
  if (format === "trillions") return `$${value.toFixed(2)}T`
  if (format === "m2") return `$${(value / 1000).toFixed(2)}T`
  if (format === "billions") return `$${value.toFixed(1)}B`
  return value.toFixed(2)
}

export default function MonetaryPolicy({ initialFactorId = "ten-year-treasury" }) {
  const { resolvedTheme } = useTheme()
  const chartTextColor = resolvedTheme === "light" ? "#475569" : "#e0e0e0"
  const [analysisRevision, setAnalysisRevision] = useState(0)
  const [selectedId, setSelectedId] = useState(initialFactorId)
  const chartSectionRef = useRef(null)
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [period, setPeriod] = useState("5Y")
  const dff = useDFFData()
  const tenYear = useTenYearData()
  const walcl = useWALCLData()
  const sofr = useSOFRData()
  const realRate = useRealInterestRateData()
  const liquidity = useLiquidityData()

  const factors = [
    { id: "fed-funds-rate", title: "Effective Federal Funds Rate", group: "Policy & expectations", icon: Landmark, format: "rate", changeUnit: "bp", data: processDFFData(dff.data || [], true, period), metadata: dff.metadata, loading: dff.loading, error: dff.error },
    { id: "sofr-rate", title: "Secured Overnight Financing Rate", group: "Policy & expectations", icon: Percent, format: "rate", changeUnit: "bp", data: processSOFRData(sofr.data || []), metadata: sofr.metadata, loading: sofr.loading, error: sofr.error },
    { id: "real-interest-rate", title: "10-Year Real Interest Rate", group: "Market rates", icon: Scale, format: "rate", changeUnit: "bp", data: processRealInterestRateData(realRate.data || []), metadata: realRate.metadata, loading: realRate.loading, error: realRate.error },
    { id: "ten-year-treasury", title: "10-Year Treasury Yield", group: "Market rates", icon: Activity, format: "rate", changeUnit: "bp", data: processTenYearData(tenYear.data || []), metadata: tenYear.metadata, loading: tenYear.loading, error: tenYear.error },
    { id: "fed-balance-sheet", title: "Federal Reserve Total Assets", group: "System liquidity", icon: WalletCards, format: "trillions", changeUnit: "percent", data: processWALCLData(walcl.data || []), metadata: walcl.metadata, loading: walcl.loading, error: walcl.error },
    { id: "money-supply-m2", title: "Money Supply (M2)", group: "System liquidity", icon: Banknote, format: "m2", changeUnit: "percent", data: liquidity.data.m2 || [], metadata: liquidity.metadata.m2, loading: liquidity.loading, error: liquidity.errors.m2 },
    { id: "reverse-repo", title: "Overnight Reverse Repo", group: "System liquidity", icon: Waves, format: "billions", changeUnit: "percent", data: liquidity.data.reverseRepo || [], metadata: liquidity.metadata.reverseRepo, loading: liquidity.loading, error: liquidity.errors.reverseRepo },
  ]

  const selected = factors.find((factor) => factor.id === selectedId) || factors[0]
  const selectedData = useMemo(() => sliceChartPeriod(selected.data, period), [selected.data, period])
  const selectedDate = selected.metadata?.observation_date || selected.metadata?.latest_date || selectedData.at(-1)?.time || "N/A"

  return (
    <AnalysisPageShell>
      <AnalysisPageHeader
        page="monetary-policy"
        title="Monetary Policy & System Liquidity"
        showDescription={false}
      />

      <Card dir="rtl">
        <CardHeader><CardTitle className="text-lg">تحلیل گروه</CardTitle></CardHeader>
        <CardContent><DomainUnderstandingPanel domainId="monetary_liquidity" simple onUpdated={() => setAnalysisRevision((value) => value + 1)} /></CardContent>
      </Card>

      <div dir="ltr" className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <Card ref={chartSectionRef} className="min-w-0 border-slate-200 bg-white lg:col-start-2 lg:row-start-1 dark:border-[#2B2B30] dark:bg-[#1F1F23]">
          <CardHeader><div className="flex flex-col gap-4"><div><CardTitle className="flex items-start justify-between gap-3 text-base"><span className="min-w-0 break-words">{selected.title}</span><Button variant="outline" size="icon" title="Expand chart" aria-label="Expand chart" onClick={() => setIsFullScreen(true)} disabled={!selectedData.length}><Maximize2 className="h-4 w-4" /></Button></CardTitle><CardDescription className="mt-2 text-xs">{selected.metadata?.source || "Source unavailable"} &middot; {selectedDate} &middot; {selected.format === "rate" ? "%" : selected.format === "trillions" ? "USD trillions" : "USD billions"}{selected.metadata?.quality_status === "stale" && <span className="ml-2 text-amber-700 dark:text-amber-400">Data is outdated</span>}</CardDescription></div><div className="flex flex-wrap gap-1">{PERIODS.map((item) => <Button key={item} size="sm" variant={period === item ? "default" : "outline"} onClick={() => setPeriod(item)}>{item}</Button>)}</div></div></CardHeader>
          <CardContent>
            {selected.loading && <AnalysisState tone="neutral" title="Loading observations" />}
            {!selected.loading && selectedData.length === 0 && <AnalysisState tone="neutral" title="Chart data unavailable" description={selected.error === "Failed to fetch" ? "Unable to reach the data API. Check that the local backend is running on port 8000, then reload this page." : selected.error?.message || selected.error || "No observations were returned for this indicator."} />}
            {!selected.loading && selectedData.length > 0 && <div className="h-[360px] w-full overflow-hidden"><MultiLineChart textColor={chartTextColor} dataSets={[selectedData]} height={360} /></div>}
          </CardContent>
        </Card>
        <div className="min-w-0 [overflow-wrap:anywhere] lg:col-start-1 lg:row-start-1">
          <MonetaryIndicatorAnalysis key={selected.id} factorId={selected.id} title={selected.title} observationDate={selectedDate} revision={analysisRevision} />
        </div>
      </div>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Monetary Policy Factors</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {factors.map((factor) => {
              const view = sliceChartPeriod(factor.data, period)
              const latest = view.at(-1)?.value
              const change = changeFor(view, factor.changeUnit)
              const quality = factor.metadata?.quality_status
              const unavailable = Boolean(factor.error) || quality === "unavailable" || quality === "invalid" || (!factor.loading && view.length === 0)
              const trend = unavailable || !Number.isFinite(change) ? "neutral" : change > 0 ? "up" : change < 0 ? "down" : "neutral"
              const Icon = factor.icon
              return (
                <button key={factor.id} type="button" className="h-full min-w-0 text-left" aria-pressed={selectedId === factor.id} onClick={() => { setSelectedId(factor.id); chartSectionRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" }) }}>
                  <AnalysisFactorCard selected={selectedId === factor.id}>
                    <CardHeader className="p-4 pb-3"><p className="text-xs text-slate-500">{factor.group}</p><CardTitle className="flex items-center justify-between gap-3 text-base"><span className="min-w-0 break-words">{factor.title}</span><Icon className="h-4 w-4 shrink-0 text-blue-600" /></CardTitle></CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="text-2xl font-semibold tabular-nums">{factor.loading ? "Loading…" : unavailable ? "N/A" : formatValue(latest, factor.format)}</div>
                      <div className="pointer-events-none mt-3 h-20 p-2 bg-transparent rounded-lg mini-chart-container" aria-hidden="true">{factor.loading ? <div className="h-full animate-pulse rounded bg-slate-100 dark:bg-slate-800" /> : <MiniChart data={view} trend={trend} />}</div>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400"><Badge variant="outline">{unavailable ? (quality || "unavailable") : quality === "stale" ? "stale" : (factor.metadata?.frequency || "frequency N/A")}</Badge><span>{factor.metadata?.observation_date || factor.metadata?.latest_date || view.at(-1)?.time || "No observation date"}</span></div>
                    </CardContent>
                  </AnalysisFactorCard>
                </button>
              )
            })}
          </div>
        </section>

      <Dialog open={isFullScreen} onOpenChange={setIsFullScreen}>
        <DialogContent className="w-[95vw] max-w-6xl">
          <DialogHeader>
            <DialogTitle>{selected.title}</DialogTitle>
            <DialogDescription>Observation {selectedDate} · {selected.metadata?.source || "Source unavailable"}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-1">{PERIODS.map((item) => <Button key={item} size="sm" variant={period === item ? "default" : "outline"} onClick={() => setPeriod(item)}>{item}</Button>)}</div>
          {isFullScreen && <MultiLineChart textColor={chartTextColor} dataSets={[selectedData]} height={440} />}
        </DialogContent>
      </Dialog>
    </AnalysisPageShell>
  )
}
