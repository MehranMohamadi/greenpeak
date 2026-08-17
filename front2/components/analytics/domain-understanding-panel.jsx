"use client"

import { useEffect, useState } from "react"
import { ChevronDown } from "lucide-react"
import { endpoints } from "@/api/api"
import { Badge } from "@/components/ui/badge"
import AnalysisListCard from "@/components/analytics/analysis-list-card"

export default function DomainUnderstandingPanel({ domainId }) {
  const [analysis, setAnalysis] = useState(null)
  const [rule, setRule] = useState(null)
  const [expanded, setExpanded] = useState(false)
  useEffect(() => {
    Promise.all([fetch(endpoints.analysis.domainLatest(domainId), { cache: "no-store" }), fetch(endpoints.analysis.ruleLatest("domain", domainId), { cache: "no-store" })])
      .then(async ([a, r]) => { if (a.ok) setAnalysis((await a.json()).data); if (r.ok) setRule((await r.json()).data) })
      .catch(() => {})
  }, [domainId])
  if (!analysis) return <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground" dir="rtl">تحلیل دامنه هنوز تولید نشده است.</div>
  return <div className="space-y-4 text-right" dir="rtl">
    <div className="flex flex-wrap gap-2"><Badge variant="outline">امتیاز سایه LLM: {analysis.llm_shadow_score}</Badge>{rule?.score != null ? <Badge variant="outline">امتیاز Rule: {rule.score}</Badge> : <Badge variant="outline">Rule: تنظیم نشده</Badge>}<Badge variant="outline">پوشش {analysis.coverage.status}</Badge></div>
    <p className="text-sm font-medium leading-7">{analysis.dominant_story_fa}</p>
    <p className="text-sm leading-7 text-muted-foreground">{analysis.narrative_fa}</p>
    <button type="button" onClick={() => setExpanded(value => !value)} className="inline-flex items-center gap-1 text-xs font-medium text-violet-700 dark:text-violet-300"><ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />{expanded ? "بستن جزئیات" : "نمایش جزئیات تحلیلی"}</button>
    {expanded && <div className="grid gap-3">
      <AnalysisListCard title="محرک‌های اصلی" items={analysis.top_drivers} tone="violet" />
      <AnalysisListCard title="شواهد پشتیبان" items={analysis.supporting_evidence} tone="positive" />
      <AnalysisListCard title="شواهد متعارض" items={analysis.conflicting_evidence} tone="warning" />
      <AnalysisListCard title="ریسک‌ها" items={analysis.risks_fa} tone="negative" />
      <AnalysisListCard title="موارد قابل پیگیری" items={analysis.watch_next_fa} tone="info" />
    </div>}
    <p className="text-[11px] text-muted-foreground">داده تا {analysis.data_as_of || "—"} · تحلیل {new Date(analysis.analysis_generated_at).toLocaleString("fa-IR")}</p>
  </div>
}
