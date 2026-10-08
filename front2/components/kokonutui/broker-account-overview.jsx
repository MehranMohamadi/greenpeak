"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Building2, ChevronDown, RefreshCw, Scale } from "lucide-react"
import {
  EmptyCollection,
  accountKey,
  formatField,
  money,
  number,
  tradingCardClass,
  tradingCardContentClass,
  tradingCardHeaderClass,
  tradingTabClass,
  tradingTabListClass,
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
    className={`text-center tabular-nums ${compact ? "text-[11px]" : "text-xs"}`}
    dir="ltr"
    title={hasAnnualizedPair ? "نرخ سالانه سواپ" : "مقدار اعلام‌شده بروکر؛ واحد به روش محاسبه سواپ نماد بستگی دارد"}
  >
    <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5">
      <span><span className="text-muted-foreground">L</span> {format(long)}</span>
      <span><span className="text-muted-foreground">S</span> {format(short)}</span>
    </div>
    {!compact && !hasAnnualizedPair && <p className="mt-0.5 text-[9px] text-muted-foreground" dir="rtl">عدد بروکر</p>}
  </div>
}

function Value({ value, tone = "", dir = "ltr" }) {
  return <span className={`block text-center font-medium tabular-nums ${tone}`} dir={dir}>{value}</span>
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
      <span>نماد</span><span>مواجهه خالص</span><span>اهرم نماد</span><span>قیمت خرید / فروش</span><span>فاصله قیمت</span><span>سواپ خرید / فروش</span>
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
            <div><dt className="text-[10px] text-muted-foreground">مواجهه خالص</dt><dd dir="ltr">{hasNumber(risk.net_symbol_exposure_usd) ? money(risk.net_symbol_exposure_usd, "USD") : "—"}</dd></div>
            <div><dt className="text-[10px] text-muted-foreground">اهرم نماد</dt><dd dir="ltr">{hasNumber(risk.net_symbol_leverage) ? `${number(risk.net_symbol_leverage, 2, 2)}×` : "—"}</dd></div>
            <div><dt className="text-[10px] text-muted-foreground">قیمت خرید / فروش</dt><dd dir="ltr">{quote}</dd></div>
            <div><dt className="text-[10px] text-muted-foreground">فاصله قیمت</dt><dd dir="ltr">{hasNumber(broker.spread_points) ? number(broker.spread_points, 2) : "—"}</dd></div>
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
  const currency = account.currency || "USD"
  const broker = snapshot.source?.broker_company || "Broker"
  const accountIdentifier = snapshot.source?.account_identifier || "—"
  const totalLeverage = portfolio.gross_portfolio_leverage
  const drawdown = portfolio.account_current_drawdown_pct

  return <details className="group rounded-lg border bg-gray-50 open:border-cyan-500/30 open:bg-cyan-500/[0.03] dark:border-[#2B2B30] dark:bg-[#0F0F12]">
    <summary className="relative cursor-pointer list-none p-3 pl-9 [&::-webkit-details-marker]:hidden">
      <ChevronDown aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-transform group-open:rotate-180" />

      <div className="hidden items-center gap-2 text-center text-[11px] lg:grid lg:grid-cols-7">
        <div className="min-w-0 text-right"><p className="truncate text-sm font-semibold text-foreground">{broker}</p><p className="truncate text-[10px] text-muted-foreground">حساب {accountIdentifier}</p></div>
        <Value value={money(account.balance, currency)} />
        <Value value={money(account.equity, currency)} />
        <Value value={money(account.floating_profit_loss, currency)} tone={profitTone(account.floating_profit_loss)} />
        <Value value={hasNumber(totalLeverage) ? `${number(totalLeverage, 2, 2)}×` : "—"} />
        <Value value={hasNumber(account.margin_level_pct) ? `${number(account.margin_level_pct, 2)}%` : "—"} tone={marginTone(account.margin_level_pct)} />
        <Value value={hasNumber(drawdown) ? `${number(drawdown, 2)}%` : "—"} tone={drawdownTone(drawdown)} />
      </div>

      <div className="space-y-3 lg:hidden">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{broker}</p><p className="text-[10px] text-muted-foreground">حساب {accountIdentifier}</p></div>
          <Value value={money(account.equity, currency)} />
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
          <div><dt className="text-[10px] text-muted-foreground">موجودی</dt><dd><Value value={money(account.balance, currency)} /></dd></div>
          <div><dt className="text-[10px] text-muted-foreground">سود/زیان شناور</dt><dd><Value value={money(account.floating_profit_loss, currency)} tone={profitTone(account.floating_profit_loss)} /></dd></div>
          <div><dt className="text-[10px] text-muted-foreground">اهرم کل</dt><dd><Value value={hasNumber(totalLeverage) ? `${number(totalLeverage, 2, 2)}×` : "—"} /></dd></div>
          <div><dt className="text-[10px] text-muted-foreground">سطح مارجین</dt><dd><Value value={hasNumber(account.margin_level_pct) ? `${number(account.margin_level_pct, 2)}%` : "—"} tone={marginTone(account.margin_level_pct)} /></dd></div>
          <div><dt className="text-[10px] text-muted-foreground">افت سرمایه</dt><dd><Value value={hasNumber(drawdown) ? `${number(drawdown, 2)}%` : "—"} tone={drawdownTone(drawdown)} /></dd></div>
        </dl>
      </div>
    </summary>

    <div className="space-y-4 border-t bg-muted/20 p-3 lg:p-4">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-8">
        <DetailValue label="مارجین آزاد" value={money(account.free_margin, currency)} />
        <DetailValue label="مارجین استفاده‌شده" value={money(account.used_margin, currency)} />
        <DetailValue label="اهرم خالص" value={hasNumber(portfolio.net_portfolio_leverage) ? `${number(portfolio.net_portfolio_leverage, 2, 2)}×` : "—"} />
        <DetailValue label="مواجهه ناخالص" value={hasNumber(portfolio.gross_portfolio_exposure_usd) ? money(portfolio.gross_portfolio_exposure_usd, "USD") : "—"} />
        <DetailValue label="مواجهه خالص" value={hasNumber(portfolio.net_portfolio_exposure_usd) ? money(portfolio.net_portfolio_exposure_usd, "USD") : "—"} />
        <DetailValue label="هزینه سالانه سواپ" value={hasNumber(swap.portfolio_annualized_swap_cost_usd) ? money(swap.portfolio_annualized_swap_cost_usd, "USD") : "—"} tone={profitTone(swap.portfolio_annualized_swap_cost_usd)} />
        <DetailValue label="نسبت هزینه سواپ به خالص دارایی" value={hasNumber(swap.portfolio_annual_swap_burden_pct_equity) ? `${number(swap.portfolio_annual_swap_burden_pct_equity, 2)}%` : "—"} tone={profitTone(swap.portfolio_annual_swap_burden_pct_equity)} />
        <DetailValue label="آخرین به‌روزرسانی" value={formatField(snapshot.timestamp_utc, "timestamp_utc", currency)} />
      </dl>
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        {snapshot.source?.trade_server && <Badge variant="outline">سرور {snapshot.source.trade_server}</Badge>}
      </div>
      <SymbolDetails rows={rows} />
    </div>
  </details>
}

