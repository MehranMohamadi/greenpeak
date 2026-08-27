"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, BriefcaseBusiness, RefreshCw } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

const money = (value, currency = "USD") => value == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(value)
const number = (value, suffix = "") => value == null ? "—" : `${Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 })}${suffix}`

export default function MT5AccountSnapshot() {
  const [snapshot, setSnapshot] = useState(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/mt5/latest", { cache: "no-store" })
      const body = await response.json()
      if (!response.ok) throw new Error(body.detail || "Unable to load MT5 snapshot")
      setSnapshot(body)
      setError("")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load MT5 snapshot")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  if (!snapshot) {
    return (
      <Card className="border-gray-200 bg-white dark:border-[#2B2B30] dark:bg-[#1F1F23]">
        <CardContent className="flex items-center justify-between gap-4 p-5">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <div><p className="font-medium">MT5 account snapshot unavailable</p><p className="text-sm text-muted-foreground">{loading ? "Checking GreenPeak…" : error}</p></div>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Retry</Button>
        </CardContent>
      </Card>
    )
  }

  const { account, portfolio_metrics: portfolio, source, positions = [], pending_orders: orders = [], swap_metrics: swap = {} } = snapshot
  const ageMinutes = Math.max(0, Math.floor((Date.now() - new Date(snapshot.timestamp_utc).getTime()) / 60000))
  const stale = ageMinutes > 15
  const metrics = [
    ["Balance", money(account.balance, account.currency)], ["Equity", money(account.equity, account.currency)],
    ["Floating P/L", money(account.floating_profit_loss, account.currency)], ["Free margin", money(account.free_margin, account.currency)],
    ["Net portfolio exposure", money(portfolio.net_portfolio_exposure_usd)], ["Gross portfolio exposure", money(portfolio.gross_portfolio_exposure_usd)],
    ["Gross leverage", number(portfolio.gross_portfolio_leverage, "×")], ["Current drawdown", number(portfolio.account_current_drawdown_pct, "%")],
    ["Annualized swap run-rate", money(swap.portfolio_annualized_swap_cost_usd)], ["Swap burden / equity", number(swap.portfolio_annual_swap_burden_pct_equity, "%")],
  ]

  return (
    <Card className="border-gray-200 bg-white dark:border-[#2B2B30] dark:bg-[#1F1F23]">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2"><BriefcaseBusiness className="h-5 w-5 text-emerald-500" />MT5 Portfolio</CardTitle>
          <div className="flex items-center gap-2"><Badge variant={stale ? "destructive" : "secondary"}>{stale ? `Stale · ${ageMinutes}m` : `Updated ${ageMinutes}m ago`}</Badge><Button variant="ghost" size="icon" onClick={load} aria-label="Refresh MT5 snapshot"><RefreshCw className="h-4 w-4" /></Button></div>
        </div>
        <p className="text-sm text-muted-foreground">{source.broker_company} · {source.trade_server} · Account {source.account_identifier}</p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">{metrics.map(([label, value]) => <div key={label} className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-semibold tabular-nums">{value}</p></div>)}</div>
        <div className="overflow-x-auto"><h3 className="mb-2 font-medium">Open positions ({positions.length})</h3><table className="w-full min-w-[760px] text-sm"><thead className="text-left text-muted-foreground"><tr><th className="py-2">Symbol</th><th>Side</th><th>Volume</th><th>Entry</th><th>Current</th><th>P/L</th><th>SL</th><th>TP</th><th>Swap</th></tr></thead><tbody>{positions.map((position) => <tr className="border-t" key={position.position_identifier}><td className="py-2 font-medium">{position.symbol}</td><td>{position.direction}</td><td>{number(position.volume)}</td><td>{number(position.open_price)}</td><td>{number(position.current_valuation_price)}</td><td>{money(position.current_profit_loss, account.currency)}</td><td>{number(position.stop_loss)}</td><td>{number(position.take_profit)}</td><td>{money(position.accrued_swap, account.currency)}</td></tr>)}</tbody></table>{positions.length === 0 && <p className="py-3 text-sm text-muted-foreground">No open positions.</p>}</div>
        <p className="text-xs text-muted-foreground">Pending orders: {orders.length} · Snapshot {snapshot.snapshot_id} · Schema {snapshot.schema_version}</p>
      </CardContent>
    </Card>
  )
}
