"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, Beaker, ChevronDown, Database } from "lucide-react"

import { endpoints } from "@/api/api"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const indicatorConfigs = {
  "ten-year-treasury": { id: "us_10y_treasury_yield" },
  "fed-funds-rate": { id: "federal_funds_rate" },
}
const value = (number, suffix = "") => number == null ? "—" : `${number > 0 && suffix === " bp" ? "+" : ""}${Number(number).toFixed(2)}${suffix}`

export default function RateFeatureCard({ factorId }) {
  const indicatorConfig = indicatorConfigs[factorId]
  const indicatorId = indicatorConfig?.id
  const [snapshot, setSnapshot] = useState(null)
  const [error, setError] = useState("")
  const [debug, setDebug] = useState(false)
  const [sourceMode, setSourceMode] = useState("")
  const [narrative, setNarrative] = useState(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!indicatorId) return
    let cancelled = false
    setSnapshot(null); setError(""); setSourceMode("")

    const load = async () => {
      try {
        const [storedResponse, narrativeResponse] = await Promise.all([
          fetch(endpoints.indicatorFeatures.latest(indicatorId), { cache: "no-store" }),
          fetch(endpoints.analysis.indicatorLatest(indicatorId), { cache: "no-store" }),
        ])
        const storedBody = await storedResponse.json()
        const narrativeBody = await narrativeResponse.json()
        if (!storedResponse.ok) throw new Error(storedBody?.detail?.message || "Analysis has not been generated yet.")
        if (!cancelled) {
          setSnapshot(storedBody.data); setSourceMode("stored snapshot")
          setNarrative(narrativeResponse.ok ? narrativeBody.data : null)
        }
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
        <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-4 text-right" dir="rtl">
          <div className="flex items-center justify-between gap-3">
            <span className="font-semibold">تفسیر هوش مصنوعی</span>
            {narrative && <Badge variant="outline">امتیاز سایه آزمایشی {narrative.llm_shadow_score}</Badge>}
          </div>
          {narrative ? <>
            <p className="mt-2 leading-7">{narrative.current_state_fa} {narrative.what_changed_fa}</p>
            <button className="mt-2 inline-flex items-center gap-1 text-xs text-violet-700" onClick={() => setExpanded(!expanded)}><ChevronDown className={`h-4 w-4 transition ${expanded ? "rotate-180" : ""}`} />{expanded ? "کمتر" : "بیشتر"}</button>
            {expanded && <div className="mt-4 space-y-3 border-t pt-4 leading-7">
              <p>{narrative.interpretation_fa}</p><p>{narrative.narrative_fa}</p>
              {!!narrative.key_facts?.length && <Detail title="واقعیت‌های کلیدی" items={narrative.key_facts.map(item => item.fact || String(item))} />}
              <Detail title="ابهام و ریسک تفسیر" items={[...(narrative.ambiguities_fa || []), ...(narrative.risks_to_interpretation_fa || [])]} />
              <Detail title="موارد قابل پیگیری" items={narrative.watch_next_fa || []} />
              <p className="text-xs text-muted-foreground">داده تا {narrative.data_as_of || "—"} · تحلیل {new Date(narrative.analysis_generated_at).toLocaleString("fa-IR")} · پوشش {narrative.coverage.status}</p>
            </div>}
          </> : <p className="mt-2 text-sm text-muted-foreground">تحلیل هنوز تولید نشده است.</p>}
        </div>
        {process.env.NODE_ENV !== "production" && <button className="text-xs text-blue-600" onClick={() => setDebug(!debug)}>{debug ? "بستن JSON توسعه‌دهنده" : "نمایش JSON توسعه‌دهنده"}</button>}
        {debug && <pre dir="ltr" className="max-h-80 overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">{JSON.stringify(snapshot, null, 2)}</pre>}
      </CardContent>
    </Card>
  )
}

function Detail({ title, items }) {
  if (!items?.length) return null
  return <div><h4 className="font-medium">{title}</h4><ul className="list-disc space-y-1 pr-5 text-sm text-muted-foreground">{items.map((item, index) => <li key={index}>{item}</li>)}</ul></div>
}

function Metric({ label, value: metricValue, title }) {
  return <div className="rounded-lg border bg-background p-3" title={title}><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 font-mono text-base font-semibold" dir="ltr">{metricValue}</div></div>
}
