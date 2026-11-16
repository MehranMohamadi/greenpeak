import { readFile } from "node:fs/promises"
import assert from "node:assert/strict"
import test from "node:test"
import { createRequire } from "node:module"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import ts from "typescript"
const source = await readFile(new URL("../lib/market-factors.js", import.meta.url), "utf8")
const { marketFactorGroups, marketFactorPanels, factorEffectHorizon } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`)

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

test("two display panels combine matching directions while preserving individual horizons and evidence", () => {
  const current = { title_fa: "Policy support", sentiment: "risk_on", duration: "short_term", horizon_fa: "این هفته", evidence_refs: ["/daily"] }
  const potential = { title_fa: "Policy support", duration: "long_term", horizon_fa: "سال آینده", mechanism_fa: "ساختاری", evidence_refs: ["/structural"] }
  const challenge = { title_fa: "Valuation pressure", sentiment: "risk_off", duration: "medium_term" }
  const risk = { title_fa: "Credit risk", status: "watch", duration: "long_term", why_active_fa: "علت ریسک", easing_conditions_fa: "شرط کاهش", evidence_refs: ["/credit"] }
  const input = { market_drivers: [current, challenge], market_potentials: [potential], risk_monitor: [risk, { title_fa: "Resolved", status: "inactive" }], key_risks: ["Legacy risk"] }
  const before = JSON.stringify(input)
  const panels = marketFactorPanels(input)
  assert.deepEqual(Object.keys(panels), ["supportive", "risks"])
  assert.deepEqual(panels.supportive, [current, potential], "same-title factors with different mechanisms must not lose their explanations")
  assert.deepEqual(panels.risks.map(item => item.title_fa), ["Valuation pressure", "Credit risk", "Legacy risk"])
  assert.equal(panels.risks[1].easing_conditions_fa, risk.easing_conditions_fa)
  assert.deepEqual(panels.risks[1].evidence_refs, risk.evidence_refs)
  assert.equal(JSON.stringify(input), before, "display grouping must not change stored analysis")
})

test("effect horizon shows the stored duration and precise explanation without guessing missing times", () => {
  assert.equal(factorEffectHorizon({ duration: "short_term", horizon_fa: "این هفته" }), "کوتاه‌مدت — این هفته")
  assert.equal(factorEffectHorizon({ duration: "medium_term" }), "میان‌مدت")
  assert.equal(factorEffectHorizon({ duration: "long_term", horizon_fa: "بلندمدت" }), "بلندمدت")
  assert.equal(factorEffectHorizon({ horizon_fa: "پس از تحقق شرط ذکرشده" }), "پس از تحقق شرط ذکرشده")
  for (const item of [{}, { duration: "unknown" }, { horizon_fa: "  " }, { horizon_fa: 3 }]) {
    assert.equal(factorEffectHorizon(item), "در تحلیل ثبت نشده است.")
  }
  assert.deepEqual(marketFactorPanels({}), { supportive: [], risks: [] })
})

const require = createRequire(import.meta.url)
const componentSource = await readFile(new URL("../components/analytics/market-intelligence-sections.jsx", import.meta.url), "utf8")
const componentCode = ts.transpileModule(`${componentSource}\nexport { FactorCard, HelpDialog }`, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText

function renderFactorComponent(name, props, open = false) {
  const exports = {}
  const wrapper = ({ children, ...props }) => React.createElement("div", props, children)
  new Function("require", "exports", componentCode)(name => {
    if (name.endsWith("/ui/card")) return Object.fromEntries(["Card", "CardHeader", "CardContent", "CardTitle"].map(key => [key, wrapper]))
    if (name.endsWith("/ui/dialog")) return { Dialog: wrapper, DialogHeader: wrapper, DialogTitle: wrapper, DialogDescription: wrapper,
      DialogTrigger: ({ children }) => React.cloneElement(children, { "aria-haspopup": "dialog" }),
      DialogContent: ({ children }) => open ? React.createElement("div", { role: "dialog" }, children) : null }
    if (name.endsWith("market-factors")) return { marketFactorPanels, factorEffectHorizon }
    if (name.startsWith("@/") || name === "next/link") return { default: () => null }
    return require(name)
  }, exports)
  return renderToStaticMarkup(React.createElement(exports[name], props))
}

test("factor boxes show titles immediately and reveal effect horizons only inside each popup", () => {
  const item = { title_fa: "عامل آزمایشی", duration: "short_term", horizon_fa: "تا پایان هفته", why_it_matters_fa: "توضیح اثر", mechanism_fa: "سازوکار آزمایشی", evidence_summary_fa: "شاهد آزمایشی" }
  const html = renderFactorComponent("FactorCard", { title: "عوامل حمایتی", items: [item], positive: true })
  assert.ok(html.includes("عوامل حمایتی") && html.includes(item.title_fa))
  assert.match(html, /aria-haspopup="dialog"/)
  assert.doesNotMatch(html, /<details|<summary/)
  for (const text of [item.horizon_fa, item.why_it_matters_fa, item.mechanism_fa]) assert.ok(!html.includes(text))
  const dialog = renderFactorComponent("HelpDialog", { title: item.title_fa, item, factorDetails: true, children: React.createElement("button", null, "جزئیات") }, true)
  for (const text of ["بازهٔ اثرگذاری", "کوتاه‌مدت — تا پایان هفته", item.why_it_matters_fa, item.mechanism_fa, item.evidence_summary_fa]) assert.ok(dialog.includes(text))
  assert.ok(dialog.indexOf("بازهٔ اثرگذاری") < dialog.indexOf("چرا مهم است؟"))
  assert.ok(!dialog.includes("ماندگاری اثر") && !dialog.includes("افق زمانی"), "show one complete effect-horizon row")
})
