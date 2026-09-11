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
      if (!response.ok) throw new Error(response.status === 503 ? "سرویس حساب‌های معاملاتی در دسترس نیست" : "دریافت حساب‌های معاملاتی ممکن نشد")
      setSnapshots(body)
      setError("")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "دریافت حساب‌های معاملاتی ممکن نشد")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading && snapshots.length === 0) {
    return <Card className="border-gray-200 bg-white dark:border-[#2B2B30] dark:bg-[#1F1F23]">
      <CardContent className="flex items-center gap-3 p-4 text-sm text-muted-foreground" dir="rtl">
        <RefreshCw className="h-4 w-4 animate-spin" />در حال دریافت حساب‌های معاملاتی…
      </CardContent>
    </Card>
  }

  if (snapshots.length === 0) {
    return <Card className="border-gray-200 bg-white dark:border-[#2B2B30] dark:bg-[#1F1F23]">
      <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4" dir="rtl">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <div><p className="font-medium">Snapshot حساب معاملاتی موجود نیست</p><p className="text-sm text-muted-foreground">{error || "یک حساب را متصل و اولین Snapshot را ارسال کنید."}</p></div>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw className={`ml-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />تلاش دوباره</Button>
      </CardContent>
    </Card>
  }

  return <section className="space-y-3" aria-labelledby="trading-accounts-title" dir="rtl">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Server className="h-5 w-5 text-emerald-500" />
        <h2 id="trading-accounts-title" className="text-lg font-semibold text-gray-900 dark:text-white">حساب‌های معاملاتی متصل</h2>
        <Badge variant="secondary">{snapshots.length}</Badge>
      </div>
      <Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw className={`ml-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />به‌روزرسانی</Button>
    </div>
    {error && <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">به‌روزرسانی انجام نشد؛ آخرین Snapshot سالم نمایش داده می‌شود. {error}</p>}
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-2 2xl:grid-cols-3">
      <Portfolio snapshots={snapshots} />
      <LastTrades snapshots={snapshots} />
      <BrokerAccounts snapshots={snapshots} />
      <TradingPositions snapshots={snapshots} />
      <PendingOrders snapshots={snapshots} />
      <RiskAndSymbols snapshots={snapshots} />
    </div>
  </section>
}
