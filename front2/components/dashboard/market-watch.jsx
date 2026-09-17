"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, TrendingDown, Minus, Globe } from "lucide-react"
import { endpoints } from "@/api/api"
import MarketWatchLoadingSkeleton from "./market-watch-loading"

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
    url: withLimit(endpoints.monetaryPolicy.tenYear),
    suffix: "%",
    decimals: 2,
  },
  {
    id: "pe-ratio",
    symbol: "نسبت P/E",
    url: withLimit(endpoints.valuation.peRatio),
    suffix: "×",
    decimals: 2,
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
    url: withLimit(endpoints.systemicRisk.dollarIndex),
    decimals: 2,
  },
  {
    id: "gold",
    symbol: "طلا",
    url: withLimit(endpoints.systemicRisk.gold),
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

function normalizePoints(payload, responseType) {
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
  const latestTimestamp = points.at(-1).timestamp
  return points.filter((point) => point.timestamp >= latestTimestamp - WEEK_WINDOW_MS)
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
  return new Intl.DateTimeFormat("fa-IR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "UTC",
  }).format(new Date(timestamp))
}

function buildMarketItem(series, payload) {
  const points = normalizePoints(payload, series.responseType)
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
    source: payload?.metadata?.source || (series.responseType === "ohlc" ? "Yahoo Finance" : ""),
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

function trendColor(trend) {
  if (trend === "up") return "text-green-600 dark:text-green-400"
  if (trend === "down") return "text-red-600 dark:text-red-400"
  return "text-gray-500 dark:text-gray-400"
}

function trendStroke(trend) {
  if (trend === "up") return "#10b981"
  if (trend === "down") return "#ef4444"
  return "#9ca3af"
}

function MiniChart({ data, trend }) {
  if (data.length === 0) {
    return <div className="h-full w-full rounded border-b border-dashed border-gray-300 dark:border-gray-600" />
  }

  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min
  const denominator = Math.max(data.length - 1, 1)
  const points = data
    .map((value, index) => {
      const x = (index / denominator) * 100
      const y = range === 0 ? 50 : 100 - ((value - min) / range) * 100
      return `${x},${y}`
    })
    .join(" ")
  const latestY = range === 0 ? 50 : 100 - ((data.at(-1) - min) / range) * 100
  const stroke = trendStroke(trend)

  return (
    <div className="h-8 w-full" aria-label="نمودار داده واقعی یک هفته اخیر">
      <svg viewBox="0 0 100 100" className="h-full w-full" preserveAspectRatio="none">
        <motion.polyline
          fill="none"
          stroke={stroke}
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
          points={points}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1, ease: "easeInOut" }}
        />
        <motion.circle
          cx={data.length > 1 ? 100 : 0}
          cy={latestY}
          r="2"
          fill={stroke}
          className="chart-point-pulse"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.8, duration: 0.3 }}
        />
      </svg>
    </div>
  )
}

function TrendIcon({ trend }) {
  if (trend === "up") return <TrendingUp className="h-3 w-3 text-green-500" />
  if (trend === "down") return <TrendingDown className="h-3 w-3 text-red-500" />
  return <Minus className="h-3 w-3 text-gray-400" />
}

export default function MarketWatch() {
  const [data, setData] = useState([])
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

  if (isLoading) return <MarketWatchLoadingSkeleton />

  return (
    <Card className="card-glow w-full border-gray-200 bg-white shadow-sm dark:border-[#2B2B30] dark:bg-[#1F1F23]">
      <CardHeader className="pb-2">
        <CardTitle
          dir="rtl"
          className="flex w-full items-center justify-start gap-2 text-right text-sm text-gray-900 dark:text-white md:text-base"
        >
          <Globe className="h-4 w-4 flex-shrink-0 text-blue-600 dark:text-blue-400" />
          <span>دیده بان بازار</span>
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="live-indicator h-2 w-2 flex-shrink-0 rounded-full bg-green-400"
          />
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
        <motion.div
          dir="ltr"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: { staggerChildren: 0.1 },
            },
          }}
          className="grid w-full grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 md:gap-3 lg:grid-cols-6"
        >
          <AnimatePresence>
            {data.map((item, index) => (
              <motion.div
                key={item.id}
                dir="rtl"
                variants={{
                  hidden: { y: 20, opacity: 0 },
                  visible: { y: 0, opacity: 1 },
                }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                whileHover={{ y: -4, scale: 1.02, transition: { duration: 0.2 } }}
                whileTap={{ scale: 0.98 }}
                title={item.source ? `منبع: ${item.source}` : item.error || undefined}
                className="market-watch-item relative flex min-w-0 cursor-pointer flex-col overflow-hidden rounded-lg border border-gray-200 bg-gray-50 p-2 dark:border-[#2B2B30] dark:bg-[#0F0F12] md:p-3"
              >
                <div className="mb-1 flex items-center justify-between">
                  <motion.span
                    className="ml-1 flex-1 truncate text-xs font-medium text-gray-900 dark:text-white"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 + 0.3 }}
                  >
                    {item.symbol}
                  </motion.span>
                  <div className="flex flex-shrink-0 items-center gap-1">
                    <motion.div
                      animate={{
                        rotate: item.trend === "up" ? [0, 5, 0] : item.trend === "down" ? [0, -5, 0] : 0,
                        scale: [1, 1.1, 1],
                      }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <TrendIcon trend={item.trend} />
                    </motion.div>
                    <motion.div
                      animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className={`h-1.5 w-1.5 rounded-full ${
                        item.trend === "up" ? "bg-green-400" : item.trend === "down" ? "bg-red-400" : "bg-gray-400"
                      }`}
                    />
                  </div>
                </div>

                <motion.div
                  className="count-up mb-1 truncate text-xs font-bold text-gray-900 dark:text-white md:text-sm"
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: index * 0.1 + 0.4 }}
                >
                  {item.price}
                </motion.div>

                <motion.div
                  className={`mb-2 truncate text-xs ${trendColor(item.trend)}`}
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: index * 0.1 + 0.5 }}
                >
                  {item.change} ({item.changePercent})
                </motion.div>

                <motion.div
                  className="h-6 w-full md:h-8"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 + 0.6 }}
                >
                  <MiniChart data={item.chartData} trend={item.trend} />
                </motion.div>

                <div className="mt-1 truncate text-[10px] text-gray-500 dark:text-gray-400">
                  {item.observationDate ? `آخرین داده: ${item.observationDate}` : item.error}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      </CardContent>
    </Card>
  )
}
