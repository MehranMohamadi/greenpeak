"use client"

import { useEffect, useRef, useState } from "react"
import { AlertTriangle, Database, RefreshCw } from "lucide-react"

import { endpoints } from "@/api/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { indicatorFeatureConfigs } from "./indicator-feature-card"

const indicators = indicatorFeatureConfigs
const stageTitles = {
  raw_input: "1. Raw Input",
  canonical_adapter: "2. Canonical Adapter",
  cleaned_series: "3. Cleaned Series",
  calculated_features: "4. Calculated Features",
  validated_snapshot: "5. Validated Snapshot",
}

function errorMessage(value, fallback) {
  if (typeof value === "string") return value
  if (value?.message) return value.message
  return fallback
}

export default function FeaturePipelineDebug() {
  const [indicator, setIndicator] = useState(indicators[0].id)
  const [payload, setPayload] = useState(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const requestController = useRef(null)

  const load = async () => {
    requestController.current?.abort()
    const controller = new AbortController()
    requestController.current = controller
    setLoading(true)
    setError("")
    const selected = indicators.find((item) => item.id === indicator)
    try {
      const startDate = new Date()
      startDate.setUTCFullYear(startDate.getUTCFullYear() - 11)
      const separator = selected.rawUrl.includes("?") ? "&" : "?"
      const rawResponse = await fetch(`${selected.rawUrl}${separator}start_date=${startDate.toISOString().slice(0, 10)}`, { cache: "no-store", signal: controller.signal })
      const rawBody = await rawResponse.json()
      if (!rawResponse.ok) throw new Error(errorMessage(rawBody?.detail, `Raw data request failed (${rawResponse.status})`))
      const observations = (rawBody.data || []).map((item) => ({ date: item.date, value: item.value ?? item.rate }))
      const response = await fetch(endpoints.indicatorFeatures.pipelinePreview, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ indicator_id: selected.id, source_series_id: selected.series, source_provider: rawBody.metadata?.source || "GreenPeak existing API", observations }),
        signal: controller.signal,
      })
      const body = await response.json()
      if (!response.ok) throw new Error(errorMessage(body?.detail, `Pipeline preview failed (${response.status})`))
      const records = (rawBody.data || []).map((item) => ({
        date: item.date,
        value: item.value ?? item.rate,
        fred_series_id: selected.series,
        source: rawBody.metadata?.source || "GreenPeak existing API",
      }))
      if (!controller.signal.aborted) {
        setPayload({
          ...body.data,
          stages: {
            ...body.data.stages,
            raw_input: { ...body.data.stages.raw_input, description: "Read-only observations received from the existing indicator API.", total_count: records.length, sample_last_10: undefined, records },
          },
        })
      }
    } catch (requestError) {
      if (!controller.signal.aborted) {
        setPayload(null)
        setError(errorMessage(requestError, "Pipeline preview is unavailable."))
      }
    } finally {
      if (requestController.current === controller) {
        requestController.current = null
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(load, 0)
    return () => window.clearTimeout(timer)
  }, [indicator])

  useEffect(() => () => requestController.current?.abort(), [])

  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-blue-600"><Database className="h-4 w-4" />Developer View</div>
            <h1 className="text-3xl font-bold">Rate Feature Pipeline JSON</h1>
            <p className="mt-2 text-muted-foreground">Verified project observations are processed in Python; this page only displays each stage.</p>
          </div>
          <Badge variant="outline">live pipeline view</Badge>
        </div>

        <Card>
          <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
            <select value={indicator} onChange={(event) => setIndicator(event.target.value)} className="h-10 flex-1 rounded-md border bg-background px-3 text-sm">
              {indicators.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
            <Button onClick={load} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</Button>
          </CardContent>
        </Card>

        {error && <div className="flex gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-amber-700 dark:text-amber-300"><AlertTriangle className="h-5 w-5 shrink-0" /><div><div className="font-medium">Live pipeline output is unavailable.</div><div className="mt-1 text-sm" dir="ltr">{error}</div><div className="mt-1 text-sm">No mock values are substituted.</div></div></div>}
        {payload && <div className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm"><span className="text-muted-foreground">Input source:</span><Badge variant="outline">{payload.source_stage}</Badge><span className="text-muted-foreground">As of:</span><span className="font-mono">{payload.as_of_date}</span></div>}
        {payload?.pipeline?.map((stageKey) => {
          const stage = payload.stages[stageKey]
          return <Card key={stageKey}><CardHeader><CardTitle className="text-lg">{stageTitles[stageKey]}</CardTitle><CardDescription>{stage.description}</CardDescription></CardHeader><CardContent><pre className="max-h-[520px] overflow-auto rounded-lg bg-slate-950 p-4 text-xs leading-relaxed text-slate-100">{JSON.stringify(stage, null, 2)}</pre></CardContent></Card>
        })}
      </div>
    </main>
  )
}
