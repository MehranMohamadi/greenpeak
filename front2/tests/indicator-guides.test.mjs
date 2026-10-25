import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const data = JSON.parse(await readFile(new URL("../lib/indicator-guides.json", import.meta.url), "utf8"))
const source = (await readFile(new URL("../lib/indicator-guides.js", import.meta.url), "utf8"))
  .replace('import guides from "./indicator-guides.json"', `const guides = ${JSON.stringify(data)}`)
const { getIndicatorGuide, indicatorGuideNote } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`)

test("imported guides retain all six cells and unique source rows", () => {
  const entries = Object.values(data.entries)
  assert.equal(entries.length, 48)
  assert.equal(new Set(entries.map((entry) => entry.sourceRange)).size, 48)
  for (const entry of entries) {
    for (const key of ["titleEn", "titleFa", "literal", "meaning", "increase", "decrease"]) {
      assert.equal(typeof entry[key], "string")
      assert.ok(entry[key].length > 0)
    }
  }
  assert.match(data.source.sha256, /^[a-f0-9]{64}$/)
})

test("the same economic indicator resolves across chart and comparison IDs", () => {
  assert.equal(getIndicatorGuide("real_yield_10y"), getIndicatorGuide("real-interest-rate"))
  assert.equal(getIndicatorGuide("treasury-10y"), getIndicatorGuide("ten-year-treasury"))
  assert.equal(getIndicatorGuide("pe-ratio"), getIndicatorGuide("valuation_pe_ratio"))
  assert.notEqual(getIndicatorGuide("forward_pe_ratio"), getIndicatorGuide("valuation_pe_ratio"))
})

test("DXY never receives the broad trade-weighted dollar guide", () => {
  assert.ok(getIndicatorGuide("broad_dollar"))
  assert.equal(getIndicatorGuide("DXY"), null)
  assert.equal(getIndicatorGuide("dollar-index"), null)
})

test("uncovered charts and object-property names return no invented definition", () => {
  for (const key of ["sp500", "iran_total", "nasdaq100", "unknown", "constructor", "__proto__", undefined]) {
    assert.equal(getIndicatorGuide(key), null)
  }
})

test("operating EPS source text stays intact and real-EPS mismatch stays explicit", () => {
  assert.match(getIndicatorGuide("sp500_eps").titleEn, /Operating Earnings/)
  assert.match(indicatorGuideNote("sp500_eps"), /Multpl/)
  assert.ok(indicatorGuideNote("sp500_eps"))
  assert.equal(indicatorGuideNote("revenue_growth"), null)
})
