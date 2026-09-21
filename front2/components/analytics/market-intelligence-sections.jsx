"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, CalendarDays, ChevronLeft, CircleHelp, Newspaper, ShieldAlert, TrendingDown, TrendingUp } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import AnalysisListCard from "@/components/analytics/analysis-list-card"

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
    ["داده فعلی", item.current], ["مقدار قبلی", item.previous], ["پیش‌بینی", item.forecast],
    ["تغییر", item.change_fa], ["چرا مهم است؟", item.why_it_matters_fa || item.detail_fa],
    ["اثر بر بازار", statusLabels[item.impact] || item.impact], ["اثر بر Sentiment", statusLabels[item.sentiment] || item.sentiment],
    ["ماندگاری اثر", statusLabels[item.duration] || item.duration], ["عامل تغییردهنده اثر", item.reversal_conditions_fa],
  ].filter(([, value]) => value)
  return <Dialog><DialogTrigger asChild>{children}</DialogTrigger><DialogContent className="max-h-[85vh] overflow-y-auto border-slate-700/70 bg-[#111c33] text-slate-100" dir="rtl"><DialogHeader className="text-right"><DialogTitle className="pl-7 leading-8">{title}</DialogTitle><DialogDescription className="text-slate-400">جزئیات ثبت‌شده در آخرین تحلیل معتبر بازار</DialogDescription></DialogHeader><div className="space-y-2">{rows.length ? rows.map(([label, value]) => <div key={label} className="rounded-lg border border-slate-700/60 bg-slate-950/35 p-3"><p className="text-xs text-cyan-400">{label}</p><p className="mt-1 text-sm leading-7">{value}</p></div>) : <p className="text-sm text-slate-400">جزئیات تکمیلی هنوز در خروجی تحلیل ثبت نشده است.</p>}</div>{item.evidence_refs?.length > 0 && <p className="text-xs text-slate-500" dir="ltr">{item.evidence_refs.join(" · ")}</p>}</DialogContent></Dialog>
}

function Kpi({ label, value, color }) {
  const colors = { green: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300", amber: "border-amber-500/30 bg-amber-500/10 text-amber-300", cyan: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300", violet: "border-violet-500/30 bg-violet-500/10 text-violet-300", slate: "border-slate-600 bg-slate-800/70 text-slate-300" }
  return <div className="flex h-full min-h-0 items-center justify-between gap-3 rounded-xl border border-slate-700/60 bg-slate-900/60 p-2.5"><span className="text-xs text-slate-400">{label}</span><span className={`rounded-full border px-3 py-0.5 text-xs font-semibold ${colors[color]}`}>{value}</span></div>
}

function InfoDialog({ title, description }) {
  return <Dialog>
    <DialogTrigger asChild>
      <button type="button" aria-label={`راهنمای ${title}`} className="shrink-0 rounded-full text-cyan-400 transition hover:text-cyan-300">
        <CircleHelp className="h-4 w-4" />
      </button>
    </DialogTrigger>
    <DialogContent className="border-slate-700/70 bg-[#111c33] text-slate-100" dir="rtl">
      <DialogHeader className="text-right">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription className="leading-7 text-slate-300">{description}</DialogDescription>
      </DialogHeader>
    </DialogContent>
  </Dialog>
}

function Drivers({ title, items, tone }) {
  const positive = tone === "positive"
  return <Card className={`border-slate-700/60 bg-[#111c33]/90 ${positive ? "shadow-emerald-950/20" : "shadow-rose-950/20"}`}><CardHeader><CardTitle className={`flex items-center gap-2 text-lg ${positive ? "text-emerald-300" : "text-rose-300"}`}>{positive ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}{title}</CardTitle></CardHeader><CardContent className="space-y-2">{items.length ? items.slice(0, 5).map((item) => <HelpDialog key={item.metric} title={item.title_fa} item={item}><button type="button" className={`flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-right text-sm transition ${positive ? "border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-400/50" : "border-rose-500/20 bg-rose-500/5 hover:border-rose-400/50"}`}><span>{item.title_fa}</span><CircleHelp className="h-4 w-4 shrink-0 opacity-70" /></button></HelpDialog>) : <p className="text-sm text-slate-400">موردی ثبت نشده است.</p>}</CardContent></Card>
}