const comparisonAssetPriority = { sp500: 0, gold: 1, eurusd: 2, bitcoin: 3, ethereum: 4 }

const comparisonAssetLabel = (asset) => ({
  sp500: "S&P 500",
  gold: "طلا",
  eurusd: "EUR/USD",
  bitcoin: "بیت‌کوین",
  ethereum: "اتریوم",
}[asset.asset_key] || asset.asset_label || asset.asset_key)

const swapModeLabel = (mode) => ({
  0: "بدون سواپ",
  1: "پوینت",
  2: "ارز پایه",
  3: "ارز مارجین",
  4: "ارز حساب",
  5: "درصد قیمت جاری",
  6: "درصد قیمت بازشدن",
  7: "بازگشایی با قیمت جاری",
  8: "بازگشایی با Bid",
}[mode] || (mode === null || mode === undefined ? "واحد نامشخص" : `روش ${mode}`))

function ComparisonValue({ children, detail }) {
  return <div className="min-w-[9.5rem] px-3 py-2 text-center text-[11px]">
    <div className="font-medium tabular-nums text-foreground" dir="ltr">{children}</div>
    {detail && <div className="mt-0.5 text-[9px] text-muted-foreground" dir="rtl">{detail}</div>}
  </div>
}

function MissingComparisonValue({ label = "داده کافی نیست" }) {
  return <ComparisonValue><span className="text-muted-foreground" dir="rtl">{label}</span></ComparisonValue>
}

