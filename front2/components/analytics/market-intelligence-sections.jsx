"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, CalendarDays, ChevronLeft, CircleHelp, Clock3, LoaderCircle, Newspaper, ShieldAlert, TrendingDown, TrendingUp, Triangle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import SP500Dashboard from "@/components/analytics/SP500Dashboard"

const statusLabels = {
  favorable: "مساعد", mixed: "ترکیبی", challenging: "پرچالش", unknown: "نامشخص",
  low: "کم", medium: "متوسط", high: "زیاد",
  risk_on: "Risk-On", neutral: "Neutral", risk_off: "Risk-Off",
}

const normalizeLegacy = (item, index, direction) => {
  if (typeof item === "string") return { metric: `${direction}_${index + 1}`, title_fa: item }
  return {
    metric: item?.metric || `${direction}_${index + 1}`,
    title_fa: item?.title_fa || item?.title || item?.driver || "محرک بازار",
    why_it_matters_fa: item?.detail_fa || item?.detail || item?.description || "",
    evidence_refs: item?.evidence_refs || [],
  }
}

const formatTime = (value) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(date)
}

const formatTehranTime = (value) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tehran" }).format(date)
}

const formatTehranDate = (value) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeZone: "Asia/Tehran" }).format(date)
}

const formatTehranClock = (value) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tehran" }).format(date)
}

const displayValue = (value) => value === null || value === undefined || value === "" ? "—" : value

const hasValue = (value) => value !== null && value !== undefined && value !== ""

const tehranDateKey = (value) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "unknown" : new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Tehran",
  }).format(date)
}

const groupEventsByDate = (items) => Array.from(items.reduce((groups, item) => {
  const key = tehranDateKey(item.release_at)
  if (!groups.has(key)) groups.set(key, { key, label: formatTehranDate(item.release_at), items: [] })
  groups.get(key).items.push(item)
  return groups
}, new Map()).values())

const enrichCalendarEvent = (event, drivers) => {
  const comparable = (value) => String(value ?? "").trim().toLocaleLowerCase("fa")
  const title = comparable(event.title_fa)
  const analysis = drivers.find(item => comparable(item.title_fa) === title) || drivers.find(item => {
    const actualMatches = hasValue(event.actual) && comparable(item.current) === comparable(event.actual)
    const forecastMatches = hasValue(event.forecast) && comparable(item.forecast) === comparable(event.forecast)
    const previousMatches = hasValue(event.previous) && comparable(item.previous) === comparable(event.previous)
    return actualMatches && (forecastMatches || previousMatches)
  })
  return analysis ? { ...analysis, ...event, current: event.actual ?? analysis.current } : { ...event, current: event.actual }
}

const fallbackNextAnalysisLabel = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  const afterDailyRun = Number(values.hour) >= 16
  const scheduled = new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day) + (afterDailyRun ? 1 : 0), 16, 0))
  return new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(scheduled)
}

function HelpDialog({ title, item, children }) {
  const rows = [
    ["داده فعلی", item.actual ?? item.current], ["مقدار قبلی", item.previous], ["پیش‌بینی", item.forecast],
    ["تغییر", item.change_fa], ["چرا مهم است؟", item.why_it_matters_fa || item.detail_fa],
    ["اثر بر بازار", statusLabels[item.impact] || item.impact], ["اثر بر Sentiment", statusLabels[item.sentiment] || item.sentiment],
    ["ماندگاری اثر", statusLabels[item.duration] || item.duration], ["عامل تغییردهنده اثر", item.reversal_conditions_fa],
  ].filter(([, value]) => hasValue(value))
  return <Dialog><DialogTrigger asChild>{children}</DialogTrigger><DialogContent className="max-h-[85vh] overflow-y-auto" dir="rtl"><DialogHeader className="text-right"><DialogTitle className="pl-7 leading-8">{title}</DialogTitle><DialogDescription>جزئیات ثبت‌شده در آخرین تحلیل معتبر بازار</DialogDescription></DialogHeader><div className="space-y-2">{rows.length ? rows.map(([label, value]) => <div key={label} className="rounded-lg border bg-muted/30 p-3"><p className="text-xs text-primary">{label}</p><p className="mt-1 text-sm leading-7">{value}</p></div>) : <p className="text-sm text-muted-foreground">جزئیات تکمیلی هنوز در خروجی تحلیل ثبت نشده است.</p>}</div>{item.evidence_refs?.length > 0 && <p className="text-xs text-muted-foreground" dir="ltr">{item.evidence_refs.join(" · ")}</p>}</DialogContent></Dialog>
}

