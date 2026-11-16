import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import test from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import ts from "typescript"

const require = createRequire(import.meta.url)
const codes = Object.fromEntries(await Promise.all(["market-outlook-card", "market-pulse-analysis", "analysis-details-dialog"].map(async name => {
  const source = await readFile(new URL(`../components/analytics/${name}.jsx`, import.meta.url), "utf8")
  return [name, ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText]
})))

function loadCard(allowed = true, name = "market-outlook-card") {
  const exports = {}
  let dialogs = []
  new Function("require", "exports", codes[name])(name => {
    if (name.endsWith("premium-analysis-gate")) return { default: ({ children }) => allowed ? children : React.createElement("p", null, "مخصوص کاربران پرمیوم") }
    if (name.endsWith("analysis-details-dialog")) return { default: ({ title, children }) => {
      dialogs.push({ title, body: renderToStaticMarkup(React.createElement("div", null, children)) })
      return React.createElement("button", { "aria-label": `دلایل و سناریوهای ${title}`, "aria-haspopup": "dialog" }, "مثلث")
    } }
    if (name.endsWith("/card")) return Object.fromEntries(["Card", "CardHeader", "CardContent", "CardTitle"].map(key => [key, ({ children, ...props }) => React.createElement(key === "CardTitle" ? "h3" : "div", props, children)]))
    if (name.endsWith("date-format")) return { formatGregorianTehranDateTime: value => `TIME:${value}` }
    return require(name)
  }, exports)
  return props => {
    dialogs = []
    const html = renderToStaticMarkup(React.createElement(exports.default, props))
    return { html, dialogs }
  }
}

const view = {
  summary_fa: "برداشت اصلی آزمایشی", change_condition_fa: "شرط تغییر آزمایشی",
  change_summary_fa: "نتیجه بازبینی آزمایشی", detail_fa: "دلایل تفصیلی آزمایشی",
  assessed_at: "2026-11-09T12:30:00Z", data_as_of: "2026-11-06",
}

test("outlook, condition and review stay visible while reasons open in a dialog", () => {
  const { html, dialogs } = loadCard()({ title: "مسیر هفته‌های پیش‌رو", horizon: "چند روز تا چند هفته", view,
    assessedAt: "2026-11-10T18:00:00Z", weeklyFocus: "موضوع هفته آزمایشی", weeklyEvents: ["رویداد آزمایشی"], weeklyAssessedAt: view.assessed_at })
  for (const text of [view.summary_fa, view.change_condition_fa, view.change_summary_fa, `TIME:${view.assessed_at}`]) assert.ok(html.includes(text))
  assert.ok(!html.includes(view.detail_fa))
  assert.match(html, /aria-haspopup="dialog"/)
  assert.doesNotMatch(html, /<details|<summary/)
  assert.equal(dialogs.length, 1)
  assert.equal(dialogs[0].title, "مسیر هفته‌های پیش‌رو")
  assert.ok(dialogs[0].body.includes(view.detail_fa) && dialogs[0].body.includes("موضوع هفته آزمایشی") && dialogs[0].body.includes("رویداد آزمایشی"))
  assert.ok(!html.includes("2026-11-10T18:00:00Z"), "a newer pulse must not relabel the outlook's assessment time")
})

test("legacy prose stays in details with its supplied original time", () => {
  const { html, dialogs } = loadCard()({ title: "تصویر ۶ تا ۱۲ ماهه", legacyText: "روایت پیشین آزمایشی", assessedAt: view.assessed_at })
  assert.ok(html.includes(`TIME:${view.assessed_at}`))
  assert.ok(!html.includes("روایت پیشین آزمایشی"))
  assert.ok(dialogs[0].body.includes("روایت پیشین آزمایشی"))
  assert.ok(!html.includes("بدون تغییر"))
})

