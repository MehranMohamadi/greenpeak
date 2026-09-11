"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Target } from "lucide-react"
import { AccountBadge, EmptyCollection, FieldGrid, tradingCardClass } from "./mt5-data-view"

export default function TradingPositions({ snapshots = [] }) {
  const positions = snapshots.flatMap((snapshot) => (snapshot.positions || []).map((position) => ({ snapshot, position })))

  return <Card className={`${tradingCardClass} h-full`}>
    <CardHeader className="pb-3">
      <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
        <Target className="h-5 w-5 text-orange-600 dark:text-orange-400" />
        Open Positions
        <Badge variant="secondary">{positions.length}</Badge>
      </CardTitle>
      <p className="text-sm text-muted-foreground">Live valuation, protection levels, financing and identifiers for every position.</p>
    </CardHeader>
    <CardContent className="max-h-[38rem] space-y-3 overflow-y-auto">
      {!positions.length && <EmptyCollection>No open positions were reported.</EmptyCollection>}
      {positions.map(({ snapshot, position }, index) => <article key={`${snapshot.snapshot_id}-${position.position_identifier || index}`} className="space-y-3 rounded-lg border bg-gray-50 p-4 dark:border-[#2B2B30] dark:bg-[#0F0F12]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2"><Badge variant="outline">{position.direction || "Position"}</Badge><span className="font-semibold">{position.symbol || "Unknown symbol"}</span></div>
          <AccountBadge snapshot={snapshot} />
        </div>
        <FieldGrid data={position} currency={snapshot.account?.currency} />
      </article>)}
    </CardContent>
  </Card>
}
