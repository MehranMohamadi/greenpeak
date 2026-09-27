export const EMPTY_RISK_RULES = {
  maxTradeRiskPct: "",
  maxOpenRiskPct: "",
  dailyLossLimitPct: "",
  maxGrossLeverage: "",
  maxTradesPerDay: "",
  minMarginLevelPct: "",
}

export const EMPTY_TRADE_DRAFT = {
  symbol: "",
  direction: "BUY",
  orderType: "MARKET",
  entryPrice: "",
  volume: "",
  stopLoss: "",
  takeProfit: "",
  setup: "",
  rationale: "",
  invalidation: "",
  mentalState: "",
}

export function finiteNumber(value) {
  if (value === "" || value == null) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function positiveRule(value) {
  const parsed = finiteNumber(value)
  return parsed != null && parsed > 0 ? parsed : null
}

function normalizeSymbol(value) {
  return String(value || "").trim().toUpperCase()
}

export function availableSymbols(snapshot) {
  const symbols = new Set()
  for (const collection of [
    snapshot?.broker_symbol_data,
    snapshot?.symbol_metrics,
    snapshot?.positions,
    snapshot?.pending_orders,
  ]) {
    for (const item of collection || []) {
      if (item?.symbol) symbols.add(String(item.symbol))
    }
  }
  return [...symbols].sort((a, b) => a.localeCompare(b))
}

export function brokerSpecFor(snapshot, symbol) {
  const wanted = normalizeSymbol(symbol)
  return (snapshot?.broker_symbol_data || []).find(
    (item) => normalizeSymbol(item?.symbol) === wanted,
  ) || null
}

function currentPositionPrice(position) {
  const direct = finiteNumber(position?.current_valuation_price)
  if (direct != null && direct > 0) return direct
  const direction = normalizeSymbol(position?.direction)
  const fallback = direction === "SELL" ? position?.current_ask : position?.current_bid
  const parsed = finiteNumber(fallback)
  return parsed != null && parsed > 0 ? parsed : null
}

function stopRisk({ direction, entryPrice, stopLoss, volume, spec }) {
  const entry = finiteNumber(entryPrice)
  const stop = finiteNumber(stopLoss)
  const lots = finiteNumber(volume)
  if (stop == null || stop <= 0) return { status: "missing_stop", amount: null, reason: "حد ضرر ثبت نشده است" }
  if (entry == null || entry <= 0) return { status: "missing_price", amount: null, reason: "قیمت معتبر در دسترس نیست" }
  if (lots == null || lots <= 0) return { status: "invalid_volume", amount: null, reason: "حجم معتبر در دسترس نیست" }

  const normalizedDirection = normalizeSymbol(direction)
  const adverseDistance = normalizedDirection === "BUY" ? entry - stop : stop - entry
  if (!(["BUY", "SELL"].includes(normalizedDirection)) || adverseDistance <= 0) {
    return { status: "invalid_stop", amount: null, reason: "جای حد ضرر با جهت معامله سازگار نیست" }
  }

  const tickSize = finiteNumber(spec?.tick_size)
  const tickValue = finiteNumber(spec?.tick_value)
  if (tickSize == null || tickSize <= 0 || tickValue == null || tickValue <= 0) {
    return { status: "missing_spec", amount: null, reason: "مشخصات tick نماد از بروکر نرسیده است" }
  }

  const amount = adverseDistance / tickSize * tickValue * lots
  if (!Number.isFinite(amount) || amount < 0) {
    return { status: "calculation_error", amount: null, reason: "ریسک قابل محاسبه نیست" }
  }
  return { status: "available", amount, reason: null }
}

export function analyzeOpenRisk(snapshot) {
  const equity = finiteNumber(snapshot?.account?.equity)
  const positions = (snapshot?.positions || []).map((position) => {
    const risk = stopRisk({
      direction: position?.direction,
      entryPrice: currentPositionPrice(position),
      stopLoss: position?.stop_loss,
      volume: position?.volume,
      spec: brokerSpecFor(snapshot, position?.symbol),
    })
    return { ...position, risk }
  })

  const pendingOrders = (snapshot?.pending_orders || []).map((order) => {
    const orderType = Number(order?.order_type)
    const direction = [0, 2, 4, 6].includes(orderType) ? "BUY" : [1, 3, 5, 7].includes(orderType) ? "SELL" : ""
    const risk = stopRisk({
      direction,
      entryPrice: order?.requested_price,
      stopLoss: order?.stop_loss,
      volume: order?.volume,
      spec: brokerSpecFor(snapshot, order?.symbol),
    })
    return { ...order, direction, risk }
  })

  const knownTotal = positions.reduce((sum, position) => sum + (position.risk.amount || 0), 0)
  const pendingKnownTotal = pendingOrders.reduce((sum, order) => sum + (order.risk.amount || 0), 0)
  const complete = positions.every((position) => position.risk.status === "available")
  const pendingComplete = pendingOrders.every((order) => order.risk.status === "available")

  return {
    positions,
    pendingOrders,
    knownTotal,
    total: complete ? knownTotal : null,
    riskPct: complete && equity != null && equity > 0 ? knownTotal / equity * 100 : null,
    complete,
    pendingKnownTotal,
    pendingTotal: pendingComplete ? pendingKnownTotal : null,
    pendingComplete,
    missingStopCount: positions.filter((position) => position.risk.status === "missing_stop").length,
    unavailableCount: positions.filter((position) => position.risk.status !== "available").length,
    pendingMissingStopCount: pendingOrders.filter((order) => order.risk.status === "missing_stop").length,
  }
}

function dateKey(date, timeZone = "Asia/Tehran") {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return ""
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)
  const get = (type) => parts.find((part) => part.type === type)?.value || ""
  return `${get("year")}-${get("month")}-${get("day")}`
}

