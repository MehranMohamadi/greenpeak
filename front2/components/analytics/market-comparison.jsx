"use client"

import dynamic from "next/dynamic"
import { useEffect, useMemo, useState } from "react"
import { ArrowLeftRight, Check, ChevronsUpDown, RefreshCw, X } from "lucide-react"
import { useTheme } from "next-themes"
import { endpoints } from "@/api/api"
import { useMarketComparison } from "@/hooks/use-market-comparison"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import IndicatorGuide from "@/components/analytics/indicator-guide"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AnalysisPageShell } from "@/components/analytics/analysis-page"

const MultiLineChart = dynamic(() => import("@/components/charts/multi-line-chart"), { ssr: false })
const MarketRelationshipChart = dynamic(() => import("@/components/charts/market-relationship-chart"), { ssr: false })
const PERIODS = ["1M", "3M", "6M", "1Y", "3Y", "5Y", "MAX"]
const COLORS = ["#06b6d4", "#d7a33d", "#a78bfa", "#f472b6", "#34d399", "#fb923c", "#60a5fa", "#e05252"]
const PAIR_PANEL_HEIGHT = Math.round(620 * 0.9)
const format = (value, digits = 2) => Number.isFinite(value) ? new Intl.NumberFormat("fa-IR", { maximumFractionDigits: digits }).format(value) : "—"

function SymbolPicker({ symbols, value, onSelect, label, excluded = [], disabled = false, compact = false, className = "" }) {
  const [open, setOpen] = useState(false)
  const selected = symbols.find((symbol) => symbol.id === value)
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><Button type="button" role="combobox" aria-label={label} aria-expanded={open} variant="outline" disabled={disabled} className={`min-w-0 justify-between ${compact ? "h-8 gap-2 px-2 text-xs" : "gap-3"} ${className}`}>
      <span className="truncate">{selected?.label || label}</span><ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
    </Button></PopoverTrigger>
    <PopoverContent className="w-[min(340px,calc(100vw-2rem))] p-0" align="start" dir="rtl">
      <Command><CommandInput placeholder="جست‌وجوی نام یا نماد…" aria-label={`جست‌وجو در ${label}`} /><CommandList>
        <CommandEmpty>نمادی پیدا نشد.</CommandEmpty>
        <CommandGroup>{symbols.filter((symbol) => !excluded.includes(symbol.id)).map((symbol) => <CommandItem key={symbol.id} value={`${symbol.label} ${symbol.id} ${symbol.series}`} onSelect={() => { onSelect(symbol.id); setOpen(false) }}>
          <Check className={`me-2 h-4 w-4 shrink-0 ${value === symbol.id ? "opacity-100" : "opacity-0"}`} />
          <span>{symbol.label}<span className="ms-2 text-[10px] text-muted-foreground" dir="ltr">{symbol.series}</span></span>
        </CommandItem>)}</CommandGroup>
      </CommandList></Command>
    </PopoverContent>
  </Popover>
}

function PeriodPicker({ value, onChange, label }) {
  return <div className="flex flex-wrap gap-1" role="group" aria-label={label} dir="ltr">{PERIODS.map((period) => <Button type="button" key={period} variant={period === value ? "default" : "ghost"} size="sm" aria-pressed={period === value} onClick={() => onChange(period)} className="h-7 min-w-9 px-2 text-xs">{period === "MAX" ? "All" : period}</Button>)}</div>
}

function CurrencyPicker({ value, onChange, label, aligned = false }) {
  return <label className={`${aligned ? "grid min-w-0 grid-cols-[4rem_minmax(0,1fr)]" : "flex"} items-center gap-2 text-xs text-muted-foreground`}><span className="whitespace-nowrap">مبنای پولی</span>
    <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className={`h-8 rounded-md border border-input bg-background px-2 text-foreground ${aligned ? "w-full min-w-0" : ""}`}>
      <option value="USD">دلار آمریکا</option><option value="IRR">ریال ایران</option>
    </select>
  </label>
}

