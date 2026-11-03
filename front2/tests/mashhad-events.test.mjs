import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import ts from "typescript"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const modules = new Map()
function loadModule(filename) {
  if (modules.has(filename)) return modules.get(filename).exports
  const module = { exports: {} }
  modules.set(filename, module)
  const nativeRequire = createRequire(filename)
  const require = name => {
    if (name === "@/app/context/sidebar-hover-context") return { useSidebarHover: () => ({ selectedRightItem: null }) }
    if (!name.startsWith("@/")) return nativeRequire(name)
    const base = resolve(root, name.slice(2))
    const target = ["", ".jsx", ".tsx", ".js", ".ts"].map(extension => base + extension).find(existsSync)
    if (!target) throw new Error(`Cannot resolve ${name}`)
    return loadModule(target)
  }
  const { outputText } = ts.transpileModule(readFileSync(filename, "utf8"), {
    fileName: filename,
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  })
  new Function("require", "module", "exports", outputText)(require, module, module.exports)
  return module.exports
}

const { getMashhadEventSection, getTehranDateKey, getUpcomingMashhadEvents, mashhadEvents } = loadModule(resolve(root, "lib/fun-content.js"))
const { CityEventsSection } = loadModule(resolve(root, "components/fun/mashhad-events.jsx"))
const render = (section, today = "2026-11-03") => renderToStaticMarkup(React.createElement(CityEventsSection, { section, today }))

test("sidebar selections resolve only within the city category", () => {
  assert.equal(getMashhadEventSection({ label: "رویدادهای فرهنگی", trail: [{ label: "در شهر" }] }), "cultural")
  assert.equal(getMashhadEventSection({ label: "رویدادهای مالی", trail: [{ label: "در شهر" }] }), "financial")
  assert.equal(getMashhadEventSection({ label: "رویدادهای مالی", trail: [{ label: "حیاط" }] }), null)
  assert.equal(getMashhadEventSection(null), null)
})

test("both categories render actual shared cards with their own events and sources", () => {
  const cultural = render("cultural")
  const financial = render("financial")
  assert.equal((cultural.match(/role="article"/g) || []).length, 3)
  assert.equal((financial.match(/role="article"/g) || []).length, 2)
  for (const event of mashhadEvents) {
    const own = event.section === "cultural" ? cultural : financial
    const other = event.section === "cultural" ? financial : cultural
    assert.ok(own.includes(event.title))
    assert.ok(own.includes(event.sourceUrl))
    assert.ok(!other.includes(event.title))
    if (event.registrationUrl) assert.ok(own.includes(event.registrationUrl))
  }
  assert.ok(cultural.includes("در اطلاعیه اعلام نشده"))
  assert.ok(!cultural.includes("رایگان"))
  assert.equal((render(null).match(/role="article"/g) || []).length, 5)
})

test("expired events disappear while an ongoing multi-day event stays visible", () => {
  const active = getUpcomingMashhadEvents("cultural", "2026-11-12")
  assert.deepEqual(active.map(event => event.id), ["patina-workshop-1405-08", "santur-tuning-1405-08"])
  assert.ok(render("cultural", "2026-11-12").includes("در حال برگزاری"))
  assert.equal(getUpcomingMashhadEvents("financial", "2026-11-06").length, 1)
  assert.equal(getUpcomingMashhadEvents(null, "2026-11-15").length, 0)
  const empty = render("financial", "2026-11-15")
  assert.ok(empty.includes("رویداد آینده‌ای برای این بخش باقی نمانده"))
  assert.ok(!empty.includes('role="article"'))
})

test("the date changes at Tehran midnight and dates match their Persian labels", () => {
  assert.equal(getTehranDateKey(new Date("2026-11-03T20:29:59Z")), "2026-11-03")
  assert.equal(getTehranDateKey(new Date("2026-11-03T20:30:00Z")), "2026-11-04")
  const formatter = new Intl.DateTimeFormat("fa-IR", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Tehran" })
  for (const event of mashhadEvents) {
    const persianStart = formatter.format(new Date(`${event.startDate}T12:00:00Z`))
    if (event.id === "patina-workshop-1405-08") assert.equal(persianStart, "۲۰ آبان ۱۴۰۵")
    else assert.ok(event.date.includes(persianStart), `${event.id}: ${persianStart}`)
  }
})

test("initial render waits for the browser date without displaying stale cards", () => {
  const html = render("cultural", null)
  assert.ok(html.includes('role="status"'))
  assert.ok(!html.includes('role="article"'))
})
