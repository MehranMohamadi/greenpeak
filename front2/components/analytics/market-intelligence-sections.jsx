"use client"
import MarketOutlookCard from "@/components/analytics/market-outlook-card"
import MarketPulseAnalysis from "@/components/analytics/market-pulse-analysis"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { Clock3, Info, LoaderCircle, Newspaper, RefreshCw, ShieldAlert, TrendingUp, Triangle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import SP500Dashboard from "@/components/analytics/SP500Dashboard"
import MarketStatusIndicators from "@/components/analytics/market-status-indicators"
import MarketEventTimeline from "@/components/analytics/market-event-timeline"
import { enrichCalendarEvent, MARKET_CALENDAR_DAYS } from "@/lib/market-event-timeline.mjs"
import { factorEffectHorizon, marketFactorPanels } from "@/lib/market-factors"
import { formatGregorianDate, formatGregorianTehranDateTime, GREGORIAN_PERSIAN_LOCALE, TEHRAN_TIME_ZONE } from "@/lib/date-format"

const analysisTabClass = "h-full w-full px-1.5 py-0 text-xs leading-none sm:px-3 sm:text-sm"
const analysisPanelClass = "mt-0 min-h-0 flex-1 overflow-y-auto overscroll-contain"

const statusLabels = {
  favorable: "مساعد", mixed: "ترکیبی", challenging: "پرچالش", unknown: "نامشخص",
  low: "کم", medium: "متوسط", high: "زیاد",
  risk_on: "Risk-On", neutral: "Neutral", risk_off: "Risk-Off",
  short_term: "کوتاه‌مدت", medium_term: "چندماهه", long_term: "بلندمدت",
  new: "جدید", ongoing: "همچنان مؤثر", changed: "تغییر شواهد",
  active: "فعال", watch: "تحت نظر", inactive: "غیرفعال",
}

const formatTime = (value) => {
  return formatGregorianTehranDateTime(value)
}

const formatTehranTime = (value) => {
  return formatGregorianTehranDateTime(value)
}

const formatTehranDate = (value) => {
  return formatGregorianDate(value)
}

const formatTehranClock = (value) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat(GREGORIAN_PERSIAN_LOCALE, { hour: "2-digit", minute: "2-digit", timeZone: TEHRAN_TIME_ZONE }).format(date)
}

const displayValue = (value) => value === null || value === undefined || value === "" ? "—" : value

const hasValue = (value) => value !== null && value !== undefined && value !== ""

const FINLOGIX_EARNINGS_URL = "https://apieconomic.finlogix.com/v1/earnings"
const MEGA_CAP_EARNINGS_THRESHOLD_USD = 300_000_000_000

const shiftCalendarDate = (date, days) => {
  const [year, month, day] = date.split("-").map(Number)
  const shifted = new Date(Date.UTC(year, month - 1, day + days))
  return shifted.toISOString().slice(0, 10)
}

const tehranCalendarDate = (value = new Date()) => new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: TEHRAN_TIME_ZONE,
}).format(value)

const marketCapToUsd = (value) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  if (typeof value !== "string") return null
  const normalized = value.trim().replace(/[,$\s]/g, "").toUpperCase()
  const match = normalized.match(/^(-?\d+(?:\.\d+)?)([KMBT])?$/)
  if (!match) return null
  const scales = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 }
  const amount = Number(match[1])
  return Number.isFinite(amount) ? amount * (scales[match[2]] || 1) : null
}

const formatMarketCap = (value) => new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
}).format(value)

const earningsCompanyKey = (value) => String(value || "")
  .normalize("NFKC")
  .toLocaleLowerCase("en-US")
  .replace(/\bclass\s+[a-z0-9]+\b/g, " ")
  .replace(/\b(incorporated|inc|corporation|corp|limited|ltd|plc|company|co)\b/g, " ")
  .replace(/[^\p{L}\p{N}]+/gu, "")

const hasEarningsValue = (value) => value !== null && value !== undefined && value !== ""

