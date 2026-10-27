import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { workTaskIdFromSearch } from "../lib/work-tasks.mjs"
import { isAdminWorkplaceTab } from "../lib/workplace-navigation.mjs"

const source = (await readFile(new URL("../lib/admin-page.js", import.meta.url), "utf8")).replace(/^import .*\r?\n/gm, "").replace(/export async function/g, "async function")

function guard(role, { cookie = "test-session", reachable = true, valid = true } = {}) {
  const calls = []
  const fetch = async (...args) => {
    calls.push(args)
    if (!reachable) throw new Error("offline")
    return { ok: valid, json: async () => ({ user: { role } }) }
  }
  const methods = new Function("cookies", "redirect", "fetch", "process", "workTaskIdFromSearch", "isAdminWorkplaceTab", source + "\nreturn { requireAdminPage, requireWorkplacePage }")(
    async () => ({ get: () => cookie ? { value: cookie } : undefined }),
    destination => { throw new Error(`redirect:${destination}`) },
    fetch,
    { env: { GREENPEAK_INTERNAL_API_BASE_URL: "http://internal.test/api/v1" } },
    workTaskIdFromSearch,
    isAdminWorkplaceTab,
  )
  return { ...methods, calls }
}

test("server page guards allow staff and admin workplace access and retain existing admin guard", async () => {
  await guard("staff").requireWorkplacePage()
  await guard("admin").requireWorkplacePage()
  await guard("admin").requireAdminPage()
  await assert.rejects(guard("user").requireWorkplacePage(), /redirect:\/profile/)
  await assert.rejects(guard("staff").requireAdminPage(), /redirect:\/profile/)
})

test("task login return links preserve one identifier and retain live role checks", async () => {
  const id = "cf3e6b15-40f6-4431-96dc-4b2322ee3d01"
  await assert.rejects(guard("staff", { cookie: "" }).requireWorkplacePage(id), new RegExp(`redirect:/login\\?task=${id}`))
  await assert.rejects(guard("staff", { cookie: "" }).requireWorkplacePage("https://outside.test"), /redirect:\/login$/)
  await assert.rejects(guard("user").requireWorkplacePage(id), /redirect:\/profile/)
})

test("management tabs require a live admin role on the server", async () => {
  for (const tab of ["users", "tools"]) {
    await guard("admin").requireWorkplacePage(null, tab)
    await assert.rejects(guard("staff").requireWorkplacePage(null, tab), /redirect:\/profile/)
    await assert.rejects(guard("user").requireWorkplacePage(null, tab), /redirect:\/profile/)
    await assert.rejects(guard("admin", { valid: false }).requireWorkplacePage(null, tab), /redirect:\/login/)
  }
  for (const tab of ["tasks", "attendance", null]) await guard("staff").requireWorkplacePage(null, tab)
  await guard("admin").requireWorkplacePage(null, "attendance", "team")
  await assert.rejects(guard("staff").requireWorkplacePage(null, "attendance", "team"), /redirect:\/profile/)
})

test("legacy admin entry points redirect to the corresponding workspace tabs", async () => {
  for (const [file, target] of [
    ["admin/page.jsx", "/workplace?tab=users"],
    ["admin/settings/page.jsx", "/workplace?tab=users"],
    ["admin/employees/page.jsx", "/workplace?tab=attendance&scope=team"],
  ]) {
    const page = (await readFile(new URL(`../app/${file}`, import.meta.url), "utf8"))
      .replace(/^import .*\r?\n/gm, "").replace(/export default function/, "return function")
    const render = new Function("redirect", page)(destination => { throw new Error(`redirect:${destination}`) })
    assert.throws(render, error => error.message === `redirect:${target}`)
  }
})

test("page guards fail closed on missing, invalid or unreachable authentication", async () => {
  for (const options of [{ cookie: "" }, { reachable: false }, { valid: false }]) {
    await assert.rejects(guard("admin", options).requireAdminPage(), /redirect:\/login/)
    await assert.rejects(guard("staff", options).requireWorkplacePage(), /redirect:\/login/)
  }
  const check = guard("staff")
  await check.requireWorkplacePage()
  assert.equal(check.calls[0][0], "http://internal.test/api/v1/auth/session")
  assert.equal(check.calls[0][1].cache, "no-store")
  assert.equal(check.calls[0][1].headers.Cookie, "gp_session=test-session")
})
