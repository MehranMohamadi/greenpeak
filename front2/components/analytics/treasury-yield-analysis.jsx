"use client"
import PremiumAnalysisGate from "@/components/analytics/premium-analysis-gate"

import { useEffect, useState } from "react"
import { endpoints } from "@/api/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const valueText = (value, suffix = "") => value == null ? "داده کافی نیست" : `${Number(value).toLocaleString("fa-IR", { maximumFractionDigits: 2 })}${suffix}`

export default function TreasuryYieldAnalysis(props) {
  return <PremiumAnalysisGate><TreasuryYieldAnalysisContent {...props} /></PremiumAnalysisGate>
}

function TreasuryYieldAnalysisContent({ revision = 0 }) {
  const [snapshot, setSnapshot] = useState(null)
  const [error, setError] = useState("")
  useEffect(() => {
    const controller = new AbortController()
    setSnapshot(null); setError("")
    const load = async () => {
      try {
        const response = await fetch(`${endpoints.monetaryPolicy.tenYear}?period=MAX&interval=1d`, { cache: "no-store", signal: controller.signal })
        const history = await response.json()
        if (!response.ok || history.metadata?.source_series_id !== "^TNX" || history.metadata?.interval !== "1d" || !Array.isArray(history.data)) throw new Error("Yahoo history unavailable")
        const featureResponse = await fetch(endpoints.monetaryPolicy.tenYearFeatures, {
          method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
          body: JSON.stringify({ source_series_id: "^TNX", observations: history.data.map(({ date, value }) => ({ date, value })) }),
        })
        const body = await featureResponse.json()
        if (!featureResponse.ok || body.data?.source?.series_id !== "^TNX" || body.data?.indicator_id !== "cboe_10y_treasury_yield") throw new Error("Treasury features unavailable")
        if (!controller.signal.aborted) setSnapshot(body.data)
      } catch {
        if (!controller.signal.aborted) setError("دریافت تحلیل روزانهٔ بازده ۱۰ساله از یاهو ممکن نشد.")
      }
    }
    load()
    return () => controller.abort()
  }, [revision])
  const features = snapshot?.features || {}
  return <Card dir="rtl" className="flex min-h-0 flex-col lg:absolute lg:inset-0">
    <CardHeader className="shrink-0 pb-2 !pt-2.5"><CardTitle className="text-base">تحلیل شاخص</CardTitle><p className="text-xs leading-5 text-muted-foreground">آمار تاریخی از داده‌های روزانهٔ Yahoo Finance · Cboe (^TNX)</p></CardHeader>
    <CardContent className="max-h-[12.5rem] min-h-0 space-y-3 overflow-y-auto pb-2 text-right lg:max-h-none lg:flex-1">
      {error ? <p role="status" className="text-sm text-amber-700 dark:text-amber-300">{error}</p> : !snapshot ? <p role="status" className="text-sm">در حال دریافت تحلیل…</p> : <>
        <p className="text-sm leading-6">{snapshot.llm_context?.summary_template_fa}</p>
        <ul className="list-disc space-y-2 pr-4 text-sm leading-6">
          <li>تغییر ۳۰روزه: {valueText(features.delta_30d_bp, " واحد پایه")}</li>
          <li>تغییر ۹۰روزه: {valueText(features.delta_90d_bp, " واحد پایه")}</li>
          <li>فاصله از میانگین یک‌ساله: {valueText(features.distance_to_mean_365d_bp, " واحد پایه")}</li>
          <li>امتیاز استاندارد یک‌ساله: {valueText(features.zscore_365d)}</li>
          <li>صدک پنج‌ساله: {valueText(features.percentile_5y, "٪")}</li>
        </ul>
        <p className="text-xs leading-6 text-muted-foreground">این محاسبات روزانه‌اند؛ نمودار بازه‌های کوتاه دادهٔ ساعتی دارد. مبنای هر دو، شاخص بازده Cboe در یاهو است و با سری رسمی DGS10 تفاوت دارد.</p>
        {snapshot.quality?.status !== "ok" && <p className="text-xs leading-6 text-amber-700 dark:text-amber-300">{snapshot.quality?.status === "stale" ? "دادهٔ روزانه قدیمی است." : "برای برخی شاخص‌ها، تاریخچهٔ کافی در دسترس نیست."}</p>}
      </>}
    </CardContent>
  </Card>
}
