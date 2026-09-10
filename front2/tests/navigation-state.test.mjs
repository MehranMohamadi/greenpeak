import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
const load = async (name) => import(`data:text/javascript;base64,${Buffer.from(await readFile(new URL(`../lib/${name}.js`, import.meta.url), "utf8")).toString("base64")}`)
const { getActiveNavHref, normalizeNavigationPath, revealActiveMarket } = await load("navigation-state")
const { matchingNarrative, monetaryNarrativeIds } = await load("monetary-narrative")
const hrefs = ["/", "/analytics", "/analytics/monetary-policy", "/analytics/valuation", "/fun"]
test("only the most specific destination is active and boundaries are respected", () => {
  assert.equal(getActiveNavHref("/analytics/monetary-policy/ten-year-treasury", hrefs), "/analytics/monetary-policy")
  assert.equal(getActiveNavHref("/fun", hrefs), "/fun")
  assert.equal(getActiveNavHref("/funny", hrefs), null)
  assert.equal(getActiveNavHref("/analytics/valuation-other", hrefs), null)
  assert.equal(getActiveNavHref("/", hrefs), "/")
  assert.equal(getActiveNavHref("/help", hrefs), null)
})
test("legacy and normalized routes identify the same destination", () => {
  assert.equal(normalizeNavigationPath("/analytics/liquidity-flows/sofr-rate/?x=1#chart"), "/analytics/monetary-policy/sofr-rate")
  assert.equal(getActiveNavHref("/sp500/", hrefs), "/analytics")
})
test("new child routes reveal their parent without changing independent branches", () => {
  const markets = [{ id: "us500", children: [{ href: "/analytics/monetary-policy" }] }]
  const saved = { us500: false, another: false }
  assert.deepEqual(revealActiveMarket(saved, "/analytics/monetary-policy/fed-funds-rate", markets), { us500: true, another: false })
  assert.deepEqual(revealActiveMarket(saved, "/fun", markets), saved)
  assert.equal(saved.us500, false)
})
test("a response for another indicator or analysis level is never shown", () => {
  const indicatorId = monetaryNarrativeIds["ten-year-treasury"]
  const data = { level: "indicator", subject_id: indicatorId, narrative_fa: "existing narrative" }
  assert.equal(matchingNarrative({ data }, indicatorId), data)
  assert.equal(matchingNarrative({ data }, monetaryNarrativeIds["fed-funds-rate"]), null)
  assert.equal(matchingNarrative({ data: { ...data, level: "domain" } }, indicatorId), null)
  assert.equal(matchingNarrative({}, indicatorId), null)
  assert.equal(new Set(Object.values(monetaryNarrativeIds)).size, 7)
})
