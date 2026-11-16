export const WATCH_INTRADAY_SERIES = {
  spx: { symbol: "^GSPC", unit: "index points", source: "Yahoo Finance · S&P 500" },
  "treasury-10y": { symbol: "^TNX", unit: "percent", source: "Yahoo Finance · Cboe (^TNX)" },
  vix: { symbol: "^VIX", unit: "index points", source: "Yahoo Finance · Cboe VIX" },
  "dollar-index": { symbol: "DX-Y.NYB", unit: "index points", source: "Yahoo Finance · ICE DXY" },
  gold: { symbol: "GC=F", unit: "USD per troy ounce", source: "Yahoo Finance · COMEX Gold Futures (GC=F)" },
}

function resultFor(series, points, now) {
  const definition = WATCH_INTRADAY_SERIES[series]
  const data = [...new Map(points.map(point => [point.time, point])).values()].sort((a, b) => a.time - b.time)
  if (!data.length) throw new Error("No valid observations")
  return {
    data,
    metadata: {
      source: definition.source,
      source_provider: "Yahoo Finance",
      source_series_id: definition.symbol,
      unit: definition.unit,
      interval: "5min",
      frequency: "intraday",
      timezone: "UTC",
      ...(series === "gold" ? { instrument_type: "futures", exchange: "COMEX" } : {}),
      observation_date: data.at(-1).date,
      retrieved_at: new Date(now).toISOString(),
      quality_status: now - data.at(-1).time * 1000 > 7 * 86400000 ? "stale" : "available",
      description: series === "treasury-10y"
        ? "Cboe Treasury yield in percent, distinct from daily FRED DGS10. Quotes may be delayed."
        : series === "gold"
          ? "Five-minute COMEX gold futures prices in USD per troy ounce, distinct from spot XAU/USD. Contract rolls can affect price changes. Quotes may be delayed."
          : "Source five-minute observations; no interpolation. Quotes may be delayed.",
    },
  }
}

export function parseWatchYahoo(payload, series, now = Date.now()) {
  const definition = WATCH_INTRADAY_SERIES[series]
  const result = payload?.chart?.result?.[0]
  if (!definition || payload?.chart?.error
    || result?.meta?.symbol !== definition.symbol || result.meta.dataGranularity !== "5m"
    || series === "gold" && result.meta.currency !== "USD") {
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
