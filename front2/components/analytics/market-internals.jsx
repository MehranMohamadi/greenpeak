"use client"
import { useState } from "react"
import { Database, Layers3, PieChart, Scale } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import useSectorPerformanceData from "@/hooks/useSectorPerformanceData"
import DomainUnderstandingPanel from "./domain-understanding-panel"
import { IndicatorNarrativeAnalysis } from "./monetary-indicator-analysis"
import { AnalysisPageHeader, AnalysisPageShell, AnalysisState } from "./analysis-page"

const labels = { technology: "Technology", financials: "Financials", healthcare: "Health Care", energy: "Energy", utilities: "Utilities", consumer_discretionary: "Consumer Discretionary", consumer_staples: "Consumer Staples", industrials: "Industrials", materials: "Materials", real_estate: "Real Estate", communication_services: "Communication Services" }

export default function MarketInternals() {
  const { data, loading, error } = useSectorPerformanceData()
  const keys = Array.from(new Set([...Object.keys(data.price_performance || {}), ...Object.keys(data.relative_performance || {})])).sort()
  const [selected, setSelected] = useState(null)
  const selectedKey = selected && keys.includes(selected) ? selected : keys[0]
  const absolute = selectedKey ? data.price_performance?.[selectedKey] : null
  const relative = selectedKey ? data.relative_performance?.[selectedKey] : null
  return <AnalysisPageShell>
    <AnalysisPageHeader page="market-internals" title="Market Structure, Sectors & Concentration" showDescription={false} />
    <Card dir="rtl"><CardContent className="p-6"><DomainUnderstandingPanel domainId="market_internals_sectors" simple /></CardContent></Card>
    {loading && <AnalysisState tone="neutral" title="Loading sector observations" />}
    {!loading && error && <AnalysisState tone="neutral" title="Sector data unavailable" description={error} />}
    {!loading && !error && !keys.length && <AnalysisState tone="neutral" title="No verified sector observations" description="No sector values were returned." />}
    {selectedKey && <div dir="ltr" className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2"><Card className="lg:col-start-1 lg:row-start-1"><CardHeader><CardTitle>{labels[selectedKey] || selectedKey.replaceAll("_", " ")}</CardTitle><CardDescription>Sector observations and relative performance</CardDescription></CardHeader><CardContent className="space-y-3"><div className="h-[260px] rounded-lg border border-dashed p-5 text-sm text-muted-foreground">No time-series chart is connected for sector leadership. The verified latest values are shown below.</div><div className="grid grid-cols-2 gap-3"><div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-900/60"><div className="text-xs text-slate-500">Price performance</div><div className="mt-1 text-lg font-semibold">{absolute?.value == null ? "N/A" : Number(absolute.value).toFixed(2)}</div></div><div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-900/60"><div className="text-xs text-slate-500">Relative to S&amp;P 500</div><div className="mt-1 text-lg font-semibold">{relative?.value == null ? "N/A" : `${Number(relative.value).toFixed(2)}%`}</div></div></div></CardContent></Card><div className="relative min-h-0 lg:col-start-2 lg:row-start-1"><IndicatorNarrativeAnalysis indicatorId={`sector_${selectedKey}`} title={labels[selectedKey] || selectedKey} observationDate={relative?.date || absolute?.date || "N/A"} /></div></div>}
    {!!keys.length && <section className="space-y-3"><h2 className="text-lg font-semibold text-slate-900 dark:text-white">Market Structure, Sectors &amp; Concentration Indicators</h2><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{keys.map((sector) => { const abs = data.price_performance?.[sector]; const rel = data.relative_performance?.[sector]; return <button key={sector} type="button" aria-pressed={selectedKey === sector} onClick={() => setSelected(sector)} className="text-left"><Card className={`h-full ${selectedKey === sector ? "ring-2 ring-amber-500" : ""}`}><CardHeader className="pb-3"><CardTitle className="flex items-center justify-between gap-3 text-base"><span>{labels[sector] || sector.replaceAll("_", " ")}</span><PieChart className="h-4 w-4 text-amber-600" /></CardTitle><CardDescription>{rel?.date || abs?.date || "Observation date unavailable"}</CardDescription></CardHeader><CardContent className="grid grid-cols-2 gap-3"><div><div className="text-xs text-slate-500">Price</div><div className="font-semibold">{abs?.value == null ? "N/A" : Number(abs.value).toFixed(2)}</div></div><div><div className="text-xs text-slate-500">Relative</div><div className="font-semibold">{rel?.value == null ? "N/A" : `${Number(rel.value).toFixed(2)}%`}</div></div></CardContent></Card></button>})}</div></section>}
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2"><Card className="border-dashed"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Layers3 className="h-4 w-4" />Index concentration</CardTitle></CardHeader><CardContent><Badge variant="outline">Data unavailable</Badge></CardContent></Card><Card className="border-dashed"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Scale className="h-4 w-4" />Style composition</CardTitle></CardHeader><CardContent><Badge variant="outline">Data unavailable</Badge></CardContent></Card></div>
    <div className="flex items-start gap-2 rounded-lg border p-3 text-xs text-muted-foreground"><Database className="mt-0.5 h-4 w-4 shrink-0" />Values are shown only when returned by the sector-performance database.</div>
  </AnalysisPageShell>
}
