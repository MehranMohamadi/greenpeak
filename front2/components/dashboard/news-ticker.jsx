"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  AlertTriangle,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Gauge,
  Lightbulb,
  ListChecks,
  Newspaper,
  Scale,
  ShieldAlert,
  Sparkles,
} from "lucide-react"
import { useAuth } from "@/components/auth/auth-context"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { endpoints } from "@/api/api"
import { accountKey, money, number } from "@/components/kokonutui/mt5-data-view"
import { IMPORTANT_US_NEWS_FA } from "@/lib/important-us-news-fa"
import {
  analyzeOpenRisk,
  analyzeTradeHistory,
  concentrationSummary,
  finiteNumber,
  freshnessSummary,
  positiveRule,
} from "@/lib/risk-management"

const INSIGHT_COUNT = 7
const ROTATION_INTERVAL_MS = 12_000
const REFRESH_INTERVAL_MS = 5 * 60 * 1000
const DASHBOARD_NEWS_SOURCES = ["alpha_vantage", "cnbc_rss"]
const SNOOZE_STORAGE_KEY = "greenpeak:dashboard-insights:snoozed"

const EDUCATIONAL_FILLERS = [
  { id: "education-risk-before-entry", title: "ریسک معامله را پیش از ورود تعیین کنید، نه پس از آن", detail: "حجم، نقطه ورود و حد ضرر باید پیش از اجرا با سقف ریسک حساب هماهنگ باشند." },
  { id: "education-stop-coverage", title: "نبود حد ضرر، محاسبه ریسک کل پرتفوی را ناقص می‌کند", detail: "حد ضرر معتبر کمک می‌کند زیان بالقوه هر موقعیت به‌صورت قابل اتکا سنجیده شود." },
  { id: "education-swap-cost", title: "سواپ می‌تواند بازده معامله‌های بلندمدت را به‌تدریج فرسوده کند", detail: "برای نگهداری چندروزه، سواپ خرید و فروش نماد را همراه با اسپرد و کمیسیون ببینید." },
  { id: "education-concentration", title: "تمرکز زیاد روی یک نماد، ریسک پنهان پرتفوی را بالا می‌برد", detail: "حتی چند معامله متفاوت می‌توانند در عمل به یک محرک مشترک وابسته باشند." },
  { id: "education-daily-plan", title: "سقف زیان و تعداد معاملات روزانه را قبل از شروع بازار مشخص کنید", detail: "قواعد از پیش تعیین‌شده تصمیم‌گیری زیر فشار را ساده‌تر می‌کنند." },
  { id: "education-snapshot", title: "تحلیل ریسک فقط به اندازه آخرین Snapshot حساب تازه است", detail: "پس از تغییر مهم در پوزیشن‌ها، یک Snapshot جدید از MetaTrader ارسال کنید." },
  { id: "education-event-risk", title: "پیش از رویدادهای کلان، گپ و لغزش را در کنار Stop در نظر بگیرید", detail: "در زمان خبر، اجرای واقعی ممکن است با قیمت برنامه‌ریزی‌شده تفاوت داشته باشد." },
  { id: "education-broker-cost", title: "هزینه واقعی بروکر ترکیبی از اسپرد، کمیسیون و سواپ است", detail: "مقایسه یک عدد به‌تنهایی ممکن است تصویر نادرستی از هزینه معامله بدهد." },
]

