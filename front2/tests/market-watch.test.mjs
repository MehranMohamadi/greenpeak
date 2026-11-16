import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import test from "node:test"
import React from "react"
import ts from "typescript"

const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
const sourceUrl = moduleUrl(await readFile(new URL("../lib/market-watch-source.js", import.meta.url), "utf8"))
const { parseWatchYahoo, WATCH_INTRADAY_SERIES } = await import(sourceUrl)
const watch = await import(moduleUrl(await readFile(new URL("../lib/market-watch.js", import.meta.url), "utf8")))
const route = (await readFile(new URL("../app/api/market/watch/route.js", import.meta.url), "utf8")).replace('"@/lib/market-watch-source"', JSON.stringify(sourceUrl))
const { GET } = await import(moduleUrl(route))
const base = Date.parse("2025-11-03T12:00:00Z") / 1000
const now = (base + 3600) * 1000
const yahoo = (series, times = [base, base + 300], close = [4.25, 4.26], interval = "5m") => ({ chart: { result: [{
  meta: { symbol: WATCH_INTRADAY_SERIES[series].symbol, dataGranularity: interval, ...(series === "gold" ? { currency: "USD" } : {}) }, timestamp: times, indicators: { quote: [{ close }] },
}] } })

test("all five intraday cards request five-minute observations; P/E stays monthly", () => {
  assert.equal(watch.marketSeries.length, 6)
  for (const series of watch.marketSeries) {
    assert.equal(series.interval, series.id === "pe-ratio" ? "1month" : "5min")
    if (series.id !== "pe-ratio") assert.equal(new URL(series.url, "http://local").searchParams.get("series"), series.id)
  }
})

test("five-minute gold retains UTC bar times and explicitly identifies COMEX futures", () => {
  const result = parseWatchYahoo(yahoo("gold", [base + 300, base, base + 300], [4001.25, 4000, 4002.25]), "gold", now)
  assert.deepEqual(result.data.map(p => [p.time, p.value]), [[base, 4000], [base + 300, 4002.25]])
  assert.equal(result.metadata.source_provider, "Yahoo Finance")
  assert.equal(result.metadata.source_series_id, "GC=F")
  assert.equal(result.metadata.instrument_type, "futures")
  assert.equal(result.metadata.exchange, "COMEX")
  assert.equal(result.metadata.unit, "USD per troy ounce")
  assert.equal(result.metadata.interval, "5min")
})

test("invalid/future gold, spot symbols, wrong units and daily bars cannot enter the futures chart", () => {
  for (const close of [null, "", " ", true, "NaN", 0, -1]) assert.throws(() => parseWatchYahoo(yahoo("gold", [base], [close]), "gold", now))
  for (const time of [0, -1, base + 9999, "bad"]) assert.throws(() => parseWatchYahoo(yahoo("gold", [time], [4000]), "gold", now))
  for (const patch of [{ symbol: "XAU/USD" }, { symbol: "GLD" }, { dataGranularity: "1d" }, { currency: "EUR" }]) {
    const raw = yahoo("gold"); Object.assign(raw.chart.result[0].meta, patch)
    assert.throws(() => parseWatchYahoo(raw, "gold", now))
  }
})

test("Yahoo parsers keep each intraday timestamp, actual symbol and unscaled Treasury percent", () => {
  for (const series of ["spx", "treasury-10y", "vix", "dollar-index"]) {
    const result = parseWatchYahoo(yahoo(series), series, now)
    assert.deepEqual(result.data.map(p => p.value), [4.25, 4.26])
    assert.equal(result.data[1].time - result.data[0].time, 300)
    assert.equal(result.metadata.source_series_id, WATCH_INTRADAY_SERIES[series].symbol)
    assert.throws(() => parseWatchYahoo(yahoo(series, undefined, undefined, "1d"), series, now))
    const wrong = yahoo(series); wrong.chart.result[0].meta.symbol = "GC=F"
    assert.throws(() => parseWatchYahoo(wrong, series, now))
  }
  assert.equal(parseWatchYahoo(yahoo("treasury-10y"), "treasury-10y", now).metadata.unit, "percent")
})

test("Yahoo invalid values are omitted without forward filling or invented zeros", () => {
  const result = parseWatchYahoo(yahoo("vix", [base, base + 300, base + 600, base + 900, base + 9999], [15, null, true, 0, 17]), "vix", now)
  assert.deepEqual(result.data.map(p => p.value), [15])
})

test("gold route needs no API key and fetches only five-minute GC futures", async () => {
  const original = globalThis.fetch
  try {
    let requested, options
    globalThis.fetch = async (url, init) => { requested = url; options = init; return Response.json(yahoo("gold", [base], [4000])) }
    const response = await GET(new Request("http://local/api/market/watch?series=gold&symbol=BAD&interval=1day"))
    assert.equal(response.status, 200)
    assert.equal(requested.origin, "https://query1.finance.yahoo.com")
    assert.equal(decodeURIComponent(requested.pathname.split("/").at(-1)), "GC=F")
    assert.equal(requested.searchParams.get("range"), "5d")
    assert.equal(requested.searchParams.get("interval"), "5m")
    assert.equal(requested.searchParams.get("apikey"), null)
    assert.equal(options.next.revalidate, 300)
    const result = await response.json()
    assert.equal(result.data.length, 1)
    assert.equal(result.metadata.source_series_id, "GC=F")
  } finally { globalThis.fetch = original }
})

test("gold provider failures stay unavailable without leaking errors or substituting spot prices", async () => {
  const original = globalThis.fetch
  try {
    for (const mock of [async () => { throw new Error("SECRET") }, async () => Response.json({ chart: { result: null, error: { description: "SECRET" } } }), async () => new Response("SECRET", { status: 429 })]) {
      globalThis.fetch = mock
      const response = await GET(new Request("http://local/api/market/watch?series=gold"))
      assert.equal(response.status, 502)
      assert.ok(!(await response.text()).includes("SECRET"))
    }
  } finally { globalThis.fetch = original }
})

