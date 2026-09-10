import { useEffect, useState } from "react"

import { endpoints } from "../api/api.js"

const EMPTY_STATE = {
  price_performance: {},
  relative_performance: {},
}

export default function useSectorPerformanceData() {
  const [data, setData] = useState(EMPTY_STATE)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const controller = new AbortController()

    async function loadMetric(metric) {
      const response = await fetch(`${endpoints.sectors.latest}/${metric}`, {
        signal: controller.signal,
      })
      if (!response.ok) throw new Error(`${metric} returned HTTP ${response.status}`)
      const payload = await response.json()
      return payload?.sectors && typeof payload.sectors === "object" ? payload.sectors : {}
    }

    async function load() {
      setLoading(true)
      const [priceResult, relativeResult] = await Promise.allSettled([
        loadMetric("price_performance"),
        loadMetric("relative_performance"),
      ])

      if (controller.signal.aborted) return

      const next = {
        price_performance: priceResult.status === "fulfilled" ? priceResult.value : {},
        relative_performance: relativeResult.status === "fulfilled" ? relativeResult.value : {},
      }
      setData(next)

      if (priceResult.status === "rejected" && relativeResult.status === "rejected") {
        setError("Verified sector data is currently unavailable.")
      } else {
        setError(null)
      }
      setLoading(false)
    }

    load()
    return () => controller.abort()
  }, [])

  return { data, loading, error }
}
