import { useEffect, useState } from "react"

import { endpoints } from "../api/api.js"

const SOURCES = {
  sp500eps: endpoints.corporate.epsSp500,
  revenue: endpoints.corporate.revenueGrowth,
  margins: endpoints.corporate.profitMargins,
  returnOnAssets: endpoints.corporate.returnOnAssets,
}

function normalize(payload) {
  return (Array.isArray(payload?.data) ? payload.data : [])
    .map((item) => {
      const value = Number(item.value ?? item.rate)
      if (!item.date || !Number.isFinite(value)) return null
      return { date: item.date, time: item.date, value }
    })
    .filter(Boolean)
    .sort((left, right) => left.date.localeCompare(right.date))
}

export default function useCorporateEarningsData() {
  const [data, setData] = useState({ sp500eps: [], revenue: [], margins: [], returnOnAssets: [] })
  const [metadata, setMetadata] = useState({ sp500eps: null, revenue: null, margins: null, returnOnAssets: null })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()

    async function loadOne([key, url]) {
      try {
        const response = await fetch(url, { signal: controller.signal })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload?.detail || `HTTP ${response.status}`)
        return { key, data: normalize(payload), metadata: payload?.metadata || null, error: null }
      } catch (error) {
        if (error.name === "AbortError") throw error
        return { key, data: [], metadata: null, error: error.message }
      }
    }

    async function load() {
      setLoading(true)
      try {
        const results = await Promise.all(Object.entries(SOURCES).map(loadOne))
        if (controller.signal.aborted) return
        setData(Object.fromEntries(results.map((result) => [result.key, result.data])))
        setMetadata(Object.fromEntries(results.map((result) => [result.key, result.metadata])))
        setErrors(Object.fromEntries(results.filter((result) => result.error).map((result) => [result.key, result.error])))
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    load().catch((error) => {
      if (!controller.signal.aborted) {
        setErrors(Object.fromEntries(Object.keys(SOURCES).map((key) => [key, error.message || "Unable to load data."])))
      }
    })
    return () => controller.abort()
  }, [])

  const error = Object.keys(errors).length === Object.keys(SOURCES).length
    ? "Corporate-fundamentals data service is unavailable."
    : null
  return { data, metadata, errors, loading, error }
}
