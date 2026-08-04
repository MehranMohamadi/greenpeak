"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, Database, RefreshCw } from "lucide-react"

import { endpoints } from "@/api/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const indicators = [
  { id: "us_10y_treasury_yield", label: "10-Year Treasury Yield (DGS10)", series: "DGS10", rawUrl: endpoints.monetaryPolicy.tenYear },
  { id: "federal_funds_rate", label: "Federal Funds Rate (DFF)", series: "DFF", rawUrl: endpoints.monetaryPolicy.dff },
]

const stageTitles = {
  raw_input: "1. Raw Input",
  canonical_adapter: "2. Canonical Adapter",
  cleaned_series: "3. Cleaned Series",
  calculated_features: "4. Calculated Features",
  validated_snapshot: "5. Validated Snapshot",
}

export default function FeaturePipelineDebug() {
  const [indicator, setIndicator] = useState(indicators[0].id)
  const [payload, setPayload] = useState(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true); setError("")
    try {
      const selected = indicators.find(item => item.id === indicator)
      const startDate = new Date()
      startDate.setUTCFullYear(startDate.getUTCFullYear() - 6)
      const separator = selected.rawUrl.includes("?") ? "&" : "?"
      const rawResponse = await fetch(`${selected.rawUrl}${separator}start_date=${startDate.toISOString().slice(0, 10)}`, { cache: "no-store" })
      const rawBody = await rawResponse.json()
      if (!rawResponse.ok) throw new Error(rawBody?.detail || `Raw data request failed (${rawResponse.status})`)
      const observations = (rawBody.data || []).map(item => ({ date: item.date, value: item.value ?? item.rate }))
      const response = await fetch(endpoints.indicatorFeatures.pipelinePreview, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ indicator_id: selected.id, source_series_id: selected.series, source_provider: rawBody.metadata?.source || "GreenPeak existing API", observations }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body?.detail?.message || `Pipeline preview failed (${response.status})`)
      setPayload(body.data)
    } catch (requestError) {
      setPayload(null)
      setError(requestError instanceof Error ? requestError.message : "Pipeline preview is unavailable.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [indicator])

  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-blue-600"><Database className="h-4 w-4" /> Developer View</div>
            <h1 className="text-3xl font-bold">Rate Feature Pipeline JSON</h1>
            <p className="mt-2 text-muted-foreground">دادهٔ موجود پروژه وارد Python می‌شود و خروجی هر تبدیل را مرحله‌به‌مرحله می‌بینی؛ فرانت فقط نمایش می‌دهد.</p>
          </div>
          <Badge variant="outline">development only</Badge>
        </div>

        <Card>
          <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
            <select value={indicator} onChange={event => setIndicator(event.target.value)} className="h-10 flex-1 rounded-md border bg-background px-3 text-sm">
              {indicators.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
            <Button onClick={load} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </CardContent>
        </Card>

        {error && <div className="flex gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-amber-700 dark:text-amber-300"><AlertTriangle className="h-5 w-5 shrink-0" /><div><div className="font-medium">خروجی واقعی فعلاً قابل دریافت نیست</div><div className="mt-1 text-sm">{error}</div></div></div>}

        {payload && <div className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm"><span className="text-muted-foreground">Input source:</span><Badge variant="outline">{payload.source_stage}</Badge><span className="text-muted-foreground">As of:</span><span className="font-mono">{payload.as_of_date}</span></div>}

        {payload?.pipeline?.map(stageKey => {
          const stage = payload.stages[stageKey]
          return (
            <Card key={stageKey}>
              <CardHeader>
                <CardTitle className="text-lg">{stageTitles[stageKey]}</CardTitle>
                <CardDescription>{stage.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="max-h-[520px] overflow-auto rounded-lg bg-slate-950 p-4 text-xs leading-relaxed text-slate-100">{JSON.stringify(stage, null, 2)}</pre>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </main>
  )
}
