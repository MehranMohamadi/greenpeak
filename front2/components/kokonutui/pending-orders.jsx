"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ListOrdered } from "lucide-react"
import { AccountBadge, EmptyCollection, FieldGrid, tradingCardClass } from "./mt5-data-view"

export default function PendingOrders({ snapshots = [] }) {
  const orders = snapshots.flatMap((snapshot) => (snapshot.pending_orders || []).map((order) => ({ snapshot, order })))

  return <Card className={`${tradingCardClass} h-full`}>
    <CardHeader className="pb-3">
      <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
        <ListOrdered className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        Pending Orders
        <Badge variant="secondary">{orders.length}</Badge>
      </CardTitle>
      <p className="text-sm text-muted-foreground">Order type, requested price, protection, expiry and strategy identifiers.</p>
    </CardHeader>
    <CardContent className="max-h-[34rem] space-y-3 overflow-y-auto">
      {!orders.length && <EmptyCollection>No pending orders were reported.</EmptyCollection>}
      {orders.map(({ snapshot, order }, index) => <article key={`${snapshot.snapshot_id}-${order.ticket || index}`} className="space-y-3 rounded-lg border bg-gray-50 p-4 dark:border-[#2B2B30] dark:bg-[#0F0F12]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2"><Badge variant="outline">{order.order_type ?? order.type ?? "Order"}</Badge><span className="font-semibold">{order.symbol || "Unknown symbol"}</span></div>
          <AccountBadge snapshot={snapshot} />
        </div>
        <FieldGrid data={order} currency={snapshot.account?.currency} />
      </article>)}
    </CardContent>
  </Card>
}
