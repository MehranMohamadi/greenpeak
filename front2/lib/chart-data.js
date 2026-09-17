// Presentation adapters only: preserve reported values and observation dates.
export function chartDate(input) {
  if (typeof input === "number" || (typeof input === "string" && /^-?\d+(\.\d+)?$/.test(input))) {
    const date = new Date(Number(input) * 1000)
    return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : null
  }
  if (typeof input !== "string") return null
  const day = /^\d{4}-\d{2}$/.test(input) ? `${input}-01` : input.split(/[T ]/)[0]
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
  const date = new Date(`${day}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === day ? day : null
}

export function normalizeChartData(data, valueKeys = ["value", "rate"]) {
  const byDate = new Map()
  for (const point of Array.isArray(data) ? data : []) {
    if (!point || typeof point !== "object") continue
    const time = chartDate(point.date) || chartDate(point.time)
    const rawValue = valueKeys.map((key) => point[key]).find((value) =>
      (typeof value === "number" || typeof value === "string") && String(value).trim() !== "" && Number.isFinite(Number(value))
    )
    if (time && rawValue !== undefined) byDate.set(time, { time, value: Number(rawValue) })
  }
  // Lightweight Charts requires strictly ascending, unique dates.
  return Array.from(byDate.values()).sort((a, b) => a.time.localeCompare(b.time))
}

export function sliceChartPeriod(data, period) {
  if (!data.length || period === "MAX") return data
  if (!/^\d+[MY]$/.test(period)) return data
  const end = chartDate(data.at(-1).time ?? data.at(-1).date)
  if (!end) return []
  const start = new Date(`${end}T00:00:00Z`)
  const amount = Number.parseInt(period, 10)
  if (period.endsWith("M")) start.setUTCMonth(start.getUTCMonth() - amount)
  else start.setUTCFullYear(start.getUTCFullYear() - amount)
  const startDay = start.toISOString().slice(0, 10)
  return data.filter((point) => {
    const day = chartDate(point.time ?? point.date)
    return day && day >= startDay
  })
}