const earningsCalendarEvents = (rows, now = new Date()) => {
  if (!Array.isArray(rows)) return []
  const today = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "America/New_York",
  }).format(now)
  const eventsByCompanyAndDate = new Map()

  rows.forEach((row) => {
    const date = String(row?.date || "").slice(0, 10)
    const marketCapUSD = marketCapToUsd(row?.marketCapUSD)
    const company = row?.name || row?.ticker || row?.symbol
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !company || marketCapUSD === null || marketCapUSD <= MEGA_CAP_EARNINGS_THRESHOLD_USD) return

    const earnings = row.indices?.earnings || {}
    const revenues = row.indices?.revenues || {}
    const actual = earnings.actual
    const marketRelease = row.marketRelease
    const releasedToday = hasEarningsValue(actual) || hasEarningsValue(revenues.actual)
    const isReleased = date < today || (date === today && releasedToday)
    const releaseTimeLabels = {
      before_open: "پیش از بازگشایی",
      after_close: "پس از بسته‌شدن بازار",
      by_day_end: "طی روز معاملاتی",
    }
    const ticker = row.ticker || row.symbol
    const title = `${company}${ticker ? ` (${ticker})` : ""} — گزارش سود فصلی`
    const releaseAt = `${date}T12:00:00Z`
    const details = [
      `ارزش بازار: ${formatMarketCap(marketCapUSD)}`,
      hasEarningsValue(revenues.actual) ? `درآمد واقعی: ${revenues.actual}` : null,
      hasEarningsValue(revenues.forecast) ? `پیش‌بینی درآمد: ${revenues.forecast}` : null,
    ].filter(Boolean).join("؛ ")
    const event = {
      event_id: `earnings-${date}-${ticker || earningsCompanyKey(company)}`,
      title_fa: title,
      release_at: releaseAt,
      calendar_date: date,
      time_precision: "day",
      release_time_label_fa: releaseTimeLabels[marketRelease] || "زمان انتشار در تقویم مشخص نشده",
      actual,
      forecast: earnings.forecast,
      previous: earnings.previous,
      detail_fa: details,
      source: "Finlogix Earnings Calendar",
      source_url: "https://www.finlogix.com/calendar/earnings?utm_source=greenpeak&utm_medium=widget&utm_campaign=EarningCalendar",
      _is_released: isReleased,
    }
    const companyKey = earningsCompanyKey(company) || String(ticker || "").toLocaleLowerCase("en-US")
    const eventKey = `${date}-${companyKey}`
    const existing = eventsByCompanyAndDate.get(eventKey)
    if (!existing || (!hasEarningsValue(existing.actual) && hasEarningsValue(actual))) {
      eventsByCompanyAndDate.set(eventKey, event)
    }
  })

  return Array.from(eventsByCompanyAndDate.values())
}

