import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const source = await readFile(new URL("../lib/risk-management.js", import.meta.url), "utf8")
const { volumeScenarioEstimate, scenarioBrokerUnitQuote, scenarioRiskRow, tradeAssetVolume } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`)
const baseline = { equity_usd: 10_000, gross_exposure_usd: 50_000, reason: null }
const risks = [
  { symbol_id: "gold", symbols: ["GOLD.pro", "XAUUSD"], net_exposure_usd: 20_000 },
  { symbol_id: "sp500", symbols: ["SPX500", "US500.cash"], net_exposure_usd: -30_000 },
]
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`)

test("both zero controls preserve the server's actual equity and leverage", () => {
  const result = volumeScenarioEstimate(baseline, risks, "gold", 0, 0, 3000)
  assert.equal(result.available, true)
  assert.equal(result.pnl, 0)
  assert.equal(result.equityAfter, 10_000)
  assert.equal(result.addedNotionalUsd, 0)
  assert.equal(result.priceChangeUsd, 0)
  assert.equal(result.leverageBefore, 5)
  assert.equal(result.leverageAfterVolume, 5)
  assert.equal(result.leverageAfter, 5)
})

test("one ounce long adds one gold price, not one broker lot", () => {
  const result = volumeScenarioEstimate(baseline, risks, "gold", 0, 1, 3000)
  assert.equal(result.addedNotionalUsd, 3000)
  assert.equal(result.grossAfterVolume, 53_000)
  assert.equal(result.leverageAfterVolume, 5.3)
  assert.equal(result.leverageAfter, 5.3)
  assert.equal(result.pnl, 0)
  assert.equal(tradeAssetVolume({ volume: 0.01, contractSize: 100 }), 1)
  assert.equal(tradeAssetVolume({ volume: 0.1, contractSize: 10 }), 1)
})

test("added volume participates in the subsequent price move and equity denominator", () => {
  const result = volumeScenarioEstimate(baseline, risks, "gold", 10, 1, 3000)
  assert.equal(result.priceChangeUsd, 300)
  assert.equal(result.pnl, 2300)
  assert.equal(result.equityAfter, 12_300)
  assert.equal(result.grossAfter, 55_300)
  close(result.leverageAfter, 55_300 / 12_300)
  assert.equal(result.impactPct, 23)
})

test("negative units add a short and net against the existing long", () => {
  const result = volumeScenarioEstimate(baseline, risks, "gold", -5, -1, 3000)
  assert.equal(result.addedNotionalUsd, -3000)
  assert.equal(result.priceChangeUsd, -150)
  assert.equal(result.netAfterVolume, 17_000)
  assert.equal(result.pnl, -850)
  assert.equal(result.grossAfter, 46_150)
  close(result.leverageAfter, 46_150 / 9150)
})

test("one index unit is its dollar index price; cross-broker addition is applied once", () => {
  const result = volumeScenarioEstimate(baseline, risks, "sp500", 0, -1, 7500)
  assert.equal(result.addedNotionalUsd, -7500)
  assert.equal(result.netAfterVolume, -37_500)
  assert.equal(result.leverageAfter, 5.75)
  assert.equal(volumeScenarioEstimate(baseline, risks, "sp500", 10, -1, 7500).leverageAfter, 9.8)
})

test("volume can flatten or reverse a short without double-counting its old exposure", () => {
  const flat = volumeScenarioEstimate(baseline, risks, "sp500", 10, 4, 7500)
  assert.equal(flat.netAfterVolume, 0)
  assert.equal(flat.pnl, 0)
  assert.equal(flat.leverageAfter, 2)
  const reversed = volumeScenarioEstimate(baseline, risks, "sp500", 10, 5, 7500)
  assert.equal(reversed.netAfterVolume, 7500)
  assert.equal(reversed.pnl, 750)
  assert.equal(reversed.grossAfter, 28_250)
})

test("fractional underlying units and actual aliases use the same portfolio row", () => {
  assert.equal(scenarioRiskRow(risks, "us500.cash"), risks[1])
  assert.equal(scenarioRiskRow(risks, "US500"), risks[1])
  assert.equal(volumeScenarioEstimate(baseline, risks, "GOLD.pro", 0, 0.25, 3000).addedNotionalUsd, 750)
  const opaqueAliases = [{ ...risks[0], symbols: ["XAUUSDm"] }]
  assert.equal(scenarioRiskRow(opaqueAliases, "XAUUSD"), opaqueAliases[0])
  assert.equal(volumeScenarioEstimate(baseline, opaqueAliases, "XAUUSD", 0, 1, 3000).netAfterVolume, 23_000)
})

test("an unheld symbol can be added only to a complete server portfolio", () => {
  const result = volumeScenarioEstimate({ equity_usd: 10_000, gross_exposure_usd: 0 }, [], "sp500", 0, 1, 7500)
  assert.equal(result.available, true)
  assert.equal(result.leverageAfter, 0.75)
  assert.equal(volumeScenarioEstimate(null, [], "sp500", 0, 1, 7500).available, false)
})

