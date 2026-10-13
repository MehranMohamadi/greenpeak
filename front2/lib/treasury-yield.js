export const TREASURY_PERIODS = ["1D", "5D", "1M", "6M", "1Y", "5Y", "10Y", "25Y", "MAX"]
export const TREASURY_PERIOD_CONFIG = {
  "1D": { range: "1d", interval: "1h" },
  "5D": { range: "5d", interval: "1h" },
  "1M": { range: "1mo", interval: "1h" },
  "6M": { range: "6mo", interval: "1h" },
  "1Y": { range: "1y", interval: "1h" },
  "5Y": { range: "5y", interval: "1d" },
  "10Y": { range: "10y", interval: "1d" },
  "25Y": { range: "max", interval: "1d" },
  MAX: { range: "max", interval: "1d" },
}

export function treasuryHistoryStart(period, now = new Date()) {
  if (period === "MAX") return Math.floor(Date.UTC(1900, 0, 1) / 1000)
  const start = new Date(now)
  start.setUTCHours(0, 0, 0, 0)
  const amount = Number.parseInt(period, 10)
  if (period.endsWith("D")) start.setUTCDate(start.getUTCDate() - amount)
  else if (period.endsWith("M")) start.setUTCMonth(start.getUTCMonth() - amount)
  else start.setUTCFullYear(start.getUTCFullYear() - amount)
  return Math.floor(start.getTime() / 1000)
}

export function parseYahooTreasury(payload, interval, now = Date.now()) {
  const result = payload?.chart?.result?.[0]
  if (payload?.chart?.error || result?.meta?.symbol !== "^TNX") throw new Error("Invalid Yahoo Treasury response")
  if (result.meta.dataGranularity !== interval && !(interval === "1h" && result.meta.dataGranularity === "60m")) {
    throw new Error("Unexpected Yahoo Treasury interval")
  }
  const times = result.timestamp
  const closes = result.indicators?.quote?.[0]?.close
  if (!Array.isArray(times) || !Array.isArray(closes)) throw new Error("Missing Treasury observations")
  const rows = new Map()
  times.forEach((time, index) => {
    const value = closes[index]
    if (!Number.isSafeInteger(time) || time * 1000 > now || typeof value !== "number" || !Number.isFinite(value) || value <= 0) return
    const observed = new Date(time * 1000)
    if (!Number.isFinite(observed.getTime())) return
    const session = result.meta.currentTradingPeriod?.regular
    if (interval === "1d" && Number.isSafeInteger(session?.start) && Number.isSafeInteger(session?.end)
      && now < session.end * 1000 && observed.toISOString().slice(0, 10) === new Date(session.start * 1000).toISOString().slice(0, 10)) return
    const date = interval === "1d" ? observed.toISOString().slice(0, 10) : observed.toISOString()
    // Yahoo already publishes ^TNX in yield percent, unlike the 10x Cboe option index quotation.
    rows.set(date, { time, date, value, rate: value })
  })
  const data = [...rows.values()].sort((a, b) => a.time - b.time)
  if (!data.length) throw new Error("No valid Treasury observations")
  const last = data.at(-1)
  return {
    data,
    metadata: {
      indicator_id: "cboe_10y_treasury_yield",
      definition_version: "1.0.0",
      source: "Yahoo Finance · Cboe (^TNX)",
      source_provider: "Yahoo Finance / Cboe",
      source_series_id: "^TNX",
      source_url: "https://finance.yahoo.com/quote/%5ETNX/",
      unit: "percent",
      frequency: interval === "1h" ? "hourly" : "daily",
      interval,
      timezone: "UTC",
      exchange_timezone: result.meta.exchangeTimezoneName || null,
      observation_date: last.date,
      latest_date: last.date,
      quality_status: now - last.time * 1000 > 7 * 86400000 ? "stale" : "ok",
      source_delay_minutes: null,
      description: "Cboe 10-year Treasury yield benchmark; distinct from the FRED DGS10 constant-maturity series. Quotes may be delayed and update during the source's market session.",
    },
  }
}
