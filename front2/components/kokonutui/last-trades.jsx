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
import {
  EmptyCollection,
  accountKey,
  tradingCardClass,
  tradingCardContentClass,
  tradingCardHeaderClass,
  tradingTabClass,
  tradingTabListClass,
} from "./mt5-data-view"

const filters = [
  { id: "open", label: "معاملات باز" },
  { id: "pending", label: "سفارش‌های در انتظار" },
  { id: "closed", label: "معاملات بسته‌شده" },
]

const tradeGridClass = "grid-cols-[minmax(0,1.15fr)_minmax(0,.72fr)_minmax(0,.48fr)_minmax(0,1.15fr)_minmax(0,.76fr)_minmax(0,.76fr)_minmax(0,.64fr)_minmax(0,.64fr)_minmax(0,.95fr)]"

const orderTypes = {
  0: { label: "Buy", direction: "long" },
  1: { label: "Sell", direction: "short" },
  2: { label: "Buy Limit", direction: "long" },
  3: { label: "Sell Limit", direction: "short" },
  4: { label: "Buy Stop", direction: "long" },
  5: { label: "Sell Stop", direction: "short" },
  6: { label: "Buy Stop Limit", direction: "long" },
  7: { label: "Sell Stop Limit", direction: "short" },
  8: { label: "Close By", direction: "unknown" },
}

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

const valueOf = (source, keys) => {
  for (const key of keys) {
    if (source?.[key] !== undefined && source?.[key] !== null && source?.[key] !== "") return source[key]
  }
  return null
}

