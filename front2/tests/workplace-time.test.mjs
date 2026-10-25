import assert from "node:assert/strict"
import test from "node:test"
import { editableInstant, gregorianDate, monthRange, parseTehranInstant, persianDateParts, formatDuration } from "../lib/workplace-time.mjs"

test("Persian month reports include the full month, including leap Esfand", () => {
  assert.deepEqual(monthRange(1405, 8), { start_date: "2026-10-23", end_date: "2026-11-21" })
  assert.deepEqual(monthRange(1403, 12), { start_date: "2025-02-19", end_date: "2025-03-20" })
  assert.deepEqual(monthRange(1404, 12), { start_date: "2026-02-20", end_date: "2026-03-20" })
  assert.throws(() => gregorianDate(1404, 12, 30))
  assert.throws(() => gregorianDate(1405, 7, 31))
})

test("Tehran inputs accept Persian digits and convert offset-aware instants", () => {
  assert.equal(parseTehranInstant("۱۴۰۵/۰۸/۰۳", "۰۹:۳۰"), "2026-10-25T06:00:00.000Z")
  assert.equal(parseTehranInstant("1405/08/03", "00:00"), "2026-10-24T20:30:00.000Z")
  assert.deepEqual(editableInstant("2026-10-24T20:30:00Z"), { date: "1405/08/03", time: "00:00" })
  assert.equal(persianDateParts("2026-10-24T20:29:59Z").day, 2)
  assert.equal(persianDateParts("2026-10-24T20:30:00Z").day, 3)
  assert.throws(() => parseTehranInstant("1405/08/03", "24:30"))
  assert.throws(() => parseTehranInstant("1405/08/03", "12:60"))
  assert.throws(() => parseTehranInstant("1405/12/30", "12:00"))
})

test("historical Tehran daylight saving and end of year round trips", () => {
  assert.equal(parseTehranInstant("1400/05/01", "09:30"), "2021-07-23T05:00:00.000Z")
  for (const year of [1399, 1400, 1403, 1404, 1405, 1410]) {
    for (let month = 1; month <= 12; month++) {
      const value = parseTehranInstant(`${year}/${month}/01`, "12:15")
      assert.deepEqual(editableInstant(value), { date: `${year}/${String(month).padStart(2, "0")}/01`, time: "12:15" })
    }
  }
  assert.match(formatDuration(3600), /۱/)
})
