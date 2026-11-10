"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Activity, ChevronDown, Maximize2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { orderIdentifier } from "@/lib/risk-management"
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

const tradeGridStyle = {
  // Keep the original flexible-column unit (11.25rem fixed tracks + nine .375rem gaps).
  // Scaling fr weights alone would redistribute the saved space into the columns.
  "--trade-column-unit": "calc((100% - 14.625rem) / 3.51)",
  gridTemplateColumns: "3.8475rem minmax(0, calc(var(--trade-column-unit) * .605)) minmax(0, calc(var(--trade-column-unit) * .456)) minmax(0, calc(var(--trade-column-unit) * .266)) 6.84rem minmax(0, calc(var(--trade-column-unit) * .4275)) minmax(0, calc(var(--trade-column-unit) * .4275)) minmax(0, calc(var(--trade-column-unit) * .3325)) minmax(0, calc(var(--trade-column-unit) * .3325)) minmax(0, calc(var(--trade-column-unit) * .57))",
}

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
    const ticket = orderIdentifier(order)
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

function SymbolAccount({ symbol, accountLabel }) {
  // Two compact lines fit within the existing 22px direction badge height.
  return <p className="flex h-[22px] min-w-0 flex-col justify-center text-right">
    <span className="block truncate text-[11px] font-semibold leading-[11px] text-foreground" title={symbol}>{symbol}</span>
    <span className="block truncate text-[9px] leading-[11px] text-muted-foreground" title={accountLabel}>{accountLabel}</span>
  </p>
}

function TradeValue({ value, className = "" }) {
  return <span className={`min-w-0 truncate tabular-nums ${className}`} dir="ltr" title={value}>{value}</span>
}

