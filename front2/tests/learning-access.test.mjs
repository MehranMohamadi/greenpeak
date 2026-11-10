import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import test from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import ts from "typescript"
import * as content from "../lib/learning-content.mjs"

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

const pages = await Promise.all(["app/learn/page.jsx", "app/learn/risk-management/page.jsx"].map(compile))
const sidebarCode = await compile("components/kokonutui/fun-sidebar.jsx")
const wrapperCode = await compile("components/auth/auth-wrapper.jsx")

function page(code) {
  return evaluate(code, {
    "@/lib/admin-page": { requireAdminPage: () => assert.fail("Learning must not require an admin role") },
    "@/lib/learning-content.mjs": content,
    "next/link": defaultExport("a"),
    "@/components/kokonutui/layout": defaultExport("div"),
    "@/components/learning/risk-learning": defaultExport("div"),
    "@/components/ui/badge": { Badge: "span" },
    "@/components/ui/button": { Button: "button" },
  }).default
}

test("both learning pages render without an administrator requirement", async () => {
  for (const code of pages) {
    assert(React.isValidElement(await page(code)()))
  }
})

test("the education link is visible for every role and while the session is loading", () => {
  for (const role of ["admin", "staff", "user"]) {
    for (const isLoading of [true, false]) {
      const Sidebar = evaluate(sidebarCode, {
        "next/link": defaultExport(({ children, ...props }) => React.createElement("a", props, children)),
        "next/navigation": { usePathname: () => "/" },
        "framer-motion": { AnimatePresence: ({ children }) => children, useReducedMotion: () => true },
        "@/app/context/sidebar-hover-context": { useSidebarHover: () => ({ setHoveredItem: noop, setSelectedRightItem: noop }) },
        "@/lib/navigation-state": navigation,
        "@/components/theme-toggle": { ThemeToggle: () => null },
        "./profile-01": defaultExport(() => null),
        "@/components/auth/auth-context": { useAuth: () => ({ isAdmin: role === "admin", isAuthenticated: true, isLoading }) },
        "@/components/chat/chat-context": { useChat: () => ({ open: false, setOpen: noop }) },
      }).default
      const markup = renderToStaticMarkup(React.createElement(Sidebar))
      assert(markup.includes('href="/learn"'))
      assert(markup.includes('href="/fun"'), "Courtyard navigation remains available")
    }
  }
})

test("client navigation allows all authenticated roles into learning and retains login protection", () => {
  for (const path of ["/learn", "/learn/risk-management", "/learn/future-lesson"]) {
    for (const role of ["admin", "staff", "user"]) {
      for (const isAuthenticated of [true, false]) {
        const Wrapper = evaluate(wrapperCode, {
          "next/navigation": { usePathname: () => path },
          "@/components/auth/auth-context": { useAuth: () => ({ isAdmin: role === "admin", isLoading: false }) },
          "@/components/auth/protected-route": defaultExport(({ children }) => isAuthenticated ? children : "login-required"),
        }).default
        const markup = renderToStaticMarkup(React.createElement(Wrapper, null, "private-learning-content"))
        assert.equal(markup.includes("private-learning-content"), isAuthenticated)
      }
    }
  }
})

test("client navigation retains administrator restrictions on management tools", () => {
  for (const path of ["/admin", "/admin/settings", "/analytics/feature-pipeline-debug", "/analytics/mt5-snapshots", "/architecture/ai-market-analysis"]) {
    for (const role of ["admin", "staff", "user"]) {
      const Wrapper = evaluate(wrapperCode, {
        "next/navigation": { usePathname: () => path },
        "@/components/auth/auth-context": { useAuth: () => ({ isAdmin: role === "admin", isLoading: false }) },
        "@/components/auth/protected-route": defaultExport(({ children }) => children),
      }).default
      const markup = renderToStaticMarkup(React.createElement(Wrapper, null, "admin-content"))
      assert.equal(markup.includes("admin-content"), role === "admin")
    }
  }
})
