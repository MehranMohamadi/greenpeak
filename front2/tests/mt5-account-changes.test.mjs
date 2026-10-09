import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const source = await readFile(new URL("../lib/mt5-account-changes.js", import.meta.url), "utf8")
const { withoutBroker, clearBrokerRiskStorage } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`)

test("removes all accounts for the exact broker and preserves other brokers", () => {
  const snapshots = [
    { source: { broker_company: "Broker", account_identifier: "1" } },
    { source: { broker_company: "Broker", account_identifier: "2" } },
    { source: { broker_company: "Broker Extra", account_identifier: "1" } },
  ]
  assert.deepEqual(withoutBroker(snapshots, "Broker"), [snapshots[2]])
  assert.equal(snapshots.length, 3)
  assert.deepEqual(withoutBroker(snapshots.slice(0, 2), "Broker"), [])
})

test("clears rules, drafts and saved plans only for the deleted account identities", () => {
  const values = new Map()
  for (const prefix of ["greenpeak:risk-rules:", "greenpeak:trade-draft:", "greenpeak:risk-plans:"]) {
    values.set(`${prefix}Broker::Server::1`, "deleted")
    values.set(`${prefix}Broker::Other::2`, "deleted")
    values.set(`${prefix}Broker Extra::Server::1`, "preserved")
  }
  values.set("theme", "dark")
  const accounts = [
    { broker_company: "Broker", trade_server: "Server", account_identifier: "1" },
    { broker_company: "Broker", trade_server: "Other", account_identifier: "2" },
  ]
  clearBrokerRiskStorage({ removeItem: (key) => values.delete(key) }, [...accounts, accounts[0]])
  assert.equal(values.size, 4)
  assert.equal(values.get("theme"), "dark")
  assert.equal([...values.values()].filter((value) => value === "preserved").length, 3)
})
