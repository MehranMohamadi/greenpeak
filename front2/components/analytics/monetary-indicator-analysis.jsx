"use client"

import { useEffect, useState } from "react"
import { endpoints } from "@/api/api"
import { matchingNarrative, monetaryNarrativeIds } from "@/lib/monetary-narrative"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { NarrativeList } from "./narrative-text"

export default function MonetaryIndicatorAnalysis({ factorId, title, observationDate, revision = 0 }) {
  return <IndicatorNarrativeAnalysis indicatorId={monetaryNarrativeIds[factorId]} title={title} observationDate={observationDate} revision={revision} />
}

export function IndicatorNarrativeAnalysis({ indicatorId, revision = 0, note }) {
  const [result, setResult] = useState(null)
  useEffect(() => {
    const controller = new AbortController()
    setResult(null)
    async function load() {
      try {
        const response = await fetch(endpoints.analysis.indicatorLatest(indicatorId), { cache: "no-store", signal: controller.signal })
        if (response.status === 404) { setResult({ indicatorId, missing: true }); return }
        if (!response.ok) throw new Error("unavailable")
        const analysis = matchingNarrative(await response.json(), indicatorId)
        if (!analysis) throw new Error("mismatched narrative")
        if (!controller.signal.aborted) setResult({ indicatorId, analysis })
      } catch {
        if (!controller.signal.aborted) setResult({ indicatorId, error: true })
      }
    }
    load()
    return () => controller.abort()
  }, [indicatorId, revision])
  const current = result?.indicatorId === indicatorId ? result : null
  const analysis = current?.analysis
  const analysisDate = analysis?.analysis_generated_at?.slice(0, 10)
  return <Card dir="rtl" className="flex min-h-0 flex-col lg:absolute lg:inset-0">
    <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0 shrink-0"><CardTitle className="text-base">تحلیل شاخص</CardTitle>{analysisDate && <time dateTime={analysisDate} dir="ltr" className="shrink-0 text-xs font-normal tabular-nums text-muted-foreground">{analysisDate}</time>}</CardHeader>
    <CardContent className="max-h-[17.5rem] space-y-4 overflow-y-auto text-right">
      {note && <p className="text-xs leading-6 text-muted-foreground">{note}</p>}
      {!current && <p role="status" className="text-sm">در حال دریافت تحلیل…</p>}
      {current?.missing && <p className="text-sm">هنوز تحلیلی برای این شاخص ثبت نشده است.</p>}
      {current?.error && <p role="status" className="text-sm">دریافت تحلیل این شاخص ممکن نشد. لطفاً دوباره صفحه را بارگذاری کنید.</p>}
      {analysis && <>
        {[...new Set([analysis.current_state_fa, analysis.what_changed_fa, analysis.interpretation_fa, analysis.narrative_fa].filter(Boolean))].map((text) => <p key={text} className="whitespace-pre-line text-sm leading-7">{text}</p>)}
        <NarrativeList title="نکات کلیدی" items={analysis.key_facts} />
        <NarrativeList title="ابهام‌ها" items={analysis.ambiguities_fa} />
        <NarrativeList title="ریسک‌های تفسیر" items={analysis.risks_to_interpretation_fa} />
        <NarrativeList title="موارد قابل پیگیری" items={analysis.watch_next_fa} />
      </>}
    </CardContent>
  </Card>
}
