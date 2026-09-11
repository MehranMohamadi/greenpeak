"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Activity } from "lucide-react"
import { AccountBadge, EmptyCollection, FieldGrid, tradingCardClass, tradingCardContentClass, tradingCardHeaderClass } from "./mt5-data-view"

export default function LastTrades({ snapshots = [] }) {
  const trades = snapshots
    .flatMap((snapshot) => (snapshot.trade_history_delta || []).map((trade) => ({ snapshot, trade })))
    .sort((left, right) => new Date(right.trade.timestamp_utc || 0) - new Date(left.trade.timestamp_utc || 0))

  return <Card className={tradingCardClass}>
    <CardHeader className={tradingCardHeaderClass}>
      <CardTitle className="flex items-center gap-2 text-base text-gray-900 dark:text-white">
        <Activity className="h-5 w-5 text-green-600 dark:text-green-400" />
        معاملات اخیر
        <Badge variant="secondary">{trades.length}</Badge>
      </CardTitle>
    </CardHeader>
    <CardContent className={`${tradingCardContentClass} space-y-2`}>
      {!trades.length && <EmptyCollection>معاملهٔ اجراشده‌ای در بازهٔ فعلی گزارش نشده است.</EmptyCollection>}
      {trades.map(({ snapshot, trade }, index) => <article key={`${snapshot.snapshot_id}-${trade.deal_identifier || index}`} className="space-y-2 rounded-lg border bg-gray-50 p-3 dark:border-[#2B2B30] dark:bg-[#0F0F12]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2"><Badge variant="outline">{trade.direction || "Deal"}</Badge><span className="text-sm font-semibold">{trade.symbol || "نماد نامشخص"}</span></div>
          <AccountBadge snapshot={snapshot} />
        </div>
        <FieldGrid data={trade} currency={snapshot.account?.currency} />
      </article>)}
    </CardContent>
  </Card>
}
