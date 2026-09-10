"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Activity, Clock3, Loader2, RefreshCw, Sparkles, TrendingUp } from "lucide-react"
import { endpoints } from "@/api/api"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import AnalysisListCard from "@/components/analytics/analysis-list-card"
import { US_MARKET } from "@/lib/navigation-state"

const domains = [
  ["monetary_liquidity", "سیاست پولی و نقدینگی سیستم", "/analytics/monetary-policy"],
  ["growth_inflation_labor", "رشد، تورم و بازار کار", "/analytics/macroeconomic"],
  ["credit_financial_risk", "اعتبار و ثبات مالی", "/analytics/systemic-risk"],
  ["corporate_fundamentals", "بنیادهای شرکتی", "/analytics/corporate-earnings"],
  ["valuation", "ارزش‌گذاری", "/analytics/valuation"],
  ["market_internals_sectors", "ساختار بازار، بخش‌ها و تمرکز", "/analytics/market-internals"],
  ["positioning_sentiment_derivatives_volatility", "موقعیت‌گیری، احساسات و نوسان", "/analytics/sentiment"],
  ["capital_flows_intermarket", "جریان سرمایه و بین‌بازاری", "/analytics/intermarket"],
]

export default function DailyMarketReport() {
  const [market, setMarket] = useState(null)
  const [domainData, setDomainData] = useState({})
  const [unavailable, setUnavailable] = useState(false)
  const [running, setRunning] = useState(false)
  const [runMessage, setRunMessage] = useState("")
  const loadPersisted = async () => {
    const read = async url => { const response = await fetch(url, { cache: "no-store" }); return response.ok ? (await response.json()).data : null }
    const [marketValue, ...domainValues] = await Promise.all([read(endpoints.analysis.marketLatest), ...domains.map(([id]) => read(endpoints.analysis.domainLatest(id)))])
    setMarket(marketValue); setDomainData(Object.fromEntries(domains.map(([id], index) => [id, domainValues[index]]))); setUnavailable(!marketValue)
  }
  useEffect(() => {
    loadPersisted().catch(() => setUnavailable(true))
  }, [])
  const runAnalysis = async () => {
    setRunning(true); setRunMessage("در حال تولید تحلیل؛ این فرایند ممکن است چند دقیقه طول بکشد…")
    try {
      let token = typeof window !== "undefined" ? sessionStorage.getItem("greenpeak_analysis_admin_token") : ""
      let response = await fetch(endpoints.analysis.runManual, { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {} })
      if (response.status === 403 && typeof window !== "undefined") {
        token = window.prompt("کد دسترسی خود را وارد کنید:") || ""
        if (token) sessionStorage.setItem("greenpeak_analysis_admin_token", token)
        response = await fetch(endpoints.analysis.runManual, { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {} })
      }
      const body = await response.json()
      if (!response.ok) throw new Error(response.status === 403 ? "کد دسترسی معتبر نیست. لطفاً کد نسخهٔ پولی خود را بررسی کنید." : "تولید تحلیل ناموفق بود. لطفاً دوباره تلاش کنید.")
      const runId = body?.data?.run_id
      if (!runId) throw new Error("شناسه اجرای تحلیل دریافت نشد.")
      let completed = false
      for (let attempt = 0; attempt < 180; attempt += 1) {
        await new Promise(resolve => setTimeout(resolve, 2500))
        const statusResponse = await fetch(endpoints.analysis.manualRunStatus(runId), { headers: token ? { Authorization: `Bearer ${token}` } : {}, cache: "no-store" })
        const statusBody = await statusResponse.json()
        if (!statusResponse.ok) throw new Error(statusResponse.status === 403 ? "کد دسترسی معتبر نیست. لطفاً کد نسخهٔ پولی خود را بررسی کنید." : "دریافت وضعیت تحلیل ناموفق بود.")
        const status = statusBody.data?.status
        setRunMessage(status === "queued" ? "تحلیل در صف اجراست…" : status === "running" ? "مدل در حال تحلیل داده‌هاست…" : "در حال نهایی‌سازی خروجی…")
        if (["success", "partial", "failed"].includes(status)) {
          if (status === "failed") throw new Error("تولید تحلیل ناموفق بود. لطفاً دوباره تلاش کنید.")
          await loadPersisted()
          setRunMessage(status === "partial" ? "تحلیل با پوشش ناقص ذخیره شد." : "تحلیل ذخیره‌شده با موفقیت به‌روزرسانی شد.")
          completed = true
          break
        }
      }
      if (!completed) throw new Error("زمان انتظار تحلیل تمام شد؛ وضعیت اجرا را دوباره بررسی کنید.")
    } catch (error) {
      setRunMessage(error instanceof Error && !(error instanceof TypeError) && !(error instanceof SyntaxError) ? error.message : "ارتباط با سرویس تحلیل ممکن نشد. لطفاً دوباره تلاش کنید.")
    } finally { setRunning(false) }
  }
  if (!market && !unavailable) return <Card className="mb-8"><CardContent className="p-6 text-sm text-muted-foreground">Loading persisted daily market report…</CardContent></Card>
  if (!market) return <Card className="mb-8 border-dashed"><CardContent className="space-y-4 p-6 text-right" dir="rtl"><div><p className="font-medium">گزارش روزانه بازار هنوز تولید نشده است.</p><p className="mt-1 text-sm text-muted-foreground">این صفحه فقط نتایج ذخیره‌شده را می‌خواند و با بازشدن صفحه تحلیلی اجرا نمی‌شود.</p></div><button type="button" disabled={running} onClick={runAnalysis} className="inline-flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-xs font-medium shadow-sm disabled:opacity-60">{running ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}{running ? "در حال تحلیل…" : "تولید تحلیل جدید"}</button>{runMessage && <p className="text-xs text-muted-foreground">{runMessage}</p>}</CardContent></Card>
  return (
    <Card className="relative mb-8 overflow-hidden border-violet-500/25 shadow-[0_22px_70px_-45px_rgba(124,58,237,0.65)]">
      <CardHeader
        className="relative overflow-hidden border-b border-violet-500/15 bg-gradient-to-bl from-violet-500/15 via-purple-500/10 to-blue-500/10 p-0 text-right"
        dir="rtl"
      >
        <div className="pointer-events-none absolute -left-16 -top-20 h-52 w-52 rounded-full bg-blue-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 right-8 h-56 w-56 rounded-full bg-violet-500/20 blur-3xl" />

        <div className="relative grid gap-6 p-6 md:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                <Activity className="h-3.5 w-3.5" />
                داده‌های بازار S&amp;P 500
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-violet-500/25 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-700 dark:text-violet-300">
                <Sparkles className="h-3.5 w-3.5" />
                تحلیل ذخیره‌شده با LLM
              </span>
            </div>

            <div className="flex items-start gap-4">
              <div className="rounded-2xl border border-violet-500/20 bg-background/70 p-3 shadow-sm backdrop-blur-sm">
                <TrendingUp className="h-7 w-7 text-violet-600 dark:text-violet-400" />
              </div>
              <div className="min-w-0">
                <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-violet-600 dark:text-violet-400">
                  {US_MARKET.label}
                </p>
                <CardTitle className="text-2xl font-bold tracking-tight md:text-3xl">
                  داستان بازار
                </CardTitle>
                <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground md:text-base">
                  جمع‌بندی شرایط بازار بر پایه ورودی‌های نسخه‌دار، پوشش داده و تحلیل ذخیره‌شده گرین‌پیک
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <Activity className="h-3.5 w-3.5 text-emerald-500" />
                آخرین داده: {market.data_as_of || "—"}
              </span>
              <span className="inline-flex items-center gap-2">
                <Clock3 className="h-3.5 w-3.5 text-violet-500" />
                زمان تحلیل: {new Date(market.analysis_generated_at).toLocaleString("fa-IR")}
              </span>
              <span>پوشش داده: {Math.round(market.coverage.ratio * 100)}٪</span>
            </div>
          </div>

          <div className="flex flex-col items-start gap-3 lg:items-end">
            <button
              type="button"
              disabled={running}
              onClick={runAnalysis}
              className="inline-flex items-center gap-2 rounded-xl border border-violet-500/25 bg-background/80 px-4 py-2.5 text-xs font-medium shadow-sm backdrop-blur-sm transition hover:border-violet-500/50 hover:bg-background disabled:cursor-not-allowed disabled:opacity-60"
            >
              {running ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {running ? "در حال تحلیل…" : "تولید تحلیل جدید"}
            </button>

            <div className="flex max-w-sm flex-wrap gap-2 lg:justify-end">
              <Badge variant="outline">تحلیل {market.analysis_version}</Badge>
              <Badge variant="outline">{market.coverage.status}</Badge>
              {market.provenance?.input_hash && <Badge variant="outline">ورودی نسخه‌دار</Badge>}
            </div>
          </div>
        </div>

        {runMessage && (
          <p className="relative border-t border-violet-500/10 bg-background/30 px-6 py-3 text-xs text-muted-foreground md:px-8">
            {runMessage}
          </p>
        )}
      </CardHeader>

      <CardContent className="space-y-7 p-6 text-right md:p-8" dir="rtl">
        <section className="rounded-2xl border border-violet-500/10 bg-violet-500/[0.035] p-5 md:p-6">
          <p className="whitespace-pre-line text-base font-medium leading-9 md:text-lg">
            {market.market_story_fa}
          </p>
          <p className="mt-4 whitespace-pre-line border-t border-violet-500/10 pt-4 leading-8 text-muted-foreground">
            {market.narrative_fa}
          </p>
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          <AnalysisListCard title="محرک‌های مثبت" items={market.positive_drivers} tone="positive" />
          <AnalysisListCard title="محرک‌های منفی" items={market.negative_drivers} tone="negative" />
          <AnalysisListCard title="تعارض‌های بین‌دامنه‌ای" items={market.cross_domain_conflicts} tone="warning" />
          <AnalysisListCard title="ریسک‌ها و عدم قطعیت" items={market.key_risks} tone="negative" />
          <AnalysisListCard title="چه چیزی تغییر کرد" items={[market.what_changed_fa]} tone="info" />
          <AnalysisListCard title="موارد قابل پیگیری" items={market.watch_next_fa} tone="violet" />
        </div>

        <section>
          <h3 className="mb-3 text-lg font-semibold">نمای دامنه‌ها</h3>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {domains.map(([id, label, href]) => {
              const analysis = domainData[id]
              return (
                <Link
                  key={id}
                  href={href}
                  className="rounded-lg border p-4 transition hover:border-violet-500/40"
                >
                  <h4 className="font-medium">{label}</h4>
                  {analysis ? (
                    <>
                      <p className="mt-2 line-clamp-3 text-xs leading-6 text-muted-foreground">
                        {analysis.dominant_story_fa}
                      </p>
                      <div className="mt-2 flex gap-1">
                        <Badge variant="outline">پوشش {Math.round((analysis.coverage?.ratio || 0) * 100)}٪</Badge>
                        <Badge variant="outline">نسخه {analysis.analysis_version}</Badge>
                      </div>
                    </>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">تحلیل موجود نیست</p>
                  )}
                </Link>
              )
            })}
          </div>
        </section>
      </CardContent>
    </Card>
  )
}
