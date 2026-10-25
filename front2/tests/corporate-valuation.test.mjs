import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const load = async (name) => {
  const source = (await readFile(new URL(`../lib/${name}.js`, import.meta.url), "utf8"))
    .replace('from "lucide-react"', `from ${JSON.stringify(import.meta.resolve("lucide-react"))}`)
  return import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`)
}
const { corporateFactors, valuationFactors, corporateValuationFactors, corporateValuationDomains, buildCorporateValuationResults, formatCorporateValuationValue } = await load("corporate-valuation")
const { marketAnalysisCategories, getMarketAnalysisCategory, getCategoryByName, getCategoryByPage, getCategoryIndex } = await load("analytics-registry")

test("the combined group retains all ten chart and narrative identities", () => {
  assert.deepEqual(corporateValuationFactors.map(({ id, key, indicatorId }) => [id, key, indicatorId]), [
    ["sp500-eps", "sp500eps", "sp500_eps"],
    ["sales-growth", "revenue", "revenue_growth"],
    ["profit-margins", "margins", "profit_margins"],
    ["return-on-assets", "returnOnAssets", "return_on_assets"],
    ["pe-ratio", "peRatio", "valuation_pe_ratio"],
    ["forward-pe", "forwardPE", "forward_pe_ratio"],
    ["price-to-book", "priceToBook", "price_to_book_ratio"],
    ["price-to-sales", "priceToSales", "price_to_sales_ratio"],
    ["peg-ratio", "pegRatio", "peg_ratio"],
    ["dividend-yield", "dividendYield", "valuation_dividend_yield"],
  ])
  assert.equal(new Set(corporateValuationFactors.map((factor) => factor.id)).size, 10)
  assert.deepEqual(corporateValuationDomains.map((domain) => domain.id), ["corporate_fundamentals", "valuation"])
})

test("a failed source does not hide the other domain's observations or metadata", () => {
  const corporate = { data: {}, metadata: {}, errors: { sp500eps: "unavailable" }, loading: false, error: "Corporate service unavailable" }
  const valuation = { data: { peRatio: [{ date: "2025-01-01", value: 20 }] }, metadata: { peRatio: { source: "test fixture", frequency: "monthly" } }, errors: {}, loading: false }
  const results = buildCorporateValuationResults(corporate, valuation)
  for (const factor of corporateFactors) assert.equal(results[factor.id], corporate)
  for (const factor of valuationFactors) assert.equal(results[factor.id], valuation)
  assert.equal(results["pe-ratio"].data.peRatio, valuation.data.peRatio)
  assert.equal(results["pe-ratio"].metadata.peRatio, valuation.metadata.peRatio)
  const reversed = buildCorporateValuationResults(valuation, corporate)
  assert.equal(reversed["sp500-eps"], valuation)
  assert.equal(reversed["pe-ratio"], corporate)
})

test("currency, percentage and multiple display units remain unchanged", () => {
  assert.equal(formatCorporateValuationValue(12.345, corporateFactors[0]), "12.35 USD")
  assert.equal(formatCorporateValuationValue(12.345, corporateFactors[1]), "12.35%")
  assert.equal(formatCorporateValuationValue(12.345, valuationFactors[0]), "12.35x")
  assert.equal(formatCorporateValuationValue(12.345, valuationFactors.at(-1)), "12.35%")
})

test("both former groups resolve to one category in navigation", () => {
  const combined = getMarketAnalysisCategory("corporate-earnings")
  assert.equal(marketAnalysisCategories.length, 6)
  assert.equal(marketAnalysisCategories[3], combined)
  assert.equal(marketAnalysisCategories.some((category) => category.page === "valuation"), false)
  assert.equal(getMarketAnalysisCategory("valuation"), combined)
  assert.equal(getCategoryByPage("valuation"), combined)
  for (const name of ["Corporate Fundamentals & Earnings", "Valuation", "Corporate Fundamentals & Valuation"]) {
    assert.equal(getCategoryByName(name), combined)
    assert.equal(getCategoryIndex(name), 3)
  }
})