function dealNet(deal) {
  return [deal?.profit, deal?.commission, deal?.swap]
    .map(finiteNumber)
    .reduce((sum, value) => sum + (value || 0), 0)
}

export function analyzeTradeHistory(snapshot, now = new Date()) {
  const deals = [...(snapshot?.trade_history_delta || [])]
    .map((deal) => ({ ...deal, timestamp: new Date(deal?.timestamp_utc) }))
    .filter((deal) => !Number.isNaN(deal.timestamp.getTime()))
    .sort((a, b) => a.timestamp - b.timestamp)
  const today = dateKey(now)
  const todaysDeals = deals.filter((deal) => dateKey(deal.timestamp) === today)
  const closingDeals = deals.filter((deal) => [1, 2, 3].includes(Number(deal?.entry_type)))
  const todaysClosingDeals = todaysDeals.filter((deal) => [1, 2, 3].includes(Number(deal?.entry_type)))
  const todaysEntries = todaysDeals.filter((deal) => Number(deal?.entry_type) === 0)
  const realizedToday = todaysClosingDeals.reduce((sum, deal) => sum + dealNet(deal), 0)

  let raisedVolumeAfterLoss = 0
  for (let index = 0; index < deals.length; index += 1) {
    const loss = deals[index]
    if (![1, 2, 3].includes(Number(loss?.entry_type)) || dealNet(loss) >= 0) continue
    const nextEntry = deals.slice(index + 1).find((deal) => Number(deal?.entry_type) === 0)
    if (!nextEntry) continue
    const minutes = (nextEntry.timestamp - loss.timestamp) / 60000
    const previousVolume = finiteNumber(loss?.volume)
    const nextVolume = finiteNumber(nextEntry?.volume)
    if (minutes <= 30 && previousVolume != null && nextVolume != null && nextVolume > previousVolume * 1.01) {
      raisedVolumeAfterLoss += 1
    }
  }

  return {
    deals,
    realizedToday,
    realizedLossUsed: Math.max(0, -realizedToday),
    todayEntryCount: todaysEntries.length,
    closedSampleCount: closingDeals.length,
    losingSampleCount: closingDeals.filter((deal) => dealNet(deal) < 0).length,
    raisedVolumeAfterLoss,
    behaviorSampleSufficient: closingDeals.length >= 10,
    historyWindowDays: finiteNumber(snapshot?.calculation_status?.trade_history_window_days),
  }
}

export function concentrationSummary(snapshot) {
  const metrics = (snapshot?.symbol_metrics || [])
    .map((item) => ({ ...item, exposure: finiteNumber(item?.net_symbol_exposure_usd) }))
    .filter((item) => item.exposure != null)
  if (!metrics.length) return { available: false, symbol: null, exposure: null, sharePct: null }
  metrics.sort((a, b) => Math.abs(b.exposure) - Math.abs(a.exposure))
  const largest = metrics[0]
  const gross = finiteNumber(snapshot?.portfolio_metrics?.gross_portfolio_exposure_usd)
  return {
    available: true,
    symbol: largest.symbol,
    exposure: largest.exposure,
    sharePct: gross != null && gross > 0 ? Math.abs(largest.exposure) / gross * 100 : null,
  }
}

