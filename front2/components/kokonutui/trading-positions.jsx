"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Target } from "lucide-react"
import { AccountBadge, EmptyCollection, FieldGrid, tradingCardClass, tradingCardContentClass, tradingCardHeaderClass } from "./mt5-data-view"

export default function TradingPositions({ snapshots = [] }) {
  const positions = snapshots.flatMap((snapshot) => (snapshot.positions || []).map((position) => ({ snapshot, position })))

  return <Card className={tradingCardClass}>
    <CardHeader className={tradingCardHeaderClass}>
      <CardTitle className="flex items-center gap-2 text-base text-gray-900 dark:text-white">
        <Target className="h-5 w-5 text-orange-600 dark:text-orange-400" />
        پوزیشن‌های باز
        <Badge variant="secondary">{positions.length}</Badge>
      </CardTitle>
    </CardHeader>
    <CardContent className={`${tradingCardContentClass} space-y-2`}>
      {!positions.length && <EmptyCollection>پوزیشن بازی گزارش نشده است.</EmptyCollection>}
      {positions.map(({ snapshot, position }, index) => <article key={`${snapshot.snapshot_id}-${position.position_identifier || index}`} className="space-y-2 rounded-lg border bg-gray-50 p-3 dark:border-[#2B2B30] dark:bg-[#0F0F12]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2"><Badge variant="outline">{position.direction || "Position"}</Badge><span className="text-sm font-semibold">{position.symbol || "نماد نامشخص"}</span></div>
          <AccountBadge snapshot={snapshot} />
        </div>
        <FieldGrid data={position} currency={snapshot.account?.currency} />
      </article>)}
    </CardContent>
  </Card>
}
