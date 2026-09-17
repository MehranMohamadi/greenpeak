"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { AlertTriangle, Database, RefreshCw } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

function errorMessage(value, fallback) {
  if (typeof value === "string") return value
  if (value?.detail) return errorMessage(value.detail, fallback)
  if (value?.message) return value.message
  return fallback
}

export default function MT5SnapshotsDebug() {
  const [snapshots, setSnapshots] = useState([])
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const requestController = useRef(null)

  const load = useCallback(async () => {
    requestController.current?.abort()
    const controller = new AbortController()
    requestController.current = controller
    setLoading(true)
    setError("")

    try {
      const response = await fetch("/dashboard-data/mt5/snapshots", {
        cache: "no-store",
        signal: controller.signal,
      })
      const body = await response.json()
      if (!response.ok) throw new Error(errorMessage(body, `Snapshot request failed (${response.status})`))
      if (!Array.isArray(body)) throw new Error("The snapshot response is not an array.")
      if (!controller.signal.aborted) setSnapshots(body)
    } catch (requestError) {
      if (!controller.signal.aborted) {
        setSnapshots([])
        setError(errorMessage(requestError, "MetaTrader snapshots are unavailable."))
      }
    } finally {
      if (requestController.current === controller) {
        requestController.current = null
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(load, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  useEffect(() => () => requestController.current?.abort(), [])

  const accountCount = new Set(snapshots.map((snapshot) => [
    snapshot.source?.broker_company,
    snapshot.source?.trade_server,
    snapshot.source?.account_identifier,
  ].join("::"))).size

  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-blue-600"><Database className="h-4 w-4" />Developer View</div>
            <h1 className="text-3xl font-bold">MetaTrader Snapshot JSON</h1>
            <p className="mt-2 text-muted-foreground">Every stored snapshot is shown below with its complete, unfiltered payload.</p>
          </div>
          <Button onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh
          </Button>
        </div>

        {error && <div className="flex gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-amber-700 dark:text-amber-300"><AlertTriangle className="h-5 w-5 shrink-0" /><div><div className="font-medium">Snapshot JSON is unavailable.</div><div className="mt-1 text-sm" dir="ltr">{error}</div><div className="mt-1 text-sm">No mock values are substituted.</div></div></div>}

        {!error && <div className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm">
          <span className="text-muted-foreground">Stored snapshots:</span><Badge variant="secondary">{snapshots.length}</Badge>
          <span className="ml-2 text-muted-foreground">Accounts:</span><Badge variant="outline">{accountCount}</Badge>
          {loading && <span className="ml-auto text-muted-foreground">Loading…</span>}
        </div>}

        {!loading && !error && snapshots.length === 0 && <Card><CardContent className="p-6 text-sm text-muted-foreground">No MetaTrader snapshots are stored.</CardContent></Card>}

        {snapshots.map((snapshot, index) => <Card key={snapshot.snapshot_id || index}>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="font-mono text-base">{snapshot.snapshot_id || `Snapshot ${index + 1}`}</CardTitle>
                <CardDescription className="mt-1">{snapshot.timestamp_utc || "Timestamp unavailable"}</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{snapshot.source?.broker_company || "Broker unavailable"}</Badge>
                <Badge variant="outline">{snapshot.source?.account_identifier || "Account unavailable"}</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <pre dir="ltr" className="max-h-[520px] overflow-auto rounded-lg bg-slate-950 p-4 text-xs leading-relaxed text-slate-100">{JSON.stringify(snapshot, null, 2)}</pre>
          </CardContent>
        </Card>)}
      </div>
    </main>
  )
}