function Kpi({ label, value, color }) {
  const colors = { green: "border-primary/30 bg-primary/10 text-primary", amber: "border-amber-500/30 bg-amber-500/10 text-amber-500", cyan: "border-primary/30 bg-primary/10 text-primary", violet: "border-primary/30 bg-primary/10 text-primary", slate: "border-border bg-muted text-muted-foreground" }
  return <div className="flex min-h-14 items-center justify-between gap-3 rounded-xl border bg-card p-2.5"><span className="text-xs text-muted-foreground">{label}</span><span className={`rounded-full border px-3 py-0.5 text-xs font-medium ${colors[color]}`}>{value}</span></div>
}

function EventValues({ item }) {
  const values = [
    ["واقعی", item.actual ?? item.current, "text-primary"],
    ["پیش‌بینی", item.forecast, "text-foreground"],
    ["قبلی", item.previous, "text-foreground"],
  ]
  return <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-3">
    {values.map(([label, value, tone]) => <div key={label} className="min-w-0 text-center">
      <span className="block text-[10px] text-muted-foreground">{label}</span>
      <span className={`mt-1 block truncate text-xs font-semibold tabular-nums ${tone}`} dir="ltr">{displayValue(value)}</span>
    </div>)}
  </div>
}

function DisclosureTriangle({ className = "" }) {
  return <Triangle aria-hidden="true" className={`h-3 w-3 shrink-0 rotate-180 fill-current ${className}`} />
}

function ReleasedEventRow({ item }) {
  const values = [
    ["واقعی", item.actual ?? item.current, "text-primary"],
    ["پیش‌بینی", item.forecast, "text-foreground"],
    ["قبلی", item.previous, "text-foreground"],
  ]
  return <article className="border-b border-border py-3 last:border-b-0">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <a href={item.source_url} target="_blank" rel="noreferrer" className="text-sm font-medium leading-6 transition hover:text-primary">{item.title_fa}</a>
        <time dateTime={item.release_at} className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
          <Clock3 className="h-3 w-3 text-primary" />{formatTehranClock(item.release_at)}
        </time>
      </div>
      <div className="flex shrink-0 items-start justify-start gap-1.5 self-end sm:self-auto" dir="rtl">
        {values.map(([label, value, tone]) => <div key={label} className="w-[3.35rem] text-left">
          <span className="block text-[9px] text-muted-foreground" dir="rtl">{label}</span>
          <span className={`mt-0.5 block truncate text-xs font-semibold tabular-nums ${tone}`} dir="ltr">{displayValue(value)}</span>
        </div>)}
        <HelpDialog title={item.title_fa} item={item}>
          <button type="button" aria-label={`نمایش تحلیل ${item.title_fa}`} title="نمایش تحلیل" className="mt-2.5 flex h-7 w-7 items-center justify-center text-primary transition hover:text-primary/80">
            <DisclosureTriangle />
          </button>
        </HelpDialog>
      </div>
    </div>
  </article>
}

function CalendarDataCard({ item, children }) {
  return <div className="rounded-xl border bg-muted/25 p-3 transition hover:border-primary/40">
    <div className="flex items-start justify-between gap-3">
      <a href={item.source_url} target="_blank" rel="noreferrer" className="min-w-0 text-sm font-medium leading-6 hover:text-primary">{item.title_fa}</a>
      {children}
    </div>
    <time dateTime={item.release_at} className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
      <span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3 text-primary" />{formatTehranDate(item.release_at)}</span>
      <span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3 text-primary" />{formatTehranClock(item.release_at)}</span>
    </time>
    <EventValues item={item} />
  </div>
}

