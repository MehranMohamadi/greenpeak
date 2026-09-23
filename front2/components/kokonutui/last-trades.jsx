"use client"

import { useMemo, useState } from "react"
import { Activity, ChevronDown } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  buildTradeLifecycles,
  formatHoldingDuration,
  formatTradeMoney,
  formatTradeNumber,
  formatTradeTime,
} from "@/lib/mt5-trade-lifecycles"
import { EmptyCollection, tradingCardClass, tradingCardContentClass, tradingCardHeaderClass } from "./mt5-data-view"

const filters = [
  { id: "all", label: "همه" },
  { id: "open", label: "باز" },
  { id: "closed", label: "بسته‌شده" },
]

const valueTone = (value) => value > 0
  ? "text-emerald-600 dark:text-emerald-400"
  : value < 0
    ? "text-rose-600 dark:text-rose-400"
    : "text-gray-700 dark:text-gray-200"

const directionTone = (direction) => direction === "long"
  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
  : direction === "short"
    ? "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
    : ""

const statusTone = (status) => status === "closed"
  ? "border-gray-400/30 bg-gray-500/10 text-muted-foreground"
  : status === "partial"
    ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
    : "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300"

function DetailValue({ label, value, tone = "" }) {
  return <div className="min-w-0 rounded-md border bg-background/70 p-2.5">
    <dt className="text-[10px] leading-4 text-muted-foreground">{label}</dt>
    <dd className={`mt-1 break-words text-xs font-medium tabular-nums ${tone}`}>{value}</dd>
  </div>
}

function ExecutionList({ lifecycle }) {
  if (!lifecycle.executions.length) {
    return <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">جزئیات Dealهای این پوزیشن در Snapshot فعلی موجود نیست.</p>
  }

  return <div className="space-y-2">
    <p className="text-xs font-medium text-foreground">اجراهای تشکیل‌دهنده پوزیشن</p>
    <ol className="space-y-1.5">
      {lifecycle.executions.map((execution) => <li key={execution.key} className="rounded-md border bg-background/70 p-2.5 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-medium">{execution.entryLabel} · {execution.actionLabel}</span>
          <time className="tabular-nums text-muted-foreground">{formatTradeTime(execution.time)}</time>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
          <span>حجم: <bdi className="font-medium text-foreground">{formatTradeNumber(execution.volume, 2, 2)}</bdi></span>
          <span>قیمت: <bdi className="font-medium text-foreground">{formatTradeNumber(execution.price)}</bdi></span>
          {execution.dealId && <span>Deal: <bdi className="font-medium text-foreground">{execution.dealId}</bdi></span>}
          {execution.orderId && <span>Order: <bdi className="font-medium text-foreground">{execution.orderId}</bdi></span>}
        </div>
      </li>)}
    </ol>
  </div>
}

