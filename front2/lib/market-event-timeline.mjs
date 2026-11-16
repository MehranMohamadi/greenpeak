export const MARKET_CALENDAR_DAYS = 7
const timeZone = "Asia/Tehran"

export function enrichCalendarEvent(event, drivers) {
  const comparable = value => String(value ?? "").trim().toLocaleLowerCase("fa")
  const hasValue = value => value !== null && value !== undefined && value !== ""
  const sameRelease = (drivers || []).filter(item => item.release_at && String(item.release_at).slice(0, 10) === String(event.release_at).slice(0, 10))
  const analysis = sameRelease.find(item => comparable(item.title_fa) === comparable(event.title_fa)) || sameRelease.find(item => {
    const actualMatches = hasValue(event.actual) && comparable(item.current) === comparable(event.actual)
    return actualMatches && (hasValue(event.forecast) && comparable(item.forecast) === comparable(event.forecast)
      || hasValue(event.previous) && comparable(item.previous) === comparable(event.previous))
  })
  // Nulls from the calendar win over older narrative values, too.
  return { ...analysis, ...event, current: event.actual ?? null }
}

export function calendarDate(value) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return null
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone }).format(date)
}

export function shiftCalendarDate(value, offset) {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day + offset)).toISOString().slice(0, 10)
}

// Date-only earnings have no fabricated intraday position. The synthetic noon
// used by the existing event details is never used to position today's marker.
export function marketEventTimeline(events, now, days = MARKET_CALENDAR_DAYS) {
  const today = calendarDate(now)
  if (!today) return []
  const timestamp = new Date(now).getTime()
  const groups = new Map()
  for (let offset = -days; offset <= days; offset++) {
    const date = shiftCalendarDate(today, offset)
    groups.set(date, { date, today: date === today, items: [], before: [], after: [], untimed: [] })
  }
  const unique = new Map()
  for (const item of events || []) {
    if (!item || typeof item !== "object") continue
    const instant = new Date(item.release_at).getTime()
    const date = item.calendar_date || calendarDate(item.release_at)
    if (!groups.has(date) || !Number.isFinite(instant) || !item.title_fa) continue
    const key = `${item.event_id || item.title_fa}:${date}:${item.time_precision === "day" ? "day" : instant}`
    const previous = unique.get(key)
    if (!previous || previous.actual == null && item.actual != null) unique.set(key, item)
  }
  for (const item of unique.values()) {
    const group = groups.get(item.calendar_date || calendarDate(item.release_at))
    group.items.push(item)
    if (group.today && item.time_precision === "day") group.untimed.push(item)
    else if (new Date(item.release_at).getTime() <= timestamp) group.before.push(item)
    else group.after.push(item)
  }
  const sort = (a, b) => new Date(a.release_at) - new Date(b.release_at) || String(a.event_id).localeCompare(String(b.event_id))
  for (const group of groups.values()) {
    for (const key of ["items", "before", "after", "untimed"]) group[key].sort(sort)
  }
  return [...groups.values()]
}
