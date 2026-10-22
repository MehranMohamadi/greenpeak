"use client"
import PremiumAnalysisGate from "@/components/analytics/premium-analysis-gate"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { CalendarDays, CircleHelp, Clock3, Link2, LoaderCircle, Newspaper, RefreshCw, ShieldAlert, TrendingUp, Triangle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import SP500Dashboard from "@/components/analytics/SP500Dashboard"
import MarketStatusCards from "@/components/analytics/market-status-cards"
import { marketFactorGroups } from "@/lib/market-factors"
import { formatGregorianDate, formatGregorianTehranDateTime, GREGORIAN_PERSIAN_LOCALE, TEHRAN_TIME_ZONE } from "@/lib/date-format"

const analysisTabClass = "flex h-full w-full items-center justify-center border border-transparent px-1.5 py-0 text-xs leading-none text-slate-500 transition sm:px-3 sm:text-sm dark:text-slate-400 data-[state=active]:border-cyan-500/50 data-[state=active]:bg-cyan-50 data-[state=active]:font-semibold data-[state=active]:text-cyan-900 data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-cyan-500/15 dark:data-[state=active]:border-cyan-400/50 dark:data-[state=active]:bg-cyan-400/15 dark:data-[state=active]:text-cyan-100 dark:data-[state=active]:ring-cyan-400/15"

const statusLabels = {
  favorable: "مساعد", mixed: "ترکیبی", challenging: "پرچالش", unknown: "نامشخص",
  low: "کم", medium: "متوسط", high: "زیاد",
  risk_on: "Risk-On", neutral: "Neutral", risk_off: "Risk-Off",
  short_term: "کوتاه‌مدت", medium_term: "چندماهه", long_term: "بلندمدت",
  new: "جدید", ongoing: "همچنان مؤثر", changed: "تغییر شواهد",
  active: "فعال", watch: "تحت نظر", inactive: "غیرفعال",
}

const factorTitle = (item) => typeof item === "string"
  ? item
  : item?.title_fa || item?.title || item?.driver || item?.risk || item?.conflict || item?.fact || ""

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

const tehranDateKey = (value) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "unknown" : new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Tehran",
  }).format(date)
}

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

const groupEventsByDate = (items, newestFirst = false) => Array.from(items.reduce((groups, item) => {
  const key = item.calendar_date || tehranDateKey(item.release_at)
  const label = item.calendar_date
    ? formatTehranDate(`${item.calendar_date}T12:00:00Z`)
    : formatTehranDate(item.release_at)
  if (!groups.has(key)) groups.set(key, { key, label, items: [] })
  groups.get(key).items.push(item)
  return groups
}, new Map()).values()).sort((left, right) => newestFirst
  ? right.key.localeCompare(left.key)
  : left.key.localeCompare(right.key))

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
  const scheduled = new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day) + (afterDailyRun ? 1 : 0), 12, 30))
  return formatGregorianTehranDateTime(scheduled)
}