export default function MarketIntelligenceSections({ market }) {
  const [news, setNews] = useState([])
  const [selectedNews, setSelectedNews] = useState(null)
  const [upcomingEvents, setUpcomingEvents] = useState([])
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
    return () => controller.abort()
  }, [])

  const structuredDrivers = market.market_drivers || []
  const positive = useMemo(() => structuredDrivers.filter(item => item.sentiment === "risk_on").concat((market.positive_drivers || []).map((item, index) => normalizeLegacy(item, index, "positive"))).slice(0, 5), [market, structuredDrivers])
  const negative = useMemo(() => structuredDrivers.filter(item => item.sentiment === "risk_off").concat((market.negative_drivers || []).map((item, index) => normalizeLegacy(item, index, "negative"))).slice(0, 5), [market, structuredDrivers])
  const summary = market.status_summary || {}
  const releasedData = structuredDrivers.filter(item => item.current && (item.previous || item.forecast)).slice(0, 5)
  const nextAnalysisLabel = market.next_analysis_at === undefined
    ? fallbackNextAnalysisLabel()
    : market.next_analysis_at
      ? formatTehranTime(market.next_analysis_at)
      : "زمان‌بندی فعال نیست"

  return <div className="space-y-6 bg-[#0b1120] p-4 text-slate-100 md:p-6" dir="rtl">
    <section className="grid items-stretch gap-4 lg:h-64 lg:grid-cols-[1.35fr_0.65fr]">
      <Card className="flex h-64 min-h-0 flex-col overflow-hidden border-cyan-500/20 bg-gradient-to-bl from-[#172554] via-[#111c33] to-[#0f172a] lg:h-full">
        <CardHeader className="shrink-0 space-y-0 pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-xl text-slate-100">خلاصه بازار</CardTitle>
            <div className="flex min-w-0 items-center gap-2">
              <time dateTime={market.analysis_generated_at} dir="ltr" className="truncate text-left text-xs tabular-nums text-slate-400">
                {formatTime(market.analysis_generated_at)}
              </time>
              <Dialog>
                <DialogTrigger asChild>
                  <button type="button" aria-label="راهنمای تحلیل بازار" className="shrink-0 rounded-full text-cyan-400 hover:text-cyan-300">
                    <CircleHelp className="h-4 w-4" />
                  </button>
                </DialogTrigger>
                <DialogContent className="border-slate-700/70 bg-[#111c33] text-slate-100" dir="rtl">
                  <DialogHeader className="text-right">
                    <DialogTitle>راهنمای تحلیل بازار</DialogTitle>
                    <DialogDescription className="space-y-3 leading-7 text-slate-300">
                      <span className="block">این باکس خلاصهٔ چهارخطی و تحلیل جامع آخرین خروجی ذخیره‌شدهٔ هوش مصنوعی بازار را نمایش می‌دهد.</span>
                      <span className="block text-cyan-300">تحلیل بعدی: {nextAnalysisLabel} به وقت تهران</span>
                    </DialogDescription>
                  </DialogHeader>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
          <div className="space-y-5">
            <p className="line-clamp-4 text-sm leading-7 text-slate-200 md:text-base">{market.market_story_fa}</p>
            <section className="space-y-2">
              <h3 className="text-base font-semibold text-cyan-300">تحلیل بازار</h3>
              <p className="whitespace-pre-line text-sm leading-8 text-slate-300">{market.systemic_synthesis_fa || market.narrative_fa}</p>
            </section>
          </div>
        </CardContent>
      </Card>
      <div className="grid h-64 min-h-0 auto-rows-fr gap-2 lg:h-full"><Kpi label="شرایط کلی بازار" value={statusLabels[summary.market_condition] || "نامشخص"} color="violet" /><Kpi label="ریسک بازار" value={statusLabels[summary.risk_level] || "نامشخص"} color="amber" /><Kpi label="Sentiment" value={statusLabels[summary.sentiment] || "نامشخص"} color="slate" /><Kpi label="شدت تغییر" value={statusLabels[summary.change_intensity] || "نامشخص"} color="cyan" /><Kpi label="اعتماد به تحلیل" value={statusLabels[summary.confidence_level] || "نامشخص"} color={summary.confidence_level === "high" ? "green" : "violet"} /></div>
    </section>

    <section className="grid gap-4 lg:grid-cols-2">
      <Card className="flex h-72 min-h-0 flex-col overflow-hidden border-cyan-500/20 bg-[#111c33]/90 text-slate-100">
        <CardHeader className="shrink-0 pb-3"><div className="flex items-center gap-2"><CardTitle>تحلیل خبر منتخب</CardTitle><InfoDialog title="تحلیل خبر منتخب" description="این باکس خبر انتخاب‌شده را بر پایه موضوع، نمادهای مرتبط، امتیاز ارتباط و احساس ثبت‌شده توسط منبع به فارسی جمع‌بندی می‌کند. تحلیل عمیق فقط در صورت وجود شواهد معتبر ساخته می‌شود." /></div></CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-y-auto">{selectedNews ? <div className="space-y-4"><h3 className="font-semibold leading-7 text-cyan-200">{selectedNews.analysis_title_fa || "تحلیل خبر بازار آمریکا"}</h3><p className="text-sm leading-8 text-slate-300">{selectedNews.analysis_fa || "تحلیل فارسی این خبر هنوز در دسترس نیست."}</p><div className="flex flex-wrap gap-2"><Badge variant="outline">ارتباط: {selectedNews.relevance_fa || "نامشخص"}</Badge><Badge variant="outline">احساس منبع: {selectedNews.sentiment_fa || "نامشخص"}</Badge></div></div> : <p className="text-sm text-slate-400">یک خبر را انتخاب کنید.</p>}</CardContent>
      </Card>
      <Card className="flex h-72 min-h-0 flex-col overflow-hidden border-slate-700/60 bg-[#111c33]/90 text-slate-100"><CardHeader className="shrink-0 pb-3"><div className="flex items-center justify-between"><CardTitle className="flex items-center gap-2"><Newspaper className="h-5 w-5 text-cyan-400" />اخبار پرتأثیر</CardTitle><Link href="/analytics/events" className="text-xs text-cyan-400">مشاهده همه</Link></div></CardHeader><CardContent className="min-h-0 flex-1 space-y-2 overflow-y-auto">{news.length ? news.map(item => <button key={item.item_id} type="button" onClick={() => setSelectedNews(item)} className={`w-full rounded-lg border p-3 text-right transition ${selectedNews?.item_id === item.item_id ? "border-cyan-400/60 bg-cyan-500/10" : "border-slate-700/60 bg-slate-950/25 hover:border-cyan-500/30"}`}><div className="flex items-center justify-between gap-2"><Badge variant="outline">{item.importance === "high" ? "اثر بالا" : "بااهمیت"}</Badge><time className="text-[11px] text-slate-500">{formatTime(item.published_at)}</time></div><p className="mt-2 line-clamp-2 text-sm font-semibold leading-6" dir="auto">{item.title}</p></button>) : <p className="text-sm text-slate-400">خبر رتبه‌بندی‌شده‌ای در دسترس نیست.</p>}</CardContent></Card>
    </section>

    <section className="grid gap-4 lg:grid-cols-2">
      <Card className="flex h-80 min-h-0 flex-col overflow-hidden border-slate-700/60 bg-[#111c33]/90 text-slate-100"><CardHeader className="shrink-0 pb-3"><div className="flex items-center gap-2"><CardTitle>داده‌های مهم منتشرشده</CardTitle><InfoDialog title="داده‌های مهم منتشرشده" description="فقط اعدادی نمایش داده می‌شوند که در شواهد آخرین تحلیل، مقدار واقعی و دست‌کم یک مقدار مقایسه‌ای معتبر داشته باشند." /></div></CardHeader><CardContent className="min-h-0 flex-1 overflow-auto">{releasedData.length ? <table className="w-full min-w-[600px] text-sm"><thead className="text-slate-400"><tr className="border-b border-slate-700"><th className="p-3 text-right">شاخص</th><th className="p-3">Previous</th><th className="p-3">Forecast</th><th className="p-3">Actual</th><th className="p-3">تحلیل</th></tr></thead><tbody>{releasedData.map(item => <tr key={item.metric} className="border-b border-slate-800"><td className="p-3 text-right"><span className="font-medium">{item.title_fa}</span><span className="mt-1 block text-xs text-slate-500" dir="ltr">{item.metric}</span></td><td className="p-3 text-center tabular-nums" dir="ltr">{item.previous || "—"}</td><td className="p-3 text-center tabular-nums" dir="ltr">{item.forecast || "—"}</td><td className="p-3 text-center font-semibold text-cyan-300 tabular-nums" dir="ltr">{item.current}</td><td className="p-3 text-center"><HelpDialog title={item.title_fa} item={item}><button type="button" aria-label={`تحلیل ${item.title_fa}`} className="text-cyan-400 hover:text-cyan-300"><CircleHelp className="h-4 w-4" /></button></HelpDialog></td></tr>)}</tbody></table> : <p className="rounded-lg border border-slate-700/60 bg-slate-950/25 p-4 text-sm text-slate-400">دادهٔ منتشرشدهٔ واجد شرایط در آخرین تحلیل ثبت نشده است.</p>}</CardContent></Card>

      <Card className="flex h-80 min-h-0 flex-col overflow-hidden border-slate-700/60 bg-[#111c33]/90 text-slate-100"><CardHeader className="shrink-0 pb-3"><div className="flex items-center gap-2"><CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-cyan-400" />رویدادهای مهم پیش‌رو</CardTitle><InfoDialog title="رویدادهای مهم پیش‌رو" description="این فهرست فقط رویدادهای آینده با درجه اهمیت بالا برای دلار آمریکا را از تقویم زنده سایت نمایش می‌دهد. عنوان رویدادها فارسی شده و زمان انتشار به وقت تهران است." /></div></CardHeader><CardContent className="min-h-0 flex-1 space-y-2 overflow-y-auto">{upcomingEvents.length ? upcomingEvents.map((item, index) => <a key={item.event_id} href={item.source_url} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl border border-slate-700/60 bg-slate-950/25 p-3 transition hover:border-cyan-500/30"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/15 text-sm font-bold text-cyan-300">{index + 1}</span><div className="min-w-0 flex-1"><p className="text-sm font-medium">{item.title_fa}</p><time dateTime={item.release_at} className="mt-1 block text-xs text-slate-400">{formatTehranTime(item.release_at)} به وقت تهران</time></div><Badge variant="outline" className="shrink-0">اهمیت بالا</Badge></a>) : <p className="rounded-lg border border-slate-700/60 bg-slate-950/25 p-4 text-sm text-slate-400">رویداد مهم آینده‌ای از تقویم دریافت نشد.</p>}<Link href="/analytics/events" className="mt-3 inline-flex items-center gap-1 text-sm text-cyan-400">مشاهدهٔ تقویم زنده <ChevronLeft className="h-4 w-4" /></Link></CardContent></Card>
    </section>

    <section className="grid gap-4 lg:grid-cols-2"><Drivers title="عوامل حمایتی" items={positive} tone="positive" /><Drivers title="عوامل چالشی" items={negative} tone="negative" /></section>

    <section className="grid gap-4 lg:grid-cols-2"><Card className="border-amber-500/20 bg-[#111c33]/90"><CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-400" />سیگنال‌های متضاد بازار</CardTitle></CardHeader><CardContent><AnalysisListCard title="نبرد نیروهای بازار" items={market.market_conflicts?.length ? market.market_conflicts.map(item => ({ title_fa: item.title_fa, detail_fa: `${item.supportive_signal_fa} در برابر ${item.pressuring_signal_fa} — ${item.current_balance_fa} شرط چرخش: ${item.reversal_condition_fa}`, evidence_refs: item.evidence_refs })) : market.cross_domain_conflicts} tone="warning" /></CardContent></Card><Card className="border-rose-500/20 bg-[#111c33]/90"><CardHeader><CardTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-rose-400" />ریسک مانیتور</CardTitle></CardHeader><CardContent><AnalysisListCard title="ریسک‌های فعال" items={market.risk_monitor?.length ? market.risk_monitor.map(item => ({ title_fa: item.title_fa, detail_fa: `${item.why_active_fa} تشدید: ${item.escalation_conditions_fa} کاهش: ${item.easing_conditions_fa}`, evidence_refs: item.evidence_refs })) : market.key_risks} tone="negative" /></CardContent></Card></section>

    <section><Card className="border-slate-700/60 bg-[#111c33]/90"><CardHeader><CardTitle>تغییرات مهم از آخرین تحلیل</CardTitle></CardHeader><CardContent>{market.important_changes?.length ? <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead className="text-slate-400"><tr className="border-b border-slate-700"><th className="p-3 text-right">عامل</th><th className="p-3">قبلی</th><th className="p-3">فعلی</th><th className="p-3">تغییر</th><th className="p-3 text-right">اثر بر بازار</th></tr></thead><tbody>{market.important_changes.map(item => <tr key={item.metric} className="border-b border-slate-800"><td className="p-3 font-medium" dir="ltr">{item.metric}</td><td className="p-3 text-center tabular-nums">{item.previous || "—"}</td><td className="p-3 text-center tabular-nums">{item.current || "—"}</td><td className="p-3 text-center">{item.change_fa}</td><td className="p-3 text-slate-300">{item.market_meaning_fa}</td></tr>)}</tbody></table></div> : <p className="rounded-lg border border-slate-700/60 bg-slate-950/25 p-4 text-sm leading-7 text-slate-300">{market.what_changed_fa || "دادهٔ مقایسه‌ای معتبری ثبت نشده است."}</p>}</CardContent></Card></section>

  </div>
}
