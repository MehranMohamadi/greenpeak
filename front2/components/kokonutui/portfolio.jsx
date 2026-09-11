"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PieChart } from "lucide-react"
import { AccountHeading, FieldGrid, accountKey, tradingCardClass, tradingCardContentClass, tradingCardHeaderClass } from "./mt5-data-view"

export default function Portfolio({ snapshots = [] }) {
  return <Card className={tradingCardClass}>
    <CardHeader className={tradingCardHeaderClass}>
      <CardTitle className="flex items-center gap-2 text-base text-gray-900 dark:text-white">
        <PieChart className="h-5 w-5 text-purple-600 dark:text-purple-400" />
        حساب و Portfolio
      </CardTitle>
    </CardHeader>
    <CardContent className={`${tradingCardContentClass} space-y-3`}>
      {snapshots.map((snapshot) => <section key={accountKey(snapshot)} className="space-y-3 rounded-lg border bg-gray-50 p-3 dark:border-[#2B2B30] dark:bg-[#0F0F12]">
        <AccountHeading snapshot={snapshot} />
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground">سرمایه و Margin حساب</h4>
          <FieldGrid data={snapshot.account} currency={snapshot.account?.currency} />
        </div>
        <div className="space-y-2 border-t pt-3 dark:border-[#2B2B30]">
          <h4 className="text-xs font-semibold text-muted-foreground">Exposure و ریسک Portfolio</h4>
          <FieldGrid data={snapshot.portfolio_metrics} currency={snapshot.account?.currency} />
        </div>
        <div className="space-y-2 border-t pt-3 dark:border-[#2B2B30]">
          <h4 className="text-xs font-semibold text-muted-foreground">Swap و تأمین مالی</h4>
          <FieldGrid data={snapshot.swap_metrics} currency={snapshot.account?.currency} />
        </div>
      </section>)}
    </CardContent>
  </Card>
}
