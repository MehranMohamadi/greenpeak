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
  contractSize: "",
  stopLoss: "",
  takeProfit: "",
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
  const defaults = ["US500", "XAUUSD"]
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
  return [...defaults, ...[...symbols]
    .filter((symbol) => !defaults.includes(normalizeSymbol(symbol)))
    .sort((a, b) => a.localeCompare(b))]
}

export function tradeAssetVolume(draft) {
  const lots = positiveRule(draft?.volume)
  const contractSize = positiveRule(draft?.contractSize)
  if (lots == null || contractSize == null) return null
  const quantity = lots * contractSize
  return Number.isFinite(quantity) && quantity > 0 ? quantity : null
}

export function tradeInputErrors(draft) {
  const errors = {}
  if (!normalizeSymbol(draft?.symbol)) errors.symbol = "نماد را انتخاب کنید."
  if (!["BUY", "SELL"].includes(draft?.direction)) errors.direction = "جهت معامله را انتخاب کنید."
  if (!["MARKET", "PENDING"].includes(draft?.orderType)) errors.orderType = "نوع سفارش را انتخاب کنید."
  for (const [key, label] of [
    ["volume", "حجم لات"], ["contractSize", "اندازه قرارداد"],
    ["entryPrice", "قیمت ورود"], ["stopLoss", "حد ضرر"], ["takeProfit", "حد سود"],
  ]) {
    if (positiveRule(draft?.[key]) == null) errors[key] = `${label} باید عددی بزرگ‌تر از صفر باشد.`
  }
  if (!errors.volume && !errors.contractSize && tradeAssetVolume(draft) == null) {
    errors.contractSize = "حاصل حجم و اندازه قرارداد قابل محاسبه نیست."
  }
  return errors
}

export function tradeMarketRequest(symbol) {
  const normalized = normalizeSymbol(symbol)
  if (/^(US500|SP500|SPX500|SPX|USA500)([._-].*)?$/.test(normalized)) {
    return { url: "/api/market/sp500?timeframe=1D", responseType: "ohlc" }
  }
  if (/^(XAUUSD|GOLD)([._-].*)?$/.test(normalized)) {
    return { url: "/api/intermarket?series=GOLDAMGBD228NLBM&range=1mo", responseType: "series" }
  }
  return null
}

export function latestSiteQuote(payload, responseType) {
  const data = responseType === "ohlc" ? payload : payload?.data
  if (!Array.isArray(data)) return null
  let latest = null
  for (const point of data) {
    const price = positiveRule(responseType === "ohlc" ? point?.close : point?.value)
    const timestamp = responseType === "ohlc"
      ? (typeof point?.time === "number" ? point.time * 1000 : NaN)
      : Date.parse(point?.date)
    if (price == null || !Number.isFinite(timestamp) || Number.isNaN(new Date(timestamp).getTime())) continue
    if (!latest || timestamp > latest.timestamp) latest = { price, timestamp }
  }
  if (!latest) return null
  return {
    price: latest.price,
    observedAt: new Date(latest.timestamp).toISOString(),
    source: responseType === "ohlc" ? "S&P 500 · Yahoo Finance" : [
      payload?.metadata?.title, payload?.metadata?.source || payload?.metadata?.source_provider,
    ].filter(Boolean).join(" · ") || "داده طلا در سایت",
  }
}

export function brokerSpecFor(snapshot, symbol) {
  const wanted = normalizeSymbol(symbol)
  const specs = snapshot?.broker_symbol_data || []
  const exact = specs.find(
    (item) => normalizeSymbol(item?.symbol) === wanted,
  )
  if (exact) return exact
  // Default dashboard symbols can use one unambiguous broker alias.
  if (!["US500", "XAUUSD"].includes(wanted)) return null
  const aliases = specs.filter((item) => matchingTradeSymbol(wanted, item?.symbol))
  return aliases.length === 1 ? aliases[0] : null
}

export function brokerContractSize(snapshot, symbol) {
  const spec = brokerSpecFor(snapshot, symbol)
  const positiveSize = (value) => ["number", "string"].includes(typeof value) ? positiveRule(value) : null
  return positiveSize(spec?.contract_size) ?? positiveSize(spec?.trade_contract_size)
}

export function tradePriceStep(spec) {
  const tick = positiveRule(spec?.tick_size) ?? positiveRule(spec?.point)
  if (tick != null) return tick
  const digits = finiteNumber(spec?.digits)
  return digits != null && Number.isInteger(digits) && digits >= 0 && digits <= 10
    ? 10 ** -digits : 0.01
}

export function stepTradePrice(value, basePrice, step, direction) {
  const base = positiveRule(value) ?? positiveRule(basePrice)
  const increment = positiveRule(step)
  if (base == null || increment == null || ![1, -1].includes(direction)) return null
  const next = Number((base + direction * increment).toPrecision(15))
  return Number.isFinite(next) && next > 0 ? next : null
}