const PRESENTATION = {
  critical: { icon: ShieldAlert, iconClass: "text-rose-600 dark:text-rose-400", badgeClass: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300", rowClass: "border-rose-500/25 bg-rose-500/[0.06]", label: "بحرانی" },
  warning: { icon: AlertTriangle, iconClass: "text-amber-600 dark:text-amber-400", badgeClass: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300", rowClass: "border-amber-500/25 bg-amber-500/[0.06]", label: "نیازمند توجه" },
  action: { icon: ListChecks, iconClass: "text-violet-600 dark:text-violet-400", badgeClass: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300", rowClass: "border-violet-500/20 bg-violet-500/[0.04]", label: "اقدام پیشنهادی" },
  portfolio: { icon: BriefcaseBusiness, iconClass: "text-cyan-600 dark:text-cyan-400", badgeClass: "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300", rowClass: "border-cyan-500/20 bg-cyan-500/[0.04]", label: "پرتفوی شما" },
  broker: { icon: Scale, iconClass: "text-sky-600 dark:text-sky-400", badgeClass: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300", rowClass: "border-sky-500/20 bg-sky-500/[0.04]", label: "مقایسه بروکر" },
  news: { icon: Newspaper, iconClass: "text-blue-600 dark:text-blue-400", badgeClass: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300", rowClass: "border-blue-500/20 bg-blue-500/[0.04]", label: "بازار و رویداد" },
  education: { icon: Lightbulb, iconClass: "text-emerald-600 dark:text-emerald-400", badgeClass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", rowClass: "border-emerald-500/20 bg-emerald-500/[0.04]", label: "نکته مدیریت ریسک" },
  summary: { icon: Gauge, iconClass: "text-cyan-600 dark:text-cyan-400", badgeClass: "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300", rowClass: "border-cyan-500/20 bg-cyan-500/[0.04]", label: "خلاصه حساب" },
  positive: { icon: CheckCircle2, iconClass: "text-emerald-600 dark:text-emerald-400", badgeClass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", rowClass: "border-emerald-500/20 bg-emerald-500/[0.04]", label: "وضعیت پایدار" },
}

function formatRelativeTime(value) {
  const publishedAt = new Date(value)
  if (Number.isNaN(publishedAt.getTime())) return ""
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - publishedAt.getTime()) / 1000))
  if (elapsedSeconds < 60) return "همین حالا"
  const elapsedMinutes = Math.floor(elapsedSeconds / 60)
  if (elapsedMinutes < 60) return `${new Intl.NumberFormat("fa-IR").format(elapsedMinutes)} دقیقه پیش`
  const elapsedHours = Math.floor(elapsedMinutes / 60)
  if (elapsedHours < 24) return `${new Intl.NumberFormat("fa-IR").format(elapsedHours)} ساعت پیش`
  return `${new Intl.NumberFormat("fa-IR").format(Math.floor(elapsedHours / 24))} روز پیش`
}

function formatCount(value) {
  return new Intl.NumberFormat("fa-IR").format(value)
}

function fallbackArticles() {
  return IMPORTANT_US_NEWS_FA.map((item) => ({ ...item, title_fa: item.title, published_label: item.time }))
}

function normalize(value) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9آ-ی]/g, "")
}

function portfolioKeywords(snapshots) {
  const keywords = new Set()
  snapshots.forEach((snapshot) => {
    for (const collection of [snapshot?.positions, snapshot?.pending_orders, snapshot?.symbol_metrics]) {
      for (const item of collection || []) {
        const symbol = normalize(item?.symbol)
        if (!symbol) continue
        if (["US500", "SP500", "SPX500", "USA500", "SPX"].some((alias) => symbol.includes(alias))) {
          ;["S&P", "SP500", "US500", "سهام آمریکا", "اس‌اندپی"].forEach((word) => keywords.add(word.toLowerCase()))
        } else if (symbol.includes("XAU") || symbol.includes("GOLD")) {
          ;["GOLD", "XAU", "طلا"].forEach((word) => keywords.add(word.toLowerCase()))
        } else if (symbol.includes("BTC") || symbol.includes("XBT") || symbol.includes("BITCOIN")) {
          ;["BITCOIN", "BTC", "بیت‌کوین"].forEach((word) => keywords.add(word.toLowerCase()))
        } else if (symbol.includes("EURUSD")) {
          ;["EURUSD", "EURO", "یورو", "دلار"].forEach((word) => keywords.add(word.toLowerCase()))
        } else if (symbol.length >= 2 && symbol.length <= 8) {
          keywords.add(symbol.toLowerCase())
        }
      }
    }
  })
  return [...keywords]
}

function articleMatchesPortfolio(article, keywords) {
  if (!keywords.length) return false
  const text = `${article?.title_fa || ""} ${article?.title || ""} ${article?.summary_fa || ""} ${article?.summary || ""}`.toLowerCase()
  return keywords.some((keyword) => text.includes(keyword))
}

function readRiskRules(snapshot) {
  if (typeof window === "undefined" || !snapshot) return {}
  try {
    return JSON.parse(window.localStorage.getItem(`greenpeak:risk-rules:${accountKey(snapshot)}`) || "{}") || {}
  } catch {
    return {}
  }
}

function accountLabel(snapshot) {
  return snapshot?.source?.broker_company || "حساب معاملاتی"
}

function thresholdItem({ id, label, metric, limit, warningText, criticalText, detail, focus = "warnings" }) {
  if (metric == null || limit == null || limit <= 0 || metric <= limit) return null
  const critical = metric / limit >= 1.3
  return {
    id,
    kind: critical ? "critical" : "warning",
    priority: critical ? 100 : 82,
    title: critical ? criticalText : warningText,
    detail,
    meta: label,
    href: "#risk-management-title",
    focus,
    canSnooze: true,
    snoozeHours: critical ? 1 : 6,
  }
}

export function buildDashboardInsights({ snapshots, comparison, articles, snoozed, now, accountDataPending = false, accountDataUnavailable = false }) {
  const candidates = []
  const add = (item) => { if (item) candidates.push(item) }
  const activeSnapshots = [...snapshots].sort((left, right) => new Date(right?.timestamp_utc || 0) - new Date(left?.timestamp_utc || 0))

  if (accountDataPending) {
    add({ id: "preparing-account-summary", kind: "summary", priority: 90, title: "در حال آماده‌سازی خلاصه شخصی حساب‌های شما هستیم", detail: "اخبار و نکات عمومی فعلاً نمایش داده می‌شوند و داده حساب پس از دریافت Snapshot جایگزین می‌شود.", meta: "چند لحظه" })
  } else if (accountDataUnavailable) {
    add({ id: "account-summary-unavailable", kind: "summary", priority: 90, title: "داده حساب فعلاً در دسترس نیست؛ موارد عمومی همچنان نمایش داده می‌شوند", detail: "در تازه‌سازی بعدی دوباره برای دریافت Snapshot تلاش می‌کنیم و این وضعیت به‌عنوان هشدار حساب محسوب نمی‌شود.", meta: "موقت" })
  } else if (!activeSnapshots.length) {
    add({ id: "connect-mt5", kind: "action", priority: 90, title: "پس از اتصال MetaTrader، خلاصه شخصی ریسک و پرتفوی را اینجا خواهید دید", detail: "اتصال فقط برای دریافت Snapshot خواندنی حساب است و سفارشی برای بروکر ارسال نمی‌کند.", meta: "شروع کار", href: "/settings" })
  } else {
    let totalPositions = 0
    let totalPending = 0

    activeSnapshots.forEach((snapshot) => {
      const key = accountKey(snapshot)
      const label = accountLabel(snapshot)
      const rules = readRiskRules(snapshot)
      const openRisk = analyzeOpenRisk(snapshot)
      const history = analyzeTradeHistory(snapshot, now)
      const concentration = concentrationSummary(snapshot)
      const freshness = freshnessSummary(snapshot, now)
      const equity = finiteNumber(snapshot?.account?.equity)
      const leverage = finiteNumber(snapshot?.portfolio_metrics?.gross_portfolio_leverage)
      const margin = finiteNumber(snapshot?.account?.margin_level_pct)
      totalPositions += openRisk.positions.length
      totalPending += openRisk.pendingOrders.length

      const maxOpenRisk = positiveRule(rules.maxOpenRiskPct)
      add(thresholdItem({ id: `open-risk:${key}`, label, metric: openRisk.riskPct, limit: maxOpenRisk, warningText: `ریسک باز ${label} کمی بالاتر از سقف برنامه است`, criticalText: `ریسک باز ${label} به‌طور جدی از سقف برنامه عبور کرده است`, detail: openRisk.riskPct == null ? "" : `${number(openRisk.riskPct, 2, 2)}٪ در برابر سقف ${maxOpenRisk}٪`, focus: "positions" }))

      const dailyLimitPct = positiveRule(rules.dailyLossLimitPct)
      const dailyLimit = dailyLimitPct != null && equity != null ? equity * dailyLimitPct / 100 : null
      add(thresholdItem({ id: `daily-loss:${key}`, label, metric: history.realizedLossUsed, limit: dailyLimit, warningText: `زیان تحقق‌یافته امروز ${label} از سقف روزانه عبور کرده است`, criticalText: `زیان امروز ${label} به‌طور جدی بالاتر از سقف برنامه است`, detail: dailyLimit == null ? "" : `${money(history.realizedLossUsed, snapshot?.account?.currency || "USD")} زیان در برابر سقف ${money(dailyLimit, snapshot?.account?.currency || "USD")}` }))

      const maxLeverage = positiveRule(rules.maxGrossLeverage)
      add(thresholdItem({ id: `leverage:${key}`, label, metric: leverage, limit: maxLeverage, warningText: `لورج کل ${label} اندکی بالاتر از سقف برنامه است`, criticalText: `لورج کل ${label} به‌طور جدی از سقف برنامه عبور کرده است`, detail: leverage == null ? "" : `${number(leverage, 2, 2)}× در برابر سقف ${maxLeverage}×` }))

      const minMargin = positiveRule(rules.minMarginLevelPct)
      if (margin != null && minMargin != null && margin < minMargin) {
        const critical = margin < minMargin * 0.7
        add({ id: `margin:${key}`, kind: critical ? "critical" : "warning", priority: critical ? 99 : 81, title: critical ? `Margin Level ${label} به محدوده جدی برنامه رسیده است` : `Margin Level ${label} پایین‌تر از حد شخصی شماست`, detail: `${number(margin, 0)}٪ در برابر حداقل شخصی ${minMargin}٪`, meta: label, href: "#risk-management-title", focus: "warnings", canSnooze: true, snoozeHours: critical ? 1 : 6 })
      }

      if (openRisk.missingStopCount > 0) {
        add({ id: `missing-stop:${key}`, kind: "warning", priority: 76, title: `${formatCount(openRisk.missingStopCount)} پوزیشن ${label} حد ضرر ثبت‌شده ندارد`, detail: "این وضعیت قرمز نشده است، اما تا ثبت Stop محاسبه ریسک کل حساب کامل نیست.", meta: label, href: "#risk-management-title", focus: "positions", canSnooze: true, snoozeHours: 6 })
      }

      if (freshness.ageMinutes != null && freshness.ageMinutes >= 180 && openRisk.positions.length > 0) {
        add({ id: `stale:${key}`, kind: "warning", priority: 70, title: `Snapshot ${label} بیش از سه ساعت به‌روزرسانی نشده است`, detail: "با وجود پوزیشن باز، بهتر است پیش از تصمیم جدید Snapshot تازه ارسال شود.", meta: label, href: "#risk-management-title", focus: "warnings", canSnooze: true, snoozeHours: 6 })
      } else if (freshness.ageMinutes != null && freshness.ageMinutes >= 60) {
        add({ id: `refresh:${key}`, kind: "action", priority: 47, title: `برای تحلیل دقیق‌تر ${label} یک Snapshot تازه ارسال کنید`, detail: `آخرین داده حدود ${formatCount(Math.round(freshness.ageMinutes))} دقیقه قبل ثبت شده است.`, meta: label, href: "/settings" })
      }

      if (concentration.sharePct != null && concentration.sharePct >= 80) {
        add({ id: `concentration:${key}`, kind: "warning", priority: 66, title: `تمرکز Exposure ${label} روی ${concentration.symbol} بسیار بالاست`, detail: `${number(concentration.sharePct, 1, 1)}٪ از Gross Exposure گزارش‌شده روی این نماد قرار دارد.`, meta: label, href: "#risk-management-title", focus: "warnings", canSnooze: true, snoozeHours: 6 })
      } else if (concentration.sharePct != null && concentration.sharePct >= 60) {
        add({ id: `concentration-note:${key}`, kind: "portfolio", priority: 48, title: `بیشترین تمرکز ${label} روی ${concentration.symbol} است`, detail: `${number(concentration.sharePct, 1, 1)}٪ از Gross Exposure گزارش‌شده`, meta: label, href: "#risk-management-title", focus: "overview-structure" })
      }

      if (history.behaviorSampleSufficient && history.raisedVolumeAfterLoss >= 2) {
        add({ id: `behavior:${key}`, kind: "warning", priority: 64, title: `چند نشانه افزایش حجم پس از زیان در ${label} دیده شده است`, detail: `${formatCount(history.raisedVolumeAfterLoss)} بار ورود با حجم بیشتر تا ۳۰ دقیقه پس از خروج زیان‌ده؛ این نشانه آماری است، نه تشخیص قطعی.`, meta: label, href: "#risk-management-title", focus: "analysis-behavior", canSnooze: true, snoozeHours: 12 })
      }

      if (!Object.values(rules).some((value) => positiveRule(value) != null)) {
        add({ id: `rules:${key}`, kind: "action", priority: 54, title: `قواعد مدیریت ریسک ${label} هنوز تنظیم نشده‌اند`, detail: "می‌توانید سقف ریسک، زیان روزانه، لورج و Margin Level را برای همین حساب مشخص کنید.", meta: label, href: "#risk-management-title", focus: "rules" })
      }
    })

    add({ id: "accounts-summary", kind: "summary", priority: 52, title: `${formatCount(activeSnapshots.length)} حساب متصل، ${formatCount(totalPositions)} پوزیشن باز و ${formatCount(totalPending)} سفارش در انتظار دارید`, detail: "این خلاصه از آخرین Snapshot هر حساب ساخته شده است.", meta: "وضعیت حساب‌ها", href: "#trading-accounts-title" })

    if (comparison?.eligible_broker_count > 0) {
      const accountBrokers = new Set(activeSnapshots.map((snapshot) => String(snapshot?.source?.broker_company || "").trim().toLocaleLowerCase()))
      const matched = (comparison.brokers || []).find((broker) => accountBrokers.has(String(broker?.broker_name || "").trim().toLocaleLowerCase()))
      add({ id: "broker-comparison-ready", kind: "broker", priority: 44, title: matched ? `مقایسه هزینه‌های ${matched.broker_name} با داده تجمیعی بروکرها آماده است` : `مقایسه تجمیعی ${formatCount(comparison.eligible_broker_count)} بروکر آماده مشاهده است`, detail: "اسپرد، کمیسیون و سواپ فقط از داده واقعی و بی‌نام حساب‌ها ساخته می‌شوند.", meta: "هزینه معامله", href: "#trading-accounts-title", focus: "broker-comparison" })
    }
  }

  const keywords = portfolioKeywords(activeSnapshots)
  articles.filter((article) => articleMatchesPortfolio(article, keywords)).slice(0, 2).forEach((article, index) => add({ id: `portfolio-news:${article.item_id || article.id || article.url || index}`, kind: "portfolio", priority: 45 - index, title: article.title_fa?.trim() || article.title?.trim(), detail: "این خبر با یکی از نمادها یا محرک‌های مرتبط با پرتفوی فعلی شما هم‌پوشانی دارد.", meta: formatRelativeTime(article.published_at) || article.published_label || "خبر مرتبط", href: "/analytics/events" }))
  articles.slice(0, 6).forEach((article, index) => add({ id: `market-news:${article.item_id || article.id || article.url || index}`, kind: "news", priority: 35 - index, title: article.title_fa?.trim() || article.title?.trim(), detail: article.summary_fa?.trim() || article.summary?.trim() || "خبر مهم بازار آمریکا", meta: formatRelativeTime(article.published_at) || article.published_label || "بازار آمریکا", href: "/analytics/events" }))
  EDUCATIONAL_FILLERS.forEach((item, index) => add({ ...item, kind: "education", priority: 18 - index, meta: "آموزش کوتاه", href: "/help" }))

  const active = candidates.filter((item) => !Number(snoozed[item.id]) || Number(snoozed[item.id]) <= now.getTime())
  const unique = []
  const seen = new Set()
  active.sort((left, right) => right.priority - left.priority).forEach((item) => {
    const fingerprint = String(item.title).trim().toLocaleLowerCase()
    if (!item.title || seen.has(fingerprint)) return
    seen.add(fingerprint)
    unique.push(item)
  })
  const critical = unique.filter((item) => item.kind === "critical").slice(0, 2)
  const warnings = unique.filter((item) => item.kind === "warning").slice(0, Math.max(0, 3 - critical.length))
  const nonAlerts = unique.filter((item) => item.kind !== "critical" && item.kind !== "warning")
  return [...critical, ...warnings, ...nonAlerts].sort((left, right) => right.priority - left.priority).slice(0, INSIGHT_COUNT)
}

async function loadNews(signal) {
  for (const sourceId of DASHBOARD_NEWS_SOURCES) {
    try {
      const response = await fetch(endpoints.news.source(sourceId, 20), { cache: "no-store", signal })
      if (!response.ok) continue
      const payload = await response.json()
      let items = payload.data?.items || []
      if (sourceId === "alpha_vantage") items = items.filter((article) => article.importance === "high" || article.importance === "medium")
      if (items.length) return items
    } catch (error) {
      if (error.name === "AbortError") throw error
    }
  }
  return fallbackArticles()
}

async function loadPrivateData(accessToken, signal) {
  if (!accessToken) return { snapshots: [], comparison: null, accountDataAvailable: true }
  const headers = { Authorization: `Bearer ${accessToken}` }
  const [accountsResult, comparisonResult] = await Promise.allSettled([
    fetch("/dashboard-data/mt5/accounts", { cache: "no-store", headers, signal }),
    fetch("/dashboard-data/mt5/broker-comparison", { cache: "no-store", headers, signal }),
  ])
  let snapshots = []
  let comparison = null
  let accountDataAvailable = false
  if (accountsResult.status === "fulfilled" && accountsResult.value.ok) {
    const body = await accountsResult.value.json().catch(() => [])
    if (Array.isArray(body)) {
      snapshots = body
      accountDataAvailable = true
    }
  }
  if (comparisonResult.status === "fulfilled" && comparisonResult.value.ok) {
    const body = await comparisonResult.value.json().catch(() => null)
    if (body && Array.isArray(body.brokers)) comparison = body
  }
  return { snapshots, comparison, accountDataAvailable }
}

function InsightAction({ item, onNavigate }) {
  return <Link href={item.href || "#"} onClick={() => onNavigate(item)} className="shrink-0 rounded-md border bg-background px-2.5 py-1.5 text-[10px] font-medium text-foreground transition hover:bg-accent">مشاهده</Link>
}

export default function NewsTicker() {
  const { accessToken, isLoading: authLoading } = useAuth()
  const [articles, setArticles] = useState(fallbackArticles)
  const [snapshots, setSnapshots] = useState([])
  const [comparison, setComparison] = useState(null)
  const [privateDataReady, setPrivateDataReady] = useState(false)
  const [privateDataUnavailable, setPrivateDataUnavailable] = useState(false)
  const [privateDataOwner, setPrivateDataOwner] = useState(null)
  const [snoozed, setSnoozed] = useState({})
  const [currentIndex, setCurrentIndex] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [now, setNow] = useState(() => new Date())
  const [rulesRevision, setRulesRevision] = useState(0)

  useEffect(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(SNOOZE_STORAGE_KEY) || "{}")
      const current = Date.now()
      setSnoozed(Object.fromEntries(Object.entries(stored).filter(([, until]) => Number(until) > current)))
    } catch {
      setSnoozed({})
    }
  }, [])

  useEffect(() => {
    const updateRules = () => setRulesRevision((value) => value + 1)
    window.addEventListener("storage", updateRules)
    window.addEventListener("greenpeak:risk-rules-updated", updateRules)
    return () => {
      window.removeEventListener("storage", updateRules)
      window.removeEventListener("greenpeak:risk-rules-updated", updateRules)
    }
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (authLoading) return undefined
    const controller = new AbortController()
    setPrivateDataReady(!accessToken)
    setPrivateDataUnavailable(false)
    const refresh = async () => {
      try {
        const [nextArticles, privateData] = await Promise.all([loadNews(controller.signal), loadPrivateData(accessToken, controller.signal)])
        setArticles(nextArticles.length ? nextArticles : fallbackArticles())
        setSnapshots(privateData.snapshots)
        setComparison(privateData.comparison)
        setPrivateDataUnavailable(!privateData.accountDataAvailable)
        setPrivateDataOwner(accessToken || null)
      } catch (error) {
        if (error.name !== "AbortError") {
          setArticles((current) => current.length ? current : fallbackArticles())
          setSnapshots([])
          setComparison(null)
          setPrivateDataUnavailable(Boolean(accessToken))
          setPrivateDataOwner(accessToken || null)
        }
      } finally {
        if (!controller.signal.aborted) setPrivateDataReady(true)
      }
    }
    refresh()
    const timer = window.setInterval(refresh, REFRESH_INTERVAL_MS)
    return () => {
      window.clearInterval(timer)
      controller.abort()
    }
  }, [accessToken, authLoading])

  const privateDataMatchesSession = privateDataOwner === (accessToken || null)
  const insights = useMemo(() => buildDashboardInsights({
    snapshots: privateDataMatchesSession ? snapshots : [],
    comparison: privateDataMatchesSession ? comparison : null,
    articles,
    snoozed,
    now,
    accountDataPending: Boolean(accessToken) && (!privateDataReady || !privateDataMatchesSession),
    accountDataUnavailable: privateDataMatchesSession && privateDataUnavailable,
  }), [accessToken, articles, comparison, now, privateDataMatchesSession, privateDataReady, privateDataUnavailable, rulesRevision, snapshots, snoozed])

  useEffect(() => {
    setCurrentIndex((index) => insights.length ? Math.min(index, insights.length - 1) : 0)
  }, [insights.length])

  useEffect(() => {
    if (insights.length < 2 || expanded || hovered) return undefined
    const timer = window.setInterval(() => setCurrentIndex((index) => (index + 1) % insights.length), ROTATION_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [expanded, hovered, insights.length])

  const current = insights[currentIndex] || insights[0] || { id: "loading", kind: "summary", title: "در حال آماده‌سازی خلاصه شخصی داشبورد…", meta: "برای شما" }
  const currentPresentation = PRESENTATION[current.kind] || PRESENTATION.summary
  const CurrentIcon = currentPresentation.icon

  const snooze = (item) => {
    const until = Date.now() + (item.snoozeHours || 6) * 60 * 60 * 1000
    const next = { ...snoozed, [item.id]: until }
    setSnoozed(next)
    window.localStorage.setItem(SNOOZE_STORAGE_KEY, JSON.stringify(next))
    setCurrentIndex(0)
  }

  const navigate = (item) => {
    if (item.focus?.startsWith("broker")) window.dispatchEvent(new CustomEvent("greenpeak:broker-focus", { detail: item.focus }))
    else if (item.focus) window.dispatchEvent(new CustomEvent("greenpeak:risk-focus", { detail: item.focus }))
    setExpanded(false)
  }

  return <Popover open={expanded} onOpenChange={setExpanded}>
    <PopoverTrigger asChild>
      <button type="button" className="block w-full rounded-xl text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2" aria-label="باز کردن خلاصه شخصی داشبورد" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
        <Card dir="rtl" className="overflow-hidden border-cyan-200 bg-gradient-to-r from-cyan-600/10 to-cyan-500/10 shadow-sm transition hover:border-cyan-300 dark:border-cyan-800 dark:from-cyan-400/10 dark:to-cyan-500/10 dark:hover:border-cyan-700">
          <div className="flex items-center gap-3 p-4">
            <div className="flex shrink-0 items-center gap-2"><Sparkles className="h-4 w-4 text-cyan-600 dark:text-cyan-400" /><span className="text-sm font-semibold text-gray-900 dark:text-white">برای شما</span></div>
            <div className="min-w-0 flex-1 overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.div key={current.id} initial={{ x: 80, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -80, opacity: 0 }} transition={{ duration: 0.4, ease: "easeInOut" }} className="flex min-w-0 items-center gap-2">
                  <CurrentIcon className={`h-4 w-4 shrink-0 ${currentPresentation.iconClass}`} />
                  <span className="truncate text-sm font-medium text-gray-900 dark:text-white">{current.title}</span>
                  <span className="hidden shrink-0 text-xs text-gray-600 dark:text-gray-400 sm:inline">{current.meta}</span>
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground"><span className="tabular-nums">{formatCount(currentIndex + 1)} از {formatCount(insights.length || INSIGHT_COUNT)}</span><ChevronDown className={`h-4 w-4 transition ${expanded ? "rotate-180" : ""}`} /></div>
          </div>
        </Card>
      </button>
    </PopoverTrigger>

    <PopoverContent side="bottom" align="start" sideOffset={8} className="z-50 w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border-cyan-500/20 p-0 shadow-2xl">
      <div dir="rtl" className="bg-popover text-popover-foreground">
        <div className="flex items-center justify-between gap-3 border-b bg-cyan-500/[0.05] px-4 py-3">
          <div><p className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />خلاصه امروز شما</p><p className="mt-1 text-[10px] text-muted-foreground">اولویت‌بندی قاعده‌محور؛ حداکثر سه هشدار و بدون مصرف AI برای شخصی‌سازی</p></div>
          <Badge variant="secondary">{formatCount(insights.length)} مورد</Badge>
        </div>
        <div className="max-h-[min(68vh,36rem)] space-y-2 overflow-y-auto p-3">
          {insights.map((item, index) => {
            const presentation = PRESENTATION[item.kind] || PRESENTATION.summary
            const Icon = presentation.icon
            return <div key={item.id} className={`flex items-start gap-3 rounded-lg border p-3 ${presentation.rowClass}`}>
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-background/80"><Icon className={`h-4 w-4 ${presentation.iconClass}`} /></span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><span className="text-[10px] tabular-nums text-muted-foreground">{formatCount(index + 1)}</span><Badge variant="outline" className={`px-1.5 py-0 text-[9px] ${presentation.badgeClass}`}>{presentation.label}</Badge>{item.meta && <span className="text-[9px] text-muted-foreground">{item.meta}</span>}</div>
                <p className="mt-1.5 text-xs font-medium leading-5 text-foreground">{item.title}</p>
                {item.detail && <p className="mt-1 text-[10px] leading-5 text-muted-foreground">{item.detail}</p>}
              </div>
              <div className="flex shrink-0 flex-col gap-1.5">
                {item.href && <InsightAction item={item} onNavigate={navigate} />}
                {item.canSnooze && <button type="button" onClick={() => snooze(item)} className="flex items-center justify-center gap-1 rounded-md px-2 py-1 text-[9px] text-muted-foreground transition hover:bg-background hover:text-foreground"><Clock3 className="h-3 w-3" />تعویق {formatCount(item.snoozeHours || 6)} ساعته</button>}
              </div>
            </div>
          })}
        </div>
      </div>
    </PopoverContent>
  </Popover>
}
