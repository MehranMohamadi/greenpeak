import { Badge } from "@/components/ui/badge"

export const tradingCardClass = "flex h-[22rem] flex-col overflow-hidden border-gray-200 bg-white shadow-sm dark:border-[#2B2B30] dark:bg-[#1F1F23]"
export const tradingCardHeaderClass = "shrink-0 p-4 pb-2"
export const tradingCardContentClass = "min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-0"

const labels = {
  account_identifier: "شماره حساب",
  account_current_drawdown_pct: "Drawdown فعلی",
  accrued_swap: "Swap تجمیعی",
  annualized_long_swap_rate_pct: "نرخ سالانه Swap خرید",
  annualized_short_swap_rate_pct: "نرخ سالانه Swap فروش",
  ask: "Ask",
  balance: "Balance حساب",
  bid: "Bid",
  break_even_price: "قیمت سربه‌سر",
  break_even_status: "وضعیت سربه‌سر",
  broker_company: "Broker",
  broker_symbol_data: "اطلاعات نماد Broker",
  calculation_status: "وضعیت محاسبات",
  commission_convention: "روش محاسبه Commission",
  contract_size: "اندازه Contract",
  current_ask: "Ask فعلی",
  current_bid: "Bid فعلی",
  current_profit_loss: "P/L فعلی",
  current_symbol_annualized_swap_cost_usd: "هزینه سالانه Swap نماد",
  current_valuation_price: "قیمت ارزش‌گذاری",
  currency: "ارز حساب",
  deal_identifier: "Deal ID",
  direction: "جهت",
  ea_name: "EA",
  ea_version: "نسخه EA",
  entry_type: "نوع ورود",
  equity: "Equity",
  executed_price: "قیمت اجرا",
  execution_mode: "روش اجرا",
  expiration_utc: "انقضا",
  final_leverage_price: "قیمت Leverage نهایی",
  final_leverage_status: "وضعیت Leverage نهایی",
  floating_profit_loss: "Floating P/L",
  free_margin: "Margin آزاد",
  gross_portfolio_exposure_usd: "Exposure ناخالص",
  gross_portfolio_leverage: "Leverage ناخالص",
  initial_volume_lots: "حجم اولیه",
  last_update_time_utc: "آخرین به‌روزرسانی",
  long_symbol_notional_usd: "ارزش Long",
  magic_number: "Magic Number",
  margin_level_pct: "سطح Margin",
  minimum_volume: "حداقل حجم",
  net_portfolio_exposure_usd: "Exposure خالص",
  net_portfolio_leverage: "Leverage خالص",
  net_symbol_exposure_usd: "Exposure خالص نماد",
  net_symbol_leverage: "Leverage خالص نماد",
  next_buy_net_symbol_leverage: "Leverage پس از خرید بعدی",
  next_sell_net_symbol_leverage: "Leverage پس از فروش بعدی",
  open_price: "قیمت بازشدن",
  open_time_utc: "زمان بازشدن",
  order_identifier: "Order ID",
  order_price: "قیمت Order",
  order_type: "نوع Order",
  point: "Point",
  portfolio_annual_swap_burden_pct_equity: "هزینه سالانه Swap / Equity",
  portfolio_annualized_swap_cost_usd: "هزینه سالانه Swap",
  position_identifier: "Position ID",
  profit: "سود",
  quote_timestamp_utc: "زمان Quote",
  received_at_utc: "زمان دریافت",
  requested_price: "قیمت درخواستی",
  required_deposit_for_active_symbol_usd: "سرمایه لازم نماد",
  required_deposit_for_gross_portfolio_usd: "سرمایه لازم Portfolio",
  schema_version: "نسخه Schema",
  send_mode: "روش ارسال",
  setup_time_utc: "زمان ایجاد",
  short_symbol_notional_usd: "ارزش Short",
  snapshot_id: "Snapshot ID",
  spread_points: "Spread",
  stop_loss: "Stop Loss",
  swap: "Swap",
  swap_long_raw: "Swap خام خرید",
  swap_mode: "روش Swap",
  swap_short_raw: "Swap خام فروش",
  symbol: "Symbol",
  take_profit: "Take Profit",
  terminal_build: "Build ترمینال",
  tick_size: "اندازه Tick",
  tick_value: "ارزش Tick",
  timestamp_utc: "زمان Snapshot",
  trade_calculation_mode: "روش محاسبه معامله",
  trade_history_window_days: "بازه تاریخچه معاملات",
  trade_server: "سرور معامله",
  trading_status: "وضعیت معامله",
  used_margin: "Margin مصرف‌شده",
  volume: "Volume",
  volume_lots: "حجم Lot",
  volume_step: "گام حجم",
}