export function parseTradePlans(raw) {
  try {
    const plans = JSON.parse(raw || "[]")
    return Array.isArray(plans) ? plans.filter((plan) =>
      plan && typeof plan === "object" && typeof plan.id === "string" && plan.id.trim()
      && plan.draft && typeof plan.draft === "object" && !Array.isArray(plan.draft),
    ) : []
  } catch { return [] }
}

export function createTradePlan({ id, createdAt, draft, review }) {
  return {
    id, createdAt, draft: { ...draft }, previewStatus: review.status, ticketId: "",
    analysis: {
      summary: review.analysis.summary,
      risks: [...review.analysis.risks],
      strengths: [...review.analysis.strengths],
      limitations: [...review.analysis.limitations],
    },
  }
}

export function confirmTradePlanTicket(plan, ticket, snapshot, confirmedAt) {
  const ticketId = normalizePositionIdentifier(ticket)
  if (!ticketId) return null
  const confirmed = { ...plan, ticketId, ticketConfirmedAt: confirmedAt }
  return { ...confirmed, ticketAssessment: assessPlannedTrade(confirmed, snapshot) }
}

export function normalizePositionIdentifier(value) {
  if (!["string", "number"].includes(typeof value)) return ""
  if (typeof value === "number" && !Number.isSafeInteger(value)) return ""
  return String(value ?? "").trim().replace(/^#\s*/, "").replace(/[۰-۹٠-٩]/g, (digit) => {
    const code = digit.charCodeAt(0)
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660)
  })
}

export function positionIdentifier(position) {
  return normalizePositionIdentifier(position?.position_identifier ?? position?.position_id ?? position?.ticket)
}

export function orderIdentifier(order) {
  return normalizePositionIdentifier(order?.ticket ?? order?.order_number ?? order?.order_identifier ?? order?.order_id)
}

export function planTicketIdentifier(plan) {
  return normalizePositionIdentifier(plan?.ticketId ?? plan?.positionId)
}

function orderDirection(order) {
  const raw = normalizeSymbol(order?.order_type ?? order?.type).replace(/^ORDER_TYPE_/, "").replaceAll(" ", "_")
  if (["0", "2", "4", "6", "BUY", "BUY_LIMIT", "BUY_STOP", "BUY_STOP_LIMIT"].includes(raw)) return "BUY"
  if (["1", "3", "5", "7", "SELL", "SELL_LIMIT", "SELL_STOP", "SELL_STOP_LIMIT"].includes(raw)) return "SELL"
  return ""
}

function matchingTradeSymbol(first, second) {
  const firstMarket = tradeMarketRequest(first)
  const secondMarket = tradeMarketRequest(second)
  return normalizeSymbol(first) === normalizeSymbol(second)
    || Boolean(firstMarket && secondMarket && firstMarket.url === secondMarket.url)
}

