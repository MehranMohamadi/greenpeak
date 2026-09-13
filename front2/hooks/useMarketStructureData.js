import { useEffect, useState } from "react"

import { endpoints } from "../api/api.js"
import { normalizeChartData } from "../lib/chart-data.js"

function normalizePayload(payload) {
  if (!payload || typeof payload !== "object") return null

  const blocks = { ...(payload.blocks || {}) }
  const normalizeSeries = (series) => (Array.isArray(series) ? series : []).map((item) => ({
    ...item,
    data: normalizeChartData(item?.data),
  }))

  if (blocks.cap_vs_equal_weight) {
    blocks.cap_vs_equal_weight = {
      ...blocks.cap_vs_equal_weight,
      series: normalizeSeries(blocks.cap_vs_equal_weight.series),
    }
  }
  if (blocks.styles) {
    blocks.styles = {
      ...blocks.styles,
      series: normalizeSeries(blocks.styles.series),
    }
  }
  if (blocks.sector_relative_returns) {
    blocks.sector_relative_returns = {
      ...blocks.sector_relative_returns,
      sector_series: Object.fromEntries(
        Object.entries(blocks.sector_relative_returns.sector_series || {}).map(([key, points]) => [
          key,
          normalizeChartData(points),
        ]),
      ),
    }
  }

  return { ...payload, blocks }
}

export default function useMarketStructureData(period = "5Y") {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(
          `${endpoints.sectors.marketStructure}?period=${encodeURIComponent(period)}`,
          { signal: controller.signal },
        )
        if (!response.ok) throw new Error(`Market structure returned HTTP ${response.status}`)
        const payload = normalizePayload(await response.json())
        if (!payload) throw new Error("Market structure returned an invalid response")
        if (!controller.signal.aborted) setData(payload)
      } catch (requestError) {
        if (requestError?.name !== "AbortError" && !controller.signal.aborted) {
          setError(requestError?.message || "Verified market-structure data is unavailable.")
          setData(null)
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    load()
    return () => controller.abort()
  }, [period])

  return { data, loading, error }
}
