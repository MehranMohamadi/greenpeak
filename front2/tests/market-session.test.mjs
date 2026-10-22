import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const source = await readFile(new URL("../lib/market-session.js", import.meta.url), "utf8")
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
const { fetchMarketSession, validMarketSession } = await import(moduleUrl)
const routeSource = (await readFile(new URL("../app/api/v1/system/session/route.js", import.meta.url), "utf8"))
  .replace('"@/lib/market-session"', JSON.stringify(moduleUrl))
const { GET } = await import(`data:text/javascript;base64,${Buffer.from(routeSource).toString("base64")}`)
const fixture = { sessions: [{ name: "London", status: "open" }, { name: "New York", status: "closed" }], overview: { active_sessions: 1 } }

test("session data is forwarded unchanged and always requested uncached", async () => {
  const controller = new AbortController()
  const data = await fetchMarketSession("/api/v1/system/session", {
    signal: controller.signal,
    fetchImpl: async (url, options) => {
      assert.equal(url, "/api/v1/system/session")
      assert.equal(options.signal, controller.signal)
      assert.equal(options.cache, "no-store")
      return Response.json(fixture)
    },
  })
  assert.deepEqual(data, fixture)
})

test("failed requests return unavailable and the next refresh can recover", async () => {
  for (const status of [500, 502, 503]) {
    assert.equal(await fetchMarketSession("/session", { fetchImpl: async () => new Response("unavailable", { status }) }), null)
  }
  assert.equal(await fetchMarketSession("/session", { fetchImpl: async () => { throw new TypeError("fetch failed") } }), null)
  assert.equal(await fetchMarketSession("/session", { fetchImpl: async () => new Response("not JSON") }), null)
  assert.deepEqual(await fetchMarketSession("/session", { fetchImpl: async () => Response.json(fixture) }), fixture)
})

test("empty, duplicate or invalid session states are never displayed as real states", async () => {
  for (const payload of [null, {}, { sessions: [] }, { sessions: [null] }, { sessions: [{ name: "London", status: "unknown" }] }, { sessions: [fixture.sessions[0], fixture.sessions[0]] }]) {
    assert.equal(validMarketSession(payload), false)
    assert.equal(await fetchMarketSession("/session", { fetchImpl: async () => Response.json(payload) }), null)
  }
})

test("session proxy preserves the successful backend contract", async (t) => {
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.ok(url.endsWith("/api/v1/system/session"))
    assert.equal(options.cache, "no-store")
    assert.ok(options.signal instanceof AbortSignal)
    return Response.json(fixture)
  })
  const response = await GET()
  assert.equal(response.status, 200)
  assert.equal(response.headers.get("cache-control"), "no-store")
  assert.deepEqual(await response.json(), fixture)
})

test("session proxy handles a backend restart and recovers without leaking exceptions", async (t) => {
  const mock = t.mock.method(globalThis, "fetch", async () => { throw new Error("private upstream connection details") })
  const unavailable = await GET()
  assert.equal(unavailable.status, 503)
  assert.equal(unavailable.headers.get("retry-after"), "30")
  assert.ok(!(await unavailable.text()).includes("private upstream"))
  mock.mock.mockImplementation(async () => Response.json(fixture))
  assert.equal((await GET()).status, 200)
})

test("backend failures or malformed responses cannot become a proxy 500", async (t) => {
  const mock = t.mock.method(globalThis, "fetch", async () => new Response("internal details", { status: 500 }))
  assert.equal((await GET()).status, 503)
  mock.mock.mockImplementation(async () => Response.json({ sessions: [] }))
  assert.equal((await GET()).status, 503)
  mock.mock.mockImplementation(async () => new Response("not JSON"))
  assert.equal((await GET()).status, 503)
})
