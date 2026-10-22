"use client"

import { useEffect, useState } from "react"
import { endpoints } from "@/api/api"

// Responses are scoped to each selection; an older request cannot overwrite it.
export function useMarketComparison(selection, revision = 0) {
  const key = JSON.stringify(selection)
  const [result, setResult] = useState({ key: "", data: null, loading: true, error: "" })
  useEffect(() => {
    const controller = new AbortController()
    setResult({ key, data: null, loading: true, error: "" })
    async function load() {
      try {
        const response = await fetch(endpoints.marketComparison.compare, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: key, signal: controller.signal,
        })
        if (!response.ok) throw new Error("دریافت مقایسه از سرور ممکن نشد. دوباره تلاش کنید.")
        const data = await response.json()
        if (!controller.signal.aborted) setResult({ key, data, loading: false, error: "" })
      } catch (error) {
        if (!controller.signal.aborted) setResult({ key, data: null, loading: false, error: error.message })
      }
    }
    load()
    return () => controller.abort()
  }, [key, revision])
  return result.key === key ? result : { data: null, loading: true, error: "" }
}
