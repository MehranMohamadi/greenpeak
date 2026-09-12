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

const EMPTY_HISTORY = {
  price_performance: [],
  relative_performance: [],
}

const EMPTY_METADATA = {
  price_performance: null,
  relative_performance: null,
}

export function useSectorPerformanceHistory(sector) {
  const [data, setData] = useState(EMPTY_HISTORY)
  const [metadata, setMetadata] = useState(EMPTY_METADATA)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})
  const [loadedSector, setLoadedSector] = useState(null)

  useEffect(() => {
    const controller = new AbortController()

    if (!sector) {
      setData(EMPTY_HISTORY)
      setMetadata(EMPTY_METADATA)
      setErrors({})
      setLoadedSector(null)
      setLoading(false)
      return () => controller.abort()
    }

    async function loadMetric(metric, endpoint) {
      const response = await fetch(`${endpoint}?sector=${encodeURIComponent(sector)}`, {
        signal: controller.signal,
      })
      if (!response.ok) throw new Error(`${metric} returned HTTP ${response.status}`)
      const payload = await response.json()
      return {
        data: Array.isArray(payload?.data) ? payload.data : [],
        metadata: payload?.metadata && typeof payload.metadata === "object" ? payload.metadata : null,
      }
    }

    async function load() {
      setLoading(true)
      setErrors({})

      const [priceResult, relativeResult] = await Promise.allSettled([
        loadMetric("price_performance", endpoints.sectors.pricePerformance),
        loadMetric("relative_performance", endpoints.sectors.relativePerformance),
      ])

      if (controller.signal.aborted) return

      setData({
        price_performance: priceResult.status === "fulfilled" ? priceResult.value.data : [],
        relative_performance: relativeResult.status === "fulfilled" ? relativeResult.value.data : [],
      })
      setMetadata({
        price_performance: priceResult.status === "fulfilled" ? priceResult.value.metadata : null,
        relative_performance: relativeResult.status === "fulfilled" ? relativeResult.value.metadata : null,
      })
      setErrors({
        ...(priceResult.status === "rejected" ? { price_performance: priceResult.reason?.message || "Price history is unavailable." } : {}),
        ...(relativeResult.status === "rejected" ? { relative_performance: relativeResult.reason?.message || "Relative history is unavailable." } : {}),
      })
      setLoadedSector(sector)
      setLoading(false)
    }

    load()
    return () => controller.abort()
  }, [sector])

  const isCurrentSector = loadedSector === sector
  return {
    data: isCurrentSector ? data : EMPTY_HISTORY,
    metadata: isCurrentSector ? metadata : EMPTY_METADATA,
    loading: Boolean(sector) && (!isCurrentSector || loading),
    errors: isCurrentSector ? errors : {},
  }
}