function Chart({ result, height }) {
  const { resolvedTheme } = useTheme()
  const series = result.data?.series
  const visible = useMemo(() => (series || []).filter((item) => item.data?.length), [series])
  const dataSets = useMemo(() => visible.map((item) => item.data), [visible])
  const options = useMemo(() => visible.map((item) => ({ title: item.label, priceScaleId: item.kind === "rate" ? "left" : "right",
    priceFormat: item.kind === "rate" ? { type: "custom", minMove: 0.01, formatter: (value) => `${value.toFixed(2)}%` } : { type: "price", precision: 2, minMove: 0.01 },
  })), [visible])
  if (result.loading) return <div role="status" className="flex items-center justify-center rounded-lg bg-muted/20 text-sm text-muted-foreground" style={{ height }}>در حال دریافت و هم‌تراز کردن داده‌های روزانه…</div>
  if (!visible.length) return <div role="status" className="flex items-center justify-center rounded-lg border border-dashed p-6 text-center text-sm leading-7 text-muted-foreground" style={{ height }}>{result.error || result.data?.summary_fa || "داده معتبر برای این انتخاب در دسترس نیست."}</div>
  return <div>
    <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">{visible.map((item, index) => <span key={item.id} className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: COLORS[index] }} />{item.label}{item.kind === "rate" && <span className="text-muted-foreground">درصد · محور چپ</span>}</span>)}</div>
    <div dir="ltr" data-testid="comparison-chart"><MultiLineChart dataSets={dataSets} seriesColors={COLORS} seriesOptions={options} height={height} textColor={resolvedTheme === "light" ? "#475569" : "#cbd5e1"} /></div>
  </div>
}

function RelationshipChart({ result }) {
  const plot = result.data?.relationship
  if (result.loading || !plot?.points?.length) return <div role="status" className="flex h-full min-h-0 items-center justify-center rounded-lg border border-dashed p-6 text-center text-sm leading-7 text-muted-foreground">{result.loading ? "در حال دریافت نقاط مشترک دو بازار…" : result.error || result.data?.summary_fa || "داده مشترک برای رسم رابطه این دو نماد در دسترس نیست."}</div>
  return <MarketRelationshipChart plot={plot} height="100%" />
}

function Sources({ series }) {
  if (!series?.length) return null
  return <details className="border-t border-border pt-3"><summary className="cursor-pointer text-xs font-medium">منبع، پوشش و مبنای محاسبه</summary><div className="mt-3 space-y-3">{series.map((item) => <div key={item.id} className="text-xs leading-6">
    <div className="flex flex-wrap items-center gap-2"><strong>{item.label}</strong><Badge variant="outline" className={`text-[9px] ${item.status === "stale" ? "text-amber-600 dark:text-amber-400" : ""}`}>{item.status === "unavailable" ? "ناموجود" : item.status === "stale" ? "قدیمی" : "داده موجود"}</Badge></div>
    <p className="text-muted-foreground">{item.note}</p><p className="text-muted-foreground">{item.unit} · {item.currency || "شاخص یا نرخ مستقل"} · {item.return_basis === "total_return" ? "با احتساب سود نقدی" : item.return_basis === "price" ? "بدون سود نقدی" : "مبنای سود نقدی ندارد"}</p>
    {item.source_url && <a href={item.source_url} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-4">{item.source} · {item.source_series_id}</a>}
    <p dir="ltr" className="text-[10px] text-muted-foreground">History: {item.history_start || "—"} · Latest: {item.observation_date || "—"}</p>{item.reason && <p className="text-amber-600 dark:text-amber-400">{item.reason}</p>}
  </div>)}</div></details>
}

function AnalysisBox({ title, result, onRetry, pair = false }) {
  const data = result.data
  return <Card data-testid={pair ? "pair-analysis" : "overview-analysis"} className={`border-primary/15 ${pair ? "flex min-h-0 flex-col lg:h-[var(--pair-panel-height)]" : "h-full"}`} style={pair ? { "--pair-panel-height": `${PAIR_PANEL_HEIGHT}px` } : undefined}>
    <CardHeader className="shrink-0 pb-3"><div className="flex items-center justify-between gap-2"><CardTitle className="text-base">{title}</CardTitle><Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRetry} disabled={result.loading} aria-label={`تازه‌سازی ${title}`}><RefreshCw className={`h-3.5 w-3.5 ${result.loading ? "animate-spin" : ""}`} /></Button></div><CardDescription>بر اساس همین نمادها و بازه انتخاب‌شده</CardDescription></CardHeader>
    <CardContent className={`space-y-4 text-sm leading-7 ${pair ? "min-h-0 flex-1 lg:overflow-y-auto" : ""}`} aria-live="polite" aria-busy={result.loading}>
      {result.loading ? <p className="text-muted-foreground">تحلیل پس از دریافت داده‌های انتخاب فعلی آماده می‌شود…</p> : <>
        <p>{result.error || data?.summary_fa || "داده معتبر در دسترس نیست."}</p>
        {pair && data?.status === "available" && <div className="rounded-lg border border-border bg-muted/20 p-3"><div className="flex items-center justify-between gap-2"><span className="text-xs text-muted-foreground">همبستگی تغییرات</span><strong dir="ltr" className="text-xl tabular-nums">{format(data.correlation)}</strong></div><p className="mt-1 text-xs text-muted-foreground">{data.correlation_reason || `${format(data.correlation_samples, 0)} فاصله میان تاریخ‌های مشترک؛ بازده ساده دارایی و تغییر واحد پایه نرخ بهره. همبستگی روی سطح قیمت محاسبه نمی‌شود.`}</p></div>}
        {data?.warnings?.length > 0 && <ul className="space-y-2 text-xs leading-6 text-muted-foreground">{data.warnings.map((warning) => <li key={warning} className="border-s-2 border-amber-500/40 ps-3">{warning}</li>)}</ul>}
        {data?.fx_source && <p className="text-xs text-muted-foreground">تبدیل ارز: {data.fx_source}؛ فقط نرخ همان روز، بدون پرکردن روزهای خالی.</p>}
        <Sources series={data?.series} />
      </>}
    </CardContent>
  </Card>
}