function LifecycleDetails({ lifecycle }) {
  return <div className="space-y-3 border-t bg-muted/20 p-3 lg:p-4">
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      <DetailValue label="سود/زیان قیمتی ناخالص" value={formatTradeMoney(lifecycle.grossProfit, lifecycle.currency)} tone={valueTone(lifecycle.grossProfit)} />
      <DetailValue label="Swap تجمیعی" value={formatTradeMoney(lifecycle.swap, lifecycle.currency)} tone={valueTone(lifecycle.swap)} />
      <DetailValue label="Commission" value={lifecycle.hasCommissionData ? formatTradeMoney(lifecycle.commission, lifecycle.currency) : "ثبت نشده"} tone={valueTone(lifecycle.commission)} />
      <DetailValue label="Fee" value={lifecycle.hasFeeData ? formatTradeMoney(lifecycle.fee, lifecycle.currency) : "ثبت نشده"} tone={valueTone(lifecycle.fee)} />
      <DetailValue label="Dividend Adjustment" value={lifecycle.hasDividendData ? formatTradeMoney(lifecycle.dividendAdjustment, lifecycle.currency) : "ثبت نشده"} tone={valueTone(lifecycle.dividendAdjustment)} />
      <DetailValue label="نتیجه خالص" value={formatTradeMoney(lifecycle.netProfit, lifecycle.currency)} tone={valueTone(lifecycle.netProfit)} />
      <DetailValue label="Stop Loss" value={formatTradeNumber(lifecycle.stopLoss)} />
      <DetailValue label="Take Profit" value={formatTradeNumber(lifecycle.takeProfit)} />
      <DetailValue label="Position ID" value={lifecycle.positionId} />
      <DetailValue label="منبع معامله" value={lifecycle.sourceLabel} />
      <DetailValue label="زمان بازشدن" value={formatTradeTime(lifecycle.openTime)} />
      <DetailValue label="زمان بسته‌شدن" value={lifecycle.status === "closed" ? formatTradeTime(lifecycle.closeTime) : "هنوز باز است"} />
      {lifecycle.mfe !== null && <DetailValue label="بیشترین سود شناور (MFE)" value={formatTradeMoney(lifecycle.mfe, lifecycle.currency)} tone={valueTone(lifecycle.mfe)} />}
      {lifecycle.mae !== null && <DetailValue label="بیشترین زیان شناور (MAE)" value={formatTradeMoney(lifecycle.mae, lifecycle.currency)} tone={valueTone(lifecycle.mae)} />}
    </dl>
    {lifecycle.status !== "closed" && !lifecycle.exitCommissionIncluded && <p className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs leading-5 text-amber-800 dark:text-amber-200">سود خالص فعلی بدون برآورد کمیسیون خروج</p>}
    <ExecutionList lifecycle={lifecycle} />
  </div>
}

function LifecycleRow({ lifecycle }) {
  const destinationPrice = lifecycle.status === "closed" ? lifecycle.closePrice : lifecycle.valuationPrice
  const priceLine = `${formatTradeNumber(lifecycle.openPrice)} → ${formatTradeNumber(destinationPrice)}`
  const riskStatus = lifecycle.status === "closed" ? lifecycle.statusLabel : `${lifecycle.statusLabel} · ${lifecycle.riskLabel}`

  return <details className="group rounded-lg border bg-gray-50 open:border-cyan-500/30 open:bg-cyan-500/[0.03] dark:border-[#2B2B30] dark:bg-[#0F0F12]">
    <summary className="relative cursor-pointer list-none p-3 pl-9 [&::-webkit-details-marker]:hidden">
      <ChevronDown aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-transform group-open:rotate-180" />

      <div className="hidden items-center gap-3 text-xs lg:grid lg:grid-cols-[1.05fr_.55fr_.5fr_1fr_1.25fr_.7fr_.8fr_.95fr]">
        <div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{lifecycle.symbol}</p><p className="truncate text-[10px] text-muted-foreground">{lifecycle.accountLabel}</p></div>
        <Badge variant="outline" className={`w-fit ${directionTone(lifecycle.direction)}`}>{lifecycle.directionLabel}</Badge>
        <span className="tabular-nums">{formatTradeNumber(lifecycle.volume, 2, 2)}</span>
        <time className="text-muted-foreground">{formatTradeTime(lifecycle.openTime)}</time>
        <span className="tabular-nums" dir="ltr">{priceLine}</span>
        <span className="tabular-nums text-muted-foreground" dir="ltr">{formatHoldingDuration(lifecycle.durationMs)}</span>
        <span className={`font-semibold tabular-nums ${valueTone(lifecycle.netProfit)}`} dir="ltr">{formatTradeMoney(lifecycle.netProfit, lifecycle.currency)}</span>
        <div className="flex flex-wrap items-center gap-1.5"><Badge variant="outline" className={statusTone(lifecycle.status)}>{riskStatus}</Badge>{lifecycle.swap < 0 && <Badge variant="outline" className="border-amber-500/30 text-amber-700 dark:text-amber-300">هزینه نگهداری</Badge>}</div>
      </div>

      <div className="space-y-2 lg:hidden">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0"><p className="text-sm font-semibold text-foreground">{lifecycle.symbol} · {lifecycle.directionLabel} · {formatTradeNumber(lifecycle.volume, 2, 2)}</p><p className="mt-0.5 truncate text-[10px] text-muted-foreground">{lifecycle.accountLabel}</p></div>
          <span className={`shrink-0 font-semibold tabular-nums ${valueTone(lifecycle.netProfit)}`} dir="ltr">{formatTradeMoney(lifecycle.netProfit, lifecycle.currency)}</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="tabular-nums" dir="ltr">{priceLine} · {formatHoldingDuration(lifecycle.durationMs)}</span>
          <Badge variant="outline" className={statusTone(lifecycle.status)}>{riskStatus}</Badge>
        </div>
      </div>
    </summary>
    <LifecycleDetails lifecycle={lifecycle} />
  </details>
}

export default function LastTrades({ snapshots = [] }) {
  const [filter, setFilter] = useState("all")
  const lifecycles = useMemo(() => buildTradeLifecycles(snapshots), [snapshots])
  const visible = filter === "all"
    ? lifecycles
    : filter === "closed"
      ? lifecycles.filter((item) => item.status === "closed")
      : lifecycles.filter((item) => item.status !== "closed")

  return <Card className={`${tradingCardClass} h-[32rem] xl:col-span-2 2xl:col-span-3`}>
    <CardHeader className={`${tradingCardHeaderClass} gap-3 sm:flex-row sm:items-center sm:justify-between`}>
      <CardTitle className="flex items-center gap-2 text-base text-gray-900 dark:text-white">
        <Activity className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
        چرخه معاملات و پوزیشن‌ها
        <Badge variant="secondary">{lifecycles.length}</Badge>
      </CardTitle>
      <div className="flex items-center gap-1 rounded-lg border bg-muted/30 p-1" aria-label="فیلتر معاملات">
        {filters.map((item) => <button key={item.id} type="button" aria-pressed={filter === item.id} onClick={() => setFilter(item.id)} className={`rounded-md px-2.5 py-1 text-xs transition ${filter === item.id ? "bg-background font-medium text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{item.label}</button>)}
      </div>
    </CardHeader>
    <CardContent className={`${tradingCardContentClass} space-y-2`}>
      <div className="sticky top-0 z-10 hidden gap-3 border-b bg-white px-3 py-2 text-[10px] font-medium text-muted-foreground dark:bg-[#1F1F23] lg:grid lg:grid-cols-[1.05fr_.55fr_.5fr_1fr_1.25fr_.7fr_.8fr_.95fr]">
        <span>نماد / حساب</span><span>جهت</span><span>حجم</span><span>بازشدن</span><span>قیمت ورود ← خروج/فعلی</span><span>مدت</span><span>نتیجه خالص</span><span>وضعیت / ریسک</span>
      </div>
      {!visible.length && <EmptyCollection>{lifecycles.length ? "معامله‌ای با این وضعیت وجود ندارد." : "چرخهٔ معامله یا پوزیشن بازی در Snapshot فعلی گزارش نشده است."}</EmptyCollection>}
      {visible.map((lifecycle) => <LifecycleRow key={lifecycle.key} lifecycle={lifecycle} />)}
    </CardContent>
  </Card>
}