const numeric = (value) => {
  if (value === null || value === undefined || value === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const protectivePrice = (value) => {
  const parsed = numeric(value)
  return parsed !== null && parsed > 0 ? parsed : null
}

const timestamp = (value) => {
  if (value === null || value === undefined || value === "") return null
  if (typeof value === "number" || /^\d+$/.test(String(value))) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? (parsed < 1e12 ? parsed * 1000 : parsed) : null
  }
  const parsed = new Date(value).getTime()
  return Number.isNaN(parsed) ? null : parsed
}

const orderTypeMeta = (value) => {
  const raw = String(value ?? "").trim()
  if (orderTypes[raw]) return orderTypes[raw]
  const normalized = raw.toUpperCase().replace(/^ORDER_TYPE_/, "").replaceAll(" ", "_")
  const mapped = Object.values(orderTypes).find((item) => item.label.toUpperCase().replaceAll(" ", "_") === normalized)
  if (mapped) return mapped
  if (normalized.includes("BUY")) return { label: raw || "Buy", direction: "long" }
  if (normalized.includes("SELL")) return { label: raw || "Sell", direction: "short" }
  return { label: raw || "Order", direction: "unknown" }
}

const snapshotAccountLabel = (snapshot) => {
  const broker = snapshot?.source?.broker_company || "Broker"
  const identifier = snapshot?.source?.account_identifier
  return identifier ? `${broker} · ${identifier}` : broker
}

const quoteForOrder = (snapshot, symbol, direction) => {
  const quote = (snapshot?.broker_symbol_data || []).find((item) => String(item?.symbol || "").toUpperCase() === String(symbol || "").toUpperCase())
  if (!quote) return { price: null, time: null }
  return {
    price: protectivePrice(direction === "long" ? quote.ask : direction === "short" ? quote.bid : null),
    time: valueOf(quote, ["quote_timestamp_utc", "timestamp_utc"]),
  }
}

function buildPendingOrders(snapshots) {
  return snapshots.flatMap((snapshot, snapshotIndex) => (snapshot?.pending_orders || []).map((order, orderIndex) => {
    const type = orderTypeMeta(valueOf(order, ["order_type", "type"]))
    const symbol = valueOf(order, ["symbol"]) || "نماد نامشخص"
    const quote = quoteForOrder(snapshot, symbol, type.direction)
    const setupTime = valueOf(order, ["setup_time_utc", "open_time_utc", "created_at"])
    const setupTimestamp = timestamp(setupTime)
    const snapshotTimestamp = timestamp(snapshot?.timestamp_utc)
    const stopLoss = protectivePrice(valueOf(order, ["stop_loss", "sl"]))
    const takeProfit = protectivePrice(valueOf(order, ["take_profit", "tp"]))
    const ticket = valueOf(order, ["ticket", "order_identifier", "order_id"])
    const rawExpirationTime = valueOf(order, ["expiration_utc", "expiration_time_utc"])
    const expirationTime = timestamp(rawExpirationTime) > 0 ? rawExpirationTime : null

    return {
      key: `${accountKey(snapshot) || snapshot?.snapshot_id || snapshotIndex}::pending::${ticket || orderIndex}`,
      accountLabel: snapshotAccountLabel(snapshot),
      symbol,
      direction: type.direction,
      orderTypeLabel: type.label,
      volume: numeric(valueOf(order, ["volume", "volume_lots", "current_volume"])),
      setupTime,
      requestedPrice: protectivePrice(valueOf(order, ["requested_price", "order_price", "open_price", "price"])),
      currentPrice: protectivePrice(valueOf(order, ["current_price", "current_valuation_price"])) ?? quote.price,
      stopLoss,
      takeProfit,
      durationMs: setupTimestamp !== null && snapshotTimestamp !== null && snapshotTimestamp >= setupTimestamp
        ? snapshotTimestamp - setupTimestamp
        : null,
      ticket,
      expirationTime,
      quoteTime: quote.time,
      magicNumber: valueOf(order, ["magic_number", "magic"]),
      comment: valueOf(order, ["comment"]),
      sortTime: setupTimestamp || snapshotTimestamp || 0,
    }
  })).sort((left, right) => right.sortTime - left.sortTime)
}

function DetailValue({ label, value, tone = "" }) {
  return <div className="min-w-0 rounded-md border bg-background/70 p-2.5">
    <dt className="text-[10px] leading-4 text-muted-foreground">{label}</dt>
    <dd className={`mt-1 break-words text-xs font-medium tabular-nums ${tone}`}>{value}</dd>
  </div>
}

function SummaryValue({ label, value, tone = "", dir }) {
  return <div className="min-w-0 rounded-md bg-muted/40 px-2 py-1.5">
    <dt className="truncate text-[10px] leading-4 text-muted-foreground">{label}</dt>
    <dd dir={dir} className={`mt-0.5 truncate text-xs font-medium tabular-nums ${tone}`}>{value}</dd>
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
      <DetailValue label="Position ID" value={lifecycle.positionId} />
      <DetailValue label="منبع معامله" value={lifecycle.sourceLabel} />
      {lifecycle.status === "closed" && <DetailValue label="زمان بسته‌شدن" value={formatTradeTime(lifecycle.closeTime)} />}
      <DetailValue label="مدت نگهداری" value={formatHoldingDuration(lifecycle.durationMs)} />
      {lifecycle.mfe !== null && <DetailValue label="بیشترین سود شناور (MFE)" value={formatTradeMoney(lifecycle.mfe, lifecycle.currency)} tone={valueTone(lifecycle.mfe)} />}
      {lifecycle.mae !== null && <DetailValue label="بیشترین زیان شناور (MAE)" value={formatTradeMoney(lifecycle.mae, lifecycle.currency)} tone={valueTone(lifecycle.mae)} />}
    </dl>
    {lifecycle.status !== "closed" && !lifecycle.exitCommissionIncluded && <p className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs leading-5 text-amber-800 dark:text-amber-200">سود خالص فعلی بدون برآورد کمیسیون خروج</p>}
    <ExecutionList lifecycle={lifecycle} />
  </div>
}

function LifecycleRow({ lifecycle }) {
  const destinationPrice = lifecycle.status === "closed" ? lifecycle.closePrice : lifecycle.valuationPrice

  return <details className="group rounded-lg border bg-gray-50 open:border-cyan-500/30 open:bg-cyan-500/[0.03] dark:border-[#2B2B30] dark:bg-[#0F0F12]">
    <summary className="relative cursor-pointer list-none p-3 pl-9 [&::-webkit-details-marker]:hidden">
      <ChevronDown aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-transform group-open:rotate-180" />
      <div className={`hidden ${tradeGridClass} items-center gap-2 whitespace-nowrap text-center text-[11px] xl:grid`}>
        <p className="min-w-0 truncate text-right"><span className="font-semibold text-foreground">{lifecycle.symbol}</span><span className="text-[10px] text-muted-foreground"> · {lifecycle.accountLabel}</span></p>
        <Badge variant="outline" className={`mx-auto max-w-full truncate ${directionTone(lifecycle.direction)}`} title={lifecycle.directionLabel}>{lifecycle.directionLabel}</Badge>
        <span className="tabular-nums" dir="ltr">{formatTradeNumber(lifecycle.volume, 2, 2)}</span>
        <time className="tabular-nums text-muted-foreground">{formatTradeTime(lifecycle.openTime)}</time>
        <span className="tabular-nums" dir="ltr">{formatTradeNumber(lifecycle.openPrice)}</span>
        <span className="tabular-nums" dir="ltr">{formatTradeNumber(destinationPrice)}</span>
        <span className="tabular-nums" dir="ltr">{formatTradeNumber(protectivePrice(lifecycle.stopLoss))}</span>
        <span className="tabular-nums" dir="ltr">{formatTradeNumber(protectivePrice(lifecycle.takeProfit))}</span>
        <span className={`font-semibold tabular-nums ${valueTone(lifecycle.netProfit)}`} dir="ltr">{formatTradeMoney(lifecycle.netProfit, lifecycle.currency)}</span>
      </div>
      <div className="grid gap-2 xl:hidden">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="truncate text-sm font-semibold text-foreground">{lifecycle.symbol}</span>
              <Badge variant="outline" className={`max-w-full truncate ${directionTone(lifecycle.direction)}`}>{lifecycle.directionLabel}</Badge>
            </div>
            <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{lifecycle.accountLabel}</p>
          </div>
          <p className={`shrink-0 text-sm font-semibold tabular-nums ${valueTone(lifecycle.netProfit)}`} dir="ltr">{formatTradeMoney(lifecycle.netProfit, lifecycle.currency)}</p>
        </div>
        <dl className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          <SummaryValue label="زمان ورود" value={formatTradeTime(lifecycle.openTime)} dir="ltr" />
          <SummaryValue label="حجم" value={formatTradeNumber(lifecycle.volume, 2, 2)} dir="ltr" />
          <SummaryValue label="قیمت ورود" value={formatTradeNumber(lifecycle.openPrice)} dir="ltr" />
          <SummaryValue label={lifecycle.status === "closed" ? "قیمت خروج" : "قیمت فعلی"} value={formatTradeNumber(destinationPrice)} dir="ltr" />
          <SummaryValue label="SL" value={formatTradeNumber(protectivePrice(lifecycle.stopLoss))} dir="ltr" />
          <SummaryValue label="TP" value={formatTradeNumber(protectivePrice(lifecycle.takeProfit))} dir="ltr" />
        </dl>
      </div>
    </summary>
    <LifecycleDetails lifecycle={lifecycle} />
  </details>
}

function PendingDetails({ order }) {
  return <div className="border-t bg-muted/20 p-3 lg:p-4">
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      <DetailValue label="Order ID" value={order.ticket || "—"} />
      <DetailValue label="مدت انتظار" value={formatHoldingDuration(order.durationMs)} />
      <DetailValue label="انقضا" value={order.expirationTime ? formatTradeTime(order.expirationTime) : "بدون انقضا"} />
      <DetailValue label="زمان Quote فعلی" value={formatTradeTime(order.quoteTime)} />
      <DetailValue label="Magic Number" value={order.magicNumber ?? "—"} />
      <DetailValue label="توضیح" value={order.comment || "—"} />
    </dl>
  </div>
}

function PendingRow({ order }) {
  return <details className="group rounded-lg border bg-gray-50 open:border-amber-500/30 open:bg-amber-500/[0.03] dark:border-[#2B2B30] dark:bg-[#0F0F12]">
    <summary className="relative cursor-pointer list-none p-3 pl-9 [&::-webkit-details-marker]:hidden">
      <ChevronDown aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-transform group-open:rotate-180" />
      <div className={`hidden ${tradeGridClass} items-center gap-2 whitespace-nowrap text-center text-[11px] xl:grid`}>
        <p className="min-w-0 truncate text-right"><span className="font-semibold text-foreground">{order.symbol}</span><span className="text-[10px] text-muted-foreground"> · {order.accountLabel}</span></p>
        <Badge variant="outline" className={`mx-auto max-w-full truncate ${directionTone(order.direction)}`} title={order.orderTypeLabel}>{order.orderTypeLabel}</Badge>
        <span className="tabular-nums" dir="ltr">{formatTradeNumber(order.volume, 2, 2)}</span>
        <time className="tabular-nums text-muted-foreground">{formatTradeTime(order.setupTime)}</time>
        <span className="tabular-nums" dir="ltr">{formatTradeNumber(order.requestedPrice)}</span>
        <span className="tabular-nums" dir="ltr">{formatTradeNumber(order.currentPrice)}</span>
        <span className="tabular-nums" dir="ltr">{formatTradeNumber(order.stopLoss)}</span>
        <span className="tabular-nums" dir="ltr">{formatTradeNumber(order.takeProfit)}</span>
        <span className="text-muted-foreground">—</span>
      </div>
      <div className="grid gap-2 xl:hidden">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{order.symbol}</p>
            <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{order.accountLabel}</p>
          </div>
          <Badge variant="outline" className={`max-w-full truncate ${directionTone(order.direction)}`}>{order.orderTypeLabel}</Badge>
        </div>
        <dl className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          <SummaryValue label="زمان ثبت" value={formatTradeTime(order.setupTime)} dir="ltr" />
          <SummaryValue label="حجم" value={formatTradeNumber(order.volume, 2, 2)} dir="ltr" />
          <SummaryValue label="قیمت سفارش" value={formatTradeNumber(order.requestedPrice)} dir="ltr" />
          <SummaryValue label="قیمت فعلی" value={formatTradeNumber(order.currentPrice)} dir="ltr" />
          <SummaryValue label="SL" value={formatTradeNumber(order.stopLoss)} dir="ltr" />
          <SummaryValue label="TP" value={formatTradeNumber(order.takeProfit)} dir="ltr" />
        </dl>
      </div>
    </summary>
    <PendingDetails order={order} />
  </details>
}

const emptyMessages = {
  open: "معامله بازی در Snapshot فعلی گزارش نشده است.",
  pending: "سفارش در انتظاری گزارش نشده است.",
  closed: "معامله بسته‌شده‌ای در بازه تاریخچه گزارش نشده است.",
}

export default function LastTrades({ snapshots = [] }) {
  const [filter, setFilter] = useState("open")
  const lifecycles = useMemo(() => buildTradeLifecycles(snapshots), [snapshots])
  const pendingOrders = useMemo(() => buildPendingOrders(snapshots), [snapshots])
  const groups = useMemo(() => ({
    open: lifecycles.filter((item) => item.status !== "closed"),
    pending: pendingOrders,
    closed: lifecycles.filter((item) => item.status === "closed"),
  }), [lifecycles, pendingOrders])
  const visible = groups[filter]

  return <Card className={`${tradingCardClass} !h-[26rem] xl:!h-[16rem] xl:col-span-2`}>
    <CardHeader className={`${tradingCardHeaderClass} flex-row flex-wrap items-center justify-between gap-3 space-y-0`}>
      <CardTitle className="flex items-center gap-2 text-base text-gray-900 dark:text-white">
        <Activity className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
        معاملات و سفارش‌ها
        <Badge variant="secondary">{visible.length}</Badge>
      </CardTitle>
      <div className={tradingTabListClass} aria-label="فیلتر معاملات و سفارش‌ها">
        {filters.map((item) => <button key={item.id} type="button" aria-pressed={filter === item.id} onClick={() => setFilter(item.id)} className={tradingTabClass(filter === item.id)}>
          {item.label}<span className="tabular-nums opacity-70">{groups[item.id].length}</span>
        </button>)}
      </div>
    </CardHeader>
    <CardContent className={`${tradingCardContentClass} !overflow-x-hidden !overflow-y-auto`}>
      <div className="min-w-0 space-y-2">
        <div className={`sticky top-0 z-10 hidden ${tradeGridClass} gap-2 border-b bg-white py-2 pl-9 pr-3 text-center text-[9px] font-medium text-muted-foreground dark:bg-[#1F1F23] xl:grid`}>
          <span className="text-right">نماد / حساب</span><span>جهت / نوع</span><span>حجم</span><span>زمان ورود / ثبت</span><span>قیمت ورود</span><span>خروج / فعلی</span><span>SL</span><span>TP</span><span>سود/زیان خالص</span>
        </div>
        {!visible.length && <EmptyCollection>{emptyMessages[filter]}</EmptyCollection>}
        {filter === "pending"
          ? visible.map((order) => <PendingRow key={order.key} order={order} />)
          : visible.map((lifecycle) => <LifecycleRow key={lifecycle.key} lifecycle={lifecycle} />)}
      </div>
    </CardContent>
  </Card>
}
