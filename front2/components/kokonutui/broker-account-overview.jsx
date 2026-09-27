"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Building2, ChevronDown } from "lucide-react"
import {
  EmptyCollection,
  accountKey,
  formatField,
  money,
  number,
  tradingCardClass,
  tradingCardContentClass,
  tradingCardHeaderClass,
} from "./mt5-data-view"

const hasNumber = (value) => value !== null && value !== "" && Number.isFinite(Number(value))

const normalizeSymbol = (symbol) => String(symbol || "").toUpperCase().replace(/[^A-Z0-9]/g, "")

const assetType = (symbol) => {
  const normalized = normalizeSymbol(symbol)
  if (normalized.includes("XAU") || normalized.includes("GOLD")) return "gold"
  if (
    normalized === "SPX"
    || ["US500", "SP500", "SPX500", "USA500", "SANDP500"].some((alias) => normalized.includes(alias))
  ) return "sp500"
  return "other"
}

const assetLabel = (symbol) => {
  const type = assetType(symbol)
  if (type === "sp500") return "S&P 500"
  if (type === "gold") return "طلا"
  return symbol || "نماد نامشخص"
}

function symbolRows(snapshot) {
  const rows = new Map()

  const add = (item, section) => {
    const symbol = item?.symbol
    if (!symbol) return
    const key = normalizeSymbol(symbol)
    const previous = rows.get(key) || { symbol }
    rows.set(key, { ...previous, [section]: item, symbol: previous.symbol || symbol })
  }

  ;(snapshot.broker_symbol_data || []).forEach((item) => add(item, "broker"))
  ;(snapshot.symbol_metrics || []).forEach((item) => add(item, "risk"))

  const priority = { sp500: 0, gold: 1, other: 2 }
  return [...rows.values()].sort((left, right) => {
    const typeDifference = priority[assetType(left.symbol)] - priority[assetType(right.symbol)]
    return typeDifference || String(left.symbol).localeCompare(String(right.symbol))
  })
}

function SwapPair({ row, compact = false }) {
  const broker = row?.broker || {}
  const risk = row?.risk || {}
  const hasAnnualizedPair = hasNumber(risk.annualized_long_swap_rate_pct)
    && hasNumber(risk.annualized_short_swap_rate_pct)
  const long = hasAnnualizedPair ? risk.annualized_long_swap_rate_pct : broker.swap_long_raw
  const short = hasAnnualizedPair ? risk.annualized_short_swap_rate_pct : broker.swap_short_raw

  if (!hasNumber(long) && !hasNumber(short)) return <span className="text-muted-foreground">—</span>

  const format = (value) => hasNumber(value)
    ? `${number(value, 4)}${hasAnnualizedPair ? "%" : ""}`
    : "—"

  return <div
    className={`tabular-nums ${compact ? "text-[11px]" : "text-xs"}`}
    dir="ltr"
    title={hasAnnualizedPair ? "نرخ سالانه سواپ" : "مقدار اعلام‌شده بروکر؛ واحد به روش محاسبه سواپ نماد بستگی دارد"}
  >
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
      <span><span className="text-muted-foreground">L</span> {format(long)}</span>
      <span><span className="text-muted-foreground">S</span> {format(short)}</span>
    </div>
    {!compact && <p className="mt-0.5 text-[9px] text-muted-foreground" dir="rtl">{hasAnnualizedPair ? "سالانه" : "عدد بروکر"}</p>}
  </div>
}

function Value({ value, tone = "", dir = "ltr" }) {
  return <span className={`font-medium tabular-nums ${tone}`} dir={dir}>{value}</span>
}

function DetailValue({ label, value, tone = "" }) {
  return <div className="min-w-0 rounded-md border bg-background/70 p-2.5">
    <dt className="text-[10px] leading-4 text-muted-foreground">{label}</dt>
    <dd className={`mt-1 break-words text-xs font-medium tabular-nums ${tone}`} dir="ltr">{value}</dd>
  </div>
}

const profitTone = (value) => Number(value) > 0
  ? "text-emerald-600 dark:text-emerald-400"
  : Number(value) < 0
    ? "text-rose-600 dark:text-rose-400"
    : "text-foreground"

const marginTone = (value) => hasNumber(value) && Number(value) < 100
  ? "text-rose-600 dark:text-rose-400"
  : hasNumber(value) && Number(value) < 200
    ? "text-amber-600 dark:text-amber-400"
    : "text-foreground"

const drawdownTone = (value) => hasNumber(value) && Number(value) >= 20
  ? "text-rose-600 dark:text-rose-400"
  : hasNumber(value) && Number(value) >= 10
    ? "text-amber-600 dark:text-amber-400"
    : "text-foreground"