test("unknown exposures, currencies and inconsistent totals never become zero", () => {
  for (const leverage of [null, { ...baseline, equity_usd: null }, { ...baseline, gross_exposure_usd: null }, { ...baseline, reason: "unsupported_currency" }, { ...baseline, reason: "incomplete_accounts" }, { ...baseline, gross_exposure_usd: 100 }]) {
    assert.equal(volumeScenarioEstimate(leverage, risks, "gold", 0, 1, 3000).available, false)
  }
  assert.equal(volumeScenarioEstimate(baseline, [{ ...risks[0], net_exposure_usd: null }], "gold", 0, 1, 3000).available, false)
})

test("dollar labels stay available when the portfolio is missing, but financial results do not", () => {
  const result = volumeScenarioEstimate(null, [], "gold", 2, 3, 3000)
  assert.equal(result.available, false)
  assert.equal(result.priceChangeUsd, 60)
  assert.equal(result.addedNotionalUsd, 9000)
  assert.equal(result.pnl, null)
})

test("missing quotes still allow a price-only stress but cannot fund added units", () => {
  assert.equal(volumeScenarioEstimate(baseline, risks, "gold", -5, 0, null).pnl, -1000)
  assert.equal(volumeScenarioEstimate(baseline, risks, "gold", -5, 1, null).available, false)
  assert.equal(volumeScenarioEstimate(baseline, risks, "gold", -5, 1, 0).available, false)
})

test("invalid controls and overflow cannot produce a plausible result", () => {
  for (const invalid of [null, undefined, "", true, false, NaN, Infinity, "bad"]) {
    // Explicit undefined uses the optional zero default for units.
    if (invalid !== undefined) assert.equal(volumeScenarioEstimate(baseline, risks, "gold", 0, invalid, 3000).available, false)
    assert.equal(volumeScenarioEstimate(baseline, risks, "gold", invalid, 1, 3000).available, false)
  }
  assert.equal(volumeScenarioEstimate(baseline, risks, "gold", -100, 1, 3000).available, false)
  const overflow = volumeScenarioEstimate(baseline, risks, "gold", 20, 1e308, 3000)
  assert.equal(overflow.available, false)
  assert.equal(overflow.addedNotionalUsd, null)
})

test("non-positive shocked equity has no finite leverage", () => {
  const result = volumeScenarioEstimate({ equity_usd: 100, gross_exposure_usd: 1000 }, [{ symbol_id: "gold", net_exposure_usd: 1000 }], "gold", -20, 0, 3000)
  assert.equal(result.available, true)
  assert.equal(result.equityAfter, -100)
  assert.equal(result.leverageAfter, null)
})

const observedAt = "2026-01-01T12:00:00Z"
const now = Date.parse("2026-01-01T13:00:00Z")
const snapshot = (symbol, bid, ask, extra = {}) => ({ timestamp_utc: observedAt, source: { broker_company: "Example" }, account: { currency: "USD" }, broker_symbol_data: [{ symbol, bid, ask, ...extra }] })

test("gold/index quote units are independent of broker lot size", () => {
  for (const size of [1, 10, 100]) {
    assert.equal(scenarioBrokerUnitQuote([snapshot("XAUUSD", 2999, 3001, { contract_size: size })], "gold", risks, now).price, 3000)
    assert.equal(scenarioBrokerUnitQuote([snapshot("US500.cash", 7499, 7501, { contract_size: size })], "sp500", risks, now).price, 7500)
  }
})

test("other linear symbols convert deposit-currency tick value to dollars per underlying unit", () => {
  const spec = { contract_size: 100_000, tick_size: 0.00001, tick_value: 1.25, trade_calculation_mode: "SYMBOL_CALC_MODE_FOREX" }
  close(scenarioBrokerUnitQuote([snapshot("EURGBP", 0.8599, 0.8601, spec)], "EURGBP", [], now).price, 1.075)
  assert.equal(scenarioBrokerUnitQuote([{ ...snapshot("EURGBP", 0.86, 0.86, spec), account: { currency: "EUR" } }], "EURGBP", [], now), null)
  assert.equal(scenarioBrokerUnitQuote([snapshot("EURGBP", 0.86, 0.86, { ...spec, trade_calculation_mode: "EXCH_BONDS" })], "EURGBP", [], now), null)
})

test("quotes require a valid observation time, positive prices and uncrossed spreads", () => {
  for (const extra of [{ quote_timestamp_utc: "bad" }, { quote_timestamp_utc: "2026-01-02T00:00:00Z" }]) {
    assert.equal(scenarioBrokerUnitQuote([snapshot("XAUUSD", 3000, 3001, extra)], "gold", risks, now), null)
  }
  assert.equal(scenarioBrokerUnitQuote([snapshot("XAUUSD", 3001, 2999)], "gold", risks, now), null)
  assert.equal(scenarioBrokerUnitQuote([snapshot("XAUUSD", 0, 0)], "gold", risks, now), null)
  assert.equal(scenarioBrokerUnitQuote([snapshot("OTHER", 10, 11)], "OTHER", [], now), null)
})

test("the freshest matching broker quote wins; another asset cannot leak into a selection", () => {
  const old = snapshot("XAUUSD", 2999, 3001)
  const recent = snapshot("GOLD.pro", 3009, 3011, { quote_timestamp_utc: "2026-01-01T12:30:00Z" })
  const unrelated = snapshot("US500.cash", 7499, 7501, { quote_timestamp_utc: "2026-01-01T12:45:00Z" })
  assert.equal(scenarioBrokerUnitQuote([old, recent, unrelated], "gold", risks, now).price, 3010)
})
