const ENTRY_IN = new Set(["0", "IN", "DEAL_ENTRY_IN"])
const ENTRY_OUT = new Set(["1", "OUT", "DEAL_ENTRY_OUT"])
const ENTRY_INOUT = new Set(["2", "INOUT", "DEAL_ENTRY_INOUT"])
const ENTRY_OUT_BY = new Set(["3", "OUT_BY", "DEAL_ENTRY_OUT_BY"])

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

const identifier = (source) => {
  const value = valueOf(source, ["position_id", "position_identifier", "deal_position_id"])
  if (value === null || String(value) === "0") return null
  return String(value)
}

const timestamp = (value) => {
  if (value === null || value === undefined || value === "") return null
  if (typeof value === "number" || /^\d+$/.test(String(value))) {
    const numberValue = Number(value)
    return Number.isFinite(numberValue) ? (numberValue < 1e12 ? numberValue * 1000 : numberValue) : null
  }
  const parsed = new Date(value).getTime()
  return Number.isNaN(parsed) ? null : parsed
}

const dealTimestamp = (deal) => timestamp(valueOf(deal, ["time_msc", "timestamp_utc", "time", "executed_at"]))

const entryKind = (deal) => {
  const raw = String(valueOf(deal, ["deal_entry", "entry_type", "entry"]) ?? "").toUpperCase()
  if (ENTRY_IN.has(raw)) return "in"
  if (ENTRY_OUT.has(raw)) return "out"
  if (ENTRY_INOUT.has(raw)) return "inout"
  if (ENTRY_OUT_BY.has(raw)) return "out_by"
  return "unknown"
}

const normalizedDirection = (source) => {
  const raw = String(valueOf(source, ["deal_type", "direction", "type", "position_type"]) ?? "").toUpperCase()
  if (["0", "BUY", "DEAL_TYPE_BUY", "POSITION_TYPE_BUY", "LONG"].includes(raw)) return "long"
  if (["1", "SELL", "DEAL_TYPE_SELL", "POSITION_TYPE_SELL", "SHORT"].includes(raw)) return "short"
  return "unknown"
}

const sum = (items, keys) => items.reduce((total, item) => total + (numeric(valueOf(item, keys)) ?? 0), 0)

const hasNumeric = (items, keys) => items.some((item) => numeric(valueOf(item, keys)) !== null)

const weightedPrice = (deals) => {
  const totals = deals.reduce((result, deal) => {
    const volume = numeric(valueOf(deal, ["volume", "volume_lots"]))
    const price = numeric(valueOf(deal, ["price", "executed_price"]))
    if (volume === null || price === null || volume <= 0) return result
    result.volume += volume
    result.notional += price * volume
    return result
  }, { volume: 0, notional: 0 })
  return totals.volume > 0 ? totals.notional / totals.volume : null
}

const accountIdentity = (snapshot) => {
  const source = snapshot?.source || {}
  return [source.broker_company, source.trade_server, source.account_identifier]
    .filter((part) => part !== null && part !== undefined && part !== "")
    .join("::") || snapshot?.snapshot_id || "unknown-account"
}

const accountName = (snapshot) => {
  const source = snapshot?.source || {}
  const broker = source.broker_company || "Broker"
  return source.account_identifier ? `${broker} · ${source.account_identifier}` : broker
}

const executionSource = (position, openingDeal) => {
  const explicit = String(valueOf(position, ["trade_source", "source"]) || valueOf(openingDeal, ["trade_source", "source"]) || "").toLowerCase()
  const reason = String(valueOf(openingDeal, ["reason", "deal_reason"]) || "").toLowerCase()
  const comment = String(valueOf(position, ["comment"]) || valueOf(openingDeal, ["comment"]) || "").toLowerCase()
  const magic = numeric(valueOf(position, ["magic", "magic_number"]) ?? valueOf(openingDeal, ["magic", "magic_number"]))
  if (explicit.includes("copy") || comment.includes("copy")) return "Copy Trading"
  if (explicit.includes("expert") || explicit === "ea" || reason.includes("expert") || (magic !== null && magic !== 0)) return "EA"
  if (explicit.includes("manual") || reason.includes("client") || reason.includes("mobile") || reason.includes("web") || magic === 0) return "دستی"
  return "نامشخص"
}

const executionLabel = (kind) => ({
  in: "ورود",
  out: "خروج",
  out_by: "خروج متقابل",
  inout: "برگشت جهت",
  unknown: "اجرای معامله",
})[kind]

const actionLabel = (deal) => {
  const direction = normalizedDirection(deal)
  return direction === "long" ? "خرید" : direction === "short" ? "فروش" : "جهت نامشخص"
}