export function assessPlannedTrade(plan, snapshot) {
  const id = planTicketIdentifier(plan)
  if (!id) return { status: "unassigned", scorePct: null, summary: "برای ارزیابی، شماره تیکت را وارد کنید.", checks: [] }
  const targets = [
    ...(snapshot?.positions || []).filter((item) => positionIdentifier(item) === id).map((item) => ({ item, kind: "position" })),
    ...(snapshot?.pending_orders || []).filter((item) => orderIdentifier(item) === id).map((item) => ({ item, kind: "order" })),
  ]
  if (!targets.length) return { status: "unavailable", scorePct: null, summary: "این تیکت در معاملات باز یا سفارش‌های در انتظار حساب یافت نشد.", checks: [] }
  if (targets.length !== 1) return { status: "ambiguous", scorePct: null, summary: "این تیکت در چند ردیف گزارش شده؛ تخصیص قابل تشخیص نیست.", checks: [] }
  const { item: position, kind } = targets[0]
  const draft = plan?.draft || {}
  const numeric = (value) => ["number", "string"].includes(typeof value) ? finiteNumber(value) : null
  const spec = brokerSpecFor(snapshot, position.symbol)
  const tick = positiveRule(spec?.tick_size) ?? positiveRule(spec?.point) ?? 0
  const actualDirection = normalizeSymbol(position?.direction)
  const direction = kind === "order" ? orderDirection(position) : ["BUY", "LONG", "0"].includes(actualDirection) ? "BUY"
    : ["SELL", "SHORT", "1"].includes(actualDirection) ? "SELL" : ""
  const checks = [
    { label: "نماد", status: typeof draft.symbol !== "string" || typeof position.symbol !== "string" || !normalizeSymbol(draft.symbol) || !normalizeSymbol(position.symbol) ? "unknown"
      : matchingTradeSymbol(draft.symbol, position.symbol) ? "pass" : "fail" },
    { label: "جهت", status: !["BUY", "SELL"].includes(draft.direction) || !direction ? "unknown"
      : draft.direction === direction ? "pass" : "fail" },
  ]
  for (const [label, plannedValue, actualValue, isPrice, isProtection] of [
    ["حجم لات", draft.volume, position.volume, false, false],
    ["قیمت ورود", draft.entryPrice, kind === "order" ? position.requested_price ?? position.order_price ?? position.open_price : position.open_price, true, false],
    ["SL", draft.stopLoss, position.stop_loss, true, true],
    ["TP", draft.takeProfit, position.take_profit, true, true],
  ]) {
    const planned = numeric(plannedValue)
    const actual = numeric(actualValue)
    let status = "unknown"
    if (planned != null && planned > 0 && actual != null && actual >= 0) {
      if (isProtection && actual === 0) status = "fail"
      else if (actual > 0) {
        const tolerance = (isPrice ? tick : 0) + Number.EPSILON * 16 * Math.max(1, planned, actual)
        status = Math.abs(planned - actual) <= tolerance ? "pass" : "fail"
      }
    }
    checks.push({ label, status })
  }
  const comparable = checks.filter((check) => check.status !== "unknown")
  const matched = comparable.filter((check) => check.status === "pass").length
  const mismatches = comparable.filter((check) => check.status === "fail").map((check) => check.label)
  const missing = checks.length - comparable.length
  const scorePct = comparable.length ? matched / comparable.length * 100 : null
  const summary = comparable.length
    ? `${Math.round(scorePct)}٪ انطباق در ${comparable.length} معیار؛ ${mismatches.length ? `اختلاف در ${mismatches.join("، ")}` : "معیارهای قابل بررسی مطابق‌اند"}${missing ? `؛ ${missing} معیار فاقد داده` : ""}.`
    : "داده کافی برای مقایسه این برنامه و معامله یا سفارش موجود نیست."
  return { status: mismatches.length ? "mismatch" : missing ? "partial" : "matched", scorePct, summary, checks, targetKind: kind }
}

