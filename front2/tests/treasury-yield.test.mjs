import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const source = await readFile(new URL("../lib/treasury-yield.js", import.meta.url), "utf8")
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
const { parseYahooTreasury, TREASURY_PERIOD_CONFIG } = await import(moduleUrl)
const routeSource = (await readFile(new URL("../app/market-data/treasury-10y/route.js", import.meta.url), "utf8"))
  .replace('"@/lib/treasury-yield"', JSON.stringify(moduleUrl))
const { GET } = await import(`data:text/javascript;base64,${Buffer.from(routeSource).toString("base64")}`)
const base = 1760000000
const payload = (times, closes, interval = "1h") => ({ chart: { result: [{
  meta: { symbol: "^TNX", dataGranularity: interval, exchangeTimezoneName: "America/Chicago" },
  timestamp: times, indicators: { quote: [{ close: closes }] },
}], error: null } })

test("Yahoo yield percent remains unscaled and hourly points remain distinct", () => {
  const response = parseYahooTreasury(payload([base + 3600, base, base + 3600], [5.25, 5.24, 5.26]), "1h", (base + 7200) * 1000)
  assert.deepEqual(response.data.map(({ time, value }) => [time, value]), [[base, 5.24], [base + 3600, 5.26]])
  assert.notEqual(response.data[0].date, response.data[1].date)
  assert.equal(response.metadata.unit, "percent")
  assert.equal(response.metadata.source_series_id, "^TNX")
  assert.equal(response.metadata.indicator_id, "cboe_10y_treasury_yield")
  assert.equal(response.metadata.frequency, "hourly")
  assert.equal(response.metadata.fred_series, undefined)
})

test("missing, malformed, zero and future source values do not fabricate observations", () => {
  const response = parseYahooTreasury(payload([base, base + 1, base + 2, base + 3, base + 4, base + 999], [5.24, null, true, "5.25", 0, 5.3]), "1h", (base + 100) * 1000)
  assert.equal(response.data.length, 1)
  assert.equal(response.data[0].value, 5.24)
  assert.throws(() => parseYahooTreasury(payload([base], [null]), "1h"))
  const wrong = payload([base], [5.24]); wrong.chart.result[0].meta.symbol = "^FVX"
  assert.throws(() => parseYahooTreasury(wrong, "1h"))
  assert.throws(() => parseYahooTreasury(payload([base], [5.24], "1d"), "1h"))
})

test("daily history preserves pre-1970 observations and excludes the unfinished session", () => {
  const day = Math.floor(base / 86400) * 86400
  const raw = payload([-86400, day - 86400, day], [6.2, 5.2, 5.24], "1d")
  raw.chart.result[0].meta.currentTradingPeriod = { regular: { start: day + 30000, end: day + 54000 } }
  const daily = parseYahooTreasury(raw, "1d", (day + 40000) * 1000)
  assert.equal(daily.data.length, 2)
  assert.equal(daily.data[0].date, "1969-12-31")
  assert.equal(daily.data.at(-1).value, 5.2)
  assert.equal(parseYahooTreasury(raw, "1d", (day + 60000) * 1000).data.length, 3)
})

test("short ranges use hourly source data while long history uses daily data", () => {
  for (const period of ["1D", "5D", "1M", "6M", "1Y"]) assert.equal(TREASURY_PERIOD_CONFIG[period].interval, "1h")
  for (const period of ["5Y", "10Y", "25Y", "MAX"]) assert.equal(TREASURY_PERIOD_CONFIG[period].interval, "1d")
})

test("route uses only the fixed Yahoo symbol, validates requests and handles outages", async () => {
  const originalFetch = globalThis.fetch
  try {
    let requestedUrl
    globalThis.fetch = async (url) => { requestedUrl = String(url); return Response.json(payload([base], [5.24])) }
    const response = await GET(new Request("http://localhost/api/market/treasury-10y?period=5D"))
    assert.equal(response.status, 200)
    const url = new URL(requestedUrl)
    assert.ok(url.pathname.endsWith("%5ETNX"))
    assert.equal(url.searchParams.get("interval"), "60m")
    assert.equal((await response.json()).metadata.source_series_id, "^TNX")
    globalThis.fetch = async (url) => { requestedUrl = String(url); return Response.json(payload([base], [5.24], "1d")) }
    assert.equal((await GET(new Request("http://localhost/api/market/treasury-10y?period=MAX"))).status, 200)
    const dailyUrl = new URL(requestedUrl)
    assert.equal(dailyUrl.searchParams.get("range"), null)
    assert.equal(dailyUrl.searchParams.get("interval"), "1d")
    assert.equal(Number(dailyUrl.searchParams.get("period2")) % 900, 0, "Daily history requests should reuse the provider cache")
    assert.ok(Number(dailyUrl.searchParams.get("period1")) < 0, "All available pre-1970 history must remain requestable")
    assert.equal((await GET(new Request("http://localhost/api/market/treasury-10y?period=bogus"))).status, 400)
    assert.equal((await GET(new Request("http://localhost/api/market/treasury-10y?period=MAX&interval=1h"))).status, 400)
    globalThis.fetch = async () => new Response("unavailable", { status: 429 })
    const failure = await GET(new Request("http://localhost/api/market/treasury-10y"))
    assert.equal(failure.status, 502)
    assert.match((await failure.json()).error, /Yahoo Finance/)
  } finally { globalThis.fetch = originalFetch }
})
