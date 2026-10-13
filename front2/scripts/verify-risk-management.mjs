import { readFile } from "node:fs/promises"

const source = await readFile(new URL("../lib/risk-management.js", import.meta.url), "utf8")
const {
  analyzeOpenRisk,
  assessAllocatedTrade,
  assessPlannedTrade,
  availableSymbols,
  brokerContractSize,
  brokerSpecFor,
  buildBehaviorAnalysis,
  buildTradeReview,
  confirmTradePlanTicket,
  createTradePlan,
  EMPTY_TRADE_DRAFT,
  latestSiteQuote,
  normalizePositionIdentifier,
  orderIdentifier,
  parseTradePlans,
  planTicketIdentifier,
  previewTrade,
  scenarioEstimate,
  stepTradePrice,
  tradeAssetVolume,
  tradeInputErrors,
  tradeMarketRequest,
  tradePriceStep,
} = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`)
const lifecycleSource = await readFile(new URL("../lib/mt5-trade-lifecycles.js", import.meta.url), "utf8")
const { buildTradeLifecycles } = await import(`data:text/javascript;base64,${Buffer.from(lifecycleSource).toString("base64")}`)

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const baseSnapshot = {
  account: { currency: "USD", equity: 10_000 },
  portfolio_metrics: { gross_portfolio_exposure_usd: 20_000, gross_portfolio_leverage: 2 },
  broker_symbol_data: [{ symbol: "XAUUSD", tick_size: 0.01, tick_value: 1 }],
  positions: [{
    position_identifier: "1",
    symbol: "XAUUSD",
    direction: "BUY",
    volume: 0.1,
    current_valuation_price: 3_000,
    stop_loss: 2_990,
  }],
  pending_orders: [],
  symbol_metrics: [{ symbol: "XAUUSD", net_symbol_exposure_usd: 10_000 }],
  trade_history_delta: [],
  calculation_status: { trade_history_window_days: 7 },
  timestamp_utc: new Date().toISOString(),
}

const completeRisk = analyzeOpenRisk(baseSnapshot)
assert(completeRisk.complete, "A fully specified position must produce complete risk")
assert(completeRisk.total === 100, "Stop risk must use distance / tick size × tick value × lots")
assert(completeRisk.riskPct === 1, "Open risk percentage must use account equity")

const incompleteRisk = analyzeOpenRisk({
  ...baseSnapshot,
  positions: [...baseSnapshot.positions, { ...baseSnapshot.positions[0], position_identifier: "2", stop_loss: 0 }],
})
assert(!incompleteRisk.complete, "A missing stop must make aggregate open risk incomplete")
assert(incompleteRisk.total === null, "Incomplete aggregate risk must not be presented as a complete number")
assert(incompleteRisk.knownTotal === 100, "Known partial risk should remain available")
assert(incompleteRisk.missingStopCount === 1, "Missing stops must be counted")

const tradeDraft = {
  symbol: "XAUUSD",
  direction: "BUY",
  orderType: "MARKET",
  entryPrice: "3000",
  currentPrice: "3050",
  stopLoss: "2990",
  takeProfit: "3020",
  volume: "0.1",
  contractSize: "100",
}
const preview = previewTrade(baseSnapshot, tradeDraft, {
  maxTradeRiskPct: "2",
  maxOpenRiskPct: "5",
}, completeRisk)
assert(preview.risk.amount === 100, "Proposed trade risk is incorrect")
assert(preview.rewardRisk === 2, "Reward/risk ratio is incorrect")
assert(preview.afterOpenRiskPct === 2, "Post-trade open risk is incorrect")
assert(preview.status === "compatible", "A trade inside configured rules should be compatible")
assert(preview.assetVolume === 10, "Asset volume must be expressed in units, independent of market price")
assert(tradeAssetVolume({ volume: "0.25", contractSize: "100" }) === 25, "Fractional lots must produce the correct unit quantity")
for (const invalid of ["", "invalid", "0", "-1", "Infinity"]) {
  assert(tradeAssetVolume({ volume: invalid, contractSize: "100" }) === null, "Invalid lots must not become a quantity")
  assert(tradeAssetVolume({ volume: "0.1", contractSize: invalid }) === null, "Invalid contract sizes must not become a quantity")
}
assert(tradeAssetVolume({ volume: "1e308", contractSize: "1e308" }) === null, "Overflow must not produce an infinite quantity")
assert(Object.keys(tradeInputErrors(EMPTY_TRADE_DRAFT)).length === 6, "An empty draft must require the six unset mandatory inputs")
assert(Object.keys(tradeInputErrors(tradeDraft)).length === 0, "A complete trade draft must pass input validation")
for (const key of ["symbol", "direction", "orderType", "volume", "contractSize", "entryPrice", "stopLoss", "takeProfit"]) {
  assert(tradeInputErrors({ ...tradeDraft, [key]: "" })[key], `${key} must be required`)
}
assert(tradeInputErrors({ ...tradeDraft, orderType: "unknown" }).orderType, "Unknown order types must be rejected")
const incompletePreview = previewTrade(baseSnapshot, { ...tradeDraft, contractSize: "" }, {}, completeRisk)
assert(incompletePreview.status === "incompatible", "A missing mandatory contract size must block a compatible result")
const review = buildTradeReview(baseSnapshot, tradeDraft, {}, completeRisk)
assert(!review.analysis.risks.some((risk) => risk.includes("ستاپ")), "The removed setup field must not generate a review warning")

const defaultSymbols = availableSymbols(null)
assert(defaultSymbols.includes("US500") && defaultSymbols.includes("XAUUSD"), "Both default symbols must be available without broker symbol data")
const accountSymbols = availableSymbols({ broker_symbol_data: [{ symbol: "xauusd" }, { symbol: "EURUSD" }] })
assert(accountSymbols.includes("EURUSD"), "Broker symbols must remain selectable")
assert(accountSymbols.filter((symbol) => symbol.toUpperCase() === "XAUUSD").length === 1, "Case variants must not duplicate a default symbol")
assert(tradeMarketRequest("US500")?.responseType === "ohlc", "US500 must use the existing S&P 500 source")
assert(tradeMarketRequest("XAUUSD")?.url.includes("GOLDAMGBD228NLBM"), "XAUUSD must use the site's existing gold source")
assert(tradeMarketRequest("EURUSD") === null, "Unsupported market symbols must not be sent to another asset's source")

const brokerA = { broker_symbol_data: [{ symbol: "XAUUSD", contract_size: 100 }, { symbol: "US500.cash", contract_size: 1 }] }
const brokerB = { broker_symbol_data: [{ symbol: "XAUUSD", contract_size: 10 }] }
assert(brokerContractSize(brokerA, "XAUUSD") === 100 && brokerContractSize(brokerB, "XAUUSD") === 10, "Contract size must come from the selected broker, without carrying values between accounts")
assert(brokerContractSize(brokerA, "US500") === 1, "A default symbol must resolve an unambiguous broker alias")
assert(brokerSpecFor(brokerA, "US500")?.symbol === "US500.cash", "The actual broker symbol must remain available for source attribution")
assert(brokerContractSize(brokerB, "US500") === null && brokerContractSize(null, "XAUUSD") === null, "Missing broker specs must not use another account or an invented default size")
assert(brokerContractSize({ broker_symbol_data: [{ symbol: "US500.cash", contract_size: 1 }, { symbol: "SPX500.pro", contract_size: 10 }] }, "US500") === null, "Multiple broker aliases must require explicit symbol selection")
assert(brokerContractSize({ broker_symbol_data: [{ symbol: "XAUUSD", contract_size: true }] }, "XAUUSD") === null, "Malformed broker contract sizes must remain unavailable")
assert(brokerContractSize({ broker_symbol_data: [{ symbol: "XAUUSD", trade_contract_size: "100" }] }, "XAUUSD") === 100, "Alternate MT5 contract size fields must be supported")

const indexQuote = latestSiteQuote([
  { time: 200, close: 6001 }, { time: 100, close: 5999 },
  { time: 300, close: null }, { time: 400, close: "invalid" }, { time: "bad", close: 6003 },
], "ohlc")
assert(indexQuote.price === 6001 && indexQuote.observedAt === new Date(200_000).toISOString(), "Current price must use the latest dated valid candle, not array order")
const goldQuote = latestSiteQuote({
  data: [{ date: "2025-01-02", value: 3001 }, { date: "2025-01-01", value: 3000 }, { date: "bad", value: 3002 }],
  metadata: { title: "COMEX Gold Futures", source: "Yahoo Finance" },
}, "series")
assert(goldQuote.price === 3001 && goldQuote.source.includes("COMEX Gold Futures"), "Gold must preserve the site's quote attribution")
assert(latestSiteQuote([], "ohlc") === null && latestSiteQuote({ data: [{ date: "2025-01-01", value: null }] }, "series") === null, "Missing prices must remain unavailable")

const scenario = scenarioEstimate(baseSnapshot, "XAUUSD", -5)
assert(scenario.pnl === -500, "Scenario P/L is incorrect")
assert(scenario.equityAfter === 9_500, "Scenario equity is incorrect")

assert(stepTradePrice("", 3000, 0.01, -1) === 2999.99, "An empty SL must step from the price, not zero")
assert(stepTradePrice("", 3000, 0.01, 1) === 3000.01, "An empty TP must step from the price, not zero")
assert(stepTradePrice("2990", 3000, 0.01, 1) === 2990.01, "An entered price must remain the stepping base")
assert(stepTradePrice("", null, 0.01, 1) === null, "A missing reference price must not fabricate a starting price")
assert(stepTradePrice("0.01", 3000, 0.01, -1) === null, "Price controls must not create zero or negative prices")
assert(tradePriceStep({ tick_size: 0.25, point: 0.01 }) === 0.25, "Price controls must use the broker tick step")
assert(tradePriceStep({ digits: 5 }) === 0.00001, "Price digits must support small currency price steps")

const positionId = "12345678901234567890"
assert(normalizePositionIdentifier(" #۱۲۳۴۵۶۷۸۹۰۱۲۳۴۵۶۷۸۹۰ ") === positionId, "Pasted position IDs must preserve all digits and support Persian numerals")
assert(normalizePositionIdentifier("١٢٣") === "123", "Arabic numerals must be normalized for matching")
assert(normalizePositionIdentifier(Number(positionId)) === "", "An unsafe numeric ID must not produce a false match")
const assignedPlan = { id: "test-plan", draft: tradeDraft, positionId }
const matchingSnapshot = { ...baseSnapshot, positions: [{
  ...baseSnapshot.positions[0], position_identifier: positionId, open_price: 3000, take_profit: 3020,
}] }
const matching = assessPlannedTrade(assignedPlan, matchingSnapshot)
assert(matching.status === "matched" && matching.scorePct === 100 && matching.checks.length === 6, "A fully matching assigned position must pass all six criteria")
const changed = assessPlannedTrade(assignedPlan, { ...matchingSnapshot, positions: [{
  ...matchingSnapshot.positions[0], volume: 0.2, stop_loss: 0,
}] })
assert(changed.status === "mismatch" && changed.checks.filter((check) => check.status === "fail").length === 2, "A changed lot size and removed SL must count as discrepancies")
const partial = assessPlannedTrade(assignedPlan, { ...matchingSnapshot, positions: [{
  ...matchingSnapshot.positions[0], open_price: null,
}] })
assert(partial.status === "partial" && partial.summary.includes("فاقد داده"), "Missing position data must not claim full conformance")
const malformed = assessPlannedTrade(assignedPlan, { ...matchingSnapshot, positions: [{
  ...matchingSnapshot.positions[0], volume: true,
}] })
assert(malformed.status === "partial", "Malformed numeric position data must remain unknown")
const tickMatch = assessPlannedTrade(assignedPlan, { ...matchingSnapshot, positions: [{
  ...matchingSnapshot.positions[0], open_price: 3000.01,
}] })
assert(tickMatch.status === "matched", "A one-tick price difference must respect the displayed tolerance")
assert(assessPlannedTrade({ ...assignedPlan, positionId: "" }, matchingSnapshot).status === "unassigned", "A plan must not be automatically assigned to a position")
assert(assessPlannedTrade(assignedPlan, { positions: [] }).status === "unavailable", "Positions from another or unavailable account must not be assumed present")
const restored = parseTradePlans(JSON.stringify([assignedPlan, null, {}, { id: "invalid", draft: [] }]))
assert(restored.length === 1 && restored[0].positionId === positionId, "Saved associations must survive JSON round trips without ID truncation")
assert(parseTradePlans("broken").length === 0 && parseTradePlans('{}').length === 0, "Malformed stored plans must have a safe empty state")

const pendingTicket = "22345678901234567890"
const pendingOrder = { ticket: pendingTicket, symbol: "XAUUSD", order_type: 2, volume: 0.1, requested_price: 3000, stop_loss: 2990, take_profit: 3020 }
const pendingSnapshot = { ...matchingSnapshot, pending_orders: [pendingOrder] }
const pendingPlan = { id: "pending-plan", ticketId: pendingTicket, draft: { ...tradeDraft, orderType: "PENDING" } }
const pendingAssessment = assessPlannedTrade(pendingPlan, pendingSnapshot)
assert(pendingAssessment.status === "matched" && pendingAssessment.targetKind === "order" && pendingAssessment.scorePct === 100, "A pending ticket must compare all six plan fields using its requested price and order direction")
assert(assessPlannedTrade(pendingPlan, { ...pendingSnapshot, pending_orders: [{ ...pendingOrder, requested_price: 3010 }] }).status === "mismatch", "A changed pending entry price must be reported as a discrepancy")
assert(assessPlannedTrade(pendingPlan, { ...pendingSnapshot, pending_orders: [{ ...pendingOrder, requested_price: null }] }).status === "partial", "Missing order prices must remain unknown")
assert(assessPlannedTrade(pendingPlan, { ...pendingSnapshot, pending_orders: [{ ...pendingOrder, order_type: null }] }).status === "partial", "A missing pending type must not imply a buy direction")
const sellPlan = { ...pendingPlan, draft: { ...pendingPlan.draft, direction: "SELL", stopLoss: "3010", takeProfit: "2980" } }
assert(assessPlannedTrade(sellPlan, { ...pendingSnapshot, pending_orders: [{ ...pendingOrder, order_type: "ORDER_TYPE_SELL_STOP", stop_loss: 3010, take_profit: 2980 }] }).status === "matched", "Named sell order types must produce the correct direction")
assert(orderIdentifier({ order_number: pendingTicket }) === pendingTicket && orderIdentifier({ ticket: Number(pendingTicket) }) === "", "Order numbers must preserve long string IDs and reject truncated numeric IDs")
assert(planTicketIdentifier(assignedPlan) === positionId, "Legacy saved position assignments must continue to work")
assert(assessPlannedTrade({ ...assignedPlan, ticketId: "" }, matchingSnapshot).status === "unassigned", "Clearing a migrated ticket must not resurrect a legacy position assignment")
assert(assessAllocatedTrade([assignedPlan, pendingPlan], pendingSnapshot, matchingSnapshot.positions[0], "position").status === "matched", "Live position rows must report their linked plan's conformance")
assert(assessAllocatedTrade([assignedPlan, pendingPlan], pendingSnapshot, pendingOrder, "order").status === "matched", "Pending rows must report their linked plan's conformance")
assert(assessAllocatedTrade([], pendingSnapshot, pendingOrder, "order").status === "unassigned", "Unlinked rows must not be matched by similar symbol or values")
assert(assessAllocatedTrade([pendingPlan, { ...pendingPlan, id: "duplicate" }], pendingSnapshot, pendingOrder, "order").status === "ambiguous", "Duplicate plan assignments must be explicit")
assert(assessPlannedTrade(assignedPlan, { ...matchingSnapshot, pending_orders: [{ ...pendingOrder, ticket: positionId }] }).status === "ambiguous", "A ticket collision between positions and orders must not choose an arbitrary target")
assert(parseTradePlans(JSON.stringify([pendingPlan]))[0].ticketId === pendingTicket, "Pending ticket assignments must survive storage without precision loss")

const savedReview = buildTradeReview(matchingSnapshot, tradeDraft, {}, analyzeOpenRisk(matchingSnapshot))
const savedPlan = createTradePlan({ id: "saved-review", createdAt: "2026-10-13T12:00:00Z", draft: tradeDraft, review: savedReview })
const originalAnalysis = JSON.stringify(savedReview.analysis)
assert(JSON.stringify(savedPlan.analysis) === originalAnalysis, "A saved plan must preserve the exact text generated by the completed review")
assert(savedPlan.ticketId === "" && savedPlan.ticketAssessment === undefined, "A new plan must have no ticket evaluation before explicit confirmation")
savedReview.analysis.risks.push("Changed after saving")
assert(JSON.stringify(savedPlan.analysis) === originalAnalysis, "Later review changes must not alter the saved analysis")
const confirmedAt = "2026-10-13T12:05:00Z"
const confirmedPlan = confirmTradePlanTicket(savedPlan, " #۱۲۳۴۵۶۷۸۹۰۱۲۳۴۵۶۷۸۹۰ ", matchingSnapshot, confirmedAt)
assert(confirmedPlan.ticketId === positionId && confirmedPlan.ticketAssessment.status === "matched", "Confirming a pasted ticket must normalize its digits and evaluate that exact trade")
assert(confirmedPlan.ticketConfirmedAt === confirmedAt && savedPlan.ticketId === "", "Confirmation must be timestamped without changing the unconfirmed plan")
assert(confirmTradePlanTicket(savedPlan, "   ", matchingSnapshot, confirmedAt) === null, "An empty ticket must not create an evaluation or assignment")
const confirmedPending = confirmTradePlanTicket(confirmedPlan, pendingTicket, pendingSnapshot, confirmedAt)
assert(confirmedPending.ticketAssessment.targetKind === "order" && confirmedPending.ticketAssessment.status === "matched", "Reconfirming another ticket must evaluate the new pending order")
assert(JSON.stringify(confirmedPending.analysis) === originalAnalysis, "Ticket reassignment must preserve the original trade review")
const confirmedMissing = confirmTradePlanTicket(savedPlan, "999", matchingSnapshot, confirmedAt)
assert(confirmedMissing.ticketAssessment.status === "unavailable", "Confirmation of an unknown ticket must give feedback without assuming conformance")
const restoredConfirmed = parseTradePlans(JSON.stringify([confirmedPlan]))[0]
assert(restoredConfirmed.ticketId === positionId && restoredConfirmed.ticketAssessment.status === "matched" && JSON.stringify(restoredConfirmed.analysis) === originalAnalysis, "Saved analysis and confirmed evaluation must survive a browser storage round trip")

const behaviorNow = new Date("2026-10-13T12:00:00Z")
const behaviorDeal = (id, clock, entryType, volume, profit) => ({
  position_identifier: id, deal_identifier: `${id}-${clock}`, symbol: "XAUUSD", direction: "BUY",
  entry_type: entryType, volume, profit, commission: -1, swap: 0,
  executed_price: entryType === 0 ? 3000 : 3020,
  timestamp_utc: `2026-10-13T${clock}:00Z`,
})
const behaviorSnapshot = {
  ...matchingSnapshot,
  timestamp_utc: behaviorNow.toISOString(),
  account: { ...baseSnapshot.account, margin_level_pct: 500 },
  positions: [{ ...matchingSnapshot.positions[0], open_time_utc: "2026-10-13T09:45:00Z" }],
  trade_history_delta: [
    behaviorDeal("closed-a", "07:00", 0, 0.2, 0),
    behaviorDeal("closed-a", "08:00", 1, 0.1, 11),
    behaviorDeal("closed-a", "08:10", 1, 0.1, 11),
    behaviorDeal("closed-b", "09:00", 0, 0.1, 0),
    behaviorDeal("closed-b", "09:30", 1, 0.1, -9),
    behaviorDeal("incomplete", "10:00", 1, 0.1, 10),
    behaviorDeal(positionId, "09:45", 0, 0.15, 0),
    behaviorDeal(positionId, "10:30", 1, 0.05, 5),
  ],
}
const behaviorRules = { maxTradeRiskPct: "2", maxOpenRiskPct: "5", dailyLossLimitPct: "2", maxGrossLeverage: "3", minMarginLevelPct: "100", maxTradesPerDay: "3" }
const lifecycles = buildTradeLifecycles([behaviorSnapshot])
assert(lifecycles.find((trade) => trade.status !== "closed").ticket === positionId, "Open trade tickets must use the source position ID without truncation")
assert(lifecycles.find((trade) => trade.positionId === "closed-a").ticket === "closed-a", "Closed trade tickets must use the position ID rather than the deal or order ID")
assert(buildTradeLifecycles([{ positions: [{ symbol: "XAUUSD", direction: "BUY", volume: 0.1 }] }])[0].ticket === null, "A generated row key must not appear as a real ticket")
const behavior = buildBehaviorAnalysis({ snapshot: behaviorSnapshot, rules: behaviorRules, plans: [assignedPlan], lifecycles, now: behaviorNow })
assert(behavior.lines.length === 6, "Behavior analysis must stay a short six-point list")
assert(behavior.completeTradeCount === 2 && behavior.winRatePct === 50, "Multiple exits must count as one complete trade and open partial trades must not count as closed wins")
assert(behavior.netResult === 8, "Reported net results must include entry and exit commissions")
assert(behavior.lines.find((line) => line.key === "risk").tone === "success", "Known positions inside all recorded risk limits must be identified correctly")
assert(behavior.lines.find((line) => line.key === "after-loss").tone === "warning", "Observed volume increases after a loss must appear in the short behavior list")
assert(behavior.lines.find((line) => line.key === "attention").text.includes("ناقص"), "Excluded incomplete histories must remain visible")
const breachedBehavior = buildBehaviorAnalysis({
  snapshot: { ...behaviorSnapshot, timestamp_utc: "2026-10-12T12:00:00Z", portfolio_metrics: { ...baseSnapshot.portfolio_metrics, gross_portfolio_leverage: 10 }, positions: [{ ...behaviorSnapshot.positions[0], stop_loss: 0 }] },
  rules: { ...behaviorRules, maxTradesPerDay: "2" }, plans: [assignedPlan], lifecycles, now: behaviorNow,
})
assert(breachedBehavior.lines.find((line) => line.key === "risk").tone === "danger", "A leverage rule breach must not be described as compliant")
assert(breachedBehavior.lines.find((line) => line.key === "discipline").tone === "warning", "Exceeding the daily entry cap must be flagged")
assert(breachedBehavior.lines.find((line) => line.key === "attention").text.includes("بدون SL"), "A missing stop must be highlighted")
assert(breachedBehavior.lines.find((line) => line.key === "attention").text.includes("قدیمی"), "Stale account data must remain visible")
const emptyBehavior = buildBehaviorAnalysis({ snapshot: null, now: behaviorNow })
assert(emptyBehavior.winRatePct === null && emptyBehavior.netResult === null, "Missing performance history must remain unknown, not zero")
assert(emptyBehavior.lines.every((line) => !line.text.includes("NaN") && !line.text.includes("Infinity")), "Empty data must not produce invalid numeric summaries")

console.log("Risk management checks passed")
