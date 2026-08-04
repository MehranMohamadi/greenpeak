"use client"

import { useCallback, useEffect, useState } from "react"
import { Activity, AlertTriangle, CheckCircle2, Play, RefreshCw } from "lucide-react"

import { endpoints } from "@/api/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const units = ["percent", "decimal", "basis_point"]

const signalStyles = {
  bullish: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  bearish: "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400",
  neutral: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  risk: "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400",
}

export default function AnalysisPipeline() {
  const [value, setValue] = useState("3.65")
  const [unit, setUnit] = useState("percent")
  const [result, setResult] = useState(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)

  const runPipeline = useCallback(async () => {
    const numericValue = Number(value)
    if (!Number.isFinite(numericValue)) {
      setError("Enter a valid finite number.")
      return
    }

    setLoading(true)
    setError("")
    try {
      const now = new Date().toISOString()
      const response = await fetch(endpoints.analysis.prepare, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          market: "SP500",
          as_of: now,
          items: [{
            type: "metric",
            id: "fed_funds_rate",
            title: "Federal Funds Rate",
            value: numericValue,
            unit,
            timestamp: now,
            source: "FRED",
          }],
        }),
      })
      if (!response.ok) {
        const detail = await response.json().catch(() => null)
        throw new Error(detail?.detail?.[0]?.msg || detail?.detail || `Request failed (${response.status})`)
      }
      setResult(await response.json())
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not reach the analysis API.")
    } finally {
      setLoading(false)
    }
  }, [unit, value])

  useEffect(() => {
    runPipeline()
  }, []) // Run the documented example once when the page opens.

  const context = result?.data
  const metric = context?.normalized_items?.[0]
  const feature = context?.features?.fed_funds_rate
  const signal = context?.signals?.[0]
  const quality = context?.data_quality

  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
              <Activity className="h-4 w-4" /> GreenPeak Analysis Pipeline
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Prepared Market Context</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Deterministic normalization, feature extraction, and rule evaluation for S&amp;P 500 inputs.
            </p>
          </div>
          <Badge variant="outline" className="w-fit">deterministic_v1</Badge>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pipeline input</CardTitle>
            <CardDescription>Change the federal funds rate and run the preparation pipeline again.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <div className="space-y-2">
              <Label htmlFor="rate-value">Value</Label>
              <Input id="rate-value" type="number" step="any" value={value} onChange={(event) => setValue(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rate-unit">Unit</Label>
              <select
                id="rate-unit"
                value={unit}
                onChange={(event) => setUnit(event.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {units.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>
            <Button onClick={runPipeline} disabled={loading}>
              {loading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
              Run pipeline
            </Button>
          </CardContent>
        </Card>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
            <AlertTriangle className="h-5 w-5 shrink-0" /> {error}
          </div>
        )}

        {context && (
          <>
            <section className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>Original value</CardDescription>
                  <CardTitle className="text-3xl">{metric?.value}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">Unit: {metric?.unit}</CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>Normalized value</CardDescription>
                  <CardTitle className="text-3xl text-emerald-600 dark:text-emerald-400">{metric?.normalized_value}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">Display: {metric?.display_value}</CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>Data quality</CardDescription>
                  <CardTitle className="flex items-center gap-2 text-3xl">
                    <CheckCircle2 className="h-7 w-7 text-emerald-500" /> {quality?.warning_count ?? 0}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">Quality warnings</CardContent>
              </Card>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Extracted features</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Row label="Metric" value="fed_funds_rate" />
                  <Row label="Current value" value={feature?.current_value} />
                  <Row label="Normalized value" value={feature?.normalized_value} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-3 text-lg">
                    Rule signal
                    {signal && <Badge variant="outline" className={signalStyles[signal.direction]}>{signal.direction}</Badge>}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {signal ? (
                    <>
                      <p className="text-sm text-muted-foreground">{signal.message}</p>
                      <Row label="Severity" value={signal.severity} />
                      <Row label="Confidence" value={`${Math.round(signal.confidence * 100)}%`} />
                      <Row label="Rule" value={signal.rule_id} />
                    </>
                  ) : <p className="text-sm text-muted-foreground">No signal was produced.</p>}
                </CardContent>
              </Card>
            </section>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Raw API response</CardTitle>
                <CardDescription>The complete prepared context returned by FastAPI.</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="max-h-[480px] overflow-auto rounded-lg bg-slate-950 p-4 text-xs leading-relaxed text-slate-100">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </main>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b pb-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-medium">{String(value ?? "—")}</span>
    </div>
  )
}