test("empty outlooks stay empty and premium content is not rendered to a locked viewer", () => {
  const { html: empty, dialogs: emptyDialogs } = loadCard()({ title: "میان‌مدت" })
  assert.ok(empty.includes("هنوز ارزیابی مستقلی"))
  assert.ok(!empty.includes("<time"))
  assert.equal(emptyDialogs.length, 0)
  const { html: locked, dialogs } = loadCard(false)({ title: "میان‌مدت", view, weeklyFocus: "موضوع محرمانه آزمایشی" })
  assert.ok(locked.includes("مخصوص کاربران پرمیوم"))
  for (const text of [view.summary_fa, view.change_condition_fa, view.detail_fa, "موضوع محرمانه آزمایشی"]) assert.ok(!locked.includes(text))
  assert.equal(dialogs.length, 0, "locked viewers cannot open the private reasons")
})

test("unchanged review stays brief while its full explanation remains available", () => {
  const { html, dialogs } = loadCard()({ embedded: true, view: { ...view, change_status: "unchanged" } })
  assert.ok(html.includes("بدون تغییر در آخرین بازبینی"))
  assert.ok(!html.includes(view.change_summary_fa))
  assert.ok(dialogs[0].body.includes(view.change_summary_fa))
  assert.ok(html.indexOf(view.summary_fa) < html.indexOf(view.change_condition_fa))
})

test("no empty popup is offered when there are no supplemental explanations", () => {
  const { dialogs } = loadCard()({ embedded: true, view: { summary_fa: "خلاصه آزمایشی" } })
  assert.equal(dialogs.length, 0)
  const weekly = loadCard()({ embedded: true, view: { summary_fa: "خلاصه آزمایشی" }, weeklyEvents: ["رویداد آزمایشی"] })
  assert.ok(weekly.dialogs[0].body.includes("رویداد آزمایشی"))
})

test("pulse keeps its summary and shows only this pulse's explanation in the popup", () => {
  const render = loadCard(true, "market-pulse-analysis")
  const market = { current_market_move_fa: "تیتر آزمایشی\nبرداشت روز", current_analysis_fa: "متن اصلی نبض", watch_next_fa: ["محرک بعدی"],
    glance_summary: { supportive_fa: ["دلیل حمایتی آزمایشی"], regime_shifters_fa: ["شرط تغییر آزمایشی"] } }
  const { html, dialogs } = render({ market })
  for (const text of ["تیتر آزمایشی", "برداشت روز", "محرک بعدی"]) assert.ok(html.includes(text))
  assert.ok(!html.includes("متن اصلی نبض"))
  assert.ok(!html.includes("دلیل حمایتی آزمایشی"))
  assert.doesNotMatch(html, /<details|<summary/)
  assert.equal(dialogs[0].title, "نبض بازار")
  assert.ok(dialogs[0].body.includes("متن اصلی نبض"))
  assert.ok(!dialogs[0].body.includes("دلیل حمایتی آزمایشی"), "retained factor evidence must not become current pulse reasons")
  assert.equal(render({ market: { ...market, current_analysis_fa: "" } }).dialogs.length, 0)
  const legacy = render({ market: { narrative_fa: "تنها متن قدیمی موجود" } })
  assert.ok(legacy.html.includes("تنها متن قدیمی موجود"))
  assert.equal(legacy.dialogs.length, 0)
})

test("the real dialog trigger is accessible and its explanations stay absent while closed", () => {
  const exports = {}
  const primitive = require("@radix-ui/react-dialog")
  new Function("require", "exports", codes["analysis-details-dialog"])(name => {
    if (name.endsWith("/dialog")) return { Dialog: primitive.Root, DialogTrigger: primitive.Trigger,
      DialogContent: ({ children }) => React.createElement(primitive.Portal, null, React.createElement(primitive.Content, null, children)),
      DialogHeader: ({ children }) => React.createElement("div", null, children), DialogTitle: primitive.Title, DialogDescription: primitive.Description }
    return require(name)
  }, exports)
  const html = renderToStaticMarkup(React.createElement(exports.default, { title: "کوتاه‌مدت" }, "توضیحات پنهان آزمایشی"))
  assert.match(html, /aria-haspopup="dialog"/)
  assert.match(html, /aria-expanded="false"/)
  assert.ok(html.includes("دلایل و سناریوهای کوتاه‌مدت"))
  assert.ok(!html.includes("توضیحات پنهان آزمایشی"))
  assert.doesNotMatch(html, /<details|<summary/)
})
