import { useEffect, useState } from "react"

import { endpoints } from "../api/api"

const SOURCES = {
  highYieldSpread: endpoints.systemicRisk.credit,
  bbbSpread: endpoints.systemicRisk.cds,
  financialStress: endpoints.systemicRisk.stress,
  yieldCurve: endpoints.systemicRisk.twoyteny,
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

export default function useSystemicRiskData() {
  const [data, setData] = useState({ highYieldSpread: [], bbbSpread: [], financialStress: [], yieldCurve: [] })
  const [metadata, setMetadata] = useState({ highYieldSpread: null, bbbSpread: null, financialStress: null, yieldCurve: null })
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
      } catch (error) {
        if (error.name !== "AbortError" && !controller.signal.aborted) {
          setErrors(Object.fromEntries(Object.keys(SOURCES).map((key) => [key, error.message])))
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    load()
    return () => controller.abort()
  }, [])

  return { data, metadata, errors, loading }
}