function InfoDialog({ title, description }) {
  return <Dialog>
    <DialogTrigger asChild>
      <button type="button" aria-label={`راهنمای ${title}`} className="shrink-0 rounded-full text-primary transition hover:text-primary/80">
        <CircleHelp className="h-4 w-4" />
      </button>
    </DialogTrigger>
    <DialogContent dir="rtl">
      <DialogHeader className="text-right">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription className="leading-7">{description}</DialogDescription>
      </DialogHeader>
    </DialogContent>
  </Dialog>
}

function Drivers({ title, items, tone }) {
  const positive = tone === "positive"
  return <Card className={positive ? "border-primary/30" : "border-destructive/30"}><CardHeader><CardTitle className={`flex items-center gap-2 ${positive ? "text-primary" : "text-destructive"}`}>{positive ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}{title}</CardTitle></CardHeader><CardContent className="space-y-2">{items.length ? items.slice(0, 5).map((item) => <HelpDialog key={item.metric} title={item.title_fa} item={item}><button type="button" className={`flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-right text-sm transition ${positive ? "border-primary/20 bg-primary/10 hover:border-primary/50" : "border-destructive/20 bg-destructive/10 hover:border-destructive/50"}`}><span>{item.title_fa}</span><DisclosureTriangle className="opacity-70" /></button></HelpDialog>) : <p className="text-sm text-muted-foreground">موردی ثبت نشده است.</p>}</CardContent></Card>
}

function CardConnector({ active = false, label }) {
  return <div className="relative z-20 -my-1 flex h-6 items-center justify-center lg:pointer-events-none lg:absolute lg:inset-y-0 lg:left-1/2 lg:my-0 lg:h-auto lg:-translate-x-1/2" role="img" aria-label={label}>
    <span
      aria-hidden="true"
      className={`flex h-6 w-9 select-none items-center justify-center rounded-full border text-[25px] font-medium leading-none ring-[3px] ring-background shadow-[0_3px_10px_hsl(var(--foreground)/0.10)] ${active ? "border-primary/60 bg-primary/10 text-primary" : "border-border bg-card text-foreground/75"}`}
      style={{ fontFamily: '"Segoe UI Symbol", "Noto Sans Symbols 2", sans-serif' }}
    >↔</span>
  </div>
}

function ExpandableAnalysisList({ items, emptyText }) {
  const values = (items || []).filter(Boolean).map((item, index) => {
    if (typeof item === "string") return { title: item, detail: "", refs: [], key: `${index}-${item}` }
    return {
      title: item.title_fa || item.fact || item.title || item.risk || item.conflict || "نکته تحلیلی",
      detail: item.detail_fa || item.detail || item.description || item.explanation || "",
      refs: item.evidence_refs || (item.evidence_ref ? [item.evidence_ref] : []),
      key: item.risk_id || `${index}-${item.title_fa || item.title || "item"}`,
    }
  })
  return values.length ? <div>{values.map(item => <details key={item.key} className="group border-b border-border last:border-b-0">
    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-3 text-sm font-medium leading-6 text-foreground transition hover:text-foreground/80 [&::-webkit-details-marker]:hidden">
      <span>{item.title}</span>
      <Triangle aria-hidden="true" className="h-3 w-3 shrink-0 rotate-90 fill-current opacity-75 transition-transform group-open:rotate-180" />
    </summary>
    <div className="pb-3 pl-5 text-xs leading-7 text-muted-foreground">
      {item.detail && <p className="whitespace-pre-line">{item.detail}</p>}
      {!!item.refs.length && <p className="mt-2 truncate text-[10px] text-muted-foreground" dir="ltr">{item.refs.join(" · ")}</p>}
    </div>
  </details>)}</div> : <p className="text-sm text-muted-foreground">{emptyText}</p>
}