export function assessAllocatedTrade(plans, snapshot, trade, kind) {
  const ticket = kind === "order" ? orderIdentifier(trade) : positionIdentifier(trade)
  const assigned = ticket ? plans.filter((plan) => planTicketIdentifier(plan) === ticket) : []
  if (!assigned.length) return { status: "unassigned", scorePct: null, summary: "برنامه‌ای به این تیکت تخصیص داده نشده است.", checks: [] }
  if (assigned.length !== 1) return { status: "ambiguous", scorePct: null, summary: "چند برنامه به این تیکت متصل است؛ تخصیص را اصلاح کنید.", checks: [] }
  return assessPlannedTrade(assigned[0], snapshot)
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
    const direction = orderDirection(order)
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

// Analyze each account with its own broker specifications before summing money.
// USD exposures must never be divided by equity in a different currency.
export function aggregateRiskOverview(entries, now = new Date(), serverLeverage = null) {
  const accounts = entries.map(({ snapshot, rules = {} }) => {
    const equity = finiteNumber(snapshot?.account?.equity)
    const exposure = finiteNumber(snapshot?.portfolio_metrics?.gross_portfolio_exposure_usd)
    const currency = String(snapshot?.account?.currency || "").trim().toUpperCase()
    const openRisk = analyzeOpenRisk(snapshot)
    const history = analyzeTradeHistory(snapshot, now)
    const maxLeverage = positiveRule(rules.maxGrossLeverage)
    const minMargin = Math.max(100, positiveRule(rules.minMarginLevelPct) || 100)
    const usedMargin = finiteNumber(snapshot?.account?.used_margin)
    const marginLevel = usedMargin != null && usedMargin > 0 && equity != null
      ? equity / usedMargin * 100 : finiteNumber(snapshot?.account?.margin_level_pct)
    const leverage = finiteNumber(snapshot?.leverage?.value)
    const warnings = []
    if (equity == null) warnings.push("اکوییتی حساب موجود نیست")
    else if (equity <= 0) warnings.push("اکوییتی حساب صفر یا منفی است؛ خطر بسته‌شدن اجباری معاملات")
    if (maxLeverage != null && leverage != null && leverage > maxLeverage) {
      warnings.push(`اهرم حساب ${leverage.toFixed(2)}× از سقف ${maxLeverage}× بیشتر است`)
    }
    if (maxLeverage == null) warnings.push("سقف اهرم این حساب تعیین نشده است")
    if (leverage == null) warnings.push(leverageReason(snapshot?.leverage?.reason))
    if (usedMargin !== 0 && marginLevel != null && marginLevel < minMargin) {
      warnings.push(`سطح مارجین ${marginLevel.toFixed(1)}٪ کمتر از حد پایش ${minMargin}٪ است؛ خطر کال مارجین را در همین حساب بررسی کنید`)
    }
    if (usedMargin !== 0 && marginLevel == null) warnings.push("سطح مارجین حساب قابل بررسی نیست")
    if (openRisk.missingStopCount) warnings.push(`${openRisk.missingStopCount} پوزیشن بدون حد ضرر`)
    if (!openRisk.complete) warnings.push("محاسبه ریسک پوزیشن‌های باز ناقص است")
    const maxRisk = positiveRule(rules.maxOpenRiskPct)
    if (maxRisk != null && openRisk.riskPct != null && openRisk.riskPct > maxRisk) warnings.push("ریسک باز حساب از سقف برنامه بیشتر است")
    const dailyLimit = positiveRule(rules.dailyLossLimitPct)
    if (dailyLimit != null && equity > 0 && history.realizedLossUsed > equity * dailyLimit / 100) warnings.push("بودجه زیان روزانه این حساب تمام شده است")
    const freshness = freshnessSummary(snapshot, now)
    if (!freshness.available || freshness.stale) warnings.push("داده حساب قدیمی است یا زمان آن مشخص نیست")
    return { snapshot, rules, currency, equity, exposure, openRisk, history, warnings }
  })
  const sum = (select) => {
    const values = accounts.map(select)
    if (!values.length || values.some((value) => value == null || !Number.isFinite(value))) return null
    const total = values.reduce((result, value) => result + value, 0)
    return Number.isFinite(total) ? total : null
  }
  const currencies = new Set(accounts.map((account) => account.currency))
  const commonCurrency = accounts.length > 0 && currencies.size === 1 && !currencies.has("")
  const currency = commonCurrency ? accounts[0].currency : null
  const moneySum = (select) => commonCurrency ? sum(select) : null
  const equity = moneySum((account) => account.equity)
  const exposure = sum((account) => account.exposure != null && account.exposure >= 0 ? account.exposure : null)
  const grossLeverage = finiteNumber(serverLeverage?.value)
  const usedMargin = moneySum(({ snapshot }) => {
    const value = finiteNumber(snapshot?.account?.used_margin)
    return value != null && value >= 0 ? value : null
  })
  const complete = accounts.length > 0 && accounts.every(({ openRisk }) => openRisk.complete)
  const total = complete ? moneySum(({ openRisk }) => openRisk.total) : null
  const dailyLimitAmount = moneySum(({ rules, equity }) => {
    const limit = positiveRule(rules.dailyLossLimitPct)
    return limit != null && equity > 0 ? equity * limit / 100 : null
  })
  const dailyLossUsed = moneySum(({ history }) => history.realizedLossUsed)
  const notices = []
  if (!commonCurrency) notices.push("ارز حساب‌ها یکسان یا مشخص نیست؛ جمع مبالغ و نسبت‌های پولی بدون نرخ تبدیل معتبر قابل محاسبه نیست.")
  if (grossLeverage == null) notices.push(leverageReason(serverLeverage?.reason))

  // Keep exposures in separate accounts from cancelling each other: collateral
  // and margin cannot move between brokers to cover an opposing position.
  const symbols = new Map()
  const concentrationComplete = accounts.every(({ snapshot, exposure }) => exposure === 0 || (
    Array.isArray(snapshot?.symbol_metrics) && snapshot.symbol_metrics.length > 0 &&
    snapshot.symbol_metrics.every((item) => normalizeSymbol(item?.symbol) && finiteNumber(item?.net_symbol_exposure_usd) != null)
  ))
  for (const { snapshot } of accounts) {
    for (const item of snapshot?.symbol_metrics || []) {
      const amount = finiteNumber(item?.net_symbol_exposure_usd)
      const symbol = normalizeSymbol(item?.symbol)
      if (amount != null && symbol) symbols.set(symbol, (symbols.get(symbol) || 0) + Math.abs(amount))
    }
  }
  const concentration = concentrationSummary({
    symbol_metrics: concentrationComplete ? [...symbols].map(([symbol, amount]) => ({ symbol, net_symbol_exposure_usd: amount })) : [],
    portfolio_metrics: { gross_portfolio_exposure_usd: exposure },
  })
  return {
    currency, equity, grossLeverage, concentration, notices,
    balance: moneySum(({ snapshot }) => finiteNumber(snapshot?.account?.balance)),
    usedMargin,
    floating: moneySum(({ snapshot }) => finiteNumber(snapshot?.account?.floating_profit_loss)),
    freeMargin: moneySum(({ snapshot }) => finiteNumber(snapshot?.account?.free_margin)),
    marginLevel: equity != null && usedMargin > 0 ? equity / usedMargin * 100 : null,
    dailyLimitAmount,
    dailyRemaining: dailyLimitAmount != null && dailyLossUsed != null ? dailyLimitAmount - dailyLossUsed : null,
    history: { realizedToday: moneySum(({ history }) => history.realizedToday) },
    openRisk: {
      positions: accounts.flatMap(({ openRisk }) => openRisk.positions),
      pendingOrders: accounts.flatMap(({ openRisk }) => openRisk.pendingOrders),
      total, complete: complete && total != null,
      riskPct: total != null && equity > 0 ? total / equity * 100 : null,
      missingStopCount: accounts.reduce((count, { openRisk }) => count + openRisk.missingStopCount, 0),
      pendingMissingStopCount: accounts.reduce((count, { openRisk }) => count + openRisk.pendingMissingStopCount, 0),
      unavailableCount: accounts.reduce((count, { openRisk }) => count + openRisk.unavailableCount, 0),
    },
    accountWarnings: accounts.filter(({ warnings }) => warnings.length > 0).map(({ snapshot, warnings }) => ({ snapshot, warnings })),
  }
}

export function leverageReason(reason) {
  return {
    unsupported_currency: "برای محاسبه اهرم، تبدیل معتبر اکوییتی به دلار موجود نیست.",
    missing_equity: "اکوییتی معتبر برای محاسبه اهرم موجود نیست.",
    non_positive_equity: "اکوییتی صفر یا منفی است؛ اهرم قابل محاسبه نیست.",
    missing_exposure: "اکسپوژر معتبر معاملات باز برای محاسبه اهرم موجود نیست.",
    incomplete_positions: "اطلاعات معاملات باز برای محاسبه اهرم ناقص است.",
    inconsistent_positions: "فهرست معاملات باز با اکسپوژر گزارش‌شده سازگار نیست.",
    missing_symbol_exposure: "اکسپوژر خالص این نماد موجود نیست.",
    incomplete_accounts: "داده لازم برای محاسبه اهرم حداقل یک حساب ناقص است؛ مجموع ناقص نمایش داده نمی‌شود.",
    no_accounts: "حسابی برای محاسبه اهرم موجود نیست.",
    invalid_result: "داده معتبر برای محاسبه اهرم موجود نیست.",
  }[reason] || "محاسبه اهرم از سرور دریافت نشده است."
}

export function freshnessSummary(snapshot, now = new Date(), staleMinutes = 15) {
  const timestamp = new Date(snapshot?.timestamp_utc)
  if (Number.isNaN(timestamp.getTime())) return { available: false, stale: true, ageMinutes: null, timestamp: null }
  const ageMinutes = Math.max(0, (now.getTime() - timestamp.getTime()) / 60000)
  return { available: true, stale: ageMinutes > staleMinutes, ageMinutes, timestamp }
}

export function buildBehaviorAnalysis({ snapshot, rules = {}, plans = [], lifecycles = [], now = new Date() }) {
  const openRisk = analyzeOpenRisk(snapshot)
  const history = analyzeTradeHistory(snapshot, now)
  const freshness = freshnessSummary(snapshot, now)
  const concentration = concentrationSummary(snapshot)
  const equity = positiveRule(snapshot?.account?.equity)
  const currency = snapshot?.account?.currency || "USD"
  const format = (value, digits = 1) => Number(value).toLocaleString("fa-IR", { maximumFractionDigits: digits })
  const amount = (value) => `${format(value, 2)} ${currency}`
  const closed = lifecycles.filter((trade) => trade.status === "closed")
  const complete = closed.filter((trade) => {
    const executions = trade.executions || []
    const entries = executions.filter((item) => item.entryLabel === "ورود")
    const exits = executions.filter((item) => ["خروج", "خروج متقابل"].includes(item.entryLabel))
    if (!entries.length || !exits.length || executions.some((item) =>
      !["ورود", "خروج", "خروج متقابل"].includes(item.entryLabel)
      || positiveRule(item.volume) == null || finiteNumber(item.profit) == null,
    ) || finiteNumber(trade.netProfit) == null) return false
    const entered = entries.reduce((total, item) => total + Number(item.volume), 0)
    const exited = exits.reduce((total, item) => total + Number(item.volume), 0)
    return Math.abs(entered - exited) <= Number.EPSILON * 16 * Math.max(1, entered, exited)
  })
  const wins = complete.filter((trade) => trade.netProfit > 0).length
  const netResult = complete.reduce((total, trade) => total + Number(trade.netProfit), 0)
  const lines = [{
    key: "performance", tone: complete.length && netResult < 0 ? "warning" : "neutral",
    text: complete.length
      ? `نتیجه ثبت‌شده: ${format(wins / complete.length * 100)}٪ سوددهی در ${complete.length} معامله کامل؛ خالص گزارش‌شده ${amount(netResult)}${complete.length < 10 ? "؛ نمونه برای نتیجه‌گیری پایدار کوچک است" : ""}.`
      : "نتیجه معاملات: سابقهٔ کامل ورود و خروج برای سنجش نرخ سوددهی موجود نیست.",
  }]

  const perTradeLimit = positiveRule(rules.maxTradeRiskPct)
  const hasReportedHistory = Array.isArray(snapshot?.trade_history_delta)
    && positiveRule(history.historyWindowDays) != null
    && history.deals.length === snapshot.trade_history_delta.length
    && history.deals.filter((deal) => [1, 2, 3].includes(Number(deal.entry_type)))
      .every((deal) => finiteNumber(deal.profit) != null)
  const positionRisks = openRisk.positions.filter((position) => position.risk.amount != null)
  const oversized = perTradeLimit != null && equity != null
    ? positionRisks.filter((position) => position.risk.amount / equity * 100 > perTradeLimit).length : 0
  const riskChecks = [{
    label: "ریسک هر معامله", status: perTradeLimit == null || equity == null ? "unknown"
      : oversized ? "fail" : positionRisks.length === openRisk.positions.length ? "pass" : "unknown",
  }]
  for (const [label, limitValue, observed, minimum] of [
    ["ریسک کل باز", rules.maxOpenRiskPct, openRisk.riskPct, false],
    ["زیان روزانه", rules.dailyLossLimitPct, equity == null || !hasReportedHistory ? null : history.realizedLossUsed / equity * 100, false],
    ["اهرم", rules.maxGrossLeverage, snapshot?.leverage?.value, false],
    ["مارجین", rules.minMarginLevelPct, snapshot?.account?.margin_level_pct, true],
  ]) {
    const limit = positiveRule(limitValue)
    const value = finiteNumber(observed)
    riskChecks.push({ label, status: limit == null || value == null ? "unknown"
      : (minimum ? value >= limit : value <= limit) ? "pass" : "fail" })
  }
  const violations = riskChecks.filter((check) => check.status === "fail")
  const checked = riskChecks.filter((check) => check.status !== "unknown").length
  lines.push({ key: "risk", tone: violations.length ? "danger" : checked < riskChecks.length ? "warning" : "success",
    text: violations.length
      ? `رعایت ریسک: ${violations.map((check) => check.label).join("، ")} خارج از حدود ثبت‌شده است${oversized ? `؛ ${oversized} پوزیشن بالاتر از سقف ریسک هر معامله` : ""}.`
      : checked ? `رعایت ریسک: ${checked} کنترل قابل محاسبه داخل حدود ثبت‌شده است${checked < riskChecks.length ? `؛ ${riskChecks.length - checked} کنترل فاقد داده یا حد شخصی` : ""}.`
        : "رعایت ریسک: حدود شخصی یا دادهٔ لازم برای ارزیابی کافی نیست.",
  })
  const maxTrades = positiveRule(rules.maxTradesPerDay)
  lines.push({ key: "discipline", tone: maxTrades != null && history.todayEntryCount > maxTrades ? "warning" : "neutral",
    text: hasReportedHistory
      ? `نظم ورودها: ${history.todayEntryCount} ورود ثبت‌شده امروز${maxTrades == null ? "؛ سقف تعداد ورود تعیین نشده" : ` در برابر سقف ${format(maxTrades, 0)}${history.todayEntryCount > maxTrades ? "؛ سقف رعایت نشده" : history.todayEntryCount === maxTrades ? "؛ ظرفیت امروز پر شده" : "؛ داخل سقف برنامه"}`}.`
      : "نظم ورودها: بازهٔ تاریخچه یا دادهٔ معتبر ورود و خروج برای بررسی کافی نیست.",
  })
  lines.push({ key: "after-loss", tone: history.raisedVolumeAfterLoss ? "warning" : "neutral",
    text: history.raisedVolumeAfterLoss
      ? `رفتار پس از زیان: ${history.raisedVolumeAfterLoss} ورود با افزایش حجم تا ۳۰ دقیقه پس از خروج زیان‌ده دیده شد${!history.behaviorSampleSufficient ? "؛ سابقه محدود است" : ""}.`
      : history.behaviorSampleSufficient ? "رفتار پس از زیان: در سابقهٔ موجود، افزایش حجم پس از خروج زیان‌ده دیده نشد."
        : "رفتار پس از زیان: سابقه برای ارزیابی قابل اتکا کافی نیست.",
  })
  const assessments = plans.map((plan) => assessPlannedTrade(plan, snapshot))
  const evaluated = assessments.filter((assessment) => ["matched", "mismatch"].includes(assessment.status))
  const matched = evaluated.filter((assessment) => assessment.status === "matched").length
  lines.push({ key: "plans", tone: evaluated.some((assessment) => assessment.status === "mismatch") ? "warning" : "neutral",
    text: evaluated.length
      ? `پایبندی به برنامه: ${matched} از ${evaluated.length} برنامهٔ مرتبط و قابل مقایسه مطابق است${assessments.length > evaluated.length ? `؛ ${assessments.length - evaluated.length} برنامه بدون تیکت قابل ارزیابی یا با دادهٔ ناقص` : ""}.`
      : plans.length ? "پایبندی به برنامه: برنامه‌ها هنوز به تیکت قابل ارزیابی مرتبط نشده‌اند یا دادهٔ مقایسه ناقص است."
        : "پایبندی به برنامه: برنامهٔ ذخیره‌شده‌ای برای این حساب موجود نیست.",
  })
  const attention = []
  if (freshness.stale) attention.push("دادهٔ حساب قدیمی یا زمان آن نامعتبر است")
  if (openRisk.missingStopCount) attention.push(`${openRisk.missingStopCount} پوزیشن بدون SL`)
  else if (!openRisk.complete) attention.push("محاسبهٔ ریسک باز ناقص است")
  if (concentration.sharePct > 50) attention.push(`${format(concentration.sharePct)}٪ مواجهه روی ${String(concentration.symbol)}`)
  if (closed.length > complete.length) attention.push(`${closed.length - complete.length} معامله با سابقهٔ ناقص از نرخ سوددهی کنار گذاشته شد`)
  const windowDays = positiveRule(history.historyWindowDays)
  lines.push({ key: "attention", tone: attention.length ? "warning" : "neutral",
    text: attention.length ? `نیازمند توجه: ${attention.slice(0, 3).join("؛ ")}${attention.length > 3 ? `؛ ${attention.length - 3} مورد دیگر` : ""}.`
      : `دامنهٔ بررسی: دادهٔ حساب و تاریخچهٔ ارسال‌شده${windowDays == null ? "؛ بازهٔ تاریخچه مشخص نیست" : ` در بازهٔ ${format(windowDays, 0)} روزه`}.`,
  })
  return { lines, completeTradeCount: complete.length, winRatePct: complete.length ? wins / complete.length * 100 : null, netResult: complete.length ? netResult : null }
}

export function previewTrade(snapshot, draft, rules, openRisk) {
  const entry = finiteNumber(draft?.entryPrice)
  const stop = finiteNumber(draft?.stopLoss)
  const target = finiteNumber(draft?.takeProfit)
  const inputErrors = tradeInputErrors(draft)
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
      key: "inputs",
      label: "اطلاعات پایه معامله",
      status: Object.keys(inputErrors).length ? "fail" : "pass",
      detail: Object.keys(inputErrors).length
        ? Object.values(inputErrors).join(" ")
        : "اطلاعات اجباری معامله ثبت شده‌اند",
    },
    {
      key: "stop",
      label: "حد ضرر معتبر",
      status: risk.status === "available" ? "pass" : "fail",
      detail: risk.reason || "حد ضرر با جهت معامله سازگار است",
    },
  ]
  checks.push({
    key: "target",
    label: "حد سود معتبر",
    status: target == null || target <= 0 ? "unknown" : rewardDistance != null && rewardDistance > 0 ? "pass" : "fail",
    detail: target == null || target <= 0
      ? "حد سود ثبت نشده است"
      : rewardDistance != null && rewardDistance > 0
        ? "حد سود با جهت معامله سازگار است"
        : "جای حد سود با جهت معامله سازگار نیست",
  })
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
    assetVolume: tradeAssetVolume(draft),
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

