"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Building2 } from "lucide-react"
import { AccountHeading, FieldGrid, accountKey, tradingCardClass } from "./mt5-data-view"

const knownRootFields = new Set([
  "schema_version", "snapshot_id", "timestamp_utc", "received_at_utc", "source", "account",
  "portfolio_metrics", "symbol_metrics", "positions", "pending_orders", "broker_symbol_data",
  "swap_metrics", "trade_history_delta", "calculation_status",
])

export default function BrokerAccounts({ snapshots = [] }) {
  return <Card className={`${tradingCardClass} h-full`}>
    <CardHeader className="pb-3">
      <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
        <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        Broker Accounts
        <Badge variant="secondary">{snapshots.length}</Badge>
      </CardTitle>
      <p className="text-sm text-muted-foreground">Connection identity, terminal version and snapshot provenance.</p>
    </CardHeader>
    <CardContent className="max-h-[34rem] space-y-4 overflow-y-auto">
      {snapshots.map((snapshot) => {
        const ageMinutes = Math.max(0, Math.floor((Date.now() - new Date(snapshot.timestamp_utc).getTime()) / 60000))
        const stale = ageMinutes > 15
        const extras = Object.fromEntries(Object.entries(snapshot).filter(([key]) => !knownRootFields.has(key)))
        return <section key={accountKey(snapshot)} className="space-y-4 rounded-lg border bg-gray-50 p-4 dark:border-[#2B2B30] dark:bg-[#0F0F12]">
          <AccountHeading snapshot={snapshot}>
            <Badge variant={stale ? "destructive" : "secondary"}>{stale ? `Stale · ${ageMinutes}m` : `Updated ${ageMinutes}m ago`}</Badge>
          </AccountHeading>
          <FieldGrid data={snapshot.source} currency={snapshot.account?.currency} />
          <div className="space-y-2 border-t pt-3 dark:border-[#2B2B30]">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Snapshot provenance</h4>
            <FieldGrid data={{ snapshot_id: snapshot.snapshot_id, schema_version: snapshot.schema_version, timestamp_utc: snapshot.timestamp_utc, received_at_utc: snapshot.received_at_utc }} />
          </div>
          {!!Object.keys(extras).length && <div className="space-y-2 border-t pt-3 dark:border-[#2B2B30]">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Additional snapshot fields</h4>
            <FieldGrid data={extras} currency={snapshot.account?.currency} />
          </div>}
        </section>
      })}
    </CardContent>
  </Card>
}