export function freshnessSummary(snapshot, now = new Date(), staleMinutes = 15) {
  const timestamp = new Date(snapshot?.timestamp_utc)
  if (Number.isNaN(timestamp.getTime())) return { available: false, stale: true, ageMinutes: null, timestamp: null }
  const ageMinutes = Math.max(0, (now.getTime() - timestamp.getTime()) / 60000)
  return { available: true, stale: ageMinutes > staleMinutes, ageMinutes, timestamp }
}

export function previewTrade(snapshot, draft, rules, openRisk) {
  const entry = finiteNumber(draft?.entryPrice)
  const stop = finiteNumber(draft?.stopLoss)
  const target = finiteNumber(draft?.takeProfit)
  const risk = stopRisk({
    direction: draft?.direction,
    entryPrice: entry,
    stopLoss: stop,
    volume: draft?.volume,
    spec: brokerSpecFor(snapshot, draft?.symbol),
  })
  const equity = finiteNumber(snapshot?.account?.equity)
  const riskPct = risk.amount != null && equity != null && equity > 0 ? risk.amount / equity * 100 : null
  const direction = normalizeSymbol(draft?.direction)
  const rewardDistance = entry != null && target != null
    ? (direction === "BUY" ? target - entry : entry - target)
    : null
  const stopDistance = entry != null && stop != null
    ? (direction === "BUY" ? entry - stop : stop - entry)
    : null
  const rewardRisk = rewardDistance != null && rewardDistance > 0 && stopDistance != null && stopDistance > 0
    ? rewardDistance / stopDistance
    : null
  const afterOpenRiskPct = risk.amount != null && openRisk?.complete && equity != null && equity > 0
    ? (openRisk.knownTotal + risk.amount) / equity * 100
    : null

  const checks = [
    {
      key: "stop",
      label: "حد ضرر معتبر",
      status: risk.status === "available" ? "pass" : "fail",
      detail: risk.reason || "حد ضرر با جهت معامله سازگار است",
    },
  ]
  const maxTradeRisk = positiveRule(rules?.maxTradeRiskPct)
  checks.push({
    key: "trade-risk",
    label: "ریسک هر معامله",
    status: maxTradeRisk == null || riskPct == null ? "unknown" : riskPct <= maxTradeRisk ? "pass" : "fail",
    detail: maxTradeRisk == null ? "سقف تعیین نشده" : riskPct == null ? "داده کافی نیست" : `${riskPct.toFixed(2)}٪ از Equity در برابر سقف ${maxTradeRisk}٪`,
  })
  const maxOpenRisk = positiveRule(rules?.maxOpenRiskPct)
  checks.push({
    key: "open-risk",
    label: "ریسک کل باز پس از معامله",
    status: maxOpenRisk == null || afterOpenRiskPct == null ? "unknown" : afterOpenRiskPct <= maxOpenRisk ? "pass" : "fail",
    detail: maxOpenRisk == null ? "سقف تعیین نشده" : afterOpenRiskPct == null ? "ریسک فعلی کامل نیست" : `${afterOpenRiskPct.toFixed(2)}٪ در برابر سقف ${maxOpenRisk}٪`,
  })

  return {
    risk,
    riskPct,
    rewardRisk,
    afterOpenRiskPct,
    checks,
    status: checks.some((check) => check.status === "fail")
      ? "incompatible"
      : checks.some((check) => check.status === "unknown")
        ? "review"
        : "compatible",
  }
}

export function scenarioEstimate(snapshot, symbol, shockPct) {
  const metric = (snapshot?.symbol_metrics || []).find(
    (item) => normalizeSymbol(item?.symbol) === normalizeSymbol(symbol),
  )
  const exposure = finiteNumber(metric?.net_symbol_exposure_usd)
  const shock = finiteNumber(shockPct)
  const equity = finiteNumber(snapshot?.account?.equity)
  const currency = String(snapshot?.account?.currency || "")
  if (!metric || exposure == null || shock == null || equity == null || currency !== "USD") {
    return { available: false, pnl: null, equityAfter: null, reason: currency && currency !== "USD" ? "تبدیل Exposure دلاری به ارز حساب در Snapshot موجود نیست" : "داده کافی برای این سناریو موجود نیست" }
  }
  const pnl = exposure * shock / 100
  return { available: true, pnl, equityAfter: equity + pnl, reason: null }
}
