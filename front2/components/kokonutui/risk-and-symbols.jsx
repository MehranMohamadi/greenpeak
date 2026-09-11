"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Gauge } from "lucide-react"
import { AccountHeading, EmptyCollection, FieldGrid, accountKey, tradingCardClass } from "./mt5-data-view"

export default function RiskAndSymbols({ snapshots = [] }) {
  return <Card className={`${tradingCardClass} h-full`}>
    <CardHeader className="pb-3">
      <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
        <Gauge className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
        Symbol Risk &amp; Broker Execution
      </CardTitle>
      <p className="text-sm text-muted-foreground">Per-symbol risk, live broker specifications and calculation quality.</p>
    </CardHeader>
    <CardContent className="max-h-[42rem] space-y-5 overflow-y-auto">
      {snapshots.map((snapshot) => {
        const riskBySymbol = new Map((snapshot.symbol_metrics || []).map((item) => [item.symbol, item]))
        const brokerBySymbol = new Map((snapshot.broker_symbol_data || []).map((item) => [item.symbol, item]))
        const symbols = [...new Set([...riskBySymbol.keys(), ...brokerBySymbol.keys()])]
        return <section key={accountKey(snapshot)} className="space-y-4 rounded-lg border bg-gray-50 p-4 dark:border-[#2B2B30] dark:bg-[#0F0F12]">
          <AccountHeading snapshot={snapshot} />
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Calculation status</h4>
            <FieldGrid data={snapshot.calculation_status} currency={snapshot.account?.currency} />
          </div>
          {!symbols.length && <EmptyCollection>No symbol risk or broker specification data was reported.</EmptyCollection>}
          {symbols.map((symbol) => <article key={symbol} className="space-y-4 border-t pt-4 dark:border-[#2B2B30]">
            <Badge variant="outline">{symbol || "Unknown symbol"}</Badge>
            {riskBySymbol.has(symbol) && <div className="space-y-2">
              <h5 className="text-xs font-semibold text-muted-foreground">Risk &amp; leverage</h5>
              <FieldGrid data={riskBySymbol.get(symbol)} currency={snapshot.account?.currency} />
            </div>}
            {brokerBySymbol.has(symbol) && <div className="space-y-2">
              <h5 className="text-xs font-semibold text-muted-foreground">Quote &amp; contract specification</h5>
              <FieldGrid data={brokerBySymbol.get(symbol)} currency={snapshot.account?.currency} />
            </div>}
          </article>)}
        </section>
      })}
    </CardContent>
  </Card>
}
