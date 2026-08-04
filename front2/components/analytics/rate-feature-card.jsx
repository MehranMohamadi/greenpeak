"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, Beaker, Database } from "lucide-react"

import { endpoints } from "@/api/api"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const indicatorConfigs = {
  "ten-year-treasury": { id: "us_10y_treasury_yield", series: "DGS10", rawUrl: endpoints.monetaryPolicy.tenYear },
  "fed-funds-rate": { id: "federal_funds_rate", series: "DFF", rawUrl: endpoints.monetaryPolicy.dff },
}
const value = (number, suffix = "") => number == null ? "—" : `${number > 0 && suffix === " bp" ? "+" : ""}${Number(number).toFixed(2)}${suffix}`

export default function RateFeatureCard({ factorId }) {
  const indicatorConfig = indicatorConfigs[factorId]
  const indicatorId = indicatorConfig?.id
  const [snapshot, setSnapshot] = useState(null)
  const [error, setError] = useState("")
  const [debug, setDebug] = useState(false)
  const [sourceMode, setSourceMode] = useState("")

  useEffect(() => {
    if (!indicatorId) return
    let cancelled = false
    setSnapshot(null); setError(""); setSourceMode("")

    const loadPreview = async () => {
      const startDate = new Date()
      startDate.setUTCFullYear(startDate.getUTCFullYear() - 6)
      const separator = indicatorConfig.rawUrl.includes("?") ? "&" : "?"
      const rawResponse = await fetch(`${indicatorConfig.rawUrl}${separator}start_date=${startDate.toISOString().slice(0, 10)}`, { cache: "no-store" })
      const rawBody = await rawResponse.json()
      if (!rawResponse.ok) throw new Error(rawBody?.detail || `Raw data request failed (${rawResponse.status})`)
      const observations = (rawBody.data || []).map(item => ({ date: item.date, value: item.value ?? item.rate }))
      if (!observations.length) throw new Error("No observations are available for this indicator")

      const previewResponse = await fetch(endpoints.indicatorFeatures.pipelinePreview, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          indicator_id: indicatorConfig.id,
          source_series_id: indicatorConfig.series,
          source_provider: rawBody.metadata?.source || "GreenPeak existing API",
          observations,
        }),
      })
      const previewBody = await previewResponse.json()
      if (!previewResponse.ok) throw new Error(previewBody?.detail?.message || `Pipeline preview failed (${previewResponse.status})`)
      return previewBody.data.stages.validated_snapshot.snapshot
    }

    const load = async () => {
      try {
        const storedResponse = await fetch(endpoints.indicatorFeatures.latest(indicatorId, process.env.NODE_ENV !== "production"), { cache: "no-store" })
        const storedBody = await storedResponse.json()
        if (storedResponse.ok) {
          if (!cancelled) { setSnapshot(storedBody.data); setSourceMode("stored snapshot") }
          return
        }
        const previewSnapshot = await loadPreview()
        if (!cancelled) { setSnapshot(previewSnapshot); setSourceMode("live Python preview") }
      } catch (requestError) {
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : "Rate analysis is unavailable")
      }
    }

    load()
    return () => { cancelled = true }
  }, [indicatorConfig, indicatorId])

  if (!indicatorId) return null
  if (error) return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardContent className="flex items-center gap-3 p-5 text-sm text-amber-700 dark:text-amber-300">
        <AlertTriangle className="h-5 w-5 shrink-0" />
        <div><div className="font-medium">Rate analysis is temporarily unavailable</div><div className="text-xs opacity-80">{error}</div></div>
      </CardContent>
    </Card>
  )
  if (!snapshot) return <Card><CardContent className="p-5 text-sm text-muted-foreground">Loading stored Python features…</CardContent></Card>
  const features = snapshot.features
  return (
    <Card className="border-blue-500/20">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-lg"><Database className="h-5 w-5 text-blue-500" /> تحلیل استاندارد نرخ</CardTitle>
          <div className="flex gap-2"><Badge variant="outline">{sourceMode}</Badge><Badge variant="outline">{snapshot.quality.status}</Badge><Badge variant="outline"><Beaker className="mr-1 h-3 w-3" /> آزمایشی</Badge></div>
        </div>
        <CardDescription>دادهٔ {snapshot.source.latest_observation_date} · {snapshot.source.series_id} · محاسبه‌شده در Python</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5" dir="rtl">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Metric label="مقدار فعلی" value={value(snapshot.current.value_pct, "%")} />
          <Metric label="تغییر ۳۰ روز" value={value(features.delta_30d_bp, " bp")} />
          <Metric label="تغییر ۹۰ روز" value={value(features.delta_90d_bp, " bp")} />
          <Metric label="تغییر یک‌سال" value={value(features.delta_365d_bp, " bp")} />
          <Metric label="Z-score یک‌سال" value={value(features.zscore_365d)} title="فاصله از میانگین یک‌ساله بر حسب انحراف معیار؛ قطعیت یا توصیه نیست." />
          <Metric label="صدک پنج‌ساله" value={value(features.percentile_5y, "%")} title="رتبه تجربی مقدار فعلی میان مشاهدات پنج سال؛ نتیجه سرمایه‌گذاری نیست." />
          <Metric label="جهت ۹۰ روز" value={snapshot.state.direction_90d} title={`آزمایشی؛ آستانه ${snapshot.state.materiality_threshold_bp} واحد پایه`} />
          <Metric label="تازگی" value={`${snapshot.quality.freshness_days} روز`} />
        </div>
        <div className="rounded-lg bg-muted/50 p-4 text-sm leading-7">
          <p className="font-medium">{snapshot.semantics.what_is_fa}</p>
          <p className="mt-2 text-muted-foreground">{snapshot.semantics.why_it_matters_fa}</p>
          <p className="mt-2 text-muted-foreground">{snapshot.llm_context.summary_template_fa}</p>
        </div>
        {process.env.NODE_ENV !== "production" && <button className="text-xs text-blue-600" onClick={() => setDebug(!debug)}>{debug ? "بستن JSON توسعه‌دهنده" : "نمایش JSON توسعه‌دهنده"}</button>}
        {debug && <pre dir="ltr" className="max-h-80 overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">{JSON.stringify(snapshot, null, 2)}</pre>}
      </CardContent>
    </Card>
  )
}

function Metric({ label, value: metricValue, title }) {
  return <div className="rounded-lg border bg-background p-3" title={title}><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 font-mono text-base font-semibold" dir="ltr">{metricValue}</div></div>
}
