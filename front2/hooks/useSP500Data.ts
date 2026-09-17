import { useCallback, useEffect, useRef, useState } from "react"

const REFRESH_INTERVAL_MS = 5 * 60 * 1000

export default function useSP500Data(timeframe = "5D") {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const activeController = useRef<AbortController | null>(null)
  const requestId = useRef(0)

  const fetchData = useCallback(
    async (backgroundRefresh = false) => {
      const currentRequestId = requestId.current + 1
      requestId.current = currentRequestId
      activeController.current?.abort()

      const controller = new AbortController()
      activeController.current = controller

      if (backgroundRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      try {
        const response = await fetch(
          `/api/market/sp500?timeframe=${encodeURIComponent(timeframe)}`,
          {
            cache: "no-store",
            signal: controller.signal,
          }
        )
        const json = await response.json()

        if (!response.ok || !Array.isArray(json)) {
          throw new Error(json?.error || "Invalid API response")
        }

        if (requestId.current !== currentRequestId) return
        setData(json)
        setError(null)
        setLastUpdated(new Date())
      } catch (requestError) {
        if (controller.signal.aborted || requestId.current !== currentRequestId) {
          return
        }
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Failed to fetch S&P 500 data"
        )
      } finally {
        if (requestId.current === currentRequestId) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    },
    [timeframe]
  )

  useEffect(() => {
    setData([])
    setError(null)
    setLastUpdated(null)
    fetchData()

    const refreshTimer = window.setInterval(
      () => fetchData(true),
      REFRESH_INTERVAL_MS
    )

    return () => {
      requestId.current += 1
      activeController.current?.abort()
      window.clearInterval(refreshTimer)
    }
  }, [fetchData])

  const refresh = useCallback(() => fetchData(true), [fetchData])

  return { data, loading, refreshing, error, lastUpdated, refresh }
}
