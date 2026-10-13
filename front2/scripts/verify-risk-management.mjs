import { readFile } from "node:fs/promises"

const source = await readFile(new URL("../lib/risk-management.js", import.meta.url), "utf8")
const {
  analyzeOpenRisk,
  availableSymbols,
  buildTradeReview,
  EMPTY_TRADE_DRAFT,
  latestSiteQuote,
  previewTrade,
  scenarioEstimate,
  tradeAssetVolume,
  tradeInputErrors,
  tradeMarketRequest,
} = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`)

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

console.log("Risk management checks passed")
