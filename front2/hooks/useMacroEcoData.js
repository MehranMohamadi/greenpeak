import { useEffect, useState } from "react"

import { endpoints } from "../api/api"

const SOURCES = {
  gdp: endpoints.macroeco.gdp,
  unemployment: endpoints.macroeco.employment,
  payroll: endpoints.macroeco.payroll,
  confidence: endpoints.macroeco.confidence,
  cpi: endpoints.macroeco.cpi,
  retailSales: endpoints.macroeco.retailSales,
}

const emptyRecord = () => Object.fromEntries(Object.keys(SOURCES).map((key) => [key, []]))
const emptyMetadata = () => Object.fromEntries(Object.keys(SOURCES).map((key) => [key, null]))

function normalize(payload) {
  const data = (Array.isArray(payload?.data) ? payload.data : [])
    .map((item) => {
      const value = Number(item.value ?? item.rate)
      if (!item.date || !Number.isFinite(value)) return null
      return { date: item.date, time: item.date, value }
    })
    .filter(Boolean)
    .sort((left, right) => left.date.localeCompare(right.date))
  return { data, metadata: payload?.metadata || null }
}

export default function useMacroEcoData() {
  const [data, setData] = useState(emptyRecord)
  const [metadata, setMetadata] = useState(emptyMetadata)
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()

    async function loadOne([key, url]) {
      try {
        const response = await fetch(url, { signal: controller.signal })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload?.detail || `HTTP ${response.status}`)
        return { key, ...normalize(payload), error: null }
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
    ? "Macroeconomic data service is unavailable."
    : null
  return { data, metadata, errors, loading, error }
}