function SymbolDetails({ rows }) {
  if (!rows.length) return <EmptyCollection>اطلاعات نماد یا شرایط اجرای بروکر گزارش نشده است.</EmptyCollection>

  return <div className="space-y-2">
    <p className="text-xs font-medium text-foreground">ریسک نماد و شرایط اجرای بروکر</p>
    <div className="hidden gap-3 border-b px-3 py-2 text-[10px] font-medium text-muted-foreground lg:grid lg:grid-cols-[1fr_1fr_.7fr_1.05fr_.8fr_1fr]">
      <span>نماد</span><span>Exposure خالص</span><span>لورج نماد</span><span>Bid / Ask</span><span>Spread</span><span>سواپ L / S</span>
    </div>
    {rows.map((row) => {
      const risk = row.risk || {}
      const broker = row.broker || {}
      const quote = hasNumber(broker.bid) || hasNumber(broker.ask)
        ? `${hasNumber(broker.bid) ? number(broker.bid) : "—"} / ${hasNumber(broker.ask) ? number(broker.ask) : "—"}`
        : "—"

      return <div key={normalizeSymbol(row.symbol)} className="rounded-md border bg-background/70 p-3">
        <div className="hidden items-center gap-3 text-xs lg:grid lg:grid-cols-[1fr_1fr_.7fr_1.05fr_.8fr_1fr]">
          <div className="min-w-0">
            <p className="font-semibold text-foreground">{assetLabel(row.symbol)}</p>
            <p className="truncate text-[10px] text-muted-foreground" dir="ltr">{row.symbol}</p>
          </div>
          <Value value={hasNumber(risk.net_symbol_exposure_usd) ? money(risk.net_symbol_exposure_usd, "USD") : "—"} />
          <Value value={hasNumber(risk.net_symbol_leverage) ? `${number(risk.net_symbol_leverage, 2, 2)}×` : "—"} />
          <Value value={quote} />
          <Value value={hasNumber(broker.spread_points) ? number(broker.spread_points, 2) : "—"} />
          <SwapPair row={row} compact />
        </div>

        <div className="space-y-2 lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <div><p className="text-sm font-semibold">{assetLabel(row.symbol)}</p><p className="text-[10px] text-muted-foreground" dir="ltr">{row.symbol}</p></div>
            <SwapPair row={row} compact />
          </div>
          <dl className="grid grid-cols-2 gap-2 text-xs">
            <div><dt className="text-[10px] text-muted-foreground">Exposure خالص</dt><dd dir="ltr">{hasNumber(risk.net_symbol_exposure_usd) ? money(risk.net_symbol_exposure_usd, "USD") : "—"}</dd></div>
            <div><dt className="text-[10px] text-muted-foreground">لورج نماد</dt><dd dir="ltr">{hasNumber(risk.net_symbol_leverage) ? `${number(risk.net_symbol_leverage, 2, 2)}×` : "—"}</dd></div>
            <div><dt className="text-[10px] text-muted-foreground">Bid / Ask</dt><dd dir="ltr">{quote}</dd></div>
            <div><dt className="text-[10px] text-muted-foreground">Spread</dt><dd dir="ltr">{hasNumber(broker.spread_points) ? number(broker.spread_points, 2) : "—"}</dd></div>
          </dl>
        </div>
      </div>
    })}
  </div>
}