const buildExecutions = (deals) => deals.map((deal, index) => ({
  key: String(valueOf(deal, ["deal_ticket", "deal_identifier"]) || `${dealTimestamp(deal) || "deal"}-${index}`),
  dealId: valueOf(deal, ["deal_ticket", "deal_identifier"]),
  orderId: valueOf(deal, ["order_ticket", "order_identifier"]),
  entryLabel: executionLabel(entryKind(deal)),
  actionLabel: actionLabel(deal),
  time: dealTimestamp(deal),
  volume: numeric(valueOf(deal, ["volume", "volume_lots"])),
  price: numeric(valueOf(deal, ["price", "executed_price"])),
  profit: numeric(valueOf(deal, ["profit"])),
  swap: numeric(valueOf(deal, ["swap"])),
  commission: numeric(valueOf(deal, ["commission"])),
  fee: numeric(valueOf(deal, ["fee"])),
  dividendAdjustment: numeric(valueOf(deal, ["dividend_adjustment", "dividend", "adjustment"])),
}))

function buildLifecycle(snapshot, positionId, position, deals) {
  const orderedDeals = [...deals].sort((left, right) => (dealTimestamp(left) || 0) - (dealTimestamp(right) || 0))
  const lastReversalIndex = position ? orderedDeals.findLastIndex((deal) => entryKind(deal) === "inout") : -1
  const lifecycleDeals = lastReversalIndex >= 0 ? orderedDeals.slice(lastReversalIndex) : orderedDeals
  const openingDeals = lifecycleDeals.filter((deal, index) => entryKind(deal) === "in" || (lastReversalIndex >= 0 && index === 0 && entryKind(deal) === "inout"))
  const closingDeals = lifecycleDeals.filter((deal) => ["out", "out_by"].includes(entryKind(deal)) || (!position && entryKind(deal) === "inout"))
  const firstOpeningDeal = openingDeals[0] || null
  const lastClosingDeal = closingDeals.at(-1) || null
  const currentDirection = normalizedDirection(position)
  const direction = currentDirection !== "unknown" ? currentDirection : normalizedDirection(firstOpeningDeal)
  const status = position ? (closingDeals.length ? "partial" : "open") : "closed"
  const positionVolume = numeric(valueOf(position, ["current_volume", "volume", "volume_lots"]))
  const openingVolume = sum(openingDeals, ["volume", "volume_lots"])
  const closingVolume = sum(closingDeals, ["volume", "volume_lots"])
  const openTime = timestamp(valueOf(position, ["open_time_utc", "open_time"])) || dealTimestamp(firstOpeningDeal)
  const closeTime = dealTimestamp(lastClosingDeal)
  const snapshotTime = timestamp(snapshot?.timestamp_utc)
  const endTime = status === "closed" ? closeTime : snapshotTime
  const durationMs = openTime !== null && endTime !== null && endTime >= openTime ? endTime - openTime : null
  const openPrice = numeric(valueOf(position, ["weighted_open_price", "open_price"])) ?? weightedPrice(openingDeals)
  const closePrice = weightedPrice(closingDeals)
  const valuationPrice = numeric(valueOf(position, ["current_valuation_price", "valuation_price", "current_price"]))
  const realizedProfit = position ? sum(closingDeals, ["profit"]) : 0
  const floatingProfit = numeric(valueOf(position, ["floating_profit_loss", "current_profit_loss", "profit"])) ?? 0
  const grossProfit = status === "closed"
    ? sum(lifecycleDeals, ["profit"])
    : floatingProfit + realizedProfit
  const dealCommission = sum(lifecycleDeals, ["commission"])
  const closingCommission = sum(closingDeals, ["commission"])
  const positionCommission = numeric(valueOf(position, ["accrued_commission", "commission"]))
  const commission = status === "closed" ? dealCommission : positionCommission !== null ? positionCommission + closingCommission : dealCommission
  const dealFee = sum(lifecycleDeals, ["fee"])
  const closingFee = sum(closingDeals, ["fee"])
  const positionFee = numeric(valueOf(position, ["accrued_fee", "fee"]))
  const fee = status === "closed" ? dealFee : positionFee !== null ? positionFee + closingFee : dealFee
  const dealSwap = sum(lifecycleDeals, ["swap"])
  const closingSwap = sum(closingDeals, ["swap"])
  const positionSwap = numeric(valueOf(position, ["accrued_swap", "swap"]))
  const swap = status === "closed" ? dealSwap : positionSwap !== null ? positionSwap + closingSwap : dealSwap
  const dealDividend = sum(lifecycleDeals, ["dividend_adjustment", "dividend", "adjustment"])
  const closingDividend = sum(closingDeals, ["dividend_adjustment", "dividend", "adjustment"])
  const positionDividend = numeric(valueOf(position, ["dividend_adjustment", "accrued_dividend_adjustment"]))
  const dividendAdjustment = status === "closed" ? dealDividend : positionDividend !== null ? positionDividend + closingDividend : dealDividend
  const explicitNet = numeric(valueOf(position, ["current_net_profit_loss", "net_profit_loss", "net_profit"]))
  const netProfit = explicitNet ?? grossProfit + swap + commission + fee + dividendAdjustment
  const exitCommissionIncluded = status === "closed" || Boolean(valueOf(position, ["exit_commission_included", "estimated_exit_commission_included"]))
  const stopLoss = numeric(valueOf(position, ["stop_loss", "sl"]))
  const takeProfit = numeric(valueOf(position, ["take_profit", "tp"]))
  const riskLabel = status === "closed" ? "—" : stopLoss && stopLoss > 0 ? "Stop فعال" : "بدون Stop"
  const statusLabel = status === "closed" ? "بسته‌شده" : status === "partial" ? "بخشی بسته‌شده" : "باز"
  const positionSource = position || {}

  return {
    key: `${accountIdentity(snapshot)}::${positionId}`,
    positionId,
    symbol: valueOf(positionSource, ["symbol"]) || valueOf(firstOpeningDeal, ["symbol"]) || valueOf(lastClosingDeal, ["symbol"]) || "نماد نامشخص",
    direction,
    directionLabel: direction === "long" ? "Long" : direction === "short" ? "Short" : "نامشخص",
    status,
    statusLabel,
    riskLabel,
    volume: status === "closed" ? openingVolume || closingVolume || null : positionVolume ?? Math.max(openingVolume - closingVolume, 0),
    openTime,
    closeTime,
    durationMs,
    openPrice,
    closePrice,
    valuationPrice,
    grossProfit,
    swap,
    commission,
    fee,
    dividendAdjustment,
    netProfit,
    stopLoss,
    takeProfit,
    sourceLabel: executionSource(positionSource, firstOpeningDeal),
    accountLabel: accountName(snapshot),
    currency: snapshot?.account?.currency || snapshot?.source?.account_currency || "USD",
    exitCommissionIncluded,
    hasCommissionData: positionCommission !== null || hasNumeric(lifecycleDeals, ["commission"]),
    hasFeeData: positionFee !== null || hasNumeric(lifecycleDeals, ["fee"]),
    hasDividendData: positionDividend !== null || hasNumeric(lifecycleDeals, ["dividend_adjustment", "dividend", "adjustment"]),
    mfe: numeric(valueOf(positionSource, ["mfe", "maximum_favorable_excursion"])),
    mae: numeric(valueOf(positionSource, ["mae", "maximum_adverse_excursion"])),
    executions: buildExecutions(lifecycleDeals),
    sortTime: status === "closed" ? closeTime || 0 : openTime || snapshotTime || 0,
  }
}

