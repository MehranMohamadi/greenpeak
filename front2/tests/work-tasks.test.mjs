import assert from "node:assert/strict"
import test from "node:test"
import { completionLabel, deliveryLabel, workStates, workTaskIdFromSearch } from "../lib/work-tasks.mjs"
import { editableDate, parsePersianDate } from "../lib/workplace-time.mjs"

test("optional Persian work deadlines support empty values and leap dates", () => {
  assert.equal(parsePersianDate(""), null)
  assert.equal(editableDate(null), "")
  assert.equal(parsePersianDate("۱۴۰۵/۰۸/۰۴"), "2026-10-26")
  assert.equal(editableDate("2026-10-26"), "1405/08/04")
  assert.equal(parsePersianDate("1403/12/30"), "2025-03-20")
  assert.throws(() => parsePersianDate("1404/12/30"))
  assert.throws(() => parsePersianDate("2026-10-26"))
  assert.throws(() => parsePersianDate("1405/13/01"))
})

test("work deep links accept one task identifier without granting authentication", () => {
  const id = "cf3e6b15-40f6-4431-96dc-4b2322ee3d01"
  assert.equal(workTaskIdFromSearch(`?task=${id}`), id)
  for (const search of ["", "?task=", "?task=../../admin", `?task=${id}&task=${id}`, "?task=https://outside.test"]) {
    assert.equal(workTaskIdFromSearch(search), null)
  }
})

test("review waiting and confirmed completion keep server-provided delivery timing", () => {
  const onTime = { state: "awaiting_approval", overdue: false, delivered_late: false }
  assert.equal(deliveryLabel(onTime), "تحویل در مهلت")
  assert.equal(deliveryLabel({ ...onTime, state: "completed" }), "تحویل در مهلت")
  assert.equal(deliveryLabel({ ...onTime, delivered_late: true }), "تحویل با تأخیر")
  assert.equal(deliveryLabel({ state: "in_progress", overdue: true, delivered_late: false }), "مهلت انجام گذشته است")
  assert.equal(deliveryLabel({ state: "cancelled", overdue: false, delivered_late: true }), "")
  assert.notEqual(completionLabel("approved"), completionLabel("no_approval"))
  assert.equal(completionLabel(null), "")
  assert.notEqual(workStates.cancelled, workStates.completed)
})
