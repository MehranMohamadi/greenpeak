"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ListOrdered } from "lucide-react"
import { AccountBadge, EmptyCollection, FieldGrid, tradingCardClass, tradingCardContentClass, tradingCardHeaderClass } from "./mt5-data-view"

export default function PendingOrders({ snapshots = [] }) {
  const orders = snapshots.flatMap((snapshot) => (snapshot.pending_orders || []).map((order) => ({ snapshot, order })))

  return <Card className={tradingCardClass}>
    <CardHeader className={tradingCardHeaderClass}>
      <CardTitle className="flex items-center gap-2 text-base text-gray-900 dark:text-white">
        <ListOrdered className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        سفارش‌های در انتظار
        <Badge variant="secondary">{orders.length}</Badge>
      </CardTitle>
    </CardHeader>
    <CardContent className={`${tradingCardContentClass} space-y-2`}>
      {!orders.length && <EmptyCollection>سفارش در انتظاری گزارش نشده است.</EmptyCollection>}
      {orders.map(({ snapshot, order }, index) => <article key={`${snapshot.snapshot_id}-${order.ticket || index}`} className="space-y-2 rounded-lg border bg-gray-50 p-3 dark:border-[#2B2B30] dark:bg-[#0F0F12]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2"><Badge variant="outline">{order.order_type ?? order.type ?? "Order"}</Badge><span className="text-sm font-semibold">{order.symbol || "نماد نامشخص"}</span></div>
          <AccountBadge snapshot={snapshot} />
        </div>
        <FieldGrid data={order} currency={snapshot.account?.currency} />
      </article>)}
    </CardContent>
  </Card>
}
