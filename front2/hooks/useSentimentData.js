import { useEffect, useState } from "react"

import { endpoints } from "../api/api"
import { normalizeChartData } from "@/lib/chart-data"

const SOURCES = {
  vix: endpoints.systemicRisk.vix,
  spx_put_call_ratio: endpoints.systemicRisk.sentiment("spx_put_call_ratio"),
  aaii_bull_bear_spread: endpoints.systemicRisk.sentiment("aaii_bull_bear_spread"),
  cftc_sp500_positioning: endpoints.systemicRisk.sentiment("cftc_sp500_positioning"),
  vix_term_structure: endpoints.systemicRisk.sentiment("vix_term_structure"),
}

const initialResults = () => Object.fromEntries(Object.keys(SOURCES).map((key) => [key, { data: [], series: {}, metadata: null, loading: true, error: null }]))
const DAILY_REFRESH_MS = 60 * 60 * 1000

export default function useSentimentData() {
  const [results, setResults] = useState(initialResults)

  useEffect(() => {
    const controller = new AbortController()
    const loadSource = async (key, url) => {
      try {
        const response = await fetch(url, { signal: controller.signal, cache: "no-store" })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload?.detail?.message || payload?.detail || `HTTP ${response.status}`)
        if (controller.signal.aborted) return
        const series = Object.fromEntries(Object.entries(payload?.series || {}).map(([name, points]) => [name, normalizeChartData(points)]))
        setResults((current) => ({ ...current, [key]: { data: normalizeChartData(payload?.data), series, metadata: payload?.metadata || null, loading: false, error: null } }))
      } catch (reason) {
        if (reason.name === "AbortError") return
        setResults((current) => ({ ...current, [key]: { ...current[key], loading: false, error: reason } }))
      }
    }
    const loadAll = () => Object.entries(SOURCES).forEach(([key, url]) => loadSource(key, url))
    const refreshDailyVolatility = () => {
      loadSource("vix", SOURCES.vix)
      loadSource("vix_term_structure", SOURCES.vix_term_structure)
    }
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refreshDailyVolatility()
    }

    loadAll()
    const refreshTimer = window.setInterval(refreshDailyVolatility, DAILY_REFRESH_MS)
    document.addEventListener("visibilitychange", refreshWhenVisible)
    return () => {
      controller.abort()
      window.clearInterval(refreshTimer)
      document.removeEventListener("visibilitychange", refreshWhenVisible)
    }
  }, [])

  return { results }
}