function HelpDialog({ title, item, children, factorDetails = false }) {
  const rows = [
    ...(factorDetails ? [["بازهٔ اثرگذاری", factorEffectHorizon(item)]] : []),
    ["تاریخ", item.release_at ? formatTehranDate(item.release_at) : null],
    [item.release_time_label_fa ? "زمان انتشار" : "ساعت", item.release_at ? item.release_time_label_fa || formatTehranClock(item.release_at) : null],
    ["اهمیت", item.importance === "high" ? "بالا" : item.importance],
    ["داده واقعی", item.actual ?? item.current], ["مقدار قبلی", item.previous], ["پیش‌بینی", item.forecast],
    ["تغییر", item.change_fa], ["چرا مهم است؟", item.why_it_matters_fa || item.detail_fa],
    ["اثر بر بازار", statusLabels[item.impact] || item.impact], ["اثر بر سنتیمنت", statusLabels[item.sentiment] || item.sentiment],
    ...(!factorDetails ? [["ماندگاری اثر", statusLabels[item.duration] || item.duration]] : []), ["عامل تغییردهنده اثر", item.reversal_conditions_fa],
    ...(factorDetails ? [
      ["سازوکار اثر بر S&P 500", item.mechanism_fa],
      ["شواهد و منبع", item.evidence_summary_fa], ["هزینه‌ها، محدودیت‌ها و شواهد مخالف", item.limitations_fa],
      ["وضعیت عامل", statusLabels[item.change_status] || item.change_status], ["بازبینی شواهد", item.review_summary_fa],
      ["وضعیت ریسک", statusLabels[item.status] || item.status], ["شدت ریسک", statusLabels[item.severity] || item.severity],
      ["شرط تشدید ریسک", item.escalation_conditions_fa], ["شرط کاهش ریسک", item.easing_conditions_fa],
      ["تفاوت با جنبه‌های دیگر", item.distinct_aspect_fa],
    ] : []),
    ["منبع", item.source],
  ].filter(([, value]) => hasValue(value))
  return <Dialog><DialogTrigger asChild>{children}</DialogTrigger><DialogContent className="max-h-[85vh] overflow-y-auto" dir="rtl"><DialogHeader className="text-right"><DialogTitle className="pl-7 leading-8">{title}</DialogTitle><DialogDescription>جزئیات کامل ثبت‌شده در آخرین داده و تحلیل معتبر بازار</DialogDescription></DialogHeader><div className="space-y-2">{rows.length ? rows.map(([label, value]) => <div key={label} className="rounded-lg border bg-muted/30 p-3"><p className="text-xs text-primary">{label}</p><p className="mt-1 text-sm leading-7">{value}</p></div>) : <p className="text-sm text-muted-foreground">جزئیات تکمیلی هنوز در خروجی تحلیل ثبت نشده است.</p>}</div>{item.source_url && <a href={item.source_url} target="_blank" rel="noreferrer" className="inline-flex text-sm text-primary hover:underline">مشاهده منبع داده</a>}{!(factorDetails && item.evidence_summary_fa) && item.evidence_refs?.length > 0 && <p className="text-xs text-muted-foreground" dir="ltr">{item.evidence_refs.join(" · ")}</p>}</DialogContent></Dialog>
}

function DisclosureTriangle({ className = "" }) {
  return <Triangle aria-hidden="true" className={`h-3 w-3 shrink-0 -rotate-90 fill-current ${className}`} />
}

function MarketEventRow({ item }) {
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
          <Clock3 className="h-3 w-3 text-primary" />{item.release_time_label_fa || formatTehranClock(item.release_at)}
        </time>
      </div>
      <div className="flex shrink-0 items-start justify-start gap-1.5 self-end sm:self-auto" dir="rtl">
        {values.map(([label, value, tone]) => <div key={label} className="w-[3.35rem] text-left">
          <span className="block text-[9px] text-muted-foreground" dir="rtl">{label}</span>
          <span className={`mt-0.5 block truncate text-xs font-semibold tabular-nums ${tone}`} dir="ltr">{displayValue(value)}</span>
        </div>)}
        <HelpDialog title={item.title_fa} item={item}>
          <button type="button" aria-label={`نمایش جزئیات ${item.title_fa}`} title="نمایش جزئیات" className="mt-2.5 flex h-7 w-7 items-center justify-center text-primary transition hover:text-primary/80">
            <DisclosureTriangle />
          </button>
        </HelpDialog>
      </div>
    </div>
  </article>
}