function ComparisonTable({ comparison, loading, error, onRetry }) {
  const brokers = comparison?.brokers || []
  const assets = useMemo(() => {
    const rows = new Map()
    brokers.forEach((broker) => (broker.symbols || []).forEach((asset) => {
      if (!rows.has(asset.asset_key)) rows.set(asset.asset_key, asset)
    }))
    return [...rows.values()].sort((left, right) => {
      const priority = (comparisonAssetPriority[left.asset_key] ?? 100) - (comparisonAssetPriority[right.asset_key] ?? 100)
      return priority || comparisonAssetLabel(left).localeCompare(comparisonAssetLabel(right), "fa")
    })
  }, [brokers])

  const symbolFor = (broker, key) => (broker.symbols || []).find((symbol) => symbol.asset_key === key)

  const renderSwap = (symbol, side) => {
    if (!symbol) return <MissingComparisonValue />
    const annualized = symbol[`swap_${side}_annualized_pct_median`]
    if (hasNumber(annualized)) {
      return <ComparisonValue detail={`سالانه · میانه ${symbol.sample_accounts} حساب`}>{number(annualized, 3)}%</ComparisonValue>
    }
    if (symbol.swap_mode_mixed) return <MissingComparisonValue label="روش‌های سواپ متفاوت" />
    const raw = symbol[`swap_${side}_raw_median`]
    if (!hasNumber(raw)) return <MissingComparisonValue />
    return <ComparisonValue detail={`${swapModeLabel(symbol.swap_mode)} · میانه ${symbol.sample_accounts} حساب`}>{number(raw, 4)}</ComparisonValue>
  }

  if (loading) return <div className="flex h-full items-center justify-center gap-2 p-6 text-sm text-muted-foreground"><RefreshCw className="h-4 w-4 animate-spin" />در حال ساخت مقایسه تجمیعی…</div>
  if (error) return <div className="flex h-full flex-col items-center justify-center gap-2 p-5 text-center text-xs text-muted-foreground"><p>{error}</p><button type="button" className="text-cyan-700 underline-offset-4 hover:underline dark:text-cyan-300" onClick={onRetry}>تلاش دوباره</button></div>
  if (!brokers.length) return <div className="flex h-full flex-col items-center justify-center gap-2 p-5 text-center">
    <Scale className="h-7 w-7 text-muted-foreground" />
    <p className="text-sm font-medium text-foreground">هنوز نمونه کافی برای مقایسه امن وجود ندارد</p>
    <p className="max-w-md text-xs leading-5 text-muted-foreground">نام کاربر، شماره حساب و سرور در این مقایسه نمایش داده نمی‌شود.</p>
  </div>

  return <div className="min-w-max">
    <p className="sticky right-0 mb-2 w-fit rounded-md border border-cyan-500/20 bg-cyan-500/5 px-2.5 py-1 text-[10px] text-muted-foreground">میانه داده‌های بی‌نام · بدون شماره حساب و هویت کاربر</p>
    <table className="border-separate border-spacing-0 text-xs" aria-label="مقایسه ستونی هزینه‌های بروکرها">
      <thead>
        <tr>
          <th className="sticky right-0 top-0 z-30 min-w-[11rem] border-b bg-white px-3 py-2 text-right font-medium text-muted-foreground dark:bg-[#1F1F23]">شاخص مقایسه</th>
          {brokers.map((broker) => <th key={broker.broker_key} className="sticky top-0 z-20 min-w-[10rem] border-b bg-white px-3 py-2 text-center dark:bg-[#1F1F23]">
            <span className="block max-w-[10rem] truncate font-semibold text-foreground" title={broker.broker_name}>{broker.broker_name}</span>
            <span className="mt-0.5 block text-[9px] font-normal text-muted-foreground">{broker.sample_accounts} حساب · {broker.sample_users} کاربر</span>
          </th>)}
        </tr>
      </thead>
      <tbody>
        <tr className="bg-muted/20">
          <th className="sticky right-0 z-10 border-b bg-gray-50 px-3 py-2 text-right font-medium dark:bg-[#18181c]">کمیسیون هر لات</th>
          {brokers.map((broker) => hasNumber(broker.commission_per_lot_median)
            ? <td key={broker.broker_key} className="border-b"><ComparisonValue detail={`میانه ${broker.commission_sample_deals} اجرای معامله`}>{number(broker.commission_per_lot_median, 3)} {broker.account_currency || ""}</ComparisonValue></td>
            : <td key={broker.broker_key} className="border-b"><MissingComparisonValue label="کمیسیون ثبت نشده" /></td>)}
        </tr>
        <tr>
          <th className="sticky right-0 z-10 border-b bg-white px-3 py-2 text-right font-medium dark:bg-[#1F1F23]">دیویدند هر لات</th>
          {brokers.map((broker) => hasNumber(broker.dividend_per_lot_median)
            ? <td key={broker.broker_key} className="border-b"><ComparisonValue detail={`میانه ${broker.dividend_sample_records} رکورد`}>{number(broker.dividend_per_lot_median, 3)} {broker.account_currency || ""}</ComparisonValue></td>
            : <td key={broker.broker_key} className="border-b"><MissingComparisonValue label="دیویدند گزارش نشده" /></td>)}
        </tr>
        {assets.map((asset) => <AssetComparisonRows key={asset.asset_key} asset={asset} brokers={brokers} symbolFor={symbolFor} renderSwap={renderSwap} />)}
      </tbody>
    </table>
  </div>
}

