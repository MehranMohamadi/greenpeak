"use client"

import dynamic from "next/dynamic"
import { useMemo, useState } from "react"
import {
  AlertTriangle,
  BarChart3,
  Building2,
  Database,
  Grid3X3,
  Layers3,
  Scale,
  TrendingUp,
} from "lucide-react"
import { useTheme } from "next-themes"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Treemap,
  XAxis,
  YAxis,
} from "recharts"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import useMarketStructureData from "@/hooks/useMarketStructureData"
import DomainUnderstandingPanel from "./domain-understanding-panel"
import { AnalysisPageHeader, AnalysisPageShell, AnalysisState, TimeframeSelector } from "./analysis-page"

const MultiLineChart = dynamic(() => import("../charts/multi-line-chart"), { ssr: false })
const PERIODS = ["1Y", "3Y", "5Y", "10Y", "MAX"]
const HEATMAP_PERIODS = ["1W", "1M", "3M", "YTD", "1Y"]
const COLORS = ["#06B6D4", "#E05252", "#D7A33D"]

const REASON_LABELS = {
  point_in_time_constituent_weights_and_membership_history_unavailable:
    "Historical point-in-time constituent weights and membership are not available from the connected source. Current weights are never substituted for past weights.",
  verified_market_structure_sources_unavailable:
    "The verified upstream sources are temporarily unavailable and no valid local snapshot exists.",
  current_spy_holdings_unavailable: "Current official SPY holdings are unavailable.",
  current_spy_sector_weights_unavailable: "Current official SPY sector weights are unavailable.",
  sector_or_spy_adjusted_history_unavailable: "Adjusted history for SPY or one of the sector proxies is unavailable.",
  one_or_more_style_series_unavailable: "One or more adjusted-price style series are unavailable.",
}

function hasValue(value) {
  return value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value))
}

function formatPercent(value, signed = false) {
  if (!hasValue(value)) return "N/A"
  const numericValue = Number(value)
  return `${signed && numericValue > 0 ? "+" : ""}${numericValue.toFixed(2)}%`
}

function formatRetrieved(value) {
  if (!value) return "N/A"
  const parsed = new Date(value)
  return Number.isFinite(parsed.getTime()) ? parsed.toLocaleString("en-GB", { timeZone: "UTC" }) + " UTC" : value
}

function metadataUnit(value) {
  return {
    percent_weight: "% weight",
    percentage_points: "percentage points",
    percentage_points_of_index_return: "percentage points of index return",
    rebased_total_return_index: "index (start = 100)",
  }[value] || value || "N/A"
}

function statusClasses(status) {
  if (status === "available") return "border-primary/30 bg-primary/10 text-primary"
  if (status === "stale") return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
  if (status === "partial") return "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
  return "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
}

function MetadataStrip({ metadata, status, proxy = false }) {
  if (!metadata) return null
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-100 pt-3 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
      <Badge variant="outline" className={statusClasses(status)}>{status || metadata.quality_status || "unknown"}</Badge>
      {proxy && <Badge variant="outline">ETF proxy</Badge>}
      <span>Source: {metadata.source || "N/A"}</span>
      <span>Observation: {metadata.observation_date || "N/A"}</span>
      <span>Retrieved: {formatRetrieved(metadata.retrieved_at)}</span>
      <span>Unit: {metadataUnit(metadata.unit)}</span>
      <span>Frequency: {metadata.frequency || "N/A"}</span>
    </div>
  )
}

function BlockHeader({ number, title, description, icon: Icon, status, proxy = false }) {
  return (
    <CardHeader className="space-y-2 pb-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="mb-1 text-xs font-medium uppercase tracking-[0.16em] text-primary">Block {number}</p>
          <CardTitle className="text-lg text-slate-900 dark:text-white">{title}</CardTitle>
        </div>
        <span className="rounded-xl bg-primary/10 p-2.5 text-primary">
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <CardDescription className="leading-5">{description}</CardDescription>
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className={statusClasses(status)}>{status || "unavailable"}</Badge>
        {proxy && <Badge variant="outline">ETF proxy</Badge>}
      </div>
    </CardHeader>
  )
}