function InfoDialog({ title, description }) {
  return <Dialog>
    <DialogTrigger asChild>
      <button type="button" aria-label={`راهنمای ${title}`} className="shrink-0 rounded-full text-primary transition hover:text-primary/80">
        <Info className="h-4 w-4" aria-hidden="true" />
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

function FactorCard({ title, subtitle, items, positive, emptyText }) {
  const values = (items || []).filter(Boolean)
  const hasChanges = values.some(item => ["new", "changed"].includes(item.change_status))
  return <Card className="flex h-80 min-h-0 min-w-0 flex-col overflow-hidden border-border">
    <CardHeader className="shrink-0 pb-2"><div className="flex flex-wrap items-center gap-2">
      {positive ? <TrendingUp className="h-4 w-4 shrink-0 text-primary" /> : <ShieldAlert className="h-4 w-4 shrink-0 text-destructive" />}
      <CardTitle>{title}</CardTitle>
      {hasChanges && <span className="rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">جدید یا تغییرکرده</span>}
      <span className="ms-auto"><InfoDialog title={title} description={subtitle} /></span>
    </div></CardHeader>
    <CardContent tabIndex={0} className="min-h-0 flex-1 overflow-y-auto overscroll-contain"><DialogAnalysisList items={values} emptyText={emptyText} /></CardContent>
  </Card>
}

function CalendarContentState({ isLoading, error, emptyText, onRetry }) {
  if (isLoading) return <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-muted/25 p-4 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin" />در حال دریافت داده‌های تقویم…</div>
  if (error) return <div className="rounded-lg border border-border bg-muted/25 p-4 text-sm text-muted-foreground">
    <p>{error}</p>
    <button type="button" onClick={onRetry} className="mt-3 inline-flex items-center gap-1.5 text-primary transition hover:text-primary/80"><RefreshCw className="h-3.5 w-3.5" />تلاش دوباره</button>
  </div>
  return <p className="rounded-lg border border-border bg-muted/25 p-4 text-sm text-muted-foreground">{emptyText}</p>
}

function DialogAnalysisList({ items, emptyText }) {
  const values = (items || []).filter(Boolean).map((item, index) => {
    if (typeof item === "string") return { title: item, dialogItem: { detail_fa: "" }, key: `${index}-${item}` }
    const title = item.title_fa || item.fact || item.title || item.risk || item.conflict || "نکته تحلیلی"
    return {
      title,
      dialogItem: {
        ...item,
        detail_fa: item.detail_fa || item.why_it_matters_fa || item.detail || item.description || item.explanation || "",
        evidence_refs: item.evidence_refs || (item.evidence_ref ? [item.evidence_ref] : []),
      },
      key: item.risk_id || `${index}-${item.title_fa || item.title || "item"}`,
    }
  })
  return values.length ? <div>{values.map(item => <HelpDialog key={item.key} title={item.title} item={item.dialogItem} factorDetails>
    <button type="button" aria-label={`نمایش جزئیات ${item.title}`} className="flex w-full items-center justify-between gap-3 border-b border-border py-3 text-right text-sm font-medium leading-6 text-foreground transition last:border-b-0 hover:text-foreground/80">
      <span className="min-w-0">{item.title}</span>
      {["new", "changed"].includes(item.dialogItem.change_status) && <span className="ms-auto shrink-0 text-xs font-normal text-primary">{statusLabels[item.dialogItem.change_status]}</span>}
      <DisclosureTriangle className="opacity-75" />
    </button>
  </HelpDialog>)}</div> : <p className="text-sm text-muted-foreground">{emptyText}</p>
}

export default function MarketIntelligenceSections({ market, status, onRefresh, loading = false }) {
  const [analysisTab, setAnalysisTab] = useState("current")
  const [news, setNews] = useState([])
  const [newsState, setNewsState] = useState({ loading: true, error: "", stale: false })
  const [newsReloadKey, setNewsReloadKey] = useState(0)
  const [selectedNews, setSelectedNews] = useState(null)
  const newsTrigger = useRef(null)
  const calendarNavigation = useRef(null)
  const [newsAnalyses, setNewsAnalyses] = useState({})
  const [newsAnalysisLoading, setNewsAnalysisLoading] = useState(null)
  const [newsAnalysisErrors, setNewsAnalysisErrors] = useState({})
  const [calendarEvents, setCalendarEvents] = useState([])
  const [earningsEvents, setEarningsEvents] = useState([])
  const [calendarReloadKey, setCalendarReloadKey] = useState(0)
  const [calendarState, setCalendarState] = useState({ loading: true, error: "", earningsError: "" })
  useEffect(() => {
    const controller = new AbortController()
    const loadNews = async () => {
      setNewsState(current => ({ ...current, loading: true, error: "" }))
      try {
        const response = await fetch("/analytics-data/news/highlights/cnbc", { cache: "no-store", signal: controller.signal })
        const payload = await response.json()
        if (!response.ok || !Array.isArray(payload?.data?.items)) throw new Error("Invalid CNBC news response")
        if (controller.signal.aborted) return
        const items = payload.data.items.filter(item => item.source === "cnbc_rss").slice(0, 4)
        setNews(items)
        setSelectedNews(current => current ? items.find(item => item.item_id === current.item_id) || current : null)
        setNewsState({ loading: false, error: "", stale: Boolean(payload.data.stale) })
      } catch {
        if (!controller.signal.aborted) setNewsState(current => ({ ...current, loading: false, error: "دریافت اخبار CNBC ناموفق بود." }))
      }
    }
    void loadNews()
    return () => controller.abort()
  }, [newsReloadKey])

  useEffect(() => {
    let stopped = false
    let active = null
    const load = async () => {
      if (active || stopped) return
      const controller = new AbortController()
      active = controller
      const timeout = setTimeout(() => controller.abort(), 25000)
      const today = tehranCalendarDate()
      const earningsUrl = new URL(FINLOGIX_EARNINGS_URL)
      earningsUrl.searchParams.set("countries", "US")
      earningsUrl.searchParams.set("start", `${shiftCalendarDate(today, -MARKET_CALENDAR_DAYS)}T00:00:00`)
      earningsUrl.searchParams.set("end", `${shiftCalendarDate(today, MARKET_CALENDAR_DAYS)}T23:59:59`)
      const read = async url => {
        const response = await fetch(url, { cache: "no-store", signal: controller.signal })
        if (!response.ok) throw new Error("Calendar source unavailable")
        return response.json()
      }
      const results = await Promise.allSettled([
        read(`/analytics-data/news/calendar/timeline?days_before=${MARKET_CALENDAR_DAYS}&days_after=${MARKET_CALENDAR_DAYS}`),
        read(earningsUrl),
      ])
      clearTimeout(timeout)
      active = null
      if (stopped) return
      const [calendar, earnings] = results
      const calendarReady = calendar.status === "fulfilled" && Array.isArray(calendar.value?.data?.items)
      const earningsReady = earnings.status === "fulfilled" && Array.isArray(earnings.value)
      // Failed refreshes never leave an old schedule looking freshly confirmed.
      setCalendarEvents(calendarReady ? calendar.value.data.items : [])
      setEarningsEvents(earningsReady ? earningsCalendarEvents(earnings.value) : [])
      setCalendarState({ loading: false,
        error: calendarReady ? "" : "دریافت رویدادهای اقتصادی ناموفق بود.",
        earningsError: earningsReady ? "" : "تقویم سود شرکت‌ها در دسترس نیست.",
      })
    }
    void load()
    const visible = () => { if (!document.hidden) void load() }
    const timer = window.setInterval(visible, 300000)
    document.addEventListener("visibilitychange", visible)
    return () => {
      stopped = true
      active?.abort()
      window.clearInterval(timer)
      document.removeEventListener("visibilitychange", visible)
    }
  }, [calendarReloadKey])

  useEffect(() => {
    const itemId = selectedNews?.item_id
    if (!itemId || !selectedNews.analysis_available || newsAnalyses[itemId]) return
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
  const emptyFactorReasons = market.factor_empty_reasons || {}
  const factorPanels = useMemo(() => marketFactorPanels(market), [market])
  const importantEvents = useMemo(() => [
    ...calendarEvents.map(item => enrichCalendarEvent(item, structuredDrivers)),
    ...earningsEvents,
  ], [calendarEvents, earningsEvents, market.market_drivers])
  const selectedNewsAnalysis = selectedNews ? newsAnalyses[selectedNews.item_id] : null
  const selectedNewsAnalysisError = selectedNews ? newsAnalysisErrors[selectedNews.item_id] : ""
  const selectedNewsTitle = selectedNews ? selectedNewsAnalysis?.title_fa || selectedNews.title_fa || selectedNews.title || selectedNews.analysis_title_fa : ""
  const selectedNewsBody = selectedNewsAnalysis?.interpretation_fa || selectedNews?.analysis_fa || selectedNews?.summary || ""
  const nextAnalysisLabel = market.next_analysis_at === undefined
    ? "زمان بعدی اعلام نشده"
    : market.next_analysis_at
      ? formatTehranTime(market.next_analysis_at)
      : "زمان‌بندی فعال نیست"
  const legacyAssessmentTime = !market.report_kind ? market.analysis_generated_at : null
  const analysisTimes = {
    current: market.analysis_generated_at,
    "short-term": market.short_term_view?.assessed_at || market.short_term_assessed_at || legacyAssessmentTime,
    "medium-term": market.medium_term_view?.assessed_at || market.medium_term_assessed_at || legacyAssessmentTime,
  }
  const analysisTime = analysisTimes[analysisTab]

  return <div className="space-y-5 bg-background p-3 text-foreground md:p-4" dir="rtl">
    <section className="space-y-3">
      <div className="grid items-start gap-4 lg:grid-cols-[1.35fr_0.65fr]">
        <Card className="flex h-64 min-h-0 min-w-0 flex-col overflow-hidden border-border bg-card">
          <Tabs value={analysisTab} onValueChange={setAnalysisTab} dir="rtl" className="flex h-full min-h-0 flex-col">
          <CardHeader className="shrink-0 flex-row flex-wrap items-center gap-x-3 gap-y-2 space-y-0 pb-3">
            <TabsList aria-label="تحلیل بازار" className="grid h-12 min-w-0 max-w-full flex-auto grid-cols-3 items-stretch p-1.5">
              <TabsTrigger value="current" className={analysisTabClass}>نبض بازار</TabsTrigger>
              <TabsTrigger value="short-term" className={analysisTabClass}>کوتاه‌مدت</TabsTrigger>
              <TabsTrigger value="medium-term" className={analysisTabClass}>میان‌مدت</TabsTrigger>
            </TabsList>
            <div className="ms-auto flex shrink-0 items-center justify-end gap-2">
              {analysisTime ? <time dateTime={analysisTime} aria-label="تاریخ و ساعت تحلیل" className="text-center text-[11px] leading-4 text-muted-foreground">
                <span className="block">{formatGregorianDate(analysisTime)}</span>
                <span className="block">{formatTehranClock(analysisTime)}</span>
              </time> : <span className="text-[11px] text-muted-foreground" aria-label="تاریخ تحلیل ثبت نشده">—</span>}
              {onRefresh && <button type="button" disabled={loading} onClick={onRefresh} aria-label="دریافت آخرین تحلیل ذخیره‌شده" className="rounded-md p-1.5 text-primary hover:bg-muted disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button>}
            </div>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 pb-6">
            <TabsContent value="current" className={analysisPanelClass}>
              <MarketPulseAnalysis market={market} />
            </TabsContent>
            <TabsContent value="short-term" className={analysisPanelClass}>
              <MarketOutlookCard embedded title="مسیر هفته‌های پیش‌رو" horizon="چند روز تا چند هفته" view={market.short_term_view} legacyText={market.short_term_outlook_fa} assessedAt={market.short_term_assessed_at || (!market.report_kind ? market.analysis_generated_at : null)} weeklyFocus={market.weekly_focus_fa} weeklyEvents={market.weekly_events_fa} weeklyAssessedAt={market.weekly_assessed_at} />
            </TabsContent>
            <TabsContent value="medium-term" className={analysisPanelClass}>
              <MarketOutlookCard embedded title="تصویر ۶ تا ۱۲ ماهه" horizon="میان‌مدت" view={market.medium_term_view} legacyText={market.medium_term_outlook_fa} assessedAt={market.medium_term_assessed_at || (!market.report_kind ? market.analysis_generated_at : null)} />
            </TabsContent>
          </CardContent>
          <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border px-6 py-1.5">
            <MarketStatusIndicators status={status} />
            <InfoDialog title="زمان‌بندی تحلیل" description={`نوبت بعدی: ${nextAnalysisLabel}`} />
          </div>
          </Tabs>
        </Card>
        <SP500Dashboard compact status={status} />
      </div>
    </section>

    <section aria-label="رویدادها و اخبار مهم" className="grid items-stretch gap-4 lg:grid-cols-2">
      <Card className="flex h-[26rem] min-h-0 min-w-0 flex-col overflow-hidden border-border">
        <CardHeader className="shrink-0 pb-2"><div className="flex items-center gap-2"><CardTitle>رویدادهای مهم</CardTitle><InfoDialog title="رویدادهای مهم" description="همهٔ رویدادهای اقتصادی آمریکا با اهمیت بالا و گزارش سود شرکت‌های با ارزش بازار بیش از ۳۰۰ میلیارد دلار، در هفت روز گذشته و هفت روز آینده. خط اکنون مرز زمانی رویدادهای دارای ساعت مشخص است؛ زمان گذشته به‌تنهایی به معنای انتشار نتیجه نیست." /><button type="button" onClick={() => calendarNavigation.current?.centerNow()} disabled={calendarState.loading || (!importantEvents.length && Boolean(calendarState.error))} className="ms-auto shrink-0 rounded px-2 py-1 text-xs text-primary hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50">اکنون</button></div></CardHeader>
        {(calendarState.error || calendarState.earningsError) && <div role="status" className="space-y-1 px-5 pb-2 text-xs text-amber-600 dark:text-amber-400"><p>{[calendarState.error, calendarState.earningsError].filter(Boolean).join(" ")}</p><button type="button" onClick={() => setCalendarReloadKey(current => current + 1)} className="rounded px-2 py-1 text-primary hover:bg-muted">تلاش دوباره</button></div>}
        {calendarState.loading ? <CardContent><CalendarContentState isLoading /></CardContent> : importantEvents.length || !calendarState.error ? <MarketEventTimeline events={importantEvents} loading={calendarState.loading} navigationRef={calendarNavigation} renderEvent={item => <MarketEventRow item={item} />} /> : <CardContent><CalendarContentState error={calendarState.error} onRetry={() => setCalendarReloadKey(current => current + 1)} /></CardContent>}
      </Card>

      <Card className="flex h-[26rem] min-h-0 min-w-0 flex-col overflow-hidden border-border">
        <CardHeader className="shrink-0 pb-3"><div className="flex items-center justify-between gap-2"><CardTitle className="flex items-center gap-2"><Newspaper className="h-4 w-4 text-primary" />اخبار منتخب</CardTitle><Link href="/analytics/events" className="text-xs text-primary">مشاهده همه</Link></div></CardHeader>
        <CardContent tabIndex={0} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {newsState.error && <div role="alert" className="flex items-center justify-between gap-2 text-xs text-amber-600 dark:text-amber-400"><span>{newsState.error}</span><button type="button" disabled={newsState.loading} onClick={() => setNewsReloadKey(current => current + 1)} className="shrink-0 rounded px-2 py-1 text-primary hover:bg-muted">تلاش دوباره</button></div>}
          {newsState.stale && news.length > 0 && <p className="pb-2 text-xs leading-5 text-amber-600 dark:text-amber-400">تازه‌ترین خبر موجود بیش از ۴۸ ساعت قدمت دارد.</p>}
          {news.length ? news.map(item => {
            const translatedTitle = newsAnalyses[item.item_id]?.title_fa || item.title_fa
            return <button key={item.item_id} type="button" aria-haspopup="dialog" onClick={event => { newsTrigger.current = event.currentTarget; setSelectedNews(item) }} className="flex w-full items-center gap-3 border-b border-border py-3 text-left transition last:border-b-0 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              <span className="min-w-0 flex-1"><span className="block text-sm font-medium leading-6" dir={translatedTitle ? "rtl" : "ltr"}>{translatedTitle || item.title}</span><span className="mt-1 block text-[11px] text-muted-foreground">{formatTime(item.published_at)}</span></span><DisclosureTriangle className="text-primary" />
            </button>
          }) : newsState.loading ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin" />در حال دریافت اخبار…</p> : !newsState.error && <p className="text-sm text-muted-foreground">خبر تازه‌ای در دسترس نیست.</p>}
        </CardContent>
      </Card>
    </section>

    <Dialog open={Boolean(selectedNews)} onOpenChange={open => { if (!open) setSelectedNews(null) }}>
      <DialogContent dir="rtl" onCloseAutoFocus={event => { event.preventDefault(); newsTrigger.current?.focus() }} className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader className="text-right"><DialogTitle className="leading-8">{selectedNewsTitle || "خبر منتخب"}</DialogTitle><DialogDescription>{selectedNews?.analysis_available ? "تحلیل خبر منتخب" : "خلاصه خبر منتخب"}</DialogDescription></DialogHeader>
        {selectedNews && <div className="space-y-3">
          {newsAnalysisLoading === selectedNews.item_id && !selectedNewsAnalysis && <p className="flex items-center gap-2 text-xs text-primary"><LoaderCircle className="h-3.5 w-3.5 animate-spin" />در حال دریافت تحلیل خبر</p>}
          {selectedNewsBody ? <p dir="auto" className="whitespace-pre-line text-sm leading-8">{selectedNewsBody}</p> : !newsAnalysisLoading && <p className="text-sm text-muted-foreground">خلاصهٔ خبر در خوراک منبع موجود نیست.</p>}
          {selectedNewsAnalysisError && <p className="text-xs leading-6 text-amber-600 dark:text-amber-400">{selectedNewsAnalysisError}</p>}
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground"><span>CNBC · {formatTime(selectedNews.published_at)}</span>{selectedNewsAnalysis && <span>مبنای تحلیل: {selectedNewsAnalysis.evidence_type === "source_page" ? "متن صفحهٔ منبع" : "خلاصهٔ منبع"}</span>}</div>
          {selectedNews.selection_reason_fa && <p className="text-xs leading-6 text-muted-foreground">{selectedNews.selection_reason_fa}</p>}
          <a href={selectedNewsAnalysis?.source_url || selectedNews.url} target="_blank" rel="noreferrer" className="inline-block text-sm text-primary hover:underline">مشاهده خبر در منبع</a>
        </div>}
      </DialogContent>
    </Dialog>

    <section aria-label="عوامل اثرگذار بر بازار" className="space-y-3">
      {(market.factors_assessed_at || (!market.report_kind && market.analysis_generated_at)) && <time className="block text-[11px] leading-5 text-muted-foreground">آخرین ارزیابی عوامل: {formatTime(market.factors_assessed_at || market.analysis_generated_at)}</time>}
      <div className="grid items-stretch gap-4 lg:grid-cols-2">
        <FactorCard title="عوامل حمایتی" subtitle="عوامل مثبت جاری و پتانسیل‌های بازار. بازهٔ اثرگذاری، سازوکار و شرایط تحقق هر مورد در جزئیات آن نمایش داده می‌شود." items={factorPanels.supportive} positive emptyText={[emptyFactorReasons.supportive, emptyFactorReasons.potentials].filter(Boolean).join(" ") || "عامل حمایتی یا پتانسیل با شواهد کافی در تحلیل موجود ثبت نشده است."} />
        <FactorCard title="ریسک‌های بازار" subtitle="عوامل چالش‌زا و فشارهای نزولی، همراه با ریسک‌های فعال یا تحت نظر. بازهٔ اثرگذاری و شرایط تشدید یا کاهش هر مورد در جزئیات آن نمایش داده می‌شود." items={factorPanels.risks} emptyText={[emptyFactorReasons.challenging, emptyFactorReasons.risks].filter(Boolean).join(" ") || "عامل چالش‌زا یا ریسک با شواهد کافی در تحلیل موجود ثبت نشده است."} />
      </div>
    </section>
  </div>
}
