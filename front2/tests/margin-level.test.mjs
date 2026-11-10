import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import test from "node:test"
import ts from "typescript"

const source = await readFile(new URL("../lib/risk-management.js", import.meta.url), "utf8")
const risk = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`)
const { accountMarginStatus, aggregateRiskOverview, buildBehaviorAnalysis } = risk
const tickerSource = await readFile(new URL("../components/dashboard/news-ticker.jsx", import.meta.url), "utf8")
const compiled = ts.transpileModule(tickerSource, {
  fileName: "news-ticker.jsx", compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
}).outputText
const require = createRequire(import.meta.url)
const exports = {}
const mocks = {
  "@/lib/risk-management": risk,
  "@/lib/mt5-account-changes": {},
  "@/components/auth/auth-context": {},
  "@/api/api": {},
  "@/lib/important-us-news-fa": { IMPORTANT_US_NEWS_FA: [] },
  "@/components/kokonutui/mt5-data-view": { accountKey: snapshot => snapshot.source.account_identifier, number: value => String(value), money: value => String(value) },
}
new Function("require", "exports", compiled)(name => mocks[name] || (name.startsWith("@/components/ui/") ? new Proxy({}, { get: (_, key) => `test-${key}` }) : require(name)), exports)
const { buildDashboardInsights } = exports
const now = new Date("2026-11-09T10:00:00Z")
const rules = { minMarginLevelPct: 150, maxGrossLeverage: 10, maxTradeRiskPct: 2, maxOpenRiskPct: 5 }
const idle = {
  source: { broker_company: "Idle broker", account_identifier: "idle" }, timestamp_utc: now.toISOString(),
  account: { currency: "USD", equity: 10_000, balance: 10_000, used_margin: 0, margin_level_pct: 0 },
  positions: [], pending_orders: [], symbol_metrics: [], trade_history_delta: [],
  portfolio_metrics: { gross_portfolio_exposure_usd: 0, gross_portfolio_leverage: 0 },
  leverage: { value: 0 },
}
function insights(snapshot) {
  const previous = globalThis.window
  globalThis.window = { localStorage: { getItem: () => JSON.stringify(rules) } }
  try { return buildDashboardInsights({ snapshots: [snapshot], comparison: null, articles: [], snoozed: {}, now }) }
  finally { if (previous === undefined) delete globalThis.window; else globalThis.window = previous }
}
const marginAlert = snapshot => insights(snapshot).find(item => item.id.startsWith("margin:"))

test("zero used margin has no applicable percentage, including MT5's zero placeholder", () => {
  assert.deepEqual(accountMarginStatus(idle), { applicable: false, levelPct: null, usedMargin: 0 })
  assert.equal(accountMarginStatus({ ...idle, account: { ...idle.account, margin_level_pct: 25 } }).levelPct, null)
  assert.equal(marginAlert(idle), undefined)
})

test("confirmed empty positions and orders do not generate a margin crisis when used margin is absent", () => {
  const snapshot = { ...idle, account: { ...idle.account, used_margin: null } }
  assert.equal(accountMarginStatus(snapshot).applicable, false)
  assert.equal(marginAlert(snapshot), undefined)
})

test("risk account warnings and behavior analysis do not treat an idle account as a margin breach", () => {
  const aggregate = aggregateRiskOverview([{ snapshot: idle, rules }], now, { value: 0 })
  assert.equal(aggregate.marginLevel, null)
  assert.equal(aggregate.accountWarnings.length, 0)
  const behavior = buildBehaviorAnalysis({ snapshot: idle, rules, plans: [], lifecycles: [], now })
  const line = behavior.lines.find(item => item.key === "risk")
  assert.notEqual(line.tone, "danger")
  assert.doesNotMatch(line.text, /مارجین.*خارج/)
})

test("a funded margin ratio uses equity and consumed margin rather than a stale reported zero", () => {
  const snapshot = { ...idle, account: { ...idle.account, used_margin: 100 } }
  assert.equal(accountMarginStatus(snapshot).levelPct, 10_000)
  assert.equal(marginAlert(snapshot), undefined)
})

test("genuinely low margin still generates critical and warning dashboard items", () => {
  const stressed = { ...idle, account: { ...idle.account, equity: 50, used_margin: 100, margin_level_pct: 50 }, positions: [{ symbol: "XAUUSD", volume: 1, direction: "BUY" }] }
  assert.equal(marginAlert(stressed)?.kind, "critical")
  const warning = { ...stressed, account: { ...stressed.account, equity: 120 } }
  assert.equal(marginAlert(warning)?.kind, "warning")
  assert.ok(aggregateRiskOverview([{ snapshot: stressed, rules }], now).accountWarnings.some(row => row.warnings.some(text => text.includes("سطح مارجین"))))
})

test("reserved margin remains monitored even without open positions", () => {
  const reserved = { ...idle, pending_orders: [{ symbol: "XAUUSD", volume: 1 }], account: { ...idle.account, equity: 50, used_margin: 100 } }
  assert.equal(accountMarginStatus(reserved).applicable, true)
  assert.equal(marginAlert(reserved)?.kind, "critical")
})

test("a reported ratio can still monitor an open position when consumed margin is missing", () => {
  const snapshot = { ...idle, positions: [{ symbol: "XAUUSD" }], account: { ...idle.account, used_margin: null, margin_level_pct: 50 } }
  assert.equal(accountMarginStatus(snapshot).levelPct, 50)
  assert.equal(marginAlert(snapshot)?.kind, "critical")
})

test("unknown activity and missing or malformed data are not converted into a numeric zero", () => {
  for (const used of [undefined, null, "", false, true, -1, Infinity]) {
    const snapshot = { account: { equity: 10_000, used_margin: used, margin_level_pct: 0 } }
    assert.equal(accountMarginStatus(snapshot).levelPct, null)
    assert.notEqual(accountMarginStatus(snapshot).applicable, true)
  }
  assert.equal(accountMarginStatus({ account: { used_margin: 100 } }).levelPct, null)
  assert.equal(accountMarginStatus({ account: { used_margin: 1e-308, equity: 1e308 } }).levelPct, null)
})

test("zero margin on hedged positions does not create a division-by-zero crisis", () => {
  const snapshot = { ...idle, positions: [{ symbol: "XAUUSD", direction: "BUY" }, { symbol: "XAUUSD", direction: "SELL" }] }
  assert.equal(accountMarginStatus(snapshot).applicable, false)
  assert.equal(marginAlert(snapshot), undefined)
})
