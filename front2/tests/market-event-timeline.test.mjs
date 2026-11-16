import assert from "node:assert/strict"
import test from "node:test"
import { calendarDate, enrichCalendarEvent, marketEventTimeline } from "../lib/market-event-timeline.mjs"

const now = "2026-11-16T12:00:00Z"
const event = (id, time, extra = {}) => ({ event_id: id, title_fa: id, release_at: time, ...extra })

test("timeline includes all 15 days and places now on today even with no events", () => {
  const groups = marketEventTimeline([], now)
  assert.equal(groups.length, 15)
  assert.equal(groups[0].date, "2026-11-09")
  assert.equal(groups.at(-1).date, "2026-11-23")
  assert.equal(groups.filter(group => group.today).length, 1)
  assert.equal(groups.find(group => group.today).date, "2026-11-16")
})

test("past and future use the actual instant, not whether an actual value is present", () => {
  const records = [event("later", "2026-11-16T14:00:00Z"), event("pending-past", "2026-11-16T10:00:00Z"), event("now", now)]
  const today = marketEventTimeline(records, now).find(group => group.today)
  assert.deepEqual(today.before.map(item => item.event_id), ["pending-past", "now"])
  assert.deepEqual(today.after.map(item => item.event_id), ["later"])
  assert.equal(today.before[0].actual, undefined)
})

test("date-only earnings have no fabricated position on either side of now", () => {
  const earnings = event("earnings", "2026-11-16T12:00:00Z", { calendar_date: "2026-11-16", time_precision: "day" })
  const today = marketEventTimeline([earnings], now).find(group => group.today)
  assert.deepEqual(today.untimed, [earnings])
  assert.equal(today.before.length + today.after.length, 0)
})

test("timezone midnight changes today's group and trims only outside the window", () => {
  const instant = "2026-11-16T21:00:00Z"
  assert.equal(calendarDate(instant), "2026-11-17")
  const groups = marketEventTimeline([
    event("in", "2026-11-09T21:00:00Z"), event("out", "2026-11-09T12:00:00Z"),
    event("invalid", "not-a-date"), null,
  ], instant)
  assert.equal(groups.find(group => group.today).date, "2026-11-17")
  assert.deepEqual(groups.flatMap(group => group.items).map(item => item.event_id), ["in"])
})

test("keeps all events, removes repeated occurrences, and preserves a real actual of zero", () => {
  const records = Array.from({ length: 25 }, (_, index) => event(String(index), "2026-11-16T10:00:00Z"))
  const actual = { ...records[0], actual: 0 }
  const groups = marketEventTimeline([...records, actual, ...records], now)
  assert.equal(groups.flatMap(group => group.items).length, 25)
  assert.equal(groups.find(group => group.today).items.find(item => item.event_id === "0").actual, 0)
  assert.equal(records[0].actual, undefined, "input observations stay immutable")
})

test("an upcoming repeat release never inherits an older actual or interpretation", () => {
  const upcoming = event("Inflation", "2026-11-17T12:30:00Z", { actual: null })
  const old = { title_fa: "Inflation", release_at: "2026-10-17T12:30:00Z", current: "3%", why_it_matters_fa: "Old release" }
  const result = enrichCalendarEvent(upcoming, [old])
  assert.equal(result.current, null)
  assert.equal(result.why_it_matters_fa, undefined)
})

test("same-release details are retained without replacing the calendar's actual zero", () => {
  const row = event("Inflation", "2026-11-17T12:30:00Z", { actual: 0, forecast: "1%" })
  const result = enrichCalendarEvent(row, [{ title_fa: "Inflation", release_at: row.release_at, current: "1%", why_it_matters_fa: "Same release", forecast: "2%" }])
  assert.equal(result.current, 0)
  assert.equal(result.forecast, "1%")
  assert.equal(result.why_it_matters_fa, "Same release")
})