function HelpDialog({ title, item, children, factorDetails = false }) {
  const rows = [
    ["تاریخ", item.release_at ? formatTehranDate(item.release_at) : null],
    [item.release_time_label_fa ? "زمان انتشار" : "ساعت تهران", item.release_at ? item.release_time_label_fa || formatTehranClock(item.release_at) : null],
    ["اهمیت", item.importance === "high" ? "بالا" : item.importance],
    ["داده واقعی", item.actual ?? item.current], ["مقدار قبلی", item.previous], ["پیش‌بینی", item.forecast],
    ["تغییر", item.change_fa], ["چرا مهم است؟", item.why_it_matters_fa || item.detail_fa],
    ["اثر بر بازار", statusLabels[item.impact] || item.impact], ["اثر بر سنتیمنت", statusLabels[item.sentiment] || item.sentiment],
    ["ماندگاری اثر", statusLabels[item.duration] || item.duration], ["عامل تغییردهنده اثر", item.reversal_conditions_fa],
    ...(factorDetails ? [
      ["سازوکار اثر بر S&P 500", item.mechanism_fa], ["افق زمانی", item.horizon_fa],
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

function FactorSection({ title, subtitle, items, positive, emptyText }) {
  return <section className="flex h-72 min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card">
    <div className="shrink-0 px-6 pb-3 pt-5">
      <h3 className={`flex items-center gap-2 text-base font-semibold ${positive ? "text-primary" : "text-destructive"}`}>
        {positive ? <TrendingUp className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}{title}
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-5"><DialogAnalysisList items={items} emptyText={emptyText} /></div>
  </section>
}

function CardConnector({ label }) {
  return <div className="relative z-20 -my-1 flex h-6 items-center justify-center lg:pointer-events-none lg:absolute lg:inset-y-0 lg:left-1/2 lg:my-0 lg:h-auto lg:-translate-x-1/2" role="img" aria-label={label}>
    <span
      aria-hidden="true"
      className="flex h-6 w-9 select-none items-center justify-center rounded-full border border-border bg-card text-foreground/75 ring-[3px] ring-background shadow-[0_3px_10px_hsl(var(--foreground)/0.10)]"
    ><Link2 className="h-4 w-4" strokeWidth={2.4} /></span>
  </div>
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
      <span className="min-w-0">
        <span className="block">{item.title}</span>
        {item.dialogItem.mechanism_fa && <span className="mt-1 block text-xs font-normal leading-6 text-muted-foreground">{item.dialogItem.detail_fa}</span>}
      </span>
      <DisclosureTriangle className="opacity-75" />
    </button>
  </HelpDialog>)}</div> : <p className="text-sm text-muted-foreground">{emptyText}</p>
}

export default function MarketIntelligenceSections({ market, onRefresh, loading = false }) {
  const [news, setNews] = useState([])
  const [newsState, setNewsState] = useState({ loading: true, error: "", stale: false })
  const [newsReloadKey, setNewsReloadKey] = useState(0)
  const [selectedNews, setSelectedNews] = useState(null)
  const [newsAnalyses, setNewsAnalyses] = useState({})
  const [newsAnalysisLoading, setNewsAnalysisLoading] = useState(null)
  const [newsAnalysisErrors, setNewsAnalysisErrors] = useState({})
  const [upcomingEvents, setUpcomingEvents] = useState([])
  const [releasedEvents, setReleasedEvents] = useState([])
  const [earningsEvents, setEarningsEvents] = useState([])
  const [calendarReloadKey, setCalendarReloadKey] = useState(0)
  const [calendarState, setCalendarState] = useState({
    upcoming: { loading: true, error: "" },
    released: { loading: true, error: "" },
  })
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
        setSelectedNews(current => items.find(item => item.item_id === current?.item_id) || items[0] || null)
        setNewsState({ loading: false, error: "", stale: Boolean(payload.data.stale) })
      } catch {
        if (!controller.signal.aborted) setNewsState(current => ({ ...current, loading: false, error: "دریافت اخبار CNBC ناموفق بود." }))
      }
    }
    void loadNews()
    return () => controller.abort()
  }, [newsReloadKey])

  useEffect(() => {
    const controller = new AbortController()
    const requestItems = async (path) => {
      let lastError = null
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const response = await fetch(path, { cache: "no-store", signal: controller.signal })
          const payload = await response.json().catch(() => null)
          if (!response.ok || !Array.isArray(payload?.data?.items)) throw new Error("Invalid calendar response")
          return payload.data.items
        } catch (error) {
          if (controller.signal.aborted) throw error
          lastError = error
        }
      }
      throw lastError || new Error("Calendar request failed")
    }
    const loadCalendar = async (kind, path, setItems, errorMessage) => {
      setCalendarState(current => ({ ...current, [kind]: { loading: true, error: "" } }))
      try {
        const items = await requestItems(path)
        if (!controller.signal.aborted) setItems(items)
      } catch (error) {
        if (!controller.signal.aborted) setCalendarState(current => ({ ...current, [kind]: { loading: false, error: errorMessage } }))
      } finally {
        if (!controller.signal.aborted) setCalendarState(current => ({ ...current, [kind]: { ...current[kind], loading: false } }))
      }
    }
    const loadEarningsCalendar = async () => {
      const today = tehranCalendarDate()
      const url = new URL(FINLOGIX_EARNINGS_URL)
      url.searchParams.set("countries", "US")
      url.searchParams.set("start", `${shiftCalendarDate(today, -14)}T00:00:00`)
      url.searchParams.set("end", `${shiftCalendarDate(today, 14)}T23:59:59`)
      try {
        const response = await fetch(url, { cache: "no-store", signal: controller.signal })
        if (!response.ok) throw new Error("Finlogix earnings request failed")
        const payload = await response.json()
        if (!Array.isArray(payload)) throw new Error("Finlogix earnings response is invalid")
        if (!controller.signal.aborted) setEarningsEvents(earningsCalendarEvents(payload))
      } catch {
        if (!controller.signal.aborted) setEarningsEvents([])
      }
    }
    void loadCalendar("upcoming", "/analytics-data/news/calendar/upcoming?limit=6", setUpcomingEvents, "دریافت داده های مهم پیش رو ناموفق بود.")
    void loadCalendar("released", "/analytics-data/news/calendar/released?limit=6", setReleasedEvents, "دریافت داده‌های مهم منتشرشده ناموفق بود.")
    void loadEarningsCalendar()
    return () => controller.abort()
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
  const factorGroups = useMemo(() => marketFactorGroups(market), [market])
  const positive = factorGroups.supportive
  const negative = factorGroups.challenging
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
  const publishedEvents = [
    ...(releasedEvents.length ? releasedEvents.map(item => enrichCalendarEvent(item, structuredDrivers)) : fallbackReleasedData),
    ...earningsEvents.filter(item => item._is_released),
  ]
  const publishedEventGroups = groupEventsByDate(publishedEvents, true)
  const upcomingMarketEvents = [
    ...upcomingEvents.map(item => enrichCalendarEvent(item, structuredDrivers)),
    ...earningsEvents.filter(item => !item._is_released),
  ]
  const upcomingEventGroups = groupEventsByDate(upcomingMarketEvents)
  const potentialItems = factorGroups.potentials
  const riskItems = factorGroups.risks
  const selectedNewsAnalysis = selectedNews ? newsAnalyses[selectedNews.item_id] : null
  const selectedNewsAnalysisError = selectedNews ? newsAnalysisErrors[selectedNews.item_id] : ""
  const selectedNewsTitle = selectedNews ? selectedNewsAnalysis?.title_fa || selectedNews.title_fa || selectedNews.title || selectedNews.analysis_title_fa : ""
  const selectedNewsBody = selectedNewsAnalysis?.interpretation_fa || selectedNews?.analysis_fa || selectedNews?.summary || ""
  const nextAnalysisLabel = market.next_analysis_at === undefined
    ? fallbackNextAnalysisLabel()
    : market.next_analysis_at
      ? formatTehranTime(market.next_analysis_at)
      : "زمان‌بندی فعال نیست"
  const summaryPoints = market.summary_points_fa?.length
    ? market.summary_points_fa.slice(0, 5)
    : [market.market_story_fa].filter(Boolean)
  const currentMoveLines = (market.current_market_move_fa || market.what_changed_fa || market.market_story_fa || "").split("\n").map(line => line.trim()).filter(Boolean)
  const currentHeadline = currentMoveLines.length > 1 ? currentMoveLines[0] : null
  const currentMoveSummary = currentHeadline ? currentMoveLines.slice(1).join("\n") : currentMoveLines.join("\n")

  return <div className="space-y-5 bg-background p-3 text-foreground md:p-4" dir="rtl">
    <section className="space-y-3">
      <div className="grid items-stretch gap-4 lg:h-64 lg:grid-cols-[1.35fr_0.65fr]">
      <Card className="h-64 min-h-0 overflow-hidden border-border bg-card lg:h-full">
        <Tabs defaultValue="current" dir="rtl" className="flex h-full min-h-0 flex-col">
        <CardHeader className="shrink-0 space-y-2 pb-3">
          <div className="flex items-center justify-end gap-2">
            {onRefresh && <button type="button" disabled={loading} onClick={onRefresh} aria-label="دریافت آخرین تحلیل ذخیره‌شده" title="دریافت آخرین تحلیل" className="rounded-md p-1.5 text-primary hover:bg-muted disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button>}
            <div className="flex min-w-0 items-center gap-2">
              <time dateTime={market.analysis_generated_at} dir="ltr" className="truncate text-left text-xs tabular-nums text-muted-foreground">
                {formatTime(market.analysis_generated_at)}
              </time>
              <Dialog>
                <DialogTrigger asChild>
                  <button type="button" aria-label="راهنمای تحلیل بازار" className="shrink-0 rounded-full text-primary hover:text-primary/80">
                    <CircleHelp className="h-4 w-4" />
                  </button>
                </DialogTrigger>
                <DialogContent dir="rtl">
                  <DialogHeader className="text-right">
                    <DialogTitle>راهنمای تحلیل بازار</DialogTitle>
                    <DialogDescription className="space-y-3 leading-7 text-muted-foreground">
                      <span className="block">این تب‌ها آخرین تحلیل ذخیره‌شدهٔ هوش مصنوعی را در جریان بازار، افق کوتاه‌مدت، میان‌مدت و جمع‌بندی پنج‌خطی نمایش می‌دهند.</span>
                      {market.analysis_freshness?.status === "overdue" && <span className="block text-amber-700 dark:text-amber-400">زمان انتشار تحلیل امروز گذشته است و هنوز خروجی تازه‌ای دریافت نشده است.</span>}
                      <span className="block text-primary">زمان‌بندی روزانه بعدی: {nextAnalysisLabel} به وقت تهران</span>
                    </DialogDescription>
                  </DialogHeader>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          <TabsList className="mt-3 grid h-12 w-full grid-cols-4 items-stretch border border-slate-300/80 bg-slate-100/90 p-1.5 dark:border-white/10 dark:bg-black/20">
            <TabsTrigger value="current" className={analysisTabClass}>جریان بازار</TabsTrigger>
            <TabsTrigger value="short-term" className={analysisTabClass}>کوتاه‌مدت</TabsTrigger>
            <TabsTrigger value="medium-term" className={analysisTabClass}>میان‌مدت</TabsTrigger>
            <TabsTrigger value="summary" className={analysisTabClass}>جمع‌بندی</TabsTrigger>
          </TabsList>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
          <TabsContent value="current" className="mt-0 space-y-3">
            {currentHeadline && <h3 className="text-sm font-semibold leading-7 text-foreground md:text-base">{currentHeadline}</h3>}
            <p className="whitespace-pre-line text-sm leading-7 text-foreground md:text-base">{currentMoveSummary}</p>
            <p className="whitespace-pre-line text-sm leading-8 text-muted-foreground">{market.current_analysis_fa || market.systemic_synthesis_fa || market.narrative_fa}</p>
          </TabsContent>
          <TabsContent value="short-term" className="mt-0">
            <PremiumAnalysisGate>
            <p className="whitespace-pre-line text-sm leading-8 text-muted-foreground">{market.short_term_outlook_fa || market.narrative_fa}</p>
            </PremiumAnalysisGate>
          </TabsContent>
          <TabsContent value="medium-term" className="mt-0">
            <PremiumAnalysisGate>
            <p className="whitespace-pre-line text-sm leading-8 text-muted-foreground">{market.medium_term_outlook_fa || market.systemic_synthesis_fa || market.narrative_fa}</p>
            </PremiumAnalysisGate>
          </TabsContent>
          <TabsContent value="summary" className="mt-0">
            <PremiumAnalysisGate>
            <ol className="space-y-2 text-sm leading-7 text-muted-foreground">
              {summaryPoints.map((item, index) => <li key={`${index}-${item}`} className="flex gap-2"><span className="text-primary">{index + 1}.</span><span>{item}</span></li>)}
            </ol>
            </PremiumAnalysisGate>
          </TabsContent>
        </CardContent>
        </Tabs>
      </Card>
      <SP500Dashboard compact />
      </div>
      <MarketStatusCards />
    </section>

    <Card className="overflow-hidden border-border bg-muted/15">
      <CardHeader className="pb-4"><CardTitle className="flex items-center gap-2"><Newspaper className="h-5 w-5 text-primary" />اخبار و رویدادها</CardTitle></CardHeader>
      <CardContent className="space-y-4">
    <section className="relative grid items-stretch gap-0 lg:grid-cols-2 lg:gap-4">
      <Card className="flex h-72 min-h-0 flex-col overflow-hidden border-border">
        <CardHeader className="shrink-0 pb-3"><div className="flex items-center justify-between"><CardTitle className="flex items-center gap-2"><Newspaper className="h-5 w-5 text-primary" />اخبار منتخب CNBC</CardTitle><Link href="/analytics/events" className="text-xs text-primary">مشاهده همه</Link></div><p className="text-xs leading-5 text-muted-foreground">چهار خبر منتخب گرین‌پیک بر اساس ارتباط با بازار آمریکا و تازگی خبر</p></CardHeader>
        <CardContent className="min-h-0 flex-1 space-y-2 overflow-y-auto">
        {newsState.error && <div role="alert" className="flex items-center justify-between gap-2 text-xs text-amber-600 dark:text-amber-400"><span>{newsState.error}</span><button type="button" disabled={newsState.loading} onClick={() => setNewsReloadKey(current => current + 1)} className="shrink-0 rounded px-2 py-1 text-primary hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">تلاش دوباره</button></div>}
        {newsState.stale && news.length > 0 && <p className="text-xs leading-5 text-amber-600 dark:text-amber-400">تازه‌ترین خبر موجود بیش از ۴۸ ساعت قدمت دارد.</p>}
        {news.length ? news.map(item => {
          const translatedTitle = newsAnalyses[item.item_id]?.title_fa || item.title_fa
          const itemTitle = translatedTitle || item.title
          const isSelected = selectedNews?.item_id === item.item_id
          return <button key={item.item_id} type="button" aria-pressed={isSelected} onClick={() => setSelectedNews(item)} className={`w-full rounded-lg border border-border p-3 text-right transition ${isSelected ? "bg-primary/15" : "bg-muted/25 hover:bg-muted/40"}`}><div className="flex items-center justify-between gap-2"><Badge variant="outline">CNBC · {item.selection_rank}</Badge><time className="text-[11px] text-muted-foreground">{formatTime(item.published_at)}</time></div><p className="mt-2 line-clamp-2 text-right text-sm font-medium leading-6" dir={translatedTitle ? "rtl" : "ltr"}>{itemTitle}</p><p className="mt-1 text-[11px] leading-5 text-muted-foreground">{item.selection_reason_fa}</p></button>
        }) : newsState.loading ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin" />در حال دریافت اخبار CNBC…</p> : !newsState.error && <p className="text-sm text-muted-foreground">خبر تازه‌ای از CNBC در دسترس نیست.</p>}</CardContent>
      </Card>

      <CardConnector label="ارتباط خبر انتخاب‌شده با تحلیل همان خبر" />

      <Card className="flex h-72 min-h-0 flex-col overflow-hidden border-border">
        <CardHeader className="shrink-0 pb-3"><div className="flex items-center gap-2"><CardTitle>{selectedNews?.analysis_available ? "تحلیل خبر منتخب" : "خلاصه خبر منتخب"}</CardTitle><InfoDialog title="خبر منتخب CNBC" description="خلاصهٔ خبر و لینک اصلی CNBC نمایش داده می‌شود. برای خبرهای موجود در آرشیو، در صورت آماده‌بودن سرویس تحلیل، ترجمه و تفسیر فارسی همان خبر نیز دریافت می‌شود." /></div></CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-y-auto" aria-live="polite">{selectedNews ? <div className="space-y-3">
          {newsAnalysisLoading === selectedNews.item_id && !selectedNewsAnalysis && <div className="flex items-center gap-2 text-xs font-medium text-primary">
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            <span>در حال تحلیل این خبر</span>
          </div>}
          <a href={selectedNewsAnalysis?.source_url || selectedNews.url} target="_blank" rel="noreferrer" className="block font-medium leading-7 text-primary transition hover:text-primary/80 hover:underline" dir={selectedNewsAnalysis?.title_fa || selectedNews.title_fa ? "rtl" : "ltr"}>{selectedNewsTitle}</a>
          {selectedNewsBody ? <p dir="auto" className="text-sm leading-8 text-muted-foreground">{selectedNewsBody}</p> : <p className="text-sm text-muted-foreground">خلاصهٔ خبر در خوراک CNBC موجود نیست؛ متن خبر را از لینک بالا بخوانید.</p>}
          {selectedNewsAnalysisError && <p className="text-xs leading-6 text-amber-400">{selectedNewsAnalysisError}</p>}
          <div className="flex flex-wrap gap-2"><Badge variant="outline">منبع: CNBC</Badge>{selectedNewsAnalysis && <Badge variant="outline">مبنای تحلیل: {selectedNewsAnalysis.evidence_type === "source_page" ? "متن صفحهٔ منبع" : "خلاصهٔ منبع"}</Badge>}</div>
        </div> : <p className="text-sm text-muted-foreground">یک خبر را انتخاب کنید.</p>}</CardContent>
      </Card>
    </section>

    <section className="relative grid items-stretch gap-0 lg:grid-cols-2 lg:gap-4">
      <Card className="flex h-80 min-h-0 flex-col overflow-hidden border-border">
        <CardHeader className="shrink-0 pb-3"><div className="flex items-center gap-2"><CardTitle>داده‌های مهم منتشرشده</CardTitle><InfoDialog title="داده‌های مهم منتشرشده" description="رویدادهای مهم منتشرشده همراه با تاریخ، ساعت تهران و مقادیر واقعی، پیش‌بینی و قبلی نمایش داده می‌شوند." /></div></CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-y-auto">{publishedEventGroups.length ? <div className="space-y-4">{publishedEventGroups.map(group => <section key={group.key}>
          <h3 className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-card pb-2 text-xs font-medium text-primary"><CalendarDays className="h-3.5 w-3.5" />{group.label}</h3>
          <div>{group.items.map(item => <MarketEventRow key={item.event_id || item.metric} item={item} />)}</div>
        </section>)}</div> : <CalendarContentState isLoading={calendarState.released.loading} error={calendarState.released.error} emptyText="دادهٔ منتشرشدهٔ مهمی از تقویم دریافت نشد." onRetry={() => setCalendarReloadKey(current => current + 1)} />}</CardContent>
      </Card>

      <CardConnector label="ارتباط داده‌های مهم منتشرشده با داده های مهم پیش رو" />

      <Card className="flex h-80 min-h-0 flex-col overflow-hidden border-border">
        <CardHeader className="shrink-0 pb-3"><div className="flex items-center gap-2"><CardTitle>داده‌های مهم پیش‌رو</CardTitle><InfoDialog title="داده‌های مهم پیش‌رو" description="داده‌های آینده با اهمیت بالا همراه با تاریخ، ساعت تهران و مقادیر پیش‌بینی و قبلی نمایش داده می‌شوند. مقدار واقعی تا زمان انتشار خالی می‌ماند." /></div></CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-y-auto">{upcomingEventGroups.length ? <div className="space-y-4">{upcomingEventGroups.map(group => <section key={group.key}>
          <h3 className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-card pb-2 text-xs font-medium text-primary"><CalendarDays className="h-3.5 w-3.5" />{group.label}</h3>
          <div>{group.items.map(item => <MarketEventRow key={item.event_id || item.metric} item={item} />)}</div>
        </section>)}</div> : <CalendarContentState isLoading={calendarState.upcoming.loading} error={calendarState.upcoming.error} emptyText="دادهٔ مهم آینده‌ای از تقویم دریافت نشد." onRetry={() => setCalendarReloadKey(current => current + 1)} />}</CardContent>
      </Card>
    </section>
      </CardContent>
    </Card>

    <Card className="overflow-hidden border-border bg-muted/15">
      <CardHeader className="pb-4">
        <CardTitle>عوامل اثرگذار بر بازار</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4" dir="rtl">
        <div className="relative grid items-stretch gap-0 lg:grid-cols-2 lg:gap-4">
          <FactorSection title="عوامل حمایتی" subtitle="عوامل مثبتِ جدید یا همچنان مؤثر · افق هر عامل مشخص است" items={positive} positive emptyText={emptyFactorReasons.supportive || "عامل حمایتی با شواهد کافی در تحلیل موجود ثبت نشده است."} />
          <CardConnector label="ارتباط عوامل حمایتی و چالش‌زا" />
          <FactorSection title="عوامل چالش‌زا" subtitle="فشارهای جاری بر بازار آمریکا · افق هر عامل مشخص است" items={negative} emptyText={emptyFactorReasons.challenging || "عامل چالش‌زا با شواهد کافی در تحلیل موجود ثبت نشده است."} />
        </div>
        <div className="relative grid items-stretch gap-0 lg:grid-cols-2 lg:gap-4">
          <FactorSection title="پتانسیل‌های بازار" subtitle="فرصت‌های چندماهه و ساختاری · با شرایط تحقق" items={potentialItems} positive emptyText={emptyFactorReasons.potentials || "پتانسیل با شواهد کافی در تحلیل موجود ثبت نشده است."} />
          <CardConnector label="ارتباط پتانسیل‌ها و ریسک‌های حاکم بر بازار" />
          <FactorSection title="ریسک‌های حاکم بر بازار" subtitle="ریسک‌های فعال یا تحت نظر · با افق زمانی مشخص" items={riskItems} emptyText={emptyFactorReasons.risks || "ریسک با شواهد کافی در تحلیل موجود ثبت نشده است."} />
        </div>
      </CardContent>
    </Card>
  </div>
}
