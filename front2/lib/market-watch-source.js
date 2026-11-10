export const WATCH_INTRADAY_SERIES = {
  spx: { symbol: "^GSPC", unit: "index points", source: "Yahoo Finance · S&P 500" },
  "treasury-10y": { symbol: "^TNX", unit: "percent", source: "Yahoo Finance · Cboe (^TNX)" },
  vix: { symbol: "^VIX", unit: "index points", source: "Yahoo Finance · Cboe VIX" },
  "dollar-index": { symbol: "DX-Y.NYB", unit: "index points", source: "Yahoo Finance · ICE DXY" },
  gold: { symbol: "XAU/USD", unit: "USD per troy ounce", source: "Twelve Data · Gold Spot (XAU/USD)" },
}

function resultFor(series, points, now) {
  const definition = WATCH_INTRADAY_SERIES[series]
  const data = [...new Map(points.map(point => [point.time, point])).values()].sort((a, b) => a.time - b.time)
  if (!data.length) throw new Error("No valid observations")
  return {
    data,
    metadata: {
      source: definition.source,
      source_provider: series === "gold" ? "Twelve Data" : "Yahoo Finance",
      source_series_id: definition.symbol,
      unit: definition.unit,
      interval: "5min",
      frequency: "intraday",
      timezone: "UTC",
      observation_date: data.at(-1).date,
      retrieved_at: new Date(now).toISOString(),
      quality_status: now - data.at(-1).time * 1000 > 7 * 86400000 ? "stale" : "available",
      description: series === "treasury-10y"
        ? "Cboe Treasury yield in percent, distinct from daily FRED DGS10. Quotes may be delayed."
        : "Source five-minute observations; no interpolation. Quotes may be delayed.",
    },
  }
}

export function parseWatchYahoo(payload, series, now = Date.now()) {
  const definition = WATCH_INTRADAY_SERIES[series]
  const result = payload?.chart?.result?.[0]
  if (!definition || series === "gold" || payload?.chart?.error
    || result?.meta?.symbol !== definition.symbol || result.meta.dataGranularity !== "5m") {
    throw new Error("Unexpected source or interval")
  }
  const times = result.timestamp
  const closes = result.indicators?.quote?.[0]?.close
  if (!Array.isArray(times) || !Array.isArray(closes)) throw new Error("Missing observations")
  const points = times.flatMap((time, index) => {
    const value = closes[index]
    if (!Number.isSafeInteger(time) || time <= 0 || time * 1000 > now
      || typeof value !== "number" || !Number.isFinite(value) || value <= 0) return []
    const date = new Date(time * 1000)
    return Number.isFinite(date.getTime()) ? [{ time, date: date.toISOString(), value }] : []
  })
  // Yahoo publishes ^TNX directly in yield percent. Do not divide by ten.
  return resultFor(series, points, now)
}

export function parseWatchGold(payload, now = Date.now()) {
  if (payload?.status === "error" || payload?.meta?.symbol !== "XAU/USD"
    || payload.meta.interval !== "5min" || (payload.meta.exchange_timezone && payload.meta.exchange_timezone !== "UTC")
    || !Array.isArray(payload.values)) throw new Error("Unexpected gold source or interval")
  const points = payload.values.flatMap(point => {
    if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(point?.datetime || "")) return []
    const iso = point.datetime.replace(" ", "T") + "Z"
    const timestamp = Date.parse(iso)
    const raw = point.close
    const value = typeof raw === "string" && raw.trim() ? Number(raw) : typeof raw === "number" ? raw : null
    if (!Number.isFinite(timestamp) || timestamp <= 0 || timestamp > now || value == null || !Number.isFinite(value) || value <= 0
      || new Date(timestamp).toISOString().slice(0, 19) !== iso.slice(0, 19)) return []
    return [{ time: timestamp / 1000, date: new Date(timestamp).toISOString(), value }]
  })
  return resultFor("gold", points, now)
}