export default function MarketIntelligenceSections({ market }) {
  const [news, setNews] = useState([])
  const [selectedNews, setSelectedNews] = useState(null)
  const [newsAnalyses, setNewsAnalyses] = useState({})
  const [newsAnalysisLoading, setNewsAnalysisLoading] = useState(null)
  const [newsAnalysisErrors, setNewsAnalysisErrors] = useState({})
  const [upcomingEvents, setUpcomingEvents] = useState([])
  const [releasedEvents, setReleasedEvents] = useState([])
  useEffect(() => {
    const controller = new AbortController()
    const loadData = async (path) => {
      const response = await fetch(path, { cache: "no-store", signal: controller.signal })
      return response.ok ? (await response.json()).data : null
    }
    loadData("/analytics-data/news/sources/alpha_vantage?limit=20")
      .then(feed => {
        const items = (feed?.items || []).filter(item => item.importance === "high" || item.importance === "medium").slice(0, 4)
        setNews(items)
        setSelectedNews(items[0] || null)
      }).catch(() => {})
    loadData("/analytics-data/news/calendar/upcoming?limit=6")
      .then(calendar => setUpcomingEvents(calendar?.items || []))
      .catch(() => {})
    loadData("/analytics-data/news/calendar/released?limit=6")
      .then(calendar => setReleasedEvents(calendar?.items || []))
      .catch(() => {})
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const itemId = selectedNews?.item_id
    if (!itemId || newsAnalyses[itemId]) return
    const controller = new AbortController()
    setNewsAnalysisLoading(itemId)
    setNewsAnalysisErrors(current => ({ ...current, [itemId]: "" }))
    fetch(`/analytics-data/news/items/${encodeURIComponent(itemId)}/analysis`, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const payload = await response.json()
        if (!response.ok || !payload?.data) throw new Error(payload?.detail?.message || "خبر قابل تحلیل نیست.")
        setNewsAnalyses(current => ({ ...current, [itemId]: payload.data }))
      })
      .catch(reason => {
        if (reason.name !== "AbortError") setNewsAnalysisErrors(current => ({ ...current, [itemId]: "ترجمه و تفسیر این خبر از صفحهٔ منبع در دسترس نیست." }))
      })
      .finally(() => {
        if (!controller.signal.aborted) setNewsAnalysisLoading(current => current === itemId ? null : current)
      })
    return () => controller.abort()
  }, [selectedNews, newsAnalyses])

  const structuredDrivers = market.market_drivers || []
  const positive = useMemo(() => structuredDrivers.filter(item => item.sentiment === "risk_on").concat((market.positive_drivers || []).map((item, index) => normalizeLegacy(item, index, "positive"))).slice(0, 5), [market, structuredDrivers])
  const negative = useMemo(() => structuredDrivers.filter(item => item.sentiment === "risk_off").concat((market.negative_drivers || []).map((item, index) => normalizeLegacy(item, index, "negative"))).slice(0, 5), [market, structuredDrivers])
  const summary = market.status_summary || {}
  const fallbackReleasedData = structuredDrivers
    .filter(item => item.current !== null && item.current !== undefined && (item.previous !== null && item.previous !== undefined || item.forecast !== null && item.forecast !== undefined))
    .slice(0, 5)
    .map(item => ({
      ...item,
      event_id: item.metric,
      actual: item.current,
      release_at: item.release_at || market.data_as_of || market.as_of_date,
      source_url: item.source_url || "/analytics/events",
    }))
  const publishedEvents = releasedEvents.length ? releasedEvents.map(item => enrichCalendarEvent(item, structuredDrivers)) : fallbackReleasedData
  const publishedEventGroups = groupEventsByDate(publishedEvents)
  const conflictItems = market.market_conflicts?.length ? market.market_conflicts.map(item => ({
    ...item,
    detail_fa: `${item.supportive_signal_fa} در برابر ${item.pressuring_signal_fa} — ${item.current_balance_fa} شرط چرخش: ${item.reversal_condition_fa}`,
  })) : market.cross_domain_conflicts
  const riskItems = market.risk_monitor?.length ? market.risk_monitor.map(item => ({
    ...item,
    detail_fa: `${item.why_active_fa} تشدید: ${item.escalation_conditions_fa} کاهش: ${item.easing_conditions_fa}`,
  })) : market.key_risks
  const selectedNewsAnalysis = selectedNews ? newsAnalyses[selectedNews.item_id] : null
  const selectedNewsAnalysisError = selectedNews ? newsAnalysisErrors[selectedNews.item_id] : ""
  const selectedNewsTitle = selectedNews ? selectedNews.title_fa || selectedNews.title || selectedNews.analysis_title_fa : ""
  const selectedNewsBody = selectedNewsAnalysis?.interpretation_fa || selectedNews?.analysis_fa || selectedNews?.summary || ""
  const nextAnalysisLabel = market.next_analysis_at === undefined
    ? fallbackNextAnalysisLabel()
    : market.next_analysis_at
      ? formatTehranTime(market.next_analysis_at)
      : "زمان‌بندی فعال نیست"

  return <div className="space-y-5 bg-background p-3 text-foreground md:p-4" dir="rtl">
    <section className="space-y-3">
      <div className="grid items-stretch gap-4 lg:h-64 lg:grid-cols-[1.35fr_0.65fr]">
      <Card className="flex h-64 min-h-0 flex-col overflow-hidden border-primary/30 bg-card lg:h-full">
        <CardHeader className="shrink-0 space-y-0 pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle>داستان بازار</CardTitle>
            <div className="flex min-w-0 items-center gap-2">
              <time dateTime={market.analysis_generated_at} dir="ltr" className="truncate text-left text-xs tabular-nums text-muted-foreground">
                {formatTime(market.analysis_generated_at)}
              </time>
              <Dialog>
                <DialogTrigger asChild>
                  <button type="button" aria-label="راهنمای داستان بازار" className="shrink-0 rounded-full text-primary hover:text-primary/80">
                    <CircleHelp className="h-4 w-4" />
                  </button>
                </DialogTrigger>
                <DialogContent dir="rtl">
                  <DialogHeader className="text-right">
                    <DialogTitle>راهنمای داستان بازار</DialogTitle>
                    <DialogDescription className="space-y-3 leading-7 text-muted-foreground">
                      <span className="block">این باکس خلاصهٔ چهارخطی و تحلیل جامع آخرین خروجی ذخیره‌شدهٔ هوش مصنوعی بازار را نمایش می‌دهد.</span>
                      <span className="block text-primary">تحلیل بعدی: {nextAnalysisLabel} به وقت تهران</span>
                    </DialogDescription>
                  </DialogHeader>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
          <div className="space-y-5">
            <section className="space-y-2">
              <h3 className="text-base font-medium text-primary">خلاصه</h3>
              <p className="line-clamp-4 text-sm leading-7 text-foreground md:text-base">{market.market_story_fa}</p>
            </section>
            <section className="space-y-2">
              <h3 className="text-base font-medium text-primary">تحلیل</h3>
              <p className="whitespace-pre-line text-sm leading-8 text-muted-foreground">{market.systemic_synthesis_fa || market.narrative_fa}</p>
            </section>
          </div>
        </CardContent>
      </Card>
      <SP500Dashboard compact />
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5"><Kpi label="شرایط کلی بازار" value={statusLabels[summary.market_condition] || "نامشخص"} color="violet" /><Kpi label="ریسک بازار" value={statusLabels[summary.risk_level] || "نامشخص"} color="amber" /><Kpi label="Sentiment" value={statusLabels[summary.sentiment] || "نامشخص"} color="slate" /><Kpi label="شدت تغییر" value={statusLabels[summary.change_intensity] || "نامشخص"} color="cyan" /><Kpi label="اعتماد به تحلیل" value={statusLabels[summary.confidence_level] || "نامشخص"} color={summary.confidence_level === "high" ? "green" : "violet"} /></div>
    </section>

    <section className="relative grid items-stretch gap-0 lg:grid-cols-2 lg:gap-1">
      <Card className="flex h-72 min-h-0 flex-col overflow-hidden">
        <CardHeader className="shrink-0 pb-3"><div className="flex items-center justify-between"><CardTitle className="flex items-center gap-2"><Newspaper className="h-5 w-5 text-primary" />اخبار پرتأثیر</CardTitle><Link href="/analytics/events" className="text-xs text-primary">مشاهده همه</Link></div></CardHeader>
        <CardContent className="min-h-0 flex-1 space-y-2 overflow-y-auto">{news.length ? news.map(item => {
          const itemTitle = item.title_fa || item.title || item.analysis_title_fa
          const isSelected = selectedNews?.item_id === item.item_id
          return <button key={item.item_id} type="button" aria-pressed={isSelected} onClick={() => setSelectedNews(item)} className={`w-full rounded-lg border p-3 text-right transition ${isSelected ? "border-primary/70 bg-primary/15 ring-1 ring-primary/25" : "border-border bg-muted/25 hover:border-primary/30"}`}><div className="flex items-center justify-between gap-2"><Badge variant="outline">{item.importance === "high" ? "اثر بالا" : "بااهمیت"}</Badge><time className="text-[11px] text-muted-foreground">{formatTime(item.published_at)}</time></div><p className="mt-2 line-clamp-2 text-right text-sm font-medium leading-6" dir={item.title_fa ? "rtl" : "ltr"}>{itemTitle}</p></button>
        }) : <p className="text-sm text-muted-foreground">خبر رتبه‌بندی‌شده‌ای در دسترس نیست.</p>}</CardContent>
      </Card>

      <CardConnector active={Boolean(selectedNews)} label="ارتباط خبر انتخاب‌شده با تحلیل همان خبر" />

      <Card className={`flex h-72 min-h-0 flex-col overflow-hidden ${selectedNews ? "border-primary/60 ring-1 ring-primary/20" : "border-primary/30"}`}>
        <CardHeader className="shrink-0 pb-3"><div className="flex items-center gap-2"><CardTitle>تحلیل خبر منتخب</CardTitle><InfoDialog title="تحلیل خبر منتخب" description="صفحهٔ منبع خبر در سمت سرور خوانده می‌شود؛ سپس LLM تیتر انگلیسی را به فارسی ترجمه و متن خبر را برای بازار S&P 500 تفسیر می‌کند. اگر متن کامل منبع قابل دریافت نباشد، خلاصهٔ ثبت‌شدهٔ همان منبع مبنا قرار می‌گیرد." /></div></CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-y-auto" aria-live="polite">{selectedNews ? <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-medium text-primary">
            {newsAnalysisLoading === selectedNews.item_id && !selectedNewsAnalysis && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
            <span>در حال تحلیل این خبر</span>
          </div>
          <a href={selectedNewsAnalysis?.source_url || selectedNews.url || "#"} target="_blank" rel="noreferrer" className="block font-medium leading-7 text-primary transition hover:text-primary/80 hover:underline" dir={selectedNews.title_fa ? "rtl" : "ltr"}>{selectedNewsTitle}</a>
          {selectedNewsBody ? <p className="text-sm leading-8 text-muted-foreground">{selectedNewsBody}</p> : <p className="text-sm text-muted-foreground">تحلیل این خبر در حال آماده‌سازی است.</p>}
          {selectedNewsAnalysisError && <p className="text-xs leading-6 text-amber-400">{selectedNewsAnalysisError}</p>}
          <div className="flex flex-wrap gap-2"><Badge variant="outline">ارتباط: {selectedNews.relevance_fa || "نامشخص"}</Badge><Badge variant="outline">احساس منبع: {selectedNews.sentiment_fa || "نامشخص"}</Badge>{selectedNewsAnalysis && <Badge variant="outline">مبنای تحلیل: {selectedNewsAnalysis.evidence_type === "source_page" ? "متن صفحهٔ منبع" : "خلاصهٔ منبع"}</Badge>}</div>
        </div> : <p className="text-sm text-muted-foreground">یک خبر را انتخاب کنید.</p>}</CardContent>
      </Card>
    </section>

    <section className="relative grid items-stretch gap-0 lg:grid-cols-2 lg:gap-1">
      <Card className="flex h-80 min-h-0 flex-col overflow-hidden">
        <CardHeader className="shrink-0 pb-3"><div className="flex items-center gap-2"><CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-primary" />رویدادهای مهم پیش‌رو</CardTitle><InfoDialog title="رویدادهای مهم پیش‌رو" description="رویدادهای آینده با اهمیت بالا همراه با تاریخ، ساعت تهران و مقادیر پیش‌بینی و قبلی نمایش داده می‌شوند. مقدار واقعی تا زمان انتشار خالی می‌ماند." /></div></CardHeader>
        <CardContent className="min-h-0 flex-1 space-y-2 overflow-y-auto">{upcomingEvents.length ? upcomingEvents.map(item => <CalendarDataCard key={item.event_id} item={item}><Badge variant="outline" className="shrink-0">اهمیت بالا</Badge></CalendarDataCard>) : <p className="rounded-lg border bg-muted/25 p-4 text-sm text-muted-foreground">دادهٔ مهم آینده‌ای از تقویم دریافت نشد.</p>}<Link href="/analytics/events" className="mt-3 inline-flex items-center gap-1 text-sm text-primary">مشاهدهٔ تقویم زنده <ChevronLeft className="h-4 w-4" /></Link></CardContent>
      </Card>

      <CardConnector label="ارتباط رویدادهای مهم پیش‌رو با داده‌های مهم منتشرشده" />

      <Card className="flex h-80 min-h-0 flex-col overflow-hidden">
        <CardHeader className="shrink-0 pb-3"><div className="flex items-center gap-2"><CardTitle>داده‌های مهم منتشرشده</CardTitle><InfoDialog title="داده‌های مهم منتشرشده" description="رویدادهای مهم منتشرشده همراه با تاریخ، ساعت تهران و مقادیر واقعی، پیش‌بینی و قبلی نمایش داده می‌شوند." /></div></CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-y-auto">{publishedEventGroups.length ? <div className="space-y-4">{publishedEventGroups.map(group => <section key={group.key}>
          <h3 className="sticky top-0 z-10 flex items-center gap-2 border-b border-primary/20 bg-card pb-2 text-xs font-medium text-primary"><CalendarDays className="h-3.5 w-3.5" />{group.label}</h3>
          <div>{group.items.map(item => <ReleasedEventRow key={item.event_id || item.metric} item={item} />)}</div>
        </section>)}</div> : <p className="rounded-lg border border-border bg-muted/25 p-4 text-sm text-muted-foreground">دادهٔ منتشرشدهٔ مهمی از تقویم دریافت نشد.</p>}</CardContent>
      </Card>
    </section>

    <section className="relative grid items-stretch gap-0 lg:grid-cols-2 lg:gap-1">
      <Drivers title="محرک‌های حمایتی" items={positive} tone="positive" />
      <CardConnector label="ارتباط محرک‌های حمایتی با عوامل چالشی" />
      <Drivers title="عوامل چالشی" items={negative} tone="negative" />
    </section>

    <section className="grid gap-4 lg:grid-cols-2">
      <Card className="flex h-72 min-h-0 flex-col overflow-hidden border-amber-500/30">
        <CardHeader className="shrink-0 pb-3"><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-foreground" />داده‌های متضاد بازار</CardTitle></CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-y-auto"><ExpandableAnalysisList items={conflictItems} emptyText="دادهٔ متضادی ثبت نشده است." /></CardContent>
      </Card>
      <Card className="flex h-72 min-h-0 flex-col overflow-hidden border-destructive/30">
        <CardHeader className="shrink-0 pb-3"><CardTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-foreground" />ریسک مانیتور</CardTitle></CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-y-auto"><ExpandableAnalysisList items={riskItems} emptyText="ریسک فعالی ثبت نشده است." /></CardContent>
      </Card>
    </section>

  </div>
}
