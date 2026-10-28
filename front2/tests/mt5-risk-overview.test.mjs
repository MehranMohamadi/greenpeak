import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { pathToFileURL } from "node:url"
import test from "node:test"

const require = createRequire(import.meta.url)
const source = (await readFile(new URL("../app/dashboard-data/mt5/risk-overview/route.js", import.meta.url), "utf8"))
  .replace('"next/server"', JSON.stringify(pathToFileURL(require.resolve("next/server.js")).href))
const { GET } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`)

test("risk proxy enforces authentication, preserves server results and disables caching", async () => {
  const originalFetch = globalThis.fetch
  const request = () => new Request("http://localhost/dashboard-data/mt5/risk-overview", { headers: { Authorization: "Bearer session" } })
  try {
    let calls = 0
    globalThis.fetch = async (url, options) => {
      calls++
      assert.ok(String(url).endsWith("/mt5/risk-overview"))
      assert.equal(options.headers.Authorization, "Bearer session")
      assert.equal(options.cache, "no-store")
      return Response.json({ accounts: [], leverage: { value: 7.125 } })
    }
    const unauthorized = await GET(new Request("http://localhost/dashboard-data/mt5/risk-overview"))
    assert.equal(unauthorized.status, 401)
    assert.equal(calls, 0)
    const response = await GET(request())
    assert.equal(response.status, 200)
    assert.equal(response.headers.get("cache-control"), "no-store")
    assert.equal((await response.json()).leverage.value, 7.125)
    globalThis.fetch = async () => Response.json({ accounts: [] })
    assert.equal((await GET(request())).status, 502)
    globalThis.fetch = async () => Response.json({ detail: "Authentication required" }, { status: 401 })
    assert.equal((await GET(request())).status, 401)
    globalThis.fetch = async () => { throw new Error("private upstream details") }
    const failed = await GET(request())
    assert.equal(failed.status, 503)
    assert.equal(failed.headers.get("cache-control"), "no-store")
    assert.ok(!(await failed.text()).includes("private"))
  } finally { globalThis.fetch = originalFetch }
})
