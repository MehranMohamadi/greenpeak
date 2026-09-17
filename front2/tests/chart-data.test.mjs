import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

// Load the same browser modules without a Next.js alias loader or new dependency.
const source = await readFile(new URL("../lib/chart-data.js", import.meta.url), "utf8")
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
const { chartDate, normalizeChartData, sliceChartPeriod } = await import(moduleUrl)
const monetarySource = (await readFile(new URL("../hooks/monetaryDataUtils.js", import.meta.url), "utf8"))
  .replace('"@/lib/chart-data"', JSON.stringify(moduleUrl))
const monetary = await import(`data:text/javascript;base64,${Buffer.from(monetarySource).toString("base64")}`)

test("API dates, ISO datetimes and Unix seconds use the same observation day", () => {
  for (const time of ["2025-01-03", "2025-01-03T00:00:00Z", 1735862400, "1735862400"]) {
    assert.equal(chartDate(time), "2025-01-03")
  }
  assert.equal(chartDate("2025-01"), "2025-01-01")
  for (const time of [null, undefined, "Jan", "2025-02-30", Infinity, "bad date"]) {
    assert.equal(chartDate(time), null)
  }
})

test("chart rows are ascending and unique, without inventing dates or zero values", () => {
  const rows = [
    { date: "2025-01-03", value: "4.5" },
    { date: "2025-01-01", value: 0 },
    { time: "2025-01-02T00:00:00Z", rate: -0.25 },
    { date: "2025-01-03", value: "4.6" },
    { date: "2025-01-03", value: null },
    { date: "2025-01-04", value: "" },
    { date: "2025-01-05", value: Infinity },
    { value: 4.7 },
    null,
  ]
  assert.deepEqual(normalizeChartData(rows), [
    { time: "2025-01-01", value: 0 },
    { time: "2025-01-02", value: -0.25 },
    { time: "2025-01-03", value: 4.6 },
  ])
  assert.equal(rows[3].date, "2025-01-03")
  assert.deepEqual(normalizeChartData({ data: rows }), [])
})

test("all monetary rate adapters accept date-only, timestamp-only and value-only rows", () => {
  const rows = [
    { date: "2025-01-03", value: 0 },
    { time: 1735776000, rate: "-0.25" },
  ]
  const expected = [{ time: "2025-01-02", value: -0.25 }, { time: "2025-01-03", value: 0 }]
  for (const name of ["processDFFData", "processTenYearData", "processSOFRData", "processRealInterestRateData"]) {
    assert.deepEqual(monetary[name](rows), expected, name)
    assert.deepEqual(monetary[name]([{ date: "2025-01-03", rate: null, value: null }]), [], name)
  }
  assert.deepEqual(monetary.processWALCLData([{ date: "2025-01-03", value: 7000000 }]), [{ time: "2025-01-03", value: 7 }])
})

test("short periods retain available stale history and accept ISO dates", () => {
  const data = normalizeChartData([
    { date: "2020-01-01T00:00:00Z", value: 1 },
    { date: "2020-05-01T00:00:00Z", value: 2 },
    { date: "2020-06-01T00:00:00Z", value: 3 },
  ])
  assert.deepEqual(sliceChartPeriod(data, "1M"), data.slice(1))
  assert.deepEqual(sliceChartPeriod(data, "MAX"), data)
  assert.deepEqual(sliceChartPeriod([], "1Y"), [])
})

test("DFF short-period display retains daily resolution before downsampling long history", () => {
  const rows = Array.from({ length: 6000 }, (_, i) => ({ time: 946684800 + i * 86400, value: 4.5 }))
  const month = monetary.processDFFData(rows, true, "1M")
  assert.ok(month.length >= 29 && month.length <= 32)
  assert.equal(month.at(-1).time, chartDate(rows.at(-1).time))
})