export function buildTradeLifecycles(snapshots = []) {
  const lifecycles = []

  snapshots.forEach((snapshot, snapshotIndex) => {
    const dealsByPosition = new Map()
    for (const deal of snapshot?.trade_history_delta || []) {
      const positionId = identifier(deal)
      if (!positionId) continue
      if (!dealsByPosition.has(positionId)) dealsByPosition.set(positionId, [])
      dealsByPosition.get(positionId).push(deal)
    }

    const positionsById = new Map()
    for (const [positionIndex, position] of (snapshot?.positions || []).entries()) {
      const positionId = identifier(position) || `open-${snapshotIndex}-${positionIndex}`
      positionsById.set(positionId, position)
    }

    const positionIds = new Set([...dealsByPosition.keys(), ...positionsById.keys()])
    for (const positionId of positionIds) {
      const position = positionsById.get(positionId) || null
      const deals = dealsByPosition.get(positionId) || []
      const hasClosingDeal = deals.some((deal) => ["out", "out_by", "inout"].includes(entryKind(deal)))
      if (!position && !hasClosingDeal) continue
      lifecycles.push(buildLifecycle(snapshot, positionId, position, deals))
    }
  })

  return lifecycles.sort((left, right) => {
    const leftRank = left.status === "closed" ? 1 : 0
    const rightRank = right.status === "closed" ? 1 : 0
    return leftRank - rightRank || right.sortTime - left.sortTime
  })
}

export function formatTradeMoney(value, currency = "USD") {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "—"
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2, signDisplay: "always" }).format(Number(value))
  } catch {
    const sign = Number(value) > 0 ? "+" : ""
    return `${sign}${Number(value).toFixed(2)} ${currency}`
  }
}

export function formatTradeNumber(value, maximumFractionDigits = 5, minimumFractionDigits = 0) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "—"
  return Number(value).toLocaleString("en-US", { maximumFractionDigits, minimumFractionDigits })
}

export function formatTradeTime(value) {
  if (value === null || value === undefined) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString("fa-IR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })
}

export function formatHoldingDuration(durationMs) {
  if (durationMs === null || durationMs === undefined || durationMs < 0) return "—"
  const seconds = Math.floor(durationMs / 1000)
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60
  if (days > 0) return `${days.toLocaleString("fa-IR")} روز${hours ? ` و ${hours.toLocaleString("fa-IR")} ساعت` : ""}`
  return [hours, minutes, remainingSeconds].map((part) => String(part).padStart(2, "0")).join(":")
}
