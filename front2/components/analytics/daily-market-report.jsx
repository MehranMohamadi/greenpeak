"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { endpoints } from "@/api/api"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

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
  useEffect(() => {
    const read = async url => { const response = await fetch(url, { cache: "no-store" }); return response.ok ? (await response.json()).data : null }
    Promise.all([read(endpoints.analysis.marketLatest), read(endpoints.analysis.ruleLatest("market", "sp500")), ...domains.map(([id]) => Promise.all([read(endpoints.analysis.domainLatest(id)), read(endpoints.analysis.ruleLatest("domain", id))]))])
      .then(([marketValue, ruleValue, ...domainValues]) => { setMarket(marketValue); setMarketRule(ruleValue); setDomainData(Object.fromEntries(domains.map(([id], index) => [id, domainValues[index]]))); setUnavailable(!marketValue) })
      .catch(() => setUnavailable(true))
  }, [])
  if (!market && !unavailable) return <Card className="mb-8"><CardContent className="p-6 text-sm text-muted-foreground">Loading persisted daily market report…</CardContent></Card>
  if (!market) return <Card className="mb-8 border-dashed"><CardContent className="p-6 text-right" dir="rtl"><p className="font-medium">گزارش روزانه بازار هنوز تولید نشده است.</p><p className="mt-1 text-sm text-muted-foreground">این صفحه فقط نتایج ذخیره‌شده را می‌خواند و با بازشدن صفحه تحلیلی اجرا نمی‌شود.</p></CardContent></Card>
  return <Card className="mb-8 overflow-hidden border-violet-500/20">
    <CardHeader className="bg-gradient-to-l from-violet-500/10 to-transparent text-right" dir="rtl">
      <CardTitle>گزارش روزانه بازار GreenPeak</CardTitle>
      <div className="flex flex-wrap justify-end gap-2 pt-2"><Badge variant="outline">امتیاز سایه LLM: {market.llm_shadow_score}</Badge>{marketRule?.score != null ? <Badge variant="outline">امتیاز کمی Rule: {marketRule.score}</Badge> : <Badge variant="outline">Rule: تنظیم نشده</Badge>}<Badge variant="outline">{market.coverage.status}</Badge></div>
      <p className="text-xs text-muted-foreground">داده تا {market.data_as_of || "—"} · تحلیل {new Date(market.analysis_generated_at).toLocaleString("fa-IR")} · پوشش {Math.round(market.coverage.ratio * 100)}٪</p>
    </CardHeader>
    <CardContent className="space-y-7 p-6 text-right" dir="rtl">
      <section><h3 className="mb-3 text-lg font-semibold">داستان بازار</h3><p className="whitespace-pre-line leading-8">{market.market_story_fa}</p><p className="mt-3 whitespace-pre-line leading-8 text-muted-foreground">{market.narrative_fa}</p></section>
      <div className="grid gap-5 md:grid-cols-2"><List title="محرک‌های مثبت" items={market.positive_drivers} /><List title="محرک‌های منفی" items={market.negative_drivers} /><List title="تعارض‌های بین‌دامنه‌ای" items={market.cross_domain_conflicts} /><List title="ریسک‌ها و عدم قطعیت" items={market.key_risks} /><List title="چه چیزی تغییر کرد" items={[market.what_changed_fa]} /><List title="موارد قابل پیگیری" items={market.watch_next_fa} /></div>
      <section><h3 className="mb-3 text-lg font-semibold">نمای دامنه‌ها</h3><div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">{domains.map(([id, label, href]) => { const [analysis, rule] = domainData[id] || []; return <Link key={id} href={href} className="rounded-lg border p-4 transition hover:border-violet-500/40"><h4 className="font-medium">{label}</h4>{analysis ? <><p className="mt-2 line-clamp-3 text-xs leading-6 text-muted-foreground">{analysis.dominant_story_fa}</p><div className="mt-2 flex gap-1"><Badge variant="outline">LLM {analysis.llm_shadow_score}</Badge>{rule?.score != null && <Badge variant="outline">Rule {rule.score}</Badge>}</div></> : <p className="mt-2 text-xs text-muted-foreground">تحلیل موجود نیست</p>}</Link> })}</div></section>
    </CardContent>
  </Card>
}

function List({ title, items }) {
  const values = (items || []).filter(Boolean).map(item => typeof item === "string" ? item : item.fact || item.text || JSON.stringify(item))
  if (!values.length) return null
  return <section><h3 className="mb-2 font-semibold">{title}</h3><ul className="list-disc space-y-2 pr-5 text-sm leading-6 text-muted-foreground">{values.map((item, index) => <li key={index}>{item}</li>)}</ul></section>
}
