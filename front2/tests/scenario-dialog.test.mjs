import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import test from "node:test"
import React from "react"
import ts from "typescript"

const require = createRequire(import.meta.url)
const riskSource = await readFile(new URL("../lib/risk-management.js", import.meta.url), "utf8")
const risk = await import(`data:text/javascript;base64,${Buffer.from(riskSource).toString("base64")}`)
const source = await readFile(new URL("../components/dashboard/scenario-dialog.jsx", import.meta.url), "utf8")
const compiled = ts.transpileModule(`${source}\nexport { ScenarioControl }`, {
  fileName: "scenario-dialog.jsx",
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
}).outputText

function harness() {
  const state = []
  let cursor = 0
  const hooks = {
    ...React, useEffect() {}, useMemo: fn => fn(),
    useState(initial) {
      const slot = cursor++
      if (!(slot in state)) state[slot] = initial
      return [state[slot], next => { state[slot] = typeof next === "function" ? next(state[slot]) : next }]
    },
  }
  const exports = {}
  const mocks = {
    react: hooks,
    "@/lib/risk-management": risk,
    "@/lib/date-format": { formatGregorianTehranDateTime: value => value },
    "@/components/kokonutui/mt5-data-view": { money: value => `$${value}`, number: value => String(value) },
  }
  new Function("require", "exports", compiled)(name => mocks[name] || (name.startsWith("@/components/ui/") ? new Proxy({}, { get: (_, key) => `test-${key}` }) : require(name)), exports)
  return { ...exports, render(props) { cursor = 0; return exports.default(props) } }
}

function find(node, predicate) {
  if (!React.isValidElement(node)) return null
  if (predicate(node)) return node
  for (const child of React.Children.toArray(node.props.children)) {
    const result = find(child, predicate)
    if (result) return result
  }
  return null
}

const props = {
  open: true, onOpenChange() {}, onSymbolChange() {}, selectedScenarioSymbol: "gold", allAccounts: true,
  scenarioSymbols: [{ symbol: "gold", label: "طلا" }],
  leverage: { equity_usd: 10_000, gross_exposure_usd: 50_000 },
  symbolRisks: [{ symbol_id: "gold", symbols: ["XAUUSD"], net_exposure_usd: 20_000 }],
  snapshots: [{ timestamp_utc: "2025-01-01T00:00:00Z", account: { currency: "USD" }, broker_symbol_data: [{ symbol: "XAUUSD", bid: 2999, ask: 3001 }] }],
}
const control = (tree, id) => find(tree, node => node.type.name === "ScenarioControl" && node.props.id === id)
const result = (tree, label) => find(tree, node => node.type === "div" && React.Children.toArray(node.props.children).some(child => child.type === "dt" && child.props.children === label))
const primaryValue = element => React.Children.toArray(element.props.children).find(child => child.type === "dd").props.children

test("the actual dialog starts with both controls at zero and preserves baseline leverage", () => {
  const h = harness()
  const tree = h.render(props)
  assert.equal(control(tree, "scenario-units").props.value, "0")
  assert.equal(control(tree, "scenario-shock").props.value, "0")
  assert.equal(primaryValue(result(tree, "اهرم کل پس از تغییر حجم")), "5×")
  assert.equal(primaryValue(result(tree, "اهرم کل پس از تغییر حجم و قیمت")), "5×")
})

test("editing signed volume and price updates the real dollar outputs and result cards", () => {
  const h = harness()
  control(h.render(props), "scenario-units").props.onChange("-1")
  let tree = h.render(props)
  assert.equal(control(tree, "scenario-units").props.dollarValue, -3000)
  assert.equal(primaryValue(result(tree, "اهرم کل پس از تغییر حجم")), "4.7×")
  control(tree, "scenario-shock").props.onChange("-5")
  tree = h.render(props)
  assert.equal(control(tree, "scenario-shock").props.dollarValue, -150)
  assert.equal(primaryValue(result(tree, "اثر تقریبی بر اکوییتی کل")), "$-850")
  assert.equal(primaryValue(result(tree, "اکوییتی کل برآوردی")), "$9150")
})

test("each RTL row places the slider on the right, its editable number next, and dollars on the left", () => {
  const h = harness()
  for (const id of ["scenario-units", "scenario-shock"]) {
    const settings = control(h.render(props), id).props
    const tree = h.ScenarioControl(settings)
    const row = find(tree, node => node.props.className?.startsWith("grid "))
    const children = React.Children.toArray(row.props.children)
    assert.equal(children[0].type, "test-Slider")
    assert.equal(find(children[1], node => node.type === "test-Input").props.id, id)
    assert.equal(find(children[2], node => node.type === "output").props.htmlFor, id)
    children[0].props.onValueChange([1])
    assert.equal(control(h.render(props), id).props.value, "1")
  }
})

test("fractional manual input stays usable, and a temporarily cleared field does not invent a result", () => {
  const h = harness()
  const getInput = () => find(h.ScenarioControl(control(h.render(props), "scenario-units").props), node => node.type === "test-Input")
  getInput().props.onChange({ target: { value: "0.25" } })
  assert.equal(control(h.render(props), "scenario-units").props.dollarValue, 750)
  getInput().props.onChange({ target: { value: "" } })
  assert.equal(control(h.render(props), "scenario-units").props.value, "")
  assert.equal(primaryValue(result(h.render(props), "اهرم کل پس از تغییر حجم")), "—")
  getInput().props.onBlur()
  assert.equal(control(h.render(props), "scenario-units").props.value, "0")
})