const accountMoneyFields = new Set([
  "balance", "equity", "floating_profit_loss", "free_margin", "used_margin",
  "current_profit_loss", "profit", "commission", "accrued_swap", "swap",
])

export function fieldLabel(key) {
  if (labels[key]) return labels[key]
  return key.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function formatField(value, key, currency = "USD") {
  if (value == null || value === "") return "—"
  if (typeof value === "boolean") return value ? "بله" : "خیر"
  if (typeof value === "object") return JSON.stringify(value)
  if (typeof value === "string") {
    if (key.includes("time") || key.endsWith("_at") || key.endsWith("_utc")) {
      const date = new Date(value)
      if (!Number.isNaN(date.getTime())) return date.toLocaleString("fa-IR", { hour12: false })
    }
    return value
  }
  if (typeof value !== "number" || !Number.isFinite(value)) return String(value)
  if (key.includes("_pct")) return `${number(value)}%`
  if (key.includes("leverage") && key !== "broker_leverage") return `${number(value)}×`
  if (key.endsWith("_usd")) return money(value, "USD")
  if (accountMoneyFields.has(key)) return money(value, currency)
  return number(value)
}

export function money(value, currency = "USD") {
  if (value == null || !Number.isFinite(Number(value))) return "—"
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(value))
  } catch {
    return `${number(value)} ${currency}`
  }
}

export function number(value, maximumFractionDigits = 8) {
  if (value == null || !Number.isFinite(Number(value))) return "—"
  return Number(value).toLocaleString("en-US", { maximumFractionDigits })
}

export function accountKey(snapshot) {
  const source = snapshot?.source || {}
  return [source.broker_company, source.trade_server, source.account_identifier].filter(Boolean).join("::") || snapshot?.snapshot_id
}

export function accountLabel(snapshot) {
  const source = snapshot?.source || {}
  return [source.broker_company, source.trade_server].filter(Boolean).join(" · ") || "حساب معاملاتی"
}

export function AccountHeading({ snapshot, children }) {
  return <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 pb-1.5 dark:border-[#2B2B30]">
    <div>
      <p className="text-sm font-medium text-gray-900 dark:text-white">{accountLabel(snapshot)}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">حساب {snapshot.source?.account_identifier || "—"}</p>
    </div>
    {children}
  </div>
}

export function FieldGrid({ data, currency = "USD", className = "" }) {
  const entries = Object.entries(data || {})
  if (!entries.length) return <p className="text-xs text-muted-foreground">داده‌ای ارسال نشده است.</p>
  return <dl className={`grid grid-cols-2 gap-x-3 gap-y-2 text-xs sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 ${className}`}>
    {entries.map(([key, value]) => <div key={key} className="min-w-0">
      <dt className="text-[11px] leading-4 text-muted-foreground">{fieldLabel(key)}</dt>
      <dd className="mt-0.5 break-words font-medium leading-4 tabular-nums text-gray-900 dark:text-white" title={typeof value === "object" ? JSON.stringify(value) : undefined}>{formatField(value, key, currency)}</dd>
    </div>)}
  </dl>
}

export function AccountBadge({ snapshot }) {
  return <Badge variant="outline">{snapshot.source?.broker_company || "Broker"} · {snapshot.source?.account_identifier || "—"}</Badge>
}

export function EmptyCollection({ children }) {
  return <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">{children}</p>
}
