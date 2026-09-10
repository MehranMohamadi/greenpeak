"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ChevronDown, Loader2, RefreshCw } from "lucide-react"

import { endpoints } from "@/api/api"
import AnalysisListCard from "@/components/analytics/analysis-list-card"
import { Badge } from "@/components/ui/badge"
import { PolicyAnalysisSkeleton } from "@/components/analytics/monetary-policy-loading"
import { NarrativeDates, NarrativeList } from "./narrative-text"

const wait = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds))
const outlookToneClasses = {
  positive: "border-green-200 bg-green-100 text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200",
  warning: "border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200",
  negative: "border-red-200 bg-red-100 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200",
  info: "border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200",
  neutral: "border-slate-200 bg-slate-100 text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200",
}

function insightText(item) {
  if (typeof item === "string") return item
  return item?.title_fa || item?.detail_fa || ""
}

export default function DomainUnderstandingPanel({ domainId, simple = false, onUpdated }) {
  const [analysis, setAnalysis] = useState(null)
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [runMessage, setRunMessage] = useState("")
  const [loadError, setLoadError] = useState(false)
  const mounted = useRef(true)

  const loadPersisted = useCallback(async () => {
    const analysisResponse = await fetch(endpoints.analysis.domainLatest(domainId), { cache: "no-store" })
    const analysisBody = await analysisResponse.json()
    if (!mounted.current) return
    setAnalysis(analysisResponse.ok ? analysisBody.data : null)
    setLoadError(!analysisResponse.ok && analysisResponse.status !== 404)
    setLoading(false)
  }, [domainId])

  useEffect(() => {
    mounted.current = true
    loadPersisted().catch(() => {
      if (mounted.current) { setLoading(false); setLoadError(true) }
    })
    return () => { mounted.current = false }
  }, [loadPersisted])

  const runAnalysis = async () => {
    if (running) return
    setRunning(true)
    setRunMessage("Generating and saving updated AI analysis on the server…")
    try {
      let token = sessionStorage.getItem("greenpeak_analysis_admin_token") || ""
      let response = await fetch(endpoints.analysis.runManual, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (response.status === 403) {
        token = window.prompt("Enter the analysis admin token:") || ""
        if (token) sessionStorage.setItem("greenpeak_analysis_admin_token", token)
        response = await fetch(endpoints.analysis.runManual, {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
      }

      const body = await response.json()
      if (!response.ok) throw new Error(body?.detail?.message || "Unable to queue AI analysis.")
      const runId = body?.data?.run_id
      if (!runId) throw new Error("The server did not return an analysis run ID.")

      for (let attempt = 0; attempt < 180; attempt += 1) {
        await wait(2500)
        const statusResponse = await fetch(endpoints.analysis.manualRunStatus(runId), {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          cache: "no-store",
        })
        const statusBody = await statusResponse.json()
        if (!statusResponse.ok) throw new Error(statusBody?.detail?.message || "Unable to read analysis status.")
        const status = statusBody.data?.status
        if (mounted.current) {
          setRunMessage(status === "queued"
            ? "Analysis is queued on the server…"
            : status === "running"
              ? "The AI model is analyzing the latest monetary-policy inputs…"
              : "Finalizing the saved analysis…")
        }
        if (["success", "partial", "failed"].includes(status)) {
          if (status === "failed") {
            throw new Error(`AI analysis failed: ${statusBody.data?.error_code || "unknown server error"}`)
          }
          await loadPersisted()
          onUpdated?.()
          if (mounted.current) {
            setRunMessage(status === "partial"
              ? "Analysis was saved with partial data coverage."
              : "Updated AI analysis was saved successfully.")
          }
          return
        }
      }
      throw new Error("Timed out while waiting for the server analysis.")
    } catch (error) {
      if (mounted.current) setRunMessage(error instanceof Error ? error.message : "Unable to generate AI analysis.")
    } finally {
      if (mounted.current) setRunning(false)
    }
  }

  if (simple) {
    return <div dir="rtl" className="space-y-4 text-right">
      {loading ? <p role="status" className="text-sm">در حال دریافت تحلیل…</p> : !analysis ? <p className="text-sm">{loadError ? "دریافت تحلیل گروه ممکن نشد." : "هنوز تحلیلی برای این گروه ثبت نشده است."}</p> : <>
        {analysis.stance_label_fa && <p className="text-sm font-medium">{analysis.stance_label_fa}</p>}
        {[...new Set([analysis.dominant_story_fa, analysis.narrative_fa].filter(Boolean))].map((text) => <p key={text} className="whitespace-pre-line text-sm leading-7">{text}</p>)}
        <NarrativeList title="نکات کلیدی" items={analysis.key_insights_fa} />
        {!!analysis.outlook_items?.length && <div className="space-y-1 text-sm leading-7">{analysis.outlook_items.map((item, index) => <p key={index}><span className="font-medium">{item.label_fa}: </span>{item.value_fa}</p>)}</div>}
        <details className="space-y-3"><summary className="cursor-pointer text-sm font-medium">جزئیات تحلیل</summary>
          <NarrativeList title="عوامل اصلی" items={analysis.top_drivers} />
          <NarrativeList title="شواهد همسو" items={analysis.supporting_evidence} />
          <NarrativeList title="شواهد متعارض" items={analysis.conflicting_evidence} />
          <NarrativeList title="ریسک‌ها" items={analysis.risks_fa} />
          <NarrativeList title="موارد قابل پیگیری" items={analysis.watch_next_fa} />
        </details>
        <NarrativeDates analysis={analysis} />
      </>}
      <RunButton running={running} onClick={runAnalysis} simple />
      {runMessage && <p dir="auto" className="text-xs text-muted-foreground" aria-live="polite">{runMessage}</p>}
    </div>
  }

  if (loading) {
    return <PolicyAnalysisSkeleton />
  }

  if (!analysis) {
    return (
      <div className="space-y-3 rounded-lg border border-dashed p-3 text-sm">
        <p className="text-muted-foreground">No saved monetary-policy AI analysis is available yet.</p>
        <RunButton running={running} onClick={runAnalysis} />
        {runMessage && <p className="text-xs text-muted-foreground" aria-live="polite">{runMessage}</p>}
      </div>
    )
  }

  const stance = analysis.stance_label_fa || "No documented stance"
  const keyInsights = (analysis.key_insights_fa?.length
    ? analysis.key_insights_fa
    : analysis.top_drivers?.map(insightText).filter(Boolean) || []).slice(0, 3)
  const outlookItems = analysis.outlook_items?.length
    ? analysis.outlook_items.slice(0, 3)
    : [
        { label_fa: "Rate path", value_fa: "Generate a new analysis", tone: "neutral" },
        { label_fa: "Balance sheet", value_fa: "Generate a new analysis", tone: "neutral" },
        { label_fa: "Policy risk", value_fa: "Generate a new analysis", tone: "neutral" },
      ]

  return (
    <div className="space-y-4" dir="ltr">
      <div className="grid gap-5 lg:grid-cols-[minmax(190px,0.75fr)_minmax(0,1fr)_minmax(0,1.15fr)]">
        <section className="space-y-2.5">
          <div className="rounded-xl border border-violet-200 bg-violet-50/70 p-4 text-center dark:border-violet-900 dark:bg-violet-950/25">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Documented stance</div>
            <Badge className="mt-3 max-w-full border border-violet-200 bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-800 shadow-none dark:border-violet-800 dark:bg-violet-950 dark:text-violet-200" dir="rtl">
              <span className="truncate">{stance}</span>
            </Badge>
            <div className="mt-3 text-[11px] text-muted-foreground">
              Coverage {analysis.coverage.status} · {Math.round(analysis.coverage.ratio * 100)}%
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-1.5">
            <Badge variant="outline">Analysis {analysis.analysis_version}</Badge>
            <Badge variant="outline">Saved AI analysis</Badge>
          </div>
        </section>

        <section className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Key Insights</h4>
          <div className="space-y-1.5">
            {keyInsights.length ? keyInsights.map((item, index) => (
              <div key={`${item}-${index}`} className="flex min-h-10 items-start gap-2 rounded-lg bg-muted/35 p-2 text-xs leading-5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
                <span className="line-clamp-2 text-right" dir="rtl" title={item}>{item}</span>
              </div>
            )) : <p className="text-xs text-muted-foreground">Generate a new analysis to populate insights.</p>}
          </div>
        </section>

        <section className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Policy Outlook</h4>
          <div className="space-y-1.5">
            {outlookItems.map((item, index) => (
              <div key={`${item.label_fa}-${index}`} className="rounded-lg border p-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-right font-semibold" dir="rtl">{item.label_fa}</span>
                  <span className={`h-2 w-2 shrink-0 rounded-full border ${outlookToneClasses[item.tone] || outlookToneClasses.neutral}`} />
                </div>
                <p className="mt-1 line-clamp-2 text-right leading-5 text-muted-foreground" dir="rtl" title={item.value_fa}>{item.value_fa}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <RunButton running={running} onClick={runAnalysis} />
      {runMessage && <p className="text-left text-xs text-muted-foreground" dir="ltr" aria-live="polite">{runMessage}</p>}
      <button type="button" onClick={() => setExpanded((value) => !value)} className="inline-flex items-center gap-1 text-xs font-medium text-violet-700 dark:text-violet-300">
        <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
        {expanded ? "Hide analytical details" : "Show analytical details"}
      </button>
      {expanded && (
        <div className="grid gap-3 text-right" dir="rtl">
          <div className="rounded-lg border p-3">
            <p className="text-sm font-medium leading-7">{analysis.dominant_story_fa}</p>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">{analysis.narrative_fa}</p>
          </div>
          <AnalysisListCard title="Top drivers" items={analysis.top_drivers} tone="violet" />
          <AnalysisListCard title="Supporting evidence" items={analysis.supporting_evidence} tone="positive" />
          <AnalysisListCard title="Conflicting evidence" items={analysis.conflicting_evidence} tone="warning" />
          <AnalysisListCard title="Risks" items={analysis.risks_fa} tone="negative" />
          <AnalysisListCard title="Watch next" items={analysis.watch_next_fa} tone="info" />
        </div>
      )}
      <p className="text-[11px] text-muted-foreground" dir="ltr">
        Data through {analysis.data_as_of || "—"} · Generated {new Date(analysis.analysis_generated_at).toLocaleString()}
        {analysis.provenance?.input_hash ? ` · Input ${analysis.provenance.input_hash}` : ""}
      </p>
    </div>
  )
}

function RunButton({ running, onClick, simple = false }) {
  return (
    <button
      type="button"
      disabled={running}
      onClick={onClick}
      className="inline-flex w-full items-center justify-center gap-2 rounded-lg border bg-background px-3 py-2 text-xs font-medium shadow-sm transition hover:border-violet-500/50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
      {simple ? (running ? "در حال به‌روزرسانی تحلیل…" : "به‌روزرسانی تحلیل") : (running ? "Generating AI analysis…" : "Generate updated AI analysis")}
    </button>
  )
}
