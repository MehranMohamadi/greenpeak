import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import test from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import ts from "typescript"
import * as content from "../lib/learning-content.mjs"
import * as workplaceNavigation from "../lib/workplace-navigation.mjs"
import * as workTasks from "../lib/work-tasks.mjs"

const require = createRequire(import.meta.url)
const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8")
const navigation = await import(`data:text/javascript;base64,${Buffer.from(await read("lib/navigation-state.js")).toString("base64")}`)
const defaultExport = component => ({ __esModule: true, default: component })
const noop = () => {}

async function compile(path) {
  return ts.transpileModule(await read(path), {
    fileName: path,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText
}

function evaluate(code, mocks, globals = {}) {
  const module = { exports: {} }
  new Function("require", "module", "exports", "fetch", "process", code)(
    name => Object.hasOwn(mocks, name) ? mocks[name] : require(name), module, module.exports, globals.fetch, globals.process,
  )
  return module.exports
}

const guardCode = await compile("lib/admin-page.js")
const pages = await Promise.all(["app/learn/page.jsx", "app/learn/risk-management/page.jsx"].map(compile))
const sidebarCode = await compile("components/kokonutui/fun-sidebar.jsx")
const wrapperCode = await compile("components/auth/auth-wrapper.jsx")

function adminGuard(role, { cookie = "test-session", reachable = true, valid = true } = {}) {
  const calls = []
  const guards = evaluate(guardCode, {
    "server-only": {},
    "next/headers": { cookies: async () => ({ get: () => cookie ? { value: cookie } : undefined }) },
    "next/navigation": { redirect: path => { throw new Error(`redirect:${path}`) } },
    "@/lib/work-tasks.mjs": workTasks,
    "@/lib/workplace-navigation.mjs": workplaceNavigation,
  }, {
    process: { env: { GREENPEAK_INTERNAL_API_BASE_URL: "http://internal.test/api/v1" } },
    fetch: async (...args) => {
      calls.push(args)
      if (!reachable) throw new Error("offline")
      return { ok: valid, json: async () => ({ user: { role } }) }
    },
  })
  return { ...guards, calls }
}

function page(code, guard) {
  return evaluate(code, {
    "@/lib/admin-page": guard,
    "@/lib/learning-content.mjs": content,
    "next/link": defaultExport("a"),
    "@/components/kokonutui/layout": defaultExport("div"),
    "@/components/learning/risk-learning": defaultExport("div"),
    "@/components/ui/badge": { Badge: "span" },
    "@/components/ui/button": { Button: "button" },
  }).default
}

test("both learning pages verify the live session and allow only administrators", async () => {
  for (const code of pages) {
    const guard = adminGuard("admin")
    assert(React.isValidElement(await page(code, guard)()))
    assert.equal(guard.calls[0][0], "http://internal.test/api/v1/auth/session")
    assert.equal(guard.calls[0][1].cache, "no-store")
    for (const role of ["user", "staff", undefined]) {
      await assert.rejects(page(code, adminGuard(role))(), /redirect:\/profile/)
    }
    for (const options of [{ cookie: "" }, { valid: false }, { reachable: false }]) {
      await assert.rejects(page(code, adminGuard("admin", options))(), /redirect:\/login/)
    }
  }
})

test("the education icon is absent for non-admins and while the session is loading", () => {
  for (const [isAdmin, isLoading, visible] of [[true, false, true], [false, false, false], [false, true, false], [true, true, false]]) {
    const Sidebar = evaluate(sidebarCode, {
      "next/link": defaultExport(({ children, ...props }) => React.createElement("a", props, children)),
      "next/navigation": { usePathname: () => "/" },
      "framer-motion": { AnimatePresence: ({ children }) => children, useReducedMotion: () => true },
      "@/app/context/sidebar-hover-context": { useSidebarHover: () => ({ setHoveredItem: noop, setSelectedRightItem: noop }) },
      "@/lib/navigation-state": navigation,
      "@/components/theme-toggle": { ThemeToggle: () => null },
      "./profile-01": defaultExport(() => null),
      "@/components/auth/auth-context": { useAuth: () => ({ isAdmin, isLoading }) },
      "@/components/chat/chat-context": { useChat: () => ({ open: false, setOpen: noop }) },
    }).default
    const markup = renderToStaticMarkup(React.createElement(Sidebar))
    assert.equal(markup.includes('href="/learn"'), visible)
    assert(markup.includes('href="/fun"'), "Courtyard navigation remains available")
  }
})

test("client navigation also blocks learning pages when an authenticated role is no longer admin", () => {
  for (const path of ["/learn", "/learn/risk-management", "/learn/future-lesson"]) {
    for (const isAdmin of [true, false]) {
      const Wrapper = evaluate(wrapperCode, {
        "next/navigation": { usePathname: () => path },
        "@/components/auth/auth-context": { useAuth: () => ({ isAdmin, isLoading: false }) },
        "@/components/auth/protected-route": defaultExport(({ children }) => children),
      }).default
      const markup = renderToStaticMarkup(React.createElement(Wrapper, null, "private-learning-content"))
      assert.equal(markup.includes("private-learning-content"), isAdmin)
    }
  }
})
