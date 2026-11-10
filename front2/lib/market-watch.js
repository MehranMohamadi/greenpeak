const WEEK_WINDOW_MS = 7 * 24 * 60 * 60 * 1000
const DATABASE_POINT_LIMIT = 10

export const marketSeries = [
  {
    id: "spx",
    symbol: "SPX",
    url: "/api/market/watch?series=spx",
    interval: "5min",
    decimals: 2,
  },
  {
    id: "treasury-10y",
    symbol: "10Y T Yield",
    url: "/api/market/watch?series=treasury-10y",
    interval: "5min",
    suffix: "%",
    decimals: 2,
  },
  {
    id: "pe-ratio",
    symbol: "نسبت P/E",
    url: `/api/market/pe-ratio?limit=${DATABASE_POINT_LIMIT}`,
    suffix: "×",
    decimals: 2,
    windowMs: null,
    interval: "1month",
  },
  {
    id: "vix",
    symbol: "VIX",
    url: "/api/market/watch?series=vix",
    interval: "5min",
    decimals: 2,
  },
  {
    id: "dollar-index",
    symbol: "شاخص دلار",
    url: "/api/market/watch?series=dollar-index",
    interval: "5min",
    decimals: 2,
  },
  {
    id: "gold",
    symbol: "طلا",
    url: "/api/market/watch?series=gold",
    interval: "5min",
    prefix: "$",
    decimals: 2,
  },
]

export const MARKET_WATCH_SYMBOLS = marketSeries.map(({ id, symbol }) => ({ id, symbol }))

function pointTimestamp(point) {
  if (Number.isFinite(point?.time)) {
    return point.time > 10_000_000_000 ? point.time : point.time * 1000
  }
  const timestamp = Date.parse(point?.date)
  return Number.isFinite(timestamp) ? timestamp : null
}

function pointValue(point, responseType) {
  const rawValue = responseType === "ohlc" ? point?.close : (point?.value ?? point?.rate)
  if (typeof rawValue === "boolean" || rawValue === null || rawValue === undefined || String(rawValue).trim() === "") return null
  const value = Number(rawValue)
  return Number.isFinite(value) ? value : null
}

function normalizePoints(payload, responseType, windowMs = WEEK_WINDOW_MS) {
  const source = responseType === "ohlc" ? payload : payload?.data
  if (!Array.isArray(source)) return []

  const rawPoints = source
    .map((point) => ({
      timestamp: pointTimestamp(point),
      value: pointValue(point, responseType),
    }))
    .filter((point) => point.timestamp !== null && point.timestamp <= Date.now() && Number.isFinite(point.value))
    .sort((a, b) => a.timestamp - b.timestamp)

  const points = [...new Map(rawPoints.map(point => [point.timestamp, point])).values()]
  if (points.length === 0) return []
  if (windowMs === null) return points.slice(-DATABASE_POINT_LIMIT)
  const latestTimestamp = points.at(-1).timestamp
  return points.filter((point) => point.timestamp >= latestTimestamp - windowMs)
}

function formatNumber(value, decimals = 2) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

function formatValue(value, series) {
  return `${series.prefix || ""}${formatNumber(value, series.decimals)}${series.suffix || ""}`
}

function formatChange(value, decimals = 2) {
  const sign = value > 0 ? "+" : ""
  return `${sign}${formatNumber(value, decimals)}`
}

function formatObservationDate(timestamp) {
  return new Intl.DateTimeFormat("fa-IR-u-ca-gregory", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Tehran",
  }).format(new Date(timestamp))
}

export function buildMarketItem(series, payload) {
  const points = normalizePoints(payload, series.responseType, series.windowMs)
  if (points.length === 0) throw new Error("No valid observations")

  const latest = points.at(-1)
  const comparison = points.length > 1 ? points[0] : null
  const change = comparison ? latest.value - comparison.value : null
  const changePercent = comparison && comparison.value !== 0
    ? (change / comparison.value) * 100
    : null
  const trend = change === null || change === 0 ? "neutral" : change < 0 ? "down" : "up"

  return {
    ...series,
    price: formatValue(latest.value, series),
    change: change === null ? "—" : formatChange(change, series.decimals),
    changePercent: changePercent === null ? "—" : `${formatChange(changePercent, 2)}%`,
    trend,
    chartData: points.map((point) => point.value),
    chartPoints: points,
    interval: payload?.metadata?.interval || series.interval,
    frequency: payload?.metadata?.frequency,
    observationTimestamp: latest.timestamp,
    sourceNote: payload?.metadata?.description || "",
    observationDate: formatObservationDate(latest.timestamp),
    source: payload?.metadata?.source || payload?.metadata?.source_provider || (series.responseType === "ohlc" ? "Yahoo Finance" : ""),
    error: null,
  }
}

export function unavailableMarketItem(series, error = "داده واقعی در دسترس نیست") {
  return {
    ...series,
    price: "—",
    change: "—",
    changePercent: "—",
    trend: "neutral",
    chartData: [],
    chartPoints: [],
    observationDate: null,
    source: "",
    error,
  }
}
