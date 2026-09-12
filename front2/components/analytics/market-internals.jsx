"use client"

import dynamic from "next/dynamic"
import { useMemo, useRef, useState } from "react"
import { Database, Layers3, Maximize2, PieChart, Scale } from "lucide-react"
import { useTheme } from "next-themes"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import useSectorPerformanceData, { useSectorPerformanceHistory } from "@/hooks/useSectorPerformanceData"
import { sliceChartPeriod } from "@/lib/chart-data"
import DomainUnderstandingPanel from "./domain-understanding-panel"
import { IndicatorNarrativeAnalysis } from "./monetary-indicator-analysis"
import { AnalysisFactorCard, AnalysisPageHeader, AnalysisPageShell, AnalysisState } from "./analysis-page"

const MultiLineChart = dynamic(() => import("../charts/multi-line-chart"), { ssr: false })
const INLINE_CHART_HEIGHT = 280
const PERIODS = ["1M", "6M", "1Y", "5Y", "10Y", "MAX"]
const METRICS = [
  {
    id: "relative_performance",
    label: "Relative to S&P 500",
    unit: "%",
    description: "Cumulative performance of the sector ETF proxy relative to SPY.",
  },
  {
    id: "price_performance",
    label: "Sector ETF price",
    unit: "index value",
    description: "Adjusted price history for the selected sector ETF proxy.",
  },
]

const SECTOR_LABELS = {
  technology: "Technology",
  financials: "Financials",
  healthcare: "Health Care",
  energy: "Energy",
  utilities: "Utilities",
  consumer_discretionary: "Consumer Discretionary",
  consumer_staples: "Consumer Staples",
  industrials: "Industrials",
  materials: "Materials",
  real_estate: "Real Estate",
  communication_services: "Communication Services",
}

function formatNumber(value) {
  const numericValue = value == null || value === "" ? null : Number(value)
  return Number.isFinite(numericValue)
    ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(numericValue)
    : "N/A"
}

function formatPercent(value, signed = false) {
  if (value == null || value === "") return "N/A"
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return "N/A"
  return `${signed && numericValue > 0 ? "+" : ""}${numericValue.toFixed(2)}%`
}

function friendlyUnit(unit, fallback) {
  if (unit === "percent") return "%"
  if (unit === "index_value") return "index value"
  return unit || fallback
}

function RelativePerformanceBar({ value, extent }) {
  const numericValue = Number(value)
  const available = value != null && value !== "" && Number.isFinite(numericValue)
  const width = available && extent > 0 ? Math.min(50, (Math.abs(numericValue) / extent) * 50) : 0
  const positive = numericValue >= 0

  return (
    <div className="mt-3 flex h-20 flex-col justify-center gap-2 rounded-lg bg-slate-50 px-3 dark:bg-slate-900/60">
      <div className="relative h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800" aria-hidden="true">
        <span className="absolute inset-y-0 left-1/2 w-px bg-slate-400/80 dark:bg-slate-500" />
        {available && (
          <span
            className={`absolute inset-y-0 rounded-full ${positive ? "bg-emerald-500" : "bg-rose-500"}`}
            style={positive ? { left: "50%", width: `${width}%` } : { right: "50%", width: `${width}%` }}
          />
        )}
      </div>
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>Lagging SPY</span>
        <span>Leading SPY</span>
      </div>
    </div>
  )
}