function AssetComparisonRows({ asset, brokers, symbolFor, renderSwap }) {
  const label = comparisonAssetLabel(asset)
  return <>
    <tr>
      <th colSpan={brokers.length + 1} className="border-b bg-cyan-500/[0.06] px-3 py-1.5 text-right text-[11px] font-semibold text-cyan-800 dark:text-cyan-200">{label}</th>
    </tr>
    <tr>
      <th className="sticky right-0 z-10 border-b bg-white px-3 py-2 text-right font-medium dark:bg-[#1F1F23]">اسپرد</th>
      {brokers.map((broker) => {
        const symbol = symbolFor(broker, asset.asset_key)
        return hasNumber(symbol?.spread_bps_median)
          ? <td key={broker.broker_key} className="border-b"><ComparisonValue detail={`${hasNumber(symbol.spread_points_median) ? `${number(symbol.spread_points_median, 2)} پوینت · ` : ""}میانه ${symbol.sample_accounts} حساب`}>{number(symbol.spread_bps_median, 3)} bp</ComparisonValue></td>
          : <td key={broker.broker_key} className="border-b"><MissingComparisonValue /></td>
      })}
    </tr>
    <tr className="bg-muted/20">
      <th className="sticky right-0 z-10 border-b bg-gray-50 px-3 py-2 text-right font-medium dark:bg-[#18181c]">سواپ خرید</th>
      {brokers.map((broker) => <td key={broker.broker_key} className="border-b">{renderSwap(symbolFor(broker, asset.asset_key), "long")}</td>)}
    </tr>
    <tr>
      <th className="sticky right-0 z-10 border-b bg-white px-3 py-2 text-right font-medium dark:bg-[#1F1F23]">سواپ فروش</th>
      {brokers.map((broker) => <td key={broker.broker_key} className="border-b">{renderSwap(symbolFor(broker, asset.asset_key), "short")}</td>)}
    </tr>
  </>
}

