import { useEffect, useState } from "react"

export default function useIntermarketSymbol(series) {
  const [data, setData] = useState([])
  const [metadata, setMetadata] = useState(null)
  const [loading, setLoading] = useState(Boolean(series))
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!series) {
      setData([])
      setMetadata(null)
      setLoading(false)
      return undefined
    }

    const controller = new AbortController()

    async function load() {
      setLoading(true)
      try {
        const response = await fetch(`/api/intermarket?series=${encodeURIComponent(series)}`, {
          signal: controller.signal,
        })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload?.error || `HTTP ${response.status}`)
        if (controller.signal.aborted) return
        setData(Array.isArray(payload?.data) ? payload.data : [])
        setMetadata(payload?.metadata || null)
        setError(null)
      } catch (requestError) {
        if (requestError.name === "AbortError") return
        setData([])
        setMetadata(null)
        setError(requestError)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    load()
    const refreshTimer = window.setInterval(load, 5 * 60 * 1000)
    return () => {
      controller.abort()
      window.clearInterval(refreshTimer)
    }
  }, [series])

  return { data, metadata, loading, error }
}
