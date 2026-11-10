"use client"

import { useEffect, useState } from "react"
import { marketSeries, buildMarketItem, unavailableMarketItem } from "@/lib/market-watch"
export { MARKET_WATCH_SYMBOLS } from "@/lib/market-watch"

const REFRESH_INTERVAL_MS = 5 * 60 * 1000

export default function useMarketWatch() {
  const [data, setData] = useState(() => marketSeries.map(series => unavailableMarketItem(series)))
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
        } catch (error) {
          return unavailableMarketItem(series, error.message)
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