test("watch route only fetches allowlisted Yahoo symbols at 5m and rejects arbitrary series", async () => {
  const original = globalThis.fetch
  try {
    for (const series of ["spx", "treasury-10y", "vix", "dollar-index"]) {
      let requested
      globalThis.fetch = async url => { requested = url; return Response.json(yahoo(series)) }
      const response = await GET(new Request(`http://local/api/market/watch?series=${series}`))
      assert.equal(response.status, 200)
      assert.equal(decodeURIComponent(requested.pathname.split("/").at(-1)), WATCH_INTRADAY_SERIES[series].symbol)
      assert.equal(requested.searchParams.get("interval"), "5m")
    }
    for (const series of ["__proto__", "constructor", "https://untrusted.test", "pe-ratio"]) assert.equal((await GET(new Request(`http://local/api/market/watch?series=${series}`))).status, 400)
  } finally { globalThis.fetch = original }
})

test("all production nginx listeners route the new public watch endpoint to Next.js", async () => {
  const config = await readFile(new URL("../../nginx.conf", import.meta.url), "utf8")
  const locations = [...config.matchAll(/location = \/api\/market\/watch\s*\{([^}]+)\}/g)]
  assert.equal(locations.length, 3)
  for (const [, body] of locations) assert.match(body, /proxy_pass http:\/\/127\.0\.0\.1:3000;/)
})

test("miniature and expanded charts share unique timestamped points, including monthly P/E", () => {
  const treasury = watch.buildMarketItem(watch.marketSeries[1], parseWatchYahoo(yahoo("treasury-10y"), "treasury-10y", now))
  assert.equal(treasury.price, "4.26%")
  assert.equal(treasury.chartPoints.length, 2)
  assert.deepEqual(treasury.chartPoints.map(p => p.value), treasury.chartData)
  const pe = watch.buildMarketItem(watch.marketSeries[2], { data: [{ date: "2025-01-01", value: 25 }, { date: "2025-02-01", value: 26 }] })
  assert.equal(pe.chartPoints.length, 2)
  assert.equal(pe.interval, "1month")
  assert.equal(watch.unavailableMarketItem(watch.marketSeries[5]).error, "داده واقعی در دسترس نیست")
})

const require = createRequire(import.meta.url)
const compile = source => ts.transpileModule(source, { fileName: "watch.jsx", compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText
const cardCode = compile(await readFile(new URL("../components/dashboard/market-watch.jsx", import.meta.url), "utf8"))
const dialogCode = compile(await readFile(new URL("../components/dashboard/market-watch-chart-dialog.jsx", import.meta.url), "utf8"))
const primitive = new Proxy({}, { get: (_, key) => `test-${String(key)}` })
function find(node, predicate) {
  if (!React.isValidElement(node)) return null
  if (predicate(node)) return node
  for (const child of React.Children.toArray(node.props.children)) { const found = find(child, predicate); if (found) return found }
  return null
}

test("each of the six actual card buttons opens its matching live-data dialog and closes independently", () => {
  let selected = null
  const ref = { current: null }
  const data = watch.marketSeries.map(series => watch.unavailableMarketItem(series))
  const exports = {}
  const mocks = {
    react: { ...React, useState: () => [selected, next => { selected = next }], useRef: () => ref },
    "framer-motion": { motion: new Proxy({}, { get: (_, key) => `motion-${String(key)}` }), AnimatePresence: "test-AnimatePresence" },
    "@/hooks/use-market-watch": { default: () => ({ data, isLoading: false }) },
    "./market-watch-loading": {},
    "@/components/dashboard/market-watch-chart-dialog": { default: "test-ChartDialog", watchIntervalLabel: item => item.interval },
  }
  new Function("require", "exports", cardCode)(name => mocks[name] || (name.startsWith("@/components/ui/") ? primitive : require(name)), exports)
  for (const item of data) {
    let tree = exports.default()
    const button = find(tree, node => node.type === "motion-button" && node.props["aria-label"] === `باز کردن چارت ${item.symbol}`)
    assert.equal(button.props.type, "button")
    assert.equal(button.props["aria-haspopup"], "dialog")
    const target = { focus() {} }
    button.props.onClick({ currentTarget: target })
    tree = exports.default()
    const dialog = find(tree, node => node.type === "test-ChartDialog")
    assert.equal(dialog.props.item.id, item.id)
    assert.equal(dialog.props.triggerRef.current, target)
    dialog.props.onClose()
    assert.equal(find(exports.default(), node => node.type === "test-ChartDialog").props.item, null)
  }
})

test("the actual popup labels P/E monthly, handles unavailable gold and restores button focus", () => {
  const exports = {}
  new Function("require", "exports", dialogCode)(name => name.startsWith("@/components/ui/") ? primitive : name === "recharts" ? primitive : require(name), exports)
  let focused = false
  const ref = { current: { focus: () => { focused = true } } }
  const item = watch.unavailableMarketItem(watch.marketSeries[5], "کلید تنظیم نشده")
  const tree = exports.default({ item, onClose() {}, triggerRef: ref })
  assert.equal(find(tree, node => node.props.role === "status").props.children, "کلید تنظیم نشده")
  let prevented = false
  find(tree, node => node.type === "test-DialogContent").props.onCloseAutoFocus({ preventDefault: () => { prevented = true } })
  assert.ok(focused && prevented)
  assert.equal(exports.watchIntervalLabel(watch.marketSeries[2]), "ماهانه")
})
