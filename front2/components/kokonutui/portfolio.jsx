"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PieChart } from "lucide-react"
import { AccountHeading, FieldGrid, accountKey, tradingCardClass } from "./mt5-data-view"

export default function Portfolio({ snapshots = [] }) {
  return <Card className={`${tradingCardClass} h-full`}>
    <CardHeader className="pb-3">
      <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
        <PieChart className="h-5 w-5 text-purple-600 dark:text-purple-400" />
        Account &amp; Portfolio
      </CardTitle>
      <p className="text-sm text-muted-foreground">Capital, margin, exposure, leverage and financing by connected account.</p>
    </CardHeader>
    <CardContent className="max-h-[38rem] space-y-5 overflow-y-auto">
      {snapshots.map((snapshot) => <section key={accountKey(snapshot)} className="space-y-4 rounded-lg border bg-gray-50 p-4 dark:border-[#2B2B30] dark:bg-[#0F0F12]">
        <AccountHeading snapshot={snapshot} />
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Account capital &amp; margin</h4>
          <FieldGrid data={snapshot.account} currency={snapshot.account?.currency} />
        </div>
        <div className="space-y-2 border-t pt-3 dark:border-[#2B2B30]">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Portfolio exposure &amp; risk</h4>
          <FieldGrid data={snapshot.portfolio_metrics} currency={snapshot.account?.currency} />
        </div>
        <div className="space-y-2 border-t pt-3 dark:border-[#2B2B30]">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Swap &amp; financing</h4>
          <FieldGrid data={snapshot.swap_metrics} currency={snapshot.account?.currency} />
        </div>
      </section>)}
    </CardContent>
  </Card>
}
