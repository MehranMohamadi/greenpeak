"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Gauge } from "lucide-react"
import { AccountHeading, EmptyCollection, FieldGrid, accountKey, tradingCardClass, tradingCardContentClass, tradingCardHeaderClass } from "./mt5-data-view"

export default function RiskAndSymbols({ snapshots = [] }) {
  return <Card className={tradingCardClass}>
    <CardHeader className={tradingCardHeaderClass}>
      <CardTitle className="flex items-center gap-2 text-base text-gray-900 dark:text-white">
        <Gauge className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
        ریسک نماد و اجرای بروکر
      </CardTitle>
    </CardHeader>
    <CardContent className={`${tradingCardContentClass} space-y-3`}>
      {snapshots.map((snapshot) => {
        const riskBySymbol = new Map((snapshot.symbol_metrics || []).map((item) => [item.symbol, item]))
        const brokerBySymbol = new Map((snapshot.broker_symbol_data || []).map((item) => [item.symbol, item]))
        const symbols = [...new Set([...riskBySymbol.keys(), ...brokerBySymbol.keys()])]
        return <section key={accountKey(snapshot)} className="space-y-3 rounded-lg border bg-gray-50 p-3 dark:border-[#2B2B30] dark:bg-[#0F0F12]">
          <AccountHeading snapshot={snapshot} />
          {!symbols.length && <EmptyCollection>اطلاعات ریسک Symbol یا مشخصات Broker گزارش نشده است.</EmptyCollection>}
          {symbols.map((symbol) => <article key={symbol} className="space-y-3 border-t pt-3 dark:border-[#2B2B30]">
            <Badge variant="outline">{symbol || "نماد نامشخص"}</Badge>
            {riskBySymbol.has(symbol) && <div className="space-y-2">
              <h5 className="text-xs font-semibold text-muted-foreground">ریسک و Leverage</h5>
              <FieldGrid data={riskBySymbol.get(symbol)} currency={snapshot.account?.currency} />
            </div>}
            {brokerBySymbol.has(symbol) && <div className="space-y-2">
              <h5 className="text-xs font-semibold text-muted-foreground">مشخصات Quote و Contract</h5>
              <FieldGrid
                data={brokerBySymbol.get(symbol)}
                currency={snapshot.account?.currency}
                excludeFields={["swap_mode", "trade_calculation_mode", "execution_mode", "trading_status", "quote_timestamp_utc"]}
              />
            </div>}
          </article>)}
        </section>
      })}
    </CardContent>
  </Card>
}
