"use client"

import { useEffect, useState } from "react"
import { endpoints } from "@/api/api"

const REFRESH_INTERVAL_MS = 5 * 60 * 1000
const WEEK_WINDOW_MS = 7 * 24 * 60 * 60 * 1000
const DATABASE_POINT_LIMIT = 10

const withLimit = (url) => `${url}${url.includes("?") ? "&" : "?"}limit=${DATABASE_POINT_LIMIT}`

const marketSeries = [
  {
    id: "spx",
    symbol: "SPX",
    url: "/api/market/sp500?timeframe=1W",
    responseType: "ohlc",
    decimals: 2,
  },
  {
    id: "treasury-10y",
    symbol: "نرخ ۱۰ ساله اوراق خزانه",
    url: `${endpoints.monetaryPolicy.tenYear}?period=5D`,
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
  },
  {
    id: "vix",
    symbol: "VIX",
    url: withLimit(endpoints.systemicRisk.vix),
    decimals: 2,
  },
  {
    id: "dollar-index",
    symbol: "شاخص دلار",
    url: "/api/intermarket?series=DXY&range=1mo",
    decimals: 2,
  },
  {
    id: "gold",
    symbol: "طلا",
    url: "/api/intermarket?series=GOLDAMGBD228NLBM&range=1mo",
    prefix: "$",
    decimals: 2,
  },
]

function pointTimestamp(point) {
  if (Number.isFinite(point?.time)) {
    return point.time > 10_000_000_000 ? point.time : point.time * 1000
  }
  const timestamp = Date.parse(point?.date)
  return Number.isFinite(timestamp) ? timestamp : null
}

function pointValue(point, responseType) {
  const rawValue = responseType === "ohlc" ? point?.close : (point?.value ?? point?.rate)
  if (rawValue === null || rawValue === undefined || rawValue === "") return null
  const value = Number(rawValue)
  return Number.isFinite(value) ? value : null
}

function normalizePoints(payload, responseType, windowMs = WEEK_WINDOW_MS) {
  const source = responseType === "ohlc" ? payload : payload?.data
  if (!Array.isArray(source)) return []

  const points = source
    .map((point) => ({
      timestamp: pointTimestamp(point),
      value: pointValue(point, responseType),
    }))
    .filter((point) => point.timestamp !== null && Number.isFinite(point.value))
    .sort((a, b) => a.timestamp - b.timestamp)

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
    timeZone: "UTC",
  }).format(new Date(timestamp))
}

function buildMarketItem(series, payload) {
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
    observationDate: formatObservationDate(latest.timestamp),
    source: payload?.metadata?.source || payload?.metadata?.source_provider || (series.responseType === "ohlc" ? "Yahoo Finance" : ""),
    error: null,
  }
}

function unavailableMarketItem(series) {
  return {
    ...series,
    price: "—",
    change: "—",
    changePercent: "—",
    trend: "neutral",
    chartData: [],
    observationDate: null,
    source: "",
    error: "داده واقعی در دسترس نیست",
  }
}

export default function useMarketWatch() {
  const [data, setData] = useState(() => marketSeries.map(unavailableMarketItem))
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let activeController = null

    async function loadMarketData(backgroundRefresh = false) {
      activeController?.abort()
      const controller = new AbortController()
      activeController = controller
      if (!backgroundRefresh) setIsLoading(true)

      const items = await Promise.all(marketSeries.map(async (series) => {
        try {
          const response = await fetch(series.url, {
            cache: "no-store",
            signal: controller.signal,
          })
          const payload = await response.json()
          if (!response.ok) throw new Error(payload?.detail || payload?.error || `HTTP ${response.status}`)
          return buildMarketItem(series, payload)
        } catch {
          return unavailableMarketItem(series)
        }
      }))

      if (!controller.signal.aborted) {
        setData(items)
        setIsLoading(false)
      }
    }

    loadMarketData()
    const refreshTimer = window.setInterval(() => loadMarketData(true), REFRESH_INTERVAL_MS)

    return () => {
      activeController?.abort()
      window.clearInterval(refreshTimer)
    }
  }, [])

  return { data, isLoading }
}
