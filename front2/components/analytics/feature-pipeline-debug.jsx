"use client"

import { useEffect, useRef, useState } from "react"
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

const createMockPayload = selected => {
  const isTreasury = selected.id === "us_10y_treasury_yield"
  const currentValue = isTreasury ? 4.18 : 5.33
  const observations = [
    { date: "2025-01-02", value: isTreasury ? 4.57 : 5.33 },
    { date: "2025-02-03", value: isTreasury ? 4.54 : 5.33 },
    { date: "2025-03-03", value: currentValue },
  ]
  const features = {
    current_value_pct: currentValue,
    delta_30d_bp: isTreasury ? -36 : 0,
    mean_30d_pct: isTreasury ? 4.31 : 5.33,
    z_score_1y: isTreasury ? 0.42 : 1.16,
    percentile_5y: isTreasury ? 78.4 : 96.2,
    slope_90d_bp_per_day: isTreasury ? -0.31 : 0,
  }
  const snapshot = {
    schema_version: "mock-1.0",
    feature_version: "mock-demo",
    definition_version: "mock-demo",
    indicator_id: selected.id,
    as_of_date: "2025-03-03",
    source: { provider: "Mock data", series_id: selected.series, is_mock: true },
    current: { observation_date: "2025-03-03", value_pct: currentValue },
    features,
    feature_reasons: {},
    derived_features: {},
    state: { direction_90d: isTreasury ? "falling" : "stable" },
    quality: { status: "mock", flags: ["MOCK_DATA_NOT_FOR_ANALYSIS"] },
  }

  return {
    indicator_id: selected.id,
    as_of_date: snapshot.as_of_date,
    source_stage: "mock_fallback",
    is_mock: true,
    pipeline: Object.keys(stageTitles),
    stages: {
      raw_input: { description: "Complete mock observations used for this manual demonstration.", total_count: observations.length, records: observations },
      canonical_adapter: { description: "Mock raw fields mapped to the canonical contract.", total_count: observations.length, sample_last_10: observations.map(item => ({ indicator_id: selected.id, observation_date: item.date, value_pct: item.value, source_series_id: selected.series, is_valid: true })) },
      cleaned_series: { description: "Mock observations sorted and prepared for this UI demonstration.", received_count: observations.length, valid_count: observations.length, flags: ["MOCK_DATA"], sample_last_10: observations },
      calculated_features: { description: "Predefined mock features; these values were not calculated from live market data.", features, feature_reasons: {}, derived_features: {}, state: snapshot.state, quality: snapshot.quality },
      validated_snapshot: { description: "Mock snapshot matching the pipeline display shape; it is never persisted.", snapshot },
    },
  }
}

