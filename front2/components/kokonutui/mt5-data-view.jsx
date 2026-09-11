import { Badge } from "@/components/ui/badge"

export const tradingCardClass = "border-gray-200 bg-white shadow-sm dark:border-[#2B2B30] dark:bg-[#1F1F23]"

const labels = {
  account_identifier: "Account",
  account_current_drawdown_pct: "Current drawdown",
  accrued_swap: "Accrued swap",
  annualized_long_swap_rate_pct: "Annualized long swap rate",
  annualized_short_swap_rate_pct: "Annualized short swap rate",
  ask: "Ask",
  balance: "Balance",
  bid: "Bid",
  break_even_price: "Break-even price",
  break_even_status: "Break-even status",
  broker_company: "Broker",
  broker_symbol_data: "Broker symbol data",
  calculation_status: "Calculation status",
  commission_convention: "Commission convention",
  contract_size: "Contract size",
  current_ask: "Current ask",
  current_bid: "Current bid",
  current_profit_loss: "Current P/L",
  current_symbol_annualized_swap_cost_usd: "Active-symbol annual swap cost",
  current_valuation_price: "Valuation price",
  deal_identifier: "Deal ID",
  direction: "Side",
  ea_name: "EA",
  ea_version: "EA version",
  entry_type: "Entry type",
  equity: "Equity",
  executed_price: "Executed price",
  execution_mode: "Execution mode",
  expiration_utc: "Expiration",
  final_leverage_price: "Final leverage price",
  final_leverage_status: "Final leverage status",
  floating_profit_loss: "Floating P/L",
  free_margin: "Free margin",
  gross_portfolio_exposure_usd: "Gross exposure",
  gross_portfolio_leverage: "Gross leverage",
  initial_volume_lots: "Initial volume",
  last_update_time_utc: "Last update",
  long_symbol_notional_usd: "Long notional",
  magic_number: "Magic number",
  margin_level_pct: "Margin level",
  minimum_volume: "Minimum volume",
  net_portfolio_exposure_usd: "Net exposure",
  net_portfolio_leverage: "Net leverage",
  net_symbol_exposure_usd: "Net symbol exposure",
  net_symbol_leverage: "Net symbol leverage",
  next_buy_net_symbol_leverage: "Leverage after next buy",
  next_sell_net_symbol_leverage: "Leverage after next sell",
  open_price: "Open price",
  open_time_utc: "Opened",
  order_identifier: "Order ID",
  order_price: "Order price",
  order_type: "Order type",
  point: "Point",
  portfolio_annual_swap_burden_pct_equity: "Annual swap burden / equity",
  portfolio_annualized_swap_cost_usd: "Annualized swap run-rate",
  position_identifier: "Position ID",
  profit: "Profit",
  quote_timestamp_utc: "Quote time",
  received_at_utc: "Received",
  requested_price: "Requested price",
  required_deposit_for_active_symbol_usd: "Required deposit for symbol",
  required_deposit_for_gross_portfolio_usd: "Required deposit for portfolio",
  schema_version: "Schema version",
  send_mode: "Send mode",
  setup_time_utc: "Created",
  short_symbol_notional_usd: "Short notional",
  snapshot_id: "Snapshot ID",
  spread_points: "Spread",
  stop_loss: "Stop loss",
  swap: "Swap",
  swap_long_raw: "Raw long swap",
  swap_mode: "Swap mode",
  swap_short_raw: "Raw short swap",
  symbol: "Symbol",
  take_profit: "Take profit",
  terminal_build: "Terminal build",
  tick_size: "Tick size",
  tick_value: "Tick value",
  timestamp_utc: "Snapshot time",
  trade_calculation_mode: "Trade calculation mode",
  trade_history_window_days: "Trade-history window",
  trade_server: "Trade server",
  trading_status: "Trading status",
  used_margin: "Used margin",
  volume: "Volume",
  volume_lots: "Volume",
  volume_step: "Volume step",
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
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (typeof value === "object") return JSON.stringify(value)
  if (typeof value === "string") {
    if (key.includes("time") || key.endsWith("_at") || key.endsWith("_utc")) {
      const date = new Date(value)
      if (!Number.isNaN(date.getTime())) return date.toLocaleString("en-GB", { hour12: false })
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
  return [source.broker_company, source.trade_server].filter(Boolean).join(" · ") || "Trading account"
}

export function AccountHeading({ snapshot, children }) {
  return <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 pb-2 dark:border-[#2B2B30]">
    <div>
      <p className="font-medium text-gray-900 dark:text-white">{accountLabel(snapshot)}</p>
      <p className="mt-1 text-xs text-muted-foreground">Account {snapshot.source?.account_identifier || "—"}</p>
    </div>
    {children}
  </div>
}

export function FieldGrid({ data, currency = "USD", className = "" }) {
  const entries = Object.entries(data || {})
  if (!entries.length) return <p className="text-sm text-muted-foreground">No data reported.</p>
  return <dl className={`grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3 ${className}`}>
    {entries.map(([key, value]) => <div key={key} className="min-w-0">
      <dt className="text-xs text-muted-foreground">{fieldLabel(key)}</dt>
      <dd className="mt-1 break-words font-medium tabular-nums text-gray-900 dark:text-white" title={typeof value === "object" ? JSON.stringify(value) : undefined}>{formatField(value, key, currency)}</dd>
    </div>)}
  </dl>
}

export function AccountBadge({ snapshot }) {
  return <Badge variant="outline">{snapshot.source?.broker_company || "Broker"} · {snapshot.source?.account_identifier || "—"}</Badge>
}

export function EmptyCollection({ children }) {
  return <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{children}</p>
}
