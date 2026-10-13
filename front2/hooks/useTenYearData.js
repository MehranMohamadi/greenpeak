"use client"

import { useEffect, useState } from "react"
import { endpoints } from "@/api/api"

export default function useTenYearData(period = "1M") {
  const [data, setData] = useState([])
  const [metadata, setMetadata] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setData([]); setMetadata(null); setLoading(true); setError(null)
    let controller
    const load = async () => {
      controller?.abort()
      const request = new AbortController()
      controller = request
      try {
        const response = await fetch(`${endpoints.monetaryPolicy.tenYear}?period=${encodeURIComponent(period)}`, { cache: "no-store", signal: request.signal })
        const body = await response.json()
        if (!response.ok || !Array.isArray(body.data) || body.metadata?.source_series_id !== "^TNX") {
          throw new Error(body.error || "Yahoo Finance Treasury data is unavailable")
        }
        if (!request.signal.aborted) { setData(body.data); setMetadata(body.metadata); setError(null) }
      } catch (reason) {
        if (!request.signal.aborted) setError(reason instanceof Error ? reason.message : "Treasury data unavailable")
      } finally {
        if (!request.signal.aborted) setLoading(false)
      }
    }
    load()
    const timer = window.setInterval(load, 60000)
    return () => { controller?.abort(); window.clearInterval(timer) }
  }, [period])

  return { data, metadata, loading, error }
}