function UnavailableBlock({ icon: Icon, title, description }) {
  return (
    <Card className="border-slate-200 bg-white shadow-sm dark:border-[#2B2B30] dark:bg-[#1F1F23]">
      <CardHeader className="pb-3">
        <p className="text-xs text-slate-500">Market structure</p>
        <CardTitle className="flex items-center justify-between gap-3 text-base">
          <span>{title}</span>
          <Icon className="h-4 w-4 shrink-0 text-blue-600" />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Badge variant="outline">Data unavailable</Badge>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}

export default function MarketInternals() {
  const { resolvedTheme } = useTheme()
  const chartTextColor = resolvedTheme === "light" ? "#475569" : "#e0e0e0"
  const chartSectionRef = useRef(null)
  const [analysisRevision, setAnalysisRevision] = useState(0)
  const [selectedSector, setSelectedSector] = useState(null)
  const [metric, setMetric] = useState("relative_performance")
  const [period, setPeriod] = useState("5Y")
  const [isFullScreen, setIsFullScreen] = useState(false)
  const { data, loading, error } = useSectorPerformanceData()
  const sectors = Array.from(
    new Set([
      ...Object.keys(data.price_performance || {}),
      ...Object.keys(data.relative_performance || {}),
    ]),
  ).sort((a, b) => (SECTOR_LABELS[a] || a).localeCompare(SECTOR_LABELS[b] || b))
  const selectedKey = selectedSector && sectors.includes(selectedSector) ? selectedSector : sectors[0]
  const priceSnapshot = selectedKey ? data.price_performance?.[selectedKey] : null
  const relativeSnapshot = selectedKey ? data.relative_performance?.[selectedKey] : null
  const history = useSectorPerformanceHistory(selectedKey)
  const activeMetric = METRICS.find((item) => item.id === metric) || METRICS[0]
  const selectedHistory = history.data[metric] || []
  const chartData = useMemo(
    () => sliceChartPeriod(selectedHistory, period),
    [selectedHistory, period],
  )
  const activeMetadata = history.metadata[metric]
  const activeError = history.errors[metric]
  const observationDate = activeMetadata?.observation_date
    || activeMetadata?.latest_date
    || chartData.at(-1)?.date
    || relativeSnapshot?.date
    || priceSnapshot?.date
    || "N/A"
  const sourceLine = (
    <>
      {activeMetadata?.source || "Sector Performance Database"}
      {" · "}{observationDate}
      {" · "}{friendlyUnit(activeMetadata?.unit, activeMetric.unit)}
      {activeMetadata?.source_series_id && <>{" · "}{activeMetadata.source_series_id}</>}
      {activeMetadata?.quality_status === "stale" && (
        <span className="ml-2 text-amber-700 dark:text-amber-400">Data is outdated</span>
      )}
    </>
  )
  const relativeExtent = Math.max(
    1,
    ...sectors.map((sector) => Math.abs(Number(data.relative_performance?.[sector]?.value) || 0)),
  )

  const metricControls = (
    <div className="flex flex-wrap gap-1">
      {METRICS.map((item) => (
        <Button
          key={item.id}
          size="sm"
          aria-pressed={metric === item.id}
          variant={metric === item.id ? "default" : "outline"}
          onClick={() => setMetric(item.id)}
        >
          {item.label}
        </Button>
      ))}
    </div>
  )
  const periodControls = (
    <div className="flex flex-wrap gap-1">
      {PERIODS.map((item) => (
        <Button
          key={item}
          size="sm"
          aria-pressed={period === item}
          variant={period === item ? "default" : "outline"}
          onClick={() => setPeriod(item)}
        >
          {item}
        </Button>
      ))}
    </div>
  )

  const selectSector = (sector) => {
    setSelectedSector(sector)
    chartSectionRef.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
      block: "start",
    })
  }

  return (
    <AnalysisPageShell>
      <AnalysisPageHeader
        page="market-internals"
        title="Market Structure, Sectors & Concentration"
        showDescription={false}
      />

      <Card dir="rtl">
        <CardContent className="p-6">
          <DomainUnderstandingPanel
            domainId="market_internals_sectors"
            simple
            onUpdated={() => setAnalysisRevision((value) => value + 1)}
          />
        </CardContent>
      </Card>

      {loading && <AnalysisState tone="neutral" title="Loading sector observations" />}
      {!loading && error && (
        <AnalysisState tone="neutral" title="Sector data unavailable" description={error} />
      )}
      {!loading && !error && !sectors.length && (
        <AnalysisState
          tone="neutral"
          title="No verified sector observations"
          description="No sector values were returned by the data service."
        />
      )}

      {selectedKey && (
        <div dir="ltr" className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
          <Card
            ref={chartSectionRef}
            className="min-w-0 border-slate-200 bg-white lg:col-start-1 lg:row-start-1 dark:border-[#2B2B30] dark:bg-[#1F1F23]"
          >
            <CardHeader className="space-y-3">
              <CardTitle className="flex items-start justify-between gap-3 text-base">
                <span className="min-w-0 break-words">
                  {SECTOR_LABELS[selectedKey] || selectedKey.replaceAll("_", " ")}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  title="Expand chart"
                  aria-label="Expand chart"
                  disabled={!chartData.length}
                  onClick={() => setIsFullScreen(true)}
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </CardTitle>
              <CardDescription className="text-xs">{sourceLine}</CardDescription>
              <p className="text-xs leading-5 text-muted-foreground">{activeMetric.description}</p>
              {metricControls}
              {periodControls}
            </CardHeader>
            <CardContent className="space-y-4">
              {history.loading && <AnalysisState tone="neutral" title="Loading sector history" />}
              {!history.loading && activeError && (
                <AnalysisState tone="neutral" title="Series unavailable" description={activeError} />
              )}
              {!history.loading && !activeError && !chartData.length && (
                <AnalysisState
                  tone="neutral"
                  title="No verified historical observations"
                  description="The database returned no time-series values for this sector and metric."
                />
              )}
              {!history.loading && !activeError && chartData.length > 0 && (
                <div className="h-[280px] w-full overflow-hidden">
                  <MultiLineChart
                    dataSets={[chartData]}
                    height={INLINE_CHART_HEIGHT}
                    textColor={chartTextColor}
                  />
                </div>
              )}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-900/60">
                  <div className="text-xs text-slate-500">Sector ETF price</div>
                  <div className="mt-1 text-lg font-semibold tabular-nums">
                    {formatNumber(priceSnapshot?.value)}
                  </div>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-900/60">
                  <div className="text-xs text-slate-500">Relative to S&amp;P 500</div>
                  <div className="mt-1 text-lg font-semibold tabular-nums">
                    {formatPercent(relativeSnapshot?.value, true)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="relative min-h-0 min-w-0 [overflow-wrap:anywhere] lg:col-start-2 lg:row-start-1">
            <IndicatorNarrativeAnalysis
              key={selectedKey}
              indicatorId={`sector_${selectedKey}`}
              title={SECTOR_LABELS[selectedKey] || selectedKey.replaceAll("_", " ")}
              observationDate={observationDate}
              revision={analysisRevision}
              note="Sector ETFs are market proxies; they are not the official GICS index series."
            />
          </div>
        </div>
      )}

      {!!sectors.length && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Sector Leadership Indicators
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sectors.map((sector) => {
              const price = data.price_performance?.[sector]
              const relative = data.relative_performance?.[sector]
              const primaryValue = relative?.value ?? price?.value
              const primaryIsRelative = relative?.value != null
              const selected = selectedKey === sector

              return (
                <button
                  key={sector}
                  type="button"
                  className="h-full min-w-0 text-left"
                  aria-pressed={selected}
                  onClick={() => selectSector(sector)}
                >
                  <AnalysisFactorCard selected={selected}>
                    <CardHeader className="p-4 pb-3">
                      <p className="text-xs text-slate-500">
                        Sector leadership{(relative?.etf_symbol || price?.etf_symbol) && ` · ${relative?.etf_symbol || price?.etf_symbol}`}
                      </p>
                      <CardTitle className="flex items-center justify-between gap-3 text-base">
                        <span className="min-w-0 break-words">
                          {SECTOR_LABELS[sector] || sector.replaceAll("_", " ")}
                        </span>
                        <PieChart className="h-4 w-4 shrink-0 text-blue-600" />
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="text-2xl font-semibold tabular-nums">
                        {primaryIsRelative ? formatPercent(primaryValue, true) : formatNumber(primaryValue)}
                      </div>
                      <RelativePerformanceBar value={relative?.value} extent={relativeExtent} />
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                        <Badge variant="outline">ETF proxy</Badge>
                        <span>{relative?.date || price?.date || "No observation date"}</span>
                        {price?.value != null && <span>Price {formatNumber(price.value)}</span>}
                      </div>
                    </CardContent>
                  </AnalysisFactorCard>
                </button>
              )
            })}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          Additional Market Structure Indicators
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <UnavailableBlock
            icon={Layers3}
            title="Index Concentration"
            description="A verified point-in-time constituent-weight source is not connected, so concentration and top-company weights are not estimated."
          />
          <UnavailableBlock
            icon={Scale}
            title="Style Composition"
            description="Equal-weight, growth/value, size, and cyclical/defensive comparison series are not yet available from the current data service."
          />
        </div>
      </section>

      <div className="flex items-start gap-2 rounded-lg border p-3 text-sm text-muted-foreground">
        <Database className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Values are shown only when returned by the sector-performance database. Missing market-structure datasets remain explicitly unavailable.
        </span>
      </div>

      <Dialog open={isFullScreen} onOpenChange={setIsFullScreen}>
        <DialogContent className="w-[95vw] max-w-6xl">
          <DialogHeader>
            <DialogTitle>{SECTOR_LABELS[selectedKey] || selectedKey?.replaceAll("_", " ")}</DialogTitle>
            <DialogDescription>{sourceLine}</DialogDescription>
          </DialogHeader>
          {metricControls}
          {periodControls}
          {isFullScreen && chartData.length > 0 && (
            <MultiLineChart dataSets={[chartData]} height={440} textColor={chartTextColor} />
          )}
        </DialogContent>
      </Dialog>
    </AnalysisPageShell>
  )
}
