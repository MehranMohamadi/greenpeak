"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Building2 } from "lucide-react"
import { AccountHeading, FieldGrid, accountKey, tradingCardClass, tradingCardContentClass, tradingCardHeaderClass } from "./mt5-data-view"

export default function BrokerAccounts({ snapshots = [] }) {
  return <Card className={tradingCardClass}>
    <CardHeader className={tradingCardHeaderClass}>
      <CardTitle className="flex items-center gap-2 text-base text-gray-900 dark:text-white">
        <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        حسابهای بروکر
        <Badge variant="secondary">{snapshots.length}</Badge>
      </CardTitle>
    </CardHeader>
    <CardContent className={`${tradingCardContentClass} space-y-3`}>
      {snapshots.map((snapshot) => {
        return <section key={accountKey(snapshot)} className="space-y-3 rounded-lg border bg-gray-50 p-3 dark:border-[#2B2B30] dark:bg-[#0F0F12]">
          <AccountHeading snapshot={snapshot} showAccountIdentifier={false} showTradeServer={false} />
          <FieldGrid
            data={snapshot.source}
            currency={snapshot.account?.currency}
            excludeFields={["account_identifier", "trade_server", "terminal_build", "ea_version", "send_mode"]}
          />
        </section>
      })}
    </CardContent>
  </Card>
}