export default function FeaturePipelineDebug() {
  const [indicator, setIndicator] = useState(indicators[0].id)
  const [payload, setPayload] = useState(null)
  const [error, setError] = useState("")
  const [isMock, setIsMock] = useState(false)
  const [loading, setLoading] = useState(false)
  const requestController = useRef(null)

  const load = async () => {
    requestController.current?.abort()
    const controller = new AbortController()
    requestController.current = controller
    setLoading(true); setError(""); setIsMock(false)
    const selected = indicators.find(item => item.id === indicator)
    try {
      const startDate = new Date()
      startDate.setUTCFullYear(startDate.getUTCFullYear() - 6)
      const separator = selected.rawUrl.includes("?") ? "&" : "?"
      const rawResponse = await fetch(`${selected.rawUrl}${separator}start_date=${startDate.toISOString().slice(0, 10)}`, { cache: "no-store", signal: controller.signal })
      const rawBody = await rawResponse.json()
      if (!rawResponse.ok) throw new Error(rawBody?.detail || `Raw data request failed (${rawResponse.status})`)
      const observations = (rawBody.data || []).map(item => ({ date: item.date, value: item.value ?? item.rate }))
      const response = await fetch(endpoints.indicatorFeatures.pipelinePreview, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ indicator_id: selected.id, source_series_id: selected.series, source_provider: rawBody.metadata?.source || "GreenPeak existing API", observations }),
        signal: controller.signal,
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body?.detail?.message || `Pipeline preview failed (${response.status})`)
      const rawRecords = (rawBody.data || []).map(item => ({
        date: item.date,
        value: item.value ?? item.rate,
        fred_series_id: selected.series,
        source: rawBody.metadata?.source || "GreenPeak existing API",
      }))
      setPayload({
        ...body.data,
        stages: {
          ...body.data.stages,
          raw_input: {
            ...body.data.stages.raw_input,
            description: "Complete read-only observations received from the existing monetary API.",
            total_count: rawRecords.length,
            sample_last_10: undefined,
            records: rawRecords,
          },
        },
      })
    } catch (requestError) {
      if (controller.signal.aborted) return
      setPayload(null)
      setError(requestError instanceof Error ? requestError.message : "Pipeline preview is unavailable.")
    } finally {
      if (requestController.current === controller) {
        requestController.current = null
        setLoading(false)
      }
    }
  }

  const showMock = () => {
    requestController.current?.abort()
    requestController.current = null
    const selected = indicators.find(item => item.id === indicator)
    setPayload(createMockPayload(selected))
    setError("")
    setIsMock(true)
    setLoading(false)
  }

  useEffect(() => {
    if (isMock) {
      const selected = indicators.find(item => item.id === indicator)
      setPayload(createMockPayload(selected))
      return
    }
    const timer = window.setTimeout(load, 0)
    return () => window.clearTimeout(timer)
  }, [indicator])

  useEffect(() => () => requestController.current?.abort(), [])

  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-blue-600"><Database className="h-4 w-4" /> Developer View</div>
            <h1 className="text-3xl font-bold">Rate Feature Pipeline JSON</h1>
            <p className="mt-2 text-muted-foreground">‏دادهٔ موجود پروژه وارد ‎Python‎ می‌شود و خروجی هر تبدیل را مرحله‌به‌مرحله می‌بینی؛ فرانت فقط نمایش می‌دهد.</p>
          </div>
          <Badge variant={isMock ? "destructive" : "outline"}>{isMock ? "MOCK DATA" : "live pipeline view"}</Badge>
        </div>

        <Card>
          <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
            <select value={indicator} onChange={event => setIndicator(event.target.value)} className="h-10 flex-1 rounded-md border bg-background px-3 text-sm">
              {indicators.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
            <Button onClick={load} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
            {isMock ? (
              <Button variant="outline" onClick={load} disabled={loading}>‏بازگشت به دادهٔ واقعی</Button>
            ) : (
              <Button variant="outline" onClick={showMock}>‏{loading ? "لغو دریافت و نمایش ماک" : "نمایش دادهٔ ماک"}</Button>
            )}
          </CardContent>
        </Card>

        {error && <div className="flex gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-amber-700 dark:text-amber-300"><AlertTriangle className="h-5 w-5 shrink-0" /><div><div className="font-medium">‏خروجی واقعی فعلاً قابل دریافت نیست.</div><div className="mt-1 text-sm">‏علت خطای ‎API‎: <span dir="ltr">{error}</span></div><div className="mt-1 text-sm">‏برای مشاهدهٔ نمونه، دکمهٔ «نمایش دادهٔ ماک» را انتخاب کنید.</div></div></div>}

        {payload && <div className={`flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm ${isMock ? "border-amber-500/40 bg-amber-500/5" : ""}`}><span className="text-muted-foreground">Input source:</span><Badge variant={isMock ? "destructive" : "outline"}>{payload.source_stage}</Badge>{isMock && <Badge variant="destructive">NOT LIVE / MOCK</Badge>}<span className="text-muted-foreground">As of:</span><span className="font-mono">{payload.as_of_date}</span></div>}

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
