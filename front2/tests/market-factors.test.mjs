import { readFile } from "node:fs/promises"
import assert from "node:assert/strict"
import test from "node:test"
const source = await readFile(new URL("../lib/market-factors.js", import.meta.url), "utf8")
const { marketFactorGroups } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`)

test("keeps supported longer-horizon and legacy factors in classified snapshots", () => {
  const groups = marketFactorGroups({ factor_classification_version: "1.0.0", market_drivers: [
    { title_fa: "Policy support", sentiment: "risk_on", duration: "medium_term" },
    { title_fa: "Valuation", sentiment: "risk_off", duration: "long_term" },
    { title_fa: "Mixed", sentiment: "mixed", duration: "short_term" },
  ], positive_drivers: ["Legacy support", "Policy support"], negative_drivers: ["Legacy pressure"],
  risk_monitor: [{ title_fa: "Credit", status: "active" }, { title_fa: "Older review", status: "unknown" }, { title_fa: "Resolved", status: "inactive" }], key_risks: ["Liquidity"] })
  assert.deepEqual(groups.supportive.map((item) => item.title_fa), ["Policy support", "Legacy support"])
  assert.equal(groups.challenging.length, 2)
  assert.deepEqual(groups.risks.map((item) => item.title_fa), ["Credit", "Older review", "Liquidity"])
  assert.equal(groups.potentials.length, 0, "Missing opportunities must not be invented")
})
