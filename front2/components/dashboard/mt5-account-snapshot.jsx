"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, RefreshCw, Server } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import BrokerAccounts from "@/components/kokonutui/broker-accounts"
import LastTrades from "@/components/kokonutui/last-trades"
import PendingOrders from "@/components/kokonutui/pending-orders"
import Portfolio from "@/components/kokonutui/portfolio"
import RiskAndSymbols from "@/components/kokonutui/risk-and-symbols"
import TradingPositions from "@/components/kokonutui/trading-positions"

export default function MT5AccountSnapshot() {
  const [snapshots, setSnapshots] = useState([])
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch("/dashboard-data/mt5/accounts", { cache: "no-store" })
      const body = await response.json()
      if (!response.ok) throw new Error(body.detail || "Unable to load trading accounts")
      setSnapshots(body)
      setError("")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load trading accounts")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading && snapshots.length === 0) {
    return <Card className="border-gray-200 bg-white dark:border-[#2B2B30] dark:bg-[#1F1F23]">
      <CardContent className="flex items-center gap-3 p-5 text-sm text-muted-foreground">
        <RefreshCw className="h-4 w-4 animate-spin" />Loading connected trading accounts…
      </CardContent>
    </Card>
  }

  if (snapshots.length === 0) {
    return <Card className="border-gray-200 bg-white dark:border-[#2B2B30] dark:bg-[#1F1F23]">
      <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <div><p className="font-medium">No trading account snapshot is available</p><p className="text-sm text-muted-foreground">{error || "Connect an account and send its first snapshot."}</p></div>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Retry</Button>
      </CardContent>
    </Card>
  }

  const latestTimestamp = snapshots.reduce((latest, snapshot) => {
    const value = new Date(snapshot.timestamp_utc).getTime()
    return Number.isFinite(value) && value > latest ? value : latest
  }, 0)

  return <section className="space-y-4" aria-labelledby="trading-accounts-title">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <div className="flex items-center gap-2">
          <Server className="h-5 w-5 text-emerald-500" />
          <h2 id="trading-accounts-title" className="text-lg font-semibold text-gray-900 dark:text-white">Connected Trading Accounts</h2>
          <Badge variant="secondary">{snapshots.length}</Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Latest account, portfolio, order, trade and broker data.</p>
      </div>
      <div className="flex items-center gap-2">
        {latestTimestamp > 0 && <span className="text-xs tabular-nums text-muted-foreground">Latest snapshot {new Date(latestTimestamp).toLocaleString("en-GB", { hour12: false })}</span>}
        <Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</Button>
      </div>
    </div>
    {error && <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">The refresh failed; showing the last successfully loaded snapshots. {error}</p>}
    <div className="grid grid-cols-1 gap-4 md:gap-6 xl:grid-cols-2">
      <Portfolio snapshots={snapshots} />
      <LastTrades snapshots={snapshots} />
      <BrokerAccounts snapshots={snapshots} />
      <TradingPositions snapshots={snapshots} />
      <PendingOrders snapshots={snapshots} />
      <RiskAndSymbols snapshots={snapshots} />
    </div>
  </section>
}
