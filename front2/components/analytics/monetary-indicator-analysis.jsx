"use client"

import { useEffect, useState } from "react"
import { endpoints } from "@/api/api"
import { matchingNarrative, monetaryNarrativeIds } from "@/lib/monetary-narrative"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { NarrativeDates, NarrativeList } from "./narrative-text"

export default function MonetaryIndicatorAnalysis({ factorId, title, observationDate, revision = 0 }) {
  return <IndicatorNarrativeAnalysis indicatorId={monetaryNarrativeIds[factorId]} title={title} observationDate={observationDate} revision={revision} />
}

export function IndicatorNarrativeAnalysis({ indicatorId, title, observationDate, revision = 0, note }) {
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
  return <Card dir="rtl">
    <CardHeader className="space-y-2"><CardTitle className="text-lg">تحلیل شاخص</CardTitle><p dir="ltr" className="text-right text-sm text-muted-foreground">{title}</p></CardHeader>
    <CardContent className="space-y-4 text-right">
      {note && <p className="text-xs leading-6 text-muted-foreground">{note}</p>}
      {!current && <p role="status" className="text-sm">در حال دریافت تحلیل…</p>}
      {current?.missing && <p className="text-sm">هنوز تحلیلی برای این شاخص ثبت نشده است.</p>}
      {current?.error && <p role="status" className="text-sm">دریافت تحلیل این شاخص ممکن نشد. لطفاً دوباره صفحه را بارگذاری کنید.</p>}
      {analysis && <>
        {[...new Set([analysis.current_state_fa, analysis.what_changed_fa, analysis.interpretation_fa, analysis.narrative_fa].filter(Boolean))].map((text) => <p key={text} className="whitespace-pre-line text-sm leading-7">{text}</p>)}
        <details className="space-y-3"><summary className="cursor-pointer text-sm font-medium">جزئیات تحلیل</summary>
          <NarrativeList title="نکات کلیدی" items={analysis.key_facts} />
          <NarrativeList title="ابهام‌ها" items={analysis.ambiguities_fa} />
          <NarrativeList title="ریسک‌های تفسیر" items={analysis.risks_to_interpretation_fa} />
          <NarrativeList title="موارد قابل پیگیری" items={analysis.watch_next_fa} />
        </details>
        <NarrativeDates analysis={analysis} observationDate={observationDate} />
      </>}
    </CardContent>
  </Card>
}
