import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import test from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import ts from "typescript"

const require = createRequire(import.meta.url)
const source = await readFile(new URL("../components/analytics/market-outlook-card.jsx", import.meta.url), "utf8")
const code = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
} }).outputText

function loadCard(allowed = true) {
  const exports = {}
  new Function("require", "exports", code)(name => {
    if (name.endsWith("premium-analysis-gate")) return { default: ({ children }) => allowed ? children : React.createElement("p", null, "مخصوص کاربران پرمیوم") }
    if (name.endsWith("/card")) return Object.fromEntries(["Card", "CardHeader", "CardContent", "CardTitle"].map(key => [key, ({ children, ...props }) => React.createElement(key === "CardTitle" ? "h3" : "div", props, children)]))
    if (name.endsWith("date-format")) return { formatGregorianTehranDateTime: value => `TIME:${value}` }
    return require(name)
  }, exports)
  return props => renderToStaticMarkup(React.createElement(exports.default, props))
}

const view = {
  summary_fa: "برداشت اصلی آزمایشی", change_condition_fa: "شرط تغییر آزمایشی",
  change_summary_fa: "نتیجه بازبینی آزمایشی", detail_fa: "دلایل تفصیلی آزمایشی",
  assessed_at: "2026-11-09T12:30:00Z", data_as_of: "2026-11-06",
}

test("outlook, condition and review are visible while reasons are in a native disclosure", () => {
  const html = loadCard()({ title: "مسیر هفته‌های پیش‌رو", horizon: "چند روز تا چند هفته", view,
    assessedAt: "2026-11-10T18:00:00Z", weeklyFocus: "موضوع هفته آزمایشی", weeklyEvents: ["رویداد آزمایشی"], weeklyAssessedAt: view.assessed_at })
  const [visible, details] = html.split("<details")
  for (const text of [view.summary_fa, view.change_condition_fa, view.change_summary_fa, `TIME:${view.assessed_at}`]) assert.ok(visible.includes(text))
  assert.ok(!visible.includes(view.detail_fa))
  assert.match(details, /<summary[^>]*>دلایل و سناریوها<\/summary>/)
  assert.ok(details.includes(view.detail_fa) && details.includes("موضوع هفته آزمایشی"))
  assert.ok(!html.includes("2026-11-10T18:00:00Z"), "a newer pulse must not relabel the outlook's assessment time")
  assert.doesNotMatch(details.split(">")[0], /\bopen\b/)
})

test("legacy prose stays in details with its supplied original time", () => {
  const html = loadCard()({ title: "تصویر ۶ تا ۱۲ ماهه", legacyText: "روایت پیشین آزمایشی", assessedAt: view.assessed_at })
  const [visible, details] = html.split("<details")
  assert.ok(visible.includes(`TIME:${view.assessed_at}`))
  assert.ok(!visible.includes("روایت پیشین آزمایشی"))
  assert.ok(details.includes("روایت پیشین آزمایشی"))
  assert.ok(!html.includes("بدون تغییر"))
})

test("empty outlooks stay empty and premium content is not rendered to a locked viewer", () => {
  const empty = loadCard()({ title: "میان‌مدت" })
  assert.ok(empty.includes("هنوز ارزیابی مستقلی"))
  assert.ok(!empty.includes("<time"))
  const locked = loadCard(false)({ title: "میان‌مدت", view, weeklyFocus: "موضوع محرمانه آزمایشی" })
  assert.ok(locked.includes("مخصوص کاربران پرمیوم"))
  for (const text of [view.summary_fa, view.change_condition_fa, view.detail_fa, "موضوع محرمانه آزمایشی"]) assert.ok(!locked.includes(text))
})
