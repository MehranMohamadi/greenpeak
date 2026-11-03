import assert from "node:assert/strict"
import { readFileSync, existsSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import ts from "typescript"

// Render the real JSX and UI imports. Missing Card/Metric bindings must fail
// here even though the project's TypeScript check does not check JSX files.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const modules = new Map()
function loadComponent(filename) {
  if (modules.has(filename)) return modules.get(filename).exports
  const module = { exports: {} }
  modules.set(filename, module)
  const nativeRequire = createRequire(filename)
  const require = name => {
    if (!name.startsWith("@/")) return nativeRequire(name)
    const base = resolve(root, name.slice(2))
    const target = ["", ".jsx", ".tsx", ".js", ".ts"].map(extension => base + extension).find(existsSync)
    if (!target) throw new Error(`Cannot resolve ${name}`)
    return loadComponent(target)
  }
  const { outputText } = ts.transpileModule(readFileSync(filename, "utf8"), {
    fileName: filename,
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  })
  new Function("require", "module", "exports", outputText)(require, module, module.exports)
  return module.exports
}
const { default: LLMModelCard } = loadComponent(resolve(root, "components/workplace/llm-model-card.jsx"))
const row = {
  id: "a".repeat(24), provider: "groq", model: "test-model", budget: "",
  requests: 3, failed_requests: 1, input_tokens: 10, output_tokens: 5,
  total_tokens: 15, unmetered_requests: 0, estimated_remaining_tokens: null,
  reported_quota: null,
}
const render = props => renderToStaticMarkup(React.createElement(LLMModelCard, {
  row, index: 0, total: 2, saving: false, testingId: null,
  onTest() {}, onToggle() {}, onMove() {}, onBudgetChange() {}, ...props,
}))

test("a populated model renders its card and all six usage metrics", () => {
  const html = render()
  assert.match(html, /groq/)
  assert.match(html, /test-model/)
  assert.equal((html.match(/<dt /g) || []).length, 6)
  assert.match(html, /توکن مصرف‌شدهٔ ثبت‌شده/)
  assert.match(html, /۱۵/)
  assert.equal((html.match(/disabled=""/g) || []).length, 1)
})

test("unknown usage stays unknown and the last priority cannot move down", () => {
  const html = render({ index: 1, row: { ...row, total_tokens: null, unmetered_requests: 1 } })
  assert.equal((html.match(/>نامشخص<\/dd>/g) || []).length, 2)
  assert.match(html, /مصرف واقعی می‌تواند بیشتر باشد/)
  assert.equal((html.match(/disabled=""/g) || []).length, 1)
})

test("enabled models expose a disable action and disabled models cannot be probed", () => {
  const enabled = render({ row: { ...row, enabled: true } })
  assert.match(enabled, /aria-pressed="true"/)
  assert.match(enabled, /aria-label="غیرفعال‌سازی groq test-model"/)
  const disabled = render({ row: { ...row, enabled: false } })
  assert.match(disabled, /aria-pressed="false"/)
  assert.match(disabled, /aria-label="فعال‌سازی groq test-model"/)
  assert.match(disabled, /<button[^>]*disabled=""[^>]*aria-label="تست اتصال groq test-model"/)
  assert.match(disabled, /test-model/)
})

test("connection results and reported quota render without undefined helpers", () => {
  const html = render({
    result: { status: "failed", error_code: "rate_limited", elapsed_ms: 25, http_status: 429, testedAt: "2026-11-01T12:00:00Z" },
    row: { ...row, reported_quota: { observed_at: "2026-11-01T12:00:00Z", remaining_tokens: 90, limit_tokens: 100 } },
  })
  assert.match(html, /محدودیت تعداد درخواست یا سهمیه فعال است/)
  assert.match(html, /HTTP.*429/)
  assert.match(html, /آخرین سهمیهٔ اعلام‌شده توسط Groq/)
  assert.match(html, /۹۰/)
  assert.match(render({ result: { status: "succeeded", elapsed_ms: 10 } }), /اتصال برقرار است و پاسخ معتبر دریافت شد/)
})