function LifecycleRow({ lifecycle }) {
  const destinationPrice = lifecycle.status === "closed" ? lifecycle.closePrice : lifecycle.valuationPrice

  return <details className="group border-b border-gray-200 last:border-b-0 dark:border-[#2B2B30]">
    <summary className="relative cursor-pointer list-none p-3 pl-9 [&::-webkit-details-marker]:hidden">
      <ChevronDown aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-transform group-open:rotate-180" />
      <div style={tradeGridStyle} className="grid items-center gap-1.5 whitespace-nowrap text-center text-[11px]">
        <span className="select-all truncate font-medium tabular-nums" dir="ltr" title={lifecycle.ticket || undefined}>{lifecycle.ticket || "—"}</span>
        <SymbolAccount symbol={lifecycle.symbol} accountLabel={lifecycle.accountLabel} />
        <Badge variant="outline" className={`mx-auto max-w-full truncate ${directionTone(lifecycle.direction)}`} title={lifecycle.directionLabel}>{lifecycle.directionLabel}</Badge>
        <span className="tabular-nums" dir="ltr">{formatTradeNumber(lifecycle.volume, 2, 2)}</span>
        <time className="tabular-nums text-muted-foreground">{formatTradeTime(lifecycle.openTime)}</time>
        <TradeValue value={formatTradeNumber(lifecycle.openPrice)} />
        <TradeValue value={formatTradeNumber(destinationPrice)} />
        <TradeValue value={formatTradeNumber(protectivePrice(lifecycle.stopLoss))} />
        <TradeValue value={formatTradeNumber(protectivePrice(lifecycle.takeProfit))} />
        <TradeValue value={formatTradeMoney(lifecycle.netProfit, lifecycle.currency)} className={`font-semibold ${valueTone(lifecycle.netProfit)}`} />
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
  return <details className="group border-b border-gray-200 last:border-b-0 dark:border-[#2B2B30]">
    <summary className="relative cursor-pointer list-none p-3 pl-9 [&::-webkit-details-marker]:hidden">
      <ChevronDown aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-transform group-open:rotate-180" />
      <div style={tradeGridStyle} className="grid items-center gap-1.5 whitespace-nowrap text-center text-[11px]">
        <span className="select-all truncate font-medium tabular-nums" dir="ltr" title={order.ticket || undefined}>{order.ticket || "—"}</span>
        <SymbolAccount symbol={order.symbol} accountLabel={order.accountLabel} />
        <Badge variant="outline" className={`mx-auto max-w-full truncate ${directionTone(order.direction)}`} title={order.orderTypeLabel}>{order.orderTypeLabel}</Badge>
        <span className="tabular-nums" dir="ltr">{formatTradeNumber(order.volume, 2, 2)}</span>
        <time className="tabular-nums text-muted-foreground">{formatTradeTime(order.setupTime)}</time>
        <TradeValue value={formatTradeNumber(order.requestedPrice)} />
        <TradeValue value={formatTradeNumber(order.currentPrice)} />
        <TradeValue value={formatTradeNumber(order.stopLoss)} />
        <TradeValue value={formatTradeNumber(order.takeProfit)} />
        <span className="text-muted-foreground">—</span>
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

function TradeFilters({ filter, groups, onFilterChange }) {
  return <div className={`${tradingTabListClass} ms-auto`} aria-label="فیلتر معاملات و سفارش‌ها">
    {filters.map((item) => <button key={item.id} type="button" aria-pressed={filter === item.id} onClick={() => onFilterChange(item.id)} className={tradingTabClass(filter === item.id)}>
      {item.label}<span className="tabular-nums opacity-70">{groups[item.id].length}</span>
    </button>)}
  </div>
}

function TradeList({ filter, items }) {
  return <div className="w-[90%] min-w-[864px]">
    <div style={tradeGridStyle} className="sticky top-0 z-10 grid gap-1.5 border-b bg-white py-2 pl-9 pr-3 text-center text-[9px] font-medium text-muted-foreground dark:bg-[#1F1F23]">
      <span>تیکت</span><span className="text-right">نماد / حساب</span><span>جهت / نوع</span><span>حجم</span><span>زمان ورود / ثبت</span><span>قیمت ورود</span><span>خروج / فعلی</span><span>SL</span><span>TP</span><span>سود/زیان خالص</span>
    </div>
    {!items.length && <EmptyCollection>{emptyMessages[filter]}</EmptyCollection>}
    {filter === "pending"
      ? items.map((order) => <PendingRow key={order.key} order={order} />)
      : items.map((lifecycle) => <LifecycleRow key={lifecycle.key} lifecycle={lifecycle} />)}
  </div>
}

export default function LastTrades({ snapshots = [], actions }) {
  const [filter, setFilter] = useState("open")
  const [expanded, setExpanded] = useState(false)
  const [panelWidth, setPanelWidth] = useState(null)
  const cardRef = useRef(null)

  useEffect(() => {
    if (!expanded || !cardRef.current) return
    const card = cardRef.current
    const updateWidth = () => setPanelWidth(card.getBoundingClientRect().width)
    updateWidth()
    const observer = new ResizeObserver(updateWidth)
    observer.observe(card)
    return () => observer.disconnect()
  }, [expanded])

  const handleOpenChange = (open) => {
    if (open && cardRef.current) setPanelWidth(cardRef.current.getBoundingClientRect().width)
    setExpanded(open)
  }

  const lifecycles = useMemo(() => buildTradeLifecycles(snapshots), [snapshots])
  const pendingOrders = useMemo(() => buildPendingOrders(snapshots), [snapshots])
  const groups = useMemo(() => ({
    open: lifecycles.filter((item) => item.status !== "closed"),
    pending: pendingOrders,
    closed: lifecycles.filter((item) => item.status === "closed"),
  }), [lifecycles, pendingOrders])
  const visible = groups[filter]

  return <Dialog open={expanded} onOpenChange={handleOpenChange}>
    <Card ref={cardRef} className={`${tradingCardClass} !h-[16rem] xl:col-span-2`}>
      <CardHeader className={`${tradingCardHeaderClass} flex-row flex-wrap items-center justify-between gap-3 space-y-0`}>
        <CardTitle className="flex items-center gap-2 text-base text-gray-900 dark:text-white">
          <Activity className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
          معاملات و سفارش‌ها
          <Badge variant="secondary">{visible.length}</Badge>
        </CardTitle>
        <DialogTrigger asChild>
          <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0" aria-label="باز کردن معاملات و سفارش‌ها در پنجره بزرگ‌تر" title="نمایش معاملات در پنجره بزرگ‌تر">
            <Maximize2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        </DialogTrigger>
        {actions}
        <TradeFilters filter={filter} groups={groups} onFilterChange={setFilter} />
      </CardHeader>
      <CardContent className={`${tradingCardContentClass} !overflow-auto`}>
        <TradeList filter={filter} items={visible} />
      </CardContent>
    </Card>
    <DialogContent dir="rtl" style={{ width: panelWidth ?? undefined }} className="flex h-[85dvh] max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden bg-white p-0 dark:bg-[#1F1F23]">
      <DialogHeader className="shrink-0 border-b p-4 pl-12 text-right sm:text-right">
        <DialogTitle className="flex items-center gap-2 text-base">
          <Activity className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
          معاملات و سفارش‌ها
          <Badge variant="secondary">{visible.length}</Badge>
        </DialogTitle>
        <DialogDescription className="sr-only">نمایش معاملات باز، سفارش‌های در انتظار و معاملات بسته‌شده با فضای بیشتر و جزئیات هر ردیف</DialogDescription>
      </DialogHeader>
      <div className="flex min-w-0 shrink-0 px-4 py-3">
        <TradeFilters filter={filter} groups={groups} onFilterChange={setFilter} />
      </div>
      <div className={`${tradingCardContentClass} overflow-x-auto overscroll-contain`}>
        <TradeList filter={filter} items={visible} />
      </div>
    </DialogContent>
  </Dialog>
}