function meaningfulText(value) {
  return String(value || "").trim().replace(/\s+/g, " ")
}

function wordCount(value) {
  const text = meaningfulText(value)
  return text ? text.split(" ").length : 0
}

export function buildTradeReview(snapshot, draft, rules, openRisk) {
  const review = previewTrade(snapshot, draft, rules, openRisk)
  const risks = []
  const strengths = []
  const limitations = []
  const rationale = meaningfulText(draft?.rationale)
  const invalidation = meaningfulText(draft?.invalidation)
  const mentalState = meaningfulText(draft?.mentalState)
  const history = analyzeTradeHistory(snapshot)
  const freshness = freshnessSummary(snapshot)
  const maxTrades = positiveRule(rules?.maxTradesPerDay)
  const dailyLossLimitPct = positiveRule(rules?.dailyLossLimitPct)
  const equity = finiteNumber(snapshot?.account?.equity)
  const dailyLossLimit = dailyLossLimitPct != null && equity != null && equity > 0
    ? equity * dailyLossLimitPct / 100
    : null

  if (wordCount(rationale) < 8) {
    risks.push("منطق ورود کوتاه یا ناکافی است؛ شواهد قابل سنجش، تایم‌فریم و دلیل انتخاب نقطه ورود را روشن‌تر ثبت کنید.")
  } else {
    strengths.push("برای منطق ورود توضیح نسبتاً کافی ثبت شده است؛ کیفیت خود تحلیل همچنان نیازمند قضاوت معامله‌گر است.")
  }

  if (wordCount(invalidation) < 5) {
    risks.push("شرط ابطال سناریو دقیق نیست؛ رویداد یا سطحی را مشخص کنید که با وقوع آن دیگر نباید در معامله بمانید.")
  } else {
    strengths.push("شرط ابطال سناریو ثبت شده است.")
  }

  if (review.rewardRisk == null) {
    risks.push("نسبت سود به زیان قابل محاسبه نیست؛ قیمت ورود، حد ضرر و حد سود را بررسی کنید.")
  } else if (review.rewardRisk < 1) {
    risks.push(`نسبت سود به زیان ${review.rewardRisk.toFixed(2)} است و زیان برنامه‌ریزی‌شده از سود هدف بیشتر است.`)
  } else if (review.rewardRisk < 1.5) {
    risks.push(`نسبت سود به زیان ${review.rewardRisk.toFixed(2)} است؛ حاشیه پاداش نسبت به ریسک محدود است.`)
  } else {
    strengths.push(`نسبت سود به زیان برنامه‌ریزی‌شده ${review.rewardRisk.toFixed(2)} است.`)
  }

  if (freshness.stale) {
    risks.push(freshness.ageMinutes == null
      ? "زمان Snapshot حساب معتبر نیست و بررسی بر داده تازه تکیه ندارد."
      : `Snapshot حساب حدود ${Math.round(freshness.ageMinutes)} دقیقه قدیمی است؛ قیمت، Equity و ریسک باز ممکن است تغییر کرده باشند.`)
  }

  if (!openRisk?.complete) {
    limitations.push("ریسک همه پوزیشن‌های باز قابل محاسبه نیست؛ بنابراین ریسک کل پس از این معامله ممکن است کمتر از مقدار واقعی دیده شود.")
  }

  const sameSymbolPositions = (snapshot?.positions || []).filter(
    (position) => normalizeSymbol(position?.symbol) === normalizeSymbol(draft?.symbol),
  )
  if (sameSymbolPositions.length) {
    risks.push(`${sameSymbolPositions.length} پوزیشن باز روی همین نماد وجود دارد؛ هم‌جهتی و تمرکز ریسک را جداگانه بررسی کنید.`)
  }

  if (maxTrades != null && history.todayEntryCount >= maxTrades) {
    risks.push(`تعداد ورودهای امروز (${history.todayEntryCount}) به سقف برنامه روزانه (${maxTrades}) رسیده است.`)
  } else if (maxTrades == null) {
    limitations.push("سقف تعداد معاملات روزانه تعیین نشده است.")
  }

  if (dailyLossLimit != null && history.realizedLossUsed >= dailyLossLimit) {
    risks.push("سقف زیان روزانه پر شده یا از آن عبور کرده است.")
  } else if (dailyLossLimitPct == null) {
    limitations.push("سقف زیان روزانه تعیین نشده است.")
  }

  if (!positiveRule(rules?.maxTradeRiskPct)) limitations.push("سقف ریسک هر معامله تعیین نشده است.")
  if (!positiveRule(rules?.maxOpenRiskPct)) limitations.push("سقف ریسک کل باز تعیین نشده است.")

  if (/عجول|انتقام|جبران|خشم|استرس|اضطراب|پس از زیان|بعد از زیان/i.test(mentalState)) {
    risks.push("وضعیت ذهنی ثبت‌شده می‌تواند احتمال تصمیم عجولانه یا معامله جبرانی را افزایش دهد؛ پیش از اجرا مکث و بازبینی مستقل انجام دهید.")
  } else if (!mentalState) {
    limitations.push("وضعیت ذهنی ثبت نشده است؛ این مورد اختیاری است اما برای کنترل رفتار معاملاتی مفید است.")
  }

  if (draft?.orderType === "PENDING") {
    limitations.push("در سفارش در انتظار، فاصله قیمت اجرا و لغزش احتمالی پس از فعال‌شدن در این محاسبه لحاظ نشده است.")
  }
  limitations.push("لغزش، گپ، نقدشوندگی و کمیسیون خروجِ ناشناخته در برآورد عددی لحاظ نشده‌اند.")

  const failedChecks = review.checks.filter((check) => check.status === "fail").length
  const unknownChecks = review.checks.filter((check) => check.status === "unknown").length
  const summary = failedChecks
    ? `این معامله ${failedChecks} کنترل ناسازگار دارد و پیش از اجرا باید اصلاح شود.`
    : unknownChecks
      ? `کنترل عددی ناسازگار ثبت نشده، اما ${unknownChecks} مورد به داده یا تصمیم تکمیلی نیاز دارد.`
      : risks.length
        ? "کنترل‌های عددی عبور کرده‌اند، اما نکات کیفی و زمینه‌ای زیر هنوز نیازمند توجه‌اند."
        : "بر اساس اطلاعات فعلی، کنترل‌های عددی و کیفی اصلی مانع مشخصی نشان نمی‌دهند."

  return {
    ...review,
    analysis: { summary, risks, strengths, limitations },
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
