import assert from "node:assert/strict"
import test from "node:test"
import { isAdminWorkplaceTab, workplaceTab, workplaceTabs } from "../lib/workplace-navigation.mjs"

test("workplace navigation keeps model and analysis quality management admin-only", () => {
  assert.deepEqual(workplaceTabs.filter(tab => !tab.adminOnly).map(tab => tab.id), ["tasks", "attendance"])
  for (const tab of ["users", "tools", "llm", "quality"]) {
    assert.equal(workplaceTab(`tab=${tab}`, true), tab)
    assert.equal(workplaceTab(`tab=${tab}`, false), "tasks")
    assert.equal(isAdminWorkplaceTab(tab), true)
  }
})

test("tab navigation accepts only a single known tab and defaults to tasks", () => {
  for (const search of ["", "tab=", "tab=https://outside.test", "tab=users&tab=attendance", "tab=../../admin"]) {
    assert.equal(workplaceTab(search, true), "tasks")
  }
  assert.equal(workplaceTab("tab=attendance&scope=team", true), "attendance")
  assert.equal(workplaceTab("tab=attendance", false), "attendance")
})