export default function MarketComparison() {
  const [catalog, setCatalog] = useState(null)
  const [catalogError, setCatalogError] = useState("")
  const [catalogRevision, setCatalogRevision] = useState(0)
  const [mainSymbols, setMainSymbols] = useState(["sp500", "gold"])
  const [mainPeriod, setMainPeriod] = useState("1Y")
  const [mainCurrency, setMainCurrency] = useState("USD")
  const [mainRevision, setMainRevision] = useState(0)
  const [pair, setPair] = useState(["sp500", "gold"])
  const [pairPeriod, setPairPeriod] = useState("1Y")
  const [pairCurrency, setPairCurrency] = useState("USD")
  const [pairRevision, setPairRevision] = useState(0)
  const main = useMarketComparison({ symbols: mainSymbols, period: mainPeriod, currency: mainCurrency, view: "performance" }, mainRevision)
  const relationship = useMarketComparison({ symbols: pair, period: pairPeriod, currency: pairCurrency, view: "relationship" }, pairRevision)
  useEffect(() => {
    const controller = new AbortController()
    fetch(endpoints.marketComparison.symbols, { signal: controller.signal }).then((response) => {
      if (!response.ok) throw new Error("فهرست نمادها دریافت نشد.")
      return response.json()
    }).then((data) => { if (!controller.signal.aborted) { setCatalog(data); setCatalogError("") } }).catch((error) => { if (!controller.signal.aborted) setCatalogError(error.message) })
    return () => controller.abort()
  }, [catalogRevision])
  const symbols = catalog?.symbols || []
  return <AnalysisPageShell><section dir="rtl" className="space-y-5">
    <Tabs defaultValue="performance" dir="rtl" className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3"><span className="rounded-xl bg-primary/10 p-2.5 text-primary"><ArrowLeftRight className="h-6 w-6" /></span><h1 className="text-xl font-semibold md:text-2xl">مقایسه و روابط بازارها</h1></div>
    <TabsList aria-label="نمای مقایسه بازارها" className="grid h-auto w-full grid-cols-2 p-1 sm:w-fit">
      <TabsTrigger value="performance" className="px-3 py-2 text-xs sm:px-5 sm:text-sm">مقایسه چند بازار</TabsTrigger>
      <TabsTrigger value="relationship" className="px-3 py-2 text-xs sm:px-5 sm:text-sm">رابطه بین دو بازار</TabsTrigger>
    </TabsList>
    </header>
    {catalogError && <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 p-3 text-sm"><span>{catalogError}</span><Button variant="outline" size="sm" onClick={() => setCatalogRevision((value) => value + 1)}>تلاش دوباره</Button></div>}
    <TabsContent value="performance" className="space-y-5">
    <div className="grid items-stretch gap-4 lg:grid-cols-3">
    <Card data-testid="main-comparison" className="min-w-0 lg:order-2 lg:col-span-2"><CardHeader className="space-y-4 pb-3"><div className="flex flex-wrap items-start justify-between gap-3"><CardTitle className="flex items-center gap-2 text-base">مقایسه چند بازار<IndicatorGuide title="مقایسه چند بازار" indicators={mainSymbols.map((id) => ({ id, label: symbols.find((symbol) => symbol.id === id)?.label || id }))} /></CardTitle><div className="ms-auto max-w-full"><PeriodPicker value={mainPeriod} onChange={setMainPeriod} label="بازه نمودار اصلی" /></div></div>
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap items-center gap-2">{mainSymbols.map((id) => <Badge key={id} variant="secondary" className="h-8 gap-2 py-0 text-xs"><span>{symbols.find((symbol) => symbol.id === id)?.label || (id === "sp500" ? "S&P 500" : id === "gold" ? "طلا · آتی COMEX" : id)}</span><button type="button" aria-label={`حذف ${symbols.find((symbol) => symbol.id === id)?.label || id}`} disabled={mainSymbols.length === 1} onClick={() => setMainSymbols((current) => current.filter((key) => key !== id))} className="rounded p-0.5 hover:bg-muted disabled:opacity-30"><X className="h-3 w-3" /></button></Badge>)}<SymbolPicker compact symbols={symbols.filter((symbol) => symbol.kind === "asset")} excluded={mainSymbols} label="افزودن نماد" disabled={!catalog || mainSymbols.length >= 8} onSelect={(id) => setMainSymbols((current) => [...current, id])} /></div><CurrencyPicker value={mainCurrency} onChange={setMainCurrency} label="مبنای پولی نمودار اصلی" /></div>
    </CardHeader><CardContent><Chart result={main} height={352} /></CardContent></Card>
    <div className="min-w-0 lg:order-1"><AnalysisBox title="جمع‌بندی بازارهای انتخاب‌شده" result={main} onRetry={() => setMainRevision((value) => value + 1)} /></div>
    </div>
    </TabsContent>
    <TabsContent value="relationship" className="space-y-4">
    <section aria-labelledby="pair-comparison-title" className="grid items-stretch gap-4 lg:grid-cols-3">
    <Card className="flex min-w-0 flex-col lg:order-2 lg:col-span-2 lg:h-[var(--pair-panel-height)]" style={{ "--pair-panel-height": `${PAIR_PANEL_HEIGHT}px` }} data-testid="pair-comparison"><CardHeader className="shrink-0 space-y-3 pb-3">
      <div className="flex flex-wrap items-start justify-between gap-3"><CardTitle id="pair-comparison-title" className="flex items-center gap-2 text-base">رابطه بین دو بازار<IndicatorGuide title="نماد اول بر اساس نماد دوم" indicators={pair.map((id) => ({ id, label: symbols.find((symbol) => symbol.id === id)?.label || id }))} /></CardTitle><div className="ms-auto max-w-full"><PeriodPicker value={pairPeriod} onChange={setPairPeriod} label="بازه مقایسه دو بازار" /></div></div>
      <div className="flex flex-wrap gap-2" aria-label="مقایسه‌های آماده">{catalog?.presets?.map((preset) => <span key={preset.id} title={preset.reason || ""}><Button type="button" size="sm" variant={pair.join(",") === preset.symbols.join(",") && pairCurrency === preset.currency ? "secondary" : "outline"} className="h-7 px-2 text-[11px]" disabled={!preset.enabled} onClick={() => { setPair(preset.symbols); setPairCurrency(preset.currency) }}>{preset.label}</Button></span>)}</div>
      <div className="grid min-w-0 gap-3 md:grid-cols-3">{[0, 1].map((index) => <div key={index} className="grid min-w-0 grid-cols-[4rem_minmax(0,1fr)] items-center gap-2"><span className="whitespace-nowrap text-xs text-muted-foreground">{index === 0 ? "نماد اول" : "نماد دوم"}</span><SymbolPicker compact className="w-full" symbols={symbols} value={pair[index]} excluded={[pair[1 - index]]} label={index === 0 ? "نماد اول" : "نماد دوم"} onSelect={(id) => setPair((current) => current.map((old, position) => position === index ? id : old))} disabled={!catalog} /></div>)}<CurrencyPicker aligned value={pairCurrency} onChange={setPairCurrency} label="مبنای پولی مقایسه دو بازار" /></div>
    </CardHeader><CardContent className="h-[360px] min-h-0 lg:h-auto lg:flex-1"><RelationshipChart result={relationship} /></CardContent></Card>
    <div className="min-h-0 min-w-0 lg:order-1"><AnalysisBox title="تحلیل رابطه دو بازار" result={relationship} pair onRetry={() => setPairRevision((value) => value + 1)} /></div>
    </section>
    </TabsContent>
    </Tabs>
  </section></AnalysisPageShell>
}
