"use client"

import { useEffect, useState } from "react"
import { endpoints } from "@/api/api"
import { Badge } from "@/components/ui/badge"

export default function DomainUnderstandingPanel({ domainId }) {
  const [analysis, setAnalysis] = useState(null)
  const [rule, setRule] = useState(null)
  useEffect(() => {
    Promise.all([fetch(endpoints.analysis.domainLatest(domainId), { cache: "no-store" }), fetch(endpoints.analysis.ruleLatest("domain", domainId), { cache: "no-store" })])
      .then(async ([a, r]) => { if (a.ok) setAnalysis((await a.json()).data); if (r.ok) setRule((await r.json()).data) })
      .catch(() => {})
  }, [domainId])
  if (!analysis) return <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground" dir="rtl">تحلیل دامنه هنوز تولید نشده است.</div>
  return <div className="space-y-3 text-right" dir="rtl">
    <div className="flex flex-wrap gap-2"><Badge variant="outline">امتیاز سایه LLM: {analysis.llm_shadow_score}</Badge>{rule?.score != null ? <Badge variant="outline">امتیاز Rule: {rule.score}</Badge> : <Badge variant="outline">Rule: تنظیم نشده</Badge>}<Badge variant="outline">پوشش {analysis.coverage.status}</Badge></div>
    <p className="text-sm font-medium leading-7">{analysis.dominant_story_fa}</p>
    <p className="text-xs leading-6 text-muted-foreground">{analysis.narrative_fa}</p>
    <p className="text-[11px] text-muted-foreground">داده تا {analysis.data_as_of || "—"} · تحلیل {new Date(analysis.analysis_generated_at).toLocaleString("fa-IR")}</p>
  </div>
}
