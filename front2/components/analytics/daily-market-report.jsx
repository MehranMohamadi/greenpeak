"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Loader2, RefreshCw } from "lucide-react"
import { endpoints } from "@/api/api"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import AnalysisListCard from "@/components/analytics/analysis-list-card"

const domains = [
  ["monetary_liquidity", "سیاست پولی و نقدینگی", "/analytics/monetary-policy"],
  ["growth_inflation_labor", "رشد، تورم و بازار کار", "/analytics/macroeconomic"],
  ["credit_financial_risk", "اعتبار و ریسک مالی", "/analytics/systemic-risk"],
  ["corporate_fundamentals", "بنیادهای شرکتی", "/analytics/corporate-earnings"],
  ["valuation", "ارزش‌گذاری", "/analytics/valuation"],
  ["market_internals_sectors", "درون‌داد بازار و بخش‌ها", "/analytics/market-internals"],
  ["positioning_sentiment_derivatives_volatility", "موقعیت‌گیری، احساسات، مشتقات و نوسان", "/analytics/sentiment"],
  ["capital_flows_intermarket", "جریان سرمایه و بین‌بازاری", "/analytics/intermarket"],
]

export default function DailyMarketReport() {
  const [market, setMarket] = useState(null)
  const [marketRule, setMarketRule] = useState(null)
  const [domainData, setDomainData] = useState({})
  const [unavailable, setUnavailable] = useState(false)
  const [running, setRunning] = useState(false)
  const [runMessage, setRunMessage] = useState("")
  const loadPersisted = async () => {
    const read = async url => { const response = await fetch(url, { cache: "no-store" }); return response.ok ? (await response.json()).data : null }
    const [marketValue, ruleValue, ...domainValues] = await Promise.all([read(endpoints.analysis.marketLatest), read(endpoints.analysis.ruleLatest("market", "sp500")), ...domains.map(([id]) => Promise.all([read(endpoints.analysis.domainLatest(id)), read(endpoints.analysis.ruleLatest("domain", id))]))])
    setMarket(marketValue); setMarketRule(ruleValue); setDomainData(Object.fromEntries(domains.map(([id], index) => [id, domainValues[index]]))); setUnavailable(!marketValue)
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
        token = window.prompt("Admin Token تحلیل را وارد کنید:") || ""
        if (token) sessionStorage.setItem("greenpeak_analysis_admin_token", token)
        response = await fetch(endpoints.analysis.runManual, { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {} })
      }
      const body = await response.json()
      if (!response.ok) throw new Error(body?.detail?.message || "تولید تحلیل ناموفق بود.")
      const runId = body?.data?.run_id
      if (!runId) throw new Error("شناسه اجرای تحلیل دریافت نشد.")
      let completed = false
      for (let attempt = 0; attempt < 180; attempt += 1) {
        await new Promise(resolve => setTimeout(resolve, 2500))
        const statusResponse = await fetch(endpoints.analysis.manualRunStatus(runId), { headers: token ? { Authorization: `Bearer ${token}` } : {}, cache: "no-store" })
        const statusBody = await statusResponse.json()
        if (!statusResponse.ok) throw new Error(statusBody?.detail?.message || "دریافت وضعیت تحلیل ناموفق بود.")
        const status = statusBody.data?.status
        setRunMessage(status === "queued" ? "تحلیل در صف اجراست…" : status === "running" ? "مدل در حال تحلیل داده‌هاست…" : "در حال نهایی‌سازی خروجی…")
        if (["success", "partial", "failed"].includes(status)) {
          if (status === "failed") throw new Error(`تحلیل ناموفق بود: ${statusBody.data?.error_code || "خطای نامشخص"}`)
          await loadPersisted()
          setRunMessage(status === "partial" ? "تحلیل با پوشش ناقص ذخیره شد." : "تحلیل ذخیره‌شده با موفقیت به‌روزرسانی شد.")
          completed = true
          break
        }
      }
      if (!completed) throw new Error("زمان انتظار تحلیل تمام شد؛ وضعیت اجرا را دوباره بررسی کنید.")
    } catch (error) {
      setRunMessage(error instanceof Error ? error.message : "تولید تحلیل ناموفق بود.")
    } finally { setRunning(false) }
  }
  if (!market && !unavailable) return <Card className="mb-8"><CardContent className="p-6 text-sm text-muted-foreground">Loading persisted daily market report…</CardContent></Card>
  if (!market) return <Card className="mb-8 border-dashed"><CardContent className="space-y-4 p-6 text-right" dir="rtl"><div><p className="font-medium">گزارش روزانه بازار هنوز تولید نشده است.</p><p className="mt-1 text-sm text-muted-foreground">این صفحه فقط نتایج ذخیره‌شده را می‌خواند و با بازشدن صفحه تحلیلی اجرا نمی‌شود.</p></div><button type="button" disabled={running} onClick={runAnalysis} className="inline-flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-xs font-medium shadow-sm disabled:opacity-60">{running ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}{running ? "در حال تحلیل…" : "تولید تحلیل جدید"}</button>{runMessage && <p className="text-xs text-muted-foreground">{runMessage}</p>}</CardContent></Card>
  return <Card className="mb-8 overflow-hidden border-violet-500/20">
    <CardHeader className="bg-gradient-to-l from-violet-500/10 to-transparent text-right" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3"><CardTitle>گزارش روزانه بازار GreenPeak</CardTitle><button type="button" disabled={running} onClick={runAnalysis} className="inline-flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-xs font-medium shadow-sm transition hover:border-violet-500/50 disabled:cursor-not-allowed disabled:opacity-60">{running ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}{running ? "در حال تحلیل…" : "تولید تحلیل جدید"}</button></div>
      {runMessage && <p className="text-xs text-muted-foreground">{runMessage}</p>}
      <div className="flex flex-wrap justify-end gap-2 pt-2"><Badge variant="outline">امتیاز سایه LLM: {market.llm_shadow_score}</Badge>{marketRule?.score != null ? <Badge variant="outline">امتیاز کمی Rule: {marketRule.score}</Badge> : <Badge variant="outline">Rule: تنظیم نشده</Badge>}<Badge variant="outline">{market.coverage.status}</Badge></div>
      <p className="text-xs text-muted-foreground">داده تا {market.data_as_of || "—"} · تحلیل {new Date(market.analysis_generated_at).toLocaleString("fa-IR")} · پوشش {Math.round(market.coverage.ratio * 100)}٪</p>
    </CardHeader>
    <CardContent className="space-y-7 p-6 text-right" dir="rtl">
      <section><h3 className="mb-3 text-lg font-semibold">داستان بازار</h3><p className="whitespace-pre-line leading-8">{market.market_story_fa}</p><p className="mt-3 whitespace-pre-line leading-8 text-muted-foreground">{market.narrative_fa}</p></section>
      <div className="grid gap-4 md:grid-cols-2"><AnalysisListCard title="محرک‌های مثبت" items={market.positive_drivers} tone="positive" /><AnalysisListCard title="محرک‌های منفی" items={market.negative_drivers} tone="negative" /><AnalysisListCard title="تعارض‌های بین‌دامنه‌ای" items={market.cross_domain_conflicts} tone="warning" /><AnalysisListCard title="ریسک‌ها و عدم قطعیت" items={market.key_risks} tone="negative" /><AnalysisListCard title="چه چیزی تغییر کرد" items={[market.what_changed_fa]} tone="info" /><AnalysisListCard title="موارد قابل پیگیری" items={market.watch_next_fa} tone="violet" /></div>
      <section><h3 className="mb-3 text-lg font-semibold">نمای دامنه‌ها</h3><div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">{domains.map(([id, label, href]) => { const [analysis, rule] = domainData[id] || []; return <Link key={id} href={href} className="rounded-lg border p-4 transition hover:border-violet-500/40"><h4 className="font-medium">{label}</h4>{analysis ? <><p className="mt-2 line-clamp-3 text-xs leading-6 text-muted-foreground">{analysis.dominant_story_fa}</p><div className="mt-2 flex gap-1"><Badge variant="outline">LLM {analysis.llm_shadow_score}</Badge>{rule?.score != null && <Badge variant="outline">Rule {rule.score}</Badge>}</div></> : <p className="mt-2 text-xs text-muted-foreground">تحلیل موجود نیست</p>}</Link> })}</div></section>
    </CardContent>
  </Card>
}