export default function BrokerAccountOverview({ snapshots = [], accessToken = "" }) {
  const [tab, setTab] = useState("accounts")
  const [comparison, setComparison] = useState(null)
  const [comparisonLoading, setComparisonLoading] = useState(false)
  const [comparisonError, setComparisonError] = useState("")

  const loadComparison = useCallback(async () => {
    if (!accessToken) {
      setComparisonError("برای مشاهده مقایسه بروکرها وارد حساب کاربری شوید.")
      return
    }
    setComparisonLoading(true)
    setComparisonError("")
    try {
      const response = await fetch("/dashboard-data/mt5/broker-comparison", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(typeof body?.detail === "string" ? body.detail : `دریافت مقایسه ممکن نشد (${response.status})`)
      if (!body || !Array.isArray(body.brokers)) throw new Error("پاسخ مقایسه بروکرها معتبر نیست")
      setComparison(body)
    } catch (reason) {
      setComparisonError(reason instanceof Error ? reason.message : "دریافت مقایسه بروکرها ممکن نشد")
    } finally {
      setComparisonLoading(false)
    }
  }, [accessToken])

  useEffect(() => {
    setComparison(null)
    setComparisonError("")
  }, [accessToken])

  useEffect(() => {
    const focusComparison = (event) => {
      if (event.detail === "broker-comparison") setTab("comparison")
    }
    window.addEventListener("greenpeak:broker-focus", focusComparison)
    return () => window.removeEventListener("greenpeak:broker-focus", focusComparison)
  }, [])

  useEffect(() => {
    if ((accessToken || tab === "comparison") && !comparison && !comparisonLoading && !comparisonError) loadComparison()
  }, [tab, accessToken, comparison, comparisonLoading, comparisonError, loadComparison])

  const tabs = [
    { id: "accounts", label: "حساب‌های من", count: snapshots.length },
    {
      id: "comparison",
      label: "مقایسه بروکرها",
      count: comparison?.eligible_broker_count ?? (comparisonLoading || (accessToken && !comparisonError) ? "…" : "—"),
    },
  ]

  return <Card className={`${tradingCardClass} !h-[16rem] xl:col-span-2`}>
    <CardHeader className={`${tradingCardHeaderClass} flex-row flex-wrap items-center justify-between gap-3 space-y-0`}>
      <CardTitle className="flex items-center gap-2 text-base text-gray-900 dark:text-white">
        <Building2 className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
        حساب بروکرها
        <Badge variant="secondary">{tab === "accounts" ? snapshots.length : (comparison?.eligible_broker_count ?? "—")}</Badge>
      </CardTitle>
      <div className={tradingTabListClass} aria-label="بخش حساب‌ها و مقایسه بروکرها">
        {tabs.map((item) => <button key={item.id} type="button" aria-pressed={tab === item.id} onClick={() => setTab(item.id)} className={tradingTabClass(tab === item.id)}>
          {item.label}{item.count !== undefined && <span className="tabular-nums opacity-70">{item.count}</span>}
        </button>)}
      </div>
    </CardHeader>
    <CardContent className={`${tradingCardContentClass} ${tab === "accounts" ? "!overflow-x-hidden !overflow-y-auto" : "!overflow-auto"}`}>
      {tab === "comparison" ? <ComparisonTable comparison={comparison} loading={comparisonLoading} error={comparisonError} onRetry={loadComparison} /> :
      <div className="min-w-0 space-y-2">
        <div className="sticky top-0 z-10 hidden gap-2 border-b bg-white py-2 pl-9 pr-3 text-center text-[10px] font-medium text-muted-foreground dark:bg-[#1F1F23] lg:grid lg:grid-cols-7">
          <span className="text-right">بروکر / حساب</span><span>موجودی</span><span>خالص دارایی</span><span>سود/زیان شناور</span><span>اهرم کل</span><span>سطح مارجین</span><span>افت سرمایه</span>
        </div>
        {!snapshots.length && <EmptyCollection>حساب بروکری برای نمایش وجود ندارد.</EmptyCollection>}
        {snapshots.map((snapshot) => <AccountRow key={accountKey(snapshot)} snapshot={snapshot} />)}
      </div>}
    </CardContent>
  </Card>
}