function UnavailablePanel({ block, children }) {
  const reason = REASON_LABELS[block?.reason] || block?.metadata?.quality_reason || block?.reason || "Verified data is unavailable."
  return (
    <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/60 p-5 dark:border-amber-900 dark:bg-amber-950/20">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div>
          <p className="font-medium text-amber-900 dark:text-amber-200">Data limitation</p>
          <p className="mt-1 text-sm leading-6 text-amber-800/80 dark:text-amber-300/80">{reason}</p>
          {children}
        </div>
      </div>
    </div>
  )
}

function CompanyConcentrationChart({ holdings, dark }) {
  return (
    <div className="h-[390px] min-w-0" aria-label="Top ten SPY constituent weights">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={holdings} layout="vertical" margin={{ top: 4, right: 36, bottom: 8, left: 12 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={dark ? "#27272a" : "#e2e8f0"} />
          <XAxis type="number" unit="%" tick={{ fill: dark ? "#a1a1aa" : "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="symbol" width={54} tick={{ fill: dark ? "#e4e4e7" : "#334155", fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ fill: dark ? "rgba(255,255,255,.04)" : "rgba(15,23,42,.04)" }}
            formatter={(value) => [formatPercent(value), "SPY weight"]}
            labelFormatter={(symbol, items) => `${symbol} · ${items?.[0]?.payload?.name || ""}`}
            contentStyle={{ borderRadius: 12, borderColor: dark ? "#3f3f46" : "#e2e8f0", background: dark ? "#18181b" : "#fff" }}
          />
          <Bar dataKey="weight_pct" radius={[0, 5, 5, 0]}>
            {holdings.map((holding, index) => <Cell key={holding.symbol} fill={COLORS[index % COLORS.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function SectorTile(props) {
  const { x, y, width, height, index, name, size } = props
  if (width < 1 || height < 1) return null
  const compact = width < 92 || height < 54
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={COLORS[index % COLORS.length]} stroke="#fff" strokeWidth={2} rx={4} />
      {width > 48 && height > 28 && (
        <>
          <text x={x + 8} y={y + 20} fill="#fff" fontSize={compact ? 10 : 12} fontWeight={700}>{name}</text>
          {!compact && <text x={x + 8} y={y + 39} fill="rgba(255,255,255,.88)" fontSize={11}>{formatPercent(size)}</text>}
        </>
      )}
    </g>
  )
}

function SectorWeightTreemap({ sectors }) {
  const data = sectors.map((item) => ({ name: item.sector, size: item.weight_pct }))
  return (
    <div className="h-[360px] min-w-0" aria-label="SPY GICS sector weight treemap">
      <ResponsiveContainer width="100%" height="100%">
        <Treemap data={data} dataKey="size" nameKey="name" stroke="#fff" content={<SectorTile />}>
          <Tooltip formatter={(value) => [formatPercent(value), "SPY weight"]} />
        </Treemap>
      </ResponsiveContainer>
    </div>
  )
}

function ChartLegend({ series }) {
  return (
    <div className="mb-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-600 dark:text-slate-300">
      {series.map((item, index) => (
        <span key={`${item.symbol}-${item.label}`} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[index % COLORS.length] }} />
          {item.label} ({item.symbol})
        </span>
      ))}
    </div>
  )
}

function ComparisonChart({ title, description, series, textColor, height = 290 }) {
  const validSeries = series.filter((item) => Array.isArray(item.data) && item.data.length > 1)
  return (
    <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
      <h3 className="font-medium text-foreground">{title}</h3>
      {description && <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>}
      {validSeries.length ? (
        <div className="mt-4">
          <ChartLegend series={validSeries} />
          <MultiLineChart dataSets={validSeries.map((item) => item.data)} height={height} textColor={textColor} seriesColors={COLORS} />
        </div>
      ) : (
        <AnalysisState tone="neutral" title="No verified observations" description="The selected comparison cannot be drawn from the current snapshot." />
      )}
    </div>
  )
}

function heatCellStyle(value, dark) {
  if (!hasValue(value)) return { backgroundColor: dark ? "#27272a" : "#f1f5f9", color: dark ? "#a1a1aa" : "#64748b" }
  const numericValue = Number(value)
  const strength = Math.min(0.82, 0.16 + Math.abs(numericValue) / 14)
  return {
    backgroundColor: numericValue >= 0 ? `rgba(6, 182, 212, ${strength})` : `rgba(225, 29, 72, ${strength})`,
    color: strength > 0.44 ? "#fff" : dark ? "#f4f4f5" : "#0f172a",
  }
}

function SectorHeatmap({ rows, selectedSector, onSelect, dark }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
      <table className="w-full min-w-[700px] border-collapse text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900/60">
          <tr>
            <th className="px-3 py-3 text-left">Sector ETF proxy</th>
            {HEATMAP_PERIODS.map((horizon) => <th key={horizon} className="px-3 py-3 text-center">{horizon}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.sector_id} className="border-t border-slate-200 dark:border-slate-800">
              <td className="p-1.5">
                <button
                  type="button"
                  aria-pressed={selectedSector === row.sector_id}
                  onClick={() => onSelect(row.sector_id)}
                  className={`w-full rounded-lg px-2 py-2 text-left transition ${selectedSector === row.sector_id ? "bg-primary/10 text-primary ring-1 ring-primary/30" : "hover:bg-muted"}`}
                >
                  <span className="font-medium">{row.sector}</span>
                  <span className="ml-2 text-xs text-slate-500">{row.symbol}</span>
                </button>
              </td>
              {HEATMAP_PERIODS.map((horizon) => (
                <td key={horizon} className="p-1.5 text-center">
                  <span className="block rounded-md px-2 py-2 font-medium tabular-nums" style={heatCellStyle(row.returns?.[horizon], dark)}>
                    {formatPercent(row.returns?.[horizon], true)}
                  </span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function MarketInternals() {
  const { resolvedTheme } = useTheme()
  const dark = resolvedTheme !== "light"
  const chartTextColor = dark ? "#e4e4e7" : "#475569"
  const [, setAnalysisRevision] = useState(0)
  const [period, setPeriod] = useState("5Y")
  const [selectedSector, setSelectedSector] = useState("technology")
  const { data, loading, error } = useMarketStructureData(period)
  const blocks = data?.blocks || {}
  const concentration = blocks.company_concentration
  const contribution = blocks.company_contribution
  const capVsEqual = blocks.cap_vs_equal_weight
  const sectorWeights = blocks.sector_weights
  const relative = blocks.sector_relative_returns
  const styles = blocks.styles
  const selectedHeatmap = relative?.heatmap?.find((item) => item.sector_id === selectedSector) || relative?.heatmap?.[0]
  const selectedSeries = selectedHeatmap ? relative?.sector_series?.[selectedHeatmap.sector_id] || [] : []
  const styleSeries = useMemo(() => {
    const bySymbol = Object.fromEntries((styles?.series || []).map((item) => [item.symbol, item]))
    return {
      growthValue: [bySymbol.IVW, bySymbol.IVE].filter(Boolean),
      size: [bySymbol.SPY, bySymbol.IJR].filter(Boolean),
      baskets: [bySymbol.CYCLICAL, bySymbol.DEFENSIVE].filter(Boolean),
    }
  }, [styles?.series])

  return (
    <AnalysisPageShell>
      <AnalysisPageHeader
        page="market-internals"
        title="Market Structure, Sectors & Concentration"
        description="Concentration, breadth, sector leadership and style participation across the S&P 500 ecosystem."
        actions={<TimeframeSelector periods={PERIODS} value={period} onChange={setPeriod} />}
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

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-slate-500">Verified chart coverage</p>
          <p className="mt-1 text-2xl font-medium tabular-nums">{data ? `${data.metadata?.available_chart_count || 0}/${data.metadata?.required_chart_count || 8}` : "—"}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-slate-500">Shared period</p>
          <p className="mt-1 text-2xl font-medium">{data?.selected_period || period}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-slate-500">Price field</p>
          <p className="mt-1 text-base font-medium">Adjusted close</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-slate-500">Missing values</p>
          <p className="mt-1 text-base font-medium">Null, never zero</p>
        </div>
      </div>

      {loading && <AnalysisState tone="neutral" title="Loading verified market-structure data" description="The six Group 6 blocks are being assembled from the local verified snapshot." />}
      {!loading && error && <AnalysisState title="Market-structure API unavailable" description={error} />}
      {!loading && !error && !data && <AnalysisState tone="neutral" title="No verified market-structure snapshot" />}

      {data && (
        <>
          <Card id="group6-company-concentration">
            <BlockHeader number="01" title="Company Concentration" description="Largest current SPY constituent weights from the official daily fund holdings file." icon={Building2} status={concentration?.status} proxy />
            <CardContent className="space-y-5">
              {concentration?.holdings?.length ? (
                <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_250px]">
                  <CompanyConcentrationChart holdings={concentration.holdings} dark={dark} />
                  <div className="flex flex-col justify-between rounded-2xl bg-primary p-6 text-primary-foreground shadow-sm">
                    <div>
                      <p className="text-sm text-primary-foreground/75">Top 10 combined SPY weight</p>
                      <p className="mt-3 text-5xl font-bold tabular-nums">{formatPercent(concentration.top_10_weight_pct)}</p>
                      <p className="mt-3 text-sm leading-6 text-primary-foreground/75">Sum of the ten reported fund weights shown in the chart; no index-level estimate is inserted.</p>
                    </div>
                    <div className="mt-6 border-t border-primary-foreground/20 pt-4 text-xs text-primary-foreground/75">As of {concentration.metadata?.observation_date || "N/A"}</div>
                  </div>
                </div>
              ) : <UnavailablePanel block={concentration} />}
              <MetadataStrip metadata={concentration?.metadata} status={concentration?.status} proxy />
            </CardContent>
          </Card>

          <Card id="group6-company-contribution">
            <BlockHeader number="02" title="Company Contribution to S&P 500 Return" description="A valid contribution calculation requires membership and weights measured at the start of the same return period." icon={Layers3} status={contribution?.status} />
            <CardContent className="space-y-5">
              <UnavailablePanel block={contribution}>
                <code className="mt-3 block rounded-lg bg-white/70 px-3 py-2 text-xs text-slate-700 dark:bg-black/20 dark:text-slate-200">{contribution?.formula || "contribution_i = previous_weight_i x total_return_i"}</code>
              </UnavailablePanel>
              <MetadataStrip metadata={contribution?.metadata} status={contribution?.status} />
            </CardContent>
          </Card>

          <Card id="group6-cap-vs-equal-weight">
            <BlockHeader number="03" title="S&P 500 vs Equal Weight" description={`SPY and RSP adjusted-close series rebased to 100 at the start of the selected ${period} window.`} icon={Scale} status={capVsEqual?.status} proxy />
            <CardContent className="space-y-5">
              {capVsEqual?.series?.length ? (
                <ComparisonChart title="Market-cap leadership versus broad participation" description="A widening gap highlights whether the cap-weighted benchmark is being driven by its largest constituents." series={capVsEqual.series} textColor={chartTextColor} height={340} />
              ) : <UnavailablePanel block={capVsEqual} />}
              <MetadataStrip metadata={capVsEqual?.metadata} status={capVsEqual?.status} proxy />
            </CardContent>
          </Card>

          <Card id="group6-sector-weights">
            <BlockHeader number="04" title="S&P 500 Sector Weights" description="Current 11-sector GICS allocation reported for SPY by State Street." icon={Grid3X3} status={sectorWeights?.status} proxy />
            <CardContent className="space-y-5">
              {sectorWeights?.sectors?.length ? <SectorWeightTreemap sectors={sectorWeights.sectors} /> : <UnavailablePanel block={sectorWeights} />}
              <MetadataStrip metadata={sectorWeights?.metadata} status={sectorWeights?.status} proxy />
            </CardContent>
          </Card>

          <Card id="group6-sector-relative-returns">
            <BlockHeader number="05" title="Sector Relative Return Heatmap" description="Adjusted total-return proxy for each Select Sector ETF minus SPY over five standard horizons." icon={BarChart3} status={relative?.status} proxy />
            <CardContent className="space-y-5">
              {relative?.heatmap?.length ? (
                <>
                  <SectorHeatmap rows={relative.heatmap} selectedSector={selectedHeatmap?.sector_id} onSelect={setSelectedSector} dark={dark} />
                  <ComparisonChart
                    title={`${selectedHeatmap?.sector || "Selected sector"} (${selectedHeatmap?.symbol || "N/A"}) relative to SPY`}
                    description={`Historical relative total-return path for the selected ${period} window; 0 marks equal cumulative performance from the shared start date.`}
                    series={[{ label: `${selectedHeatmap?.symbol || "Sector"} minus SPY`, symbol: selectedHeatmap?.symbol || "", data: selectedSeries }]}
                    textColor={chartTextColor}
                    height={320}
                  />
                </>
              ) : <UnavailablePanel block={relative} />}
              <MetadataStrip metadata={relative?.metadata} status={relative?.status} proxy />
            </CardContent>
          </Card>

          <Card id="group6-style-comparisons">
            <BlockHeader number="06" title="Style & Participation Comparisons" description={`Three compact adjusted-return views, each rebased to 100 at the selected ${period} start.`} icon={TrendingUp} status={styles?.status} proxy />
            <CardContent className="space-y-5">
              <div className="grid gap-5 xl:grid-cols-3">
                <ComparisonChart title="Growth vs Value" description="IVW versus IVE S&P 500 style proxies." series={styleSeries.growthValue} textColor={chartTextColor} height={260} />
                <ComparisonChart title="Large vs Small" description="SPY versus the IJR S&P SmallCap 600 proxy." series={styleSeries.size} textColor={chartTextColor} height={260} />
                <ComparisonChart title="Cyclical vs Defensive" description="Fixed equal-weight sector baskets calculated from adjusted ETF series." series={styleSeries.baskets} textColor={chartTextColor} height={260} />
              </div>
              <div className="grid gap-3 rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-600 dark:bg-slate-900/60 dark:text-slate-300 md:grid-cols-3">
                <div><strong className="text-slate-900 dark:text-white">Formula:</strong> {styles?.formula || "N/A"}</div>
                <div><strong className="text-slate-900 dark:text-white">Cyclical:</strong> {(styles?.basket_composition?.cyclical || []).join(", ") || "N/A"}</div>
                <div><strong className="text-slate-900 dark:text-white">Defensive:</strong> {(styles?.basket_composition?.defensive || []).join(", ") || "N/A"}</div>
              </div>
              <MetadataStrip metadata={styles?.metadata} status={styles?.status} proxy />
            </CardContent>
          </Card>
        </>
      )}

      <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
        <Database className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <span>Current weights and historical adjusted-price comparisons are kept as separate datasets. ETF series are explicitly labeled as proxies, all charts share the selected period, and missing observations remain null instead of being converted to zero.</span>
      </div>
    </AnalysisPageShell>
  )
}