function AccountRow({ snapshot }) {
  const account = snapshot.account || {}
  const portfolio = snapshot.portfolio_metrics || {}
  const swap = snapshot.swap_metrics || {}
  const rows = symbolRows(snapshot)
  const sp500 = rows.find((row) => assetType(row.symbol) === "sp500")
  const gold = rows.find((row) => assetType(row.symbol) === "gold")
  const currency = account.currency || "USD"
  const broker = snapshot.source?.broker_company || "Broker"
  const accountIdentifier = snapshot.source?.account_identifier || "—"
  const totalLeverage = portfolio.gross_portfolio_leverage
  const drawdown = portfolio.account_current_drawdown_pct

  return <details className="group rounded-lg border bg-gray-50 open:border-cyan-500/30 open:bg-cyan-500/[0.03] dark:border-[#2B2B30] dark:bg-[#0F0F12]">
    <summary className="relative cursor-pointer list-none p-3 pl-9 [&::-webkit-details-marker]:hidden">
      <ChevronDown aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-transform group-open:rotate-180" />

      <div className="hidden items-center gap-3 text-xs lg:grid lg:grid-cols-[1.15fr_.75fr_.75fr_.75fr_.65fr_.75fr_1fr_1fr_.65fr]">
        <div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{broker}</p><p className="truncate text-[10px] text-muted-foreground">حساب {accountIdentifier}</p></div>
        <Value value={money(account.balance, currency)} />
        <Value value={money(account.equity, currency)} />
        <Value value={money(account.floating_profit_loss, currency)} tone={profitTone(account.floating_profit_loss)} />
        <Value value={hasNumber(totalLeverage) ? `${number(totalLeverage, 2, 2)}×` : "—"} />
        <Value value={hasNumber(account.margin_level_pct) ? `${number(account.margin_level_pct, 2)}%` : "—"} tone={marginTone(account.margin_level_pct)} />
        <SwapPair row={sp500} />
        <SwapPair row={gold} />
        <Value value={hasNumber(drawdown) ? `${number(drawdown, 2)}%` : "—"} tone={drawdownTone(drawdown)} />
      </div>

      <div className="space-y-3 lg:hidden">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{broker}</p><p className="text-[10px] text-muted-foreground">حساب {accountIdentifier}</p></div>
          <Value value={money(account.equity, currency)} />
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
          <div><dt className="text-[10px] text-muted-foreground">Balance</dt><dd><Value value={money(account.balance, currency)} /></dd></div>
          <div><dt className="text-[10px] text-muted-foreground">Floating P/L</dt><dd><Value value={money(account.floating_profit_loss, currency)} tone={profitTone(account.floating_profit_loss)} /></dd></div>
          <div><dt className="text-[10px] text-muted-foreground">لورج کل</dt><dd><Value value={hasNumber(totalLeverage) ? `${number(totalLeverage, 2, 2)}×` : "—"} /></dd></div>
          <div><dt className="text-[10px] text-muted-foreground">Margin Level</dt><dd><Value value={hasNumber(account.margin_level_pct) ? `${number(account.margin_level_pct, 2)}%` : "—"} tone={marginTone(account.margin_level_pct)} /></dd></div>
          <div><dt className="text-[10px] text-muted-foreground">Drawdown</dt><dd><Value value={hasNumber(drawdown) ? `${number(drawdown, 2)}%` : "—"} tone={drawdownTone(drawdown)} /></dd></div>
          <div><dt className="text-[10px] text-muted-foreground">سواپ S&P 500</dt><dd><SwapPair row={sp500} compact /></dd></div>
          <div><dt className="text-[10px] text-muted-foreground">سواپ طلا</dt><dd><SwapPair row={gold} compact /></dd></div>
        </dl>
      </div>
    </summary>

    <div className="space-y-4 border-t bg-muted/20 p-3 lg:p-4">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-7">
        <DetailValue label="Free Margin" value={money(account.free_margin, currency)} />
        <DetailValue label="Used Margin" value={money(account.used_margin, currency)} />
        <DetailValue label="لورج خالص" value={hasNumber(portfolio.net_portfolio_leverage) ? `${number(portfolio.net_portfolio_leverage, 2, 2)}×` : "—"} />
        <DetailValue label="Exposure ناخالص" value={hasNumber(portfolio.gross_portfolio_exposure_usd) ? money(portfolio.gross_portfolio_exposure_usd, "USD") : "—"} />
        <DetailValue label="Exposure خالص" value={hasNumber(portfolio.net_portfolio_exposure_usd) ? money(portfolio.net_portfolio_exposure_usd, "USD") : "—"} />
        <DetailValue label="هزینه سالانه Swap" value={hasNumber(swap.portfolio_annualized_swap_cost_usd) ? money(swap.portfolio_annualized_swap_cost_usd, "USD") : "—"} tone={profitTone(swap.portfolio_annualized_swap_cost_usd)} />
        <DetailValue label="آخرین به‌روزرسانی" value={formatField(snapshot.timestamp_utc, "timestamp_utc", currency)} />
      </dl>
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        {snapshot.source?.trade_server && <Badge variant="outline">سرور {snapshot.source.trade_server}</Badge>}
        {hasNumber(swap.portfolio_annual_swap_burden_pct_equity) && <Badge variant="outline">هزینه Swap / Equity: {number(swap.portfolio_annual_swap_burden_pct_equity, 2)}%</Badge>}
      </div>
      <SymbolDetails rows={rows} />
    </div>
  </details>
}

export default function BrokerAccountOverview({ snapshots = [] }) {
  return <Card className={`${tradingCardClass} h-[32rem] xl:col-span-2 2xl:col-span-3`}>
    <CardHeader className={tradingCardHeaderClass}>
      <CardTitle className="flex items-center gap-2 text-base text-gray-900 dark:text-white">
        <Building2 className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
        خلاصه حساب‌ها و شرایط بروکر
        <Badge variant="secondary">{snapshots.length}</Badge>
      </CardTitle>
    </CardHeader>
    <CardContent className={`${tradingCardContentClass} space-y-2`}>
      <div className="sticky top-0 z-10 hidden gap-3 border-b bg-white px-3 py-2 text-[10px] font-medium text-muted-foreground dark:bg-[#1F1F23] lg:grid lg:grid-cols-[1.15fr_.75fr_.75fr_.75fr_.65fr_.75fr_1fr_1fr_.65fr]">
        <span>بروکر / حساب</span><span>Balance</span><span>Equity</span><span>Floating P/L</span><span>لورج کل</span><span>Margin Level</span><span>سواپ S&P 500<br />L / S</span><span>سواپ طلا<br />L / S</span><span>Drawdown</span>
      </div>
      {!snapshots.length && <EmptyCollection>حساب بروکری برای نمایش وجود ندارد.</EmptyCollection>}
      {snapshots.map((snapshot) => <AccountRow key={accountKey(snapshot)} snapshot={snapshot} />)}
    </CardContent>
  </Card>
}
