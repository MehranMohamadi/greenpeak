"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { createChart } from "lightweight-charts"

import { normalizeChartData } from "@/lib/chart-data"

export default function MiniChart({ data, trend, isTransitioning = false, selectedPeriod = 'MAX' }) {
  const chartRef = useRef()
  const chartInstanceRef = useRef()
  const [error, setError] = useState(null)
  const processedData = useMemo(() => normalizeChartData(data), [data])

  useEffect(() => {
    if (!chartRef.current || processedData.length === 0) {
      return
    }

    // Clean up previous chart instance
    if (chartInstanceRef.current) {
      try {
        chartInstanceRef.current.remove()
      } catch (e) {
        console.warn("Error removing previous mini chart:", e)
      }
      chartInstanceRef.current = null
    }

    setError(null)
    try {
      const chart = createChart(chartRef.current, {
        width: chartRef.current.clientWidth,
        height: 64,
        layout: {
          background: { color: "transparent" },
          textColor: "#888",
        },
        grid: {
          vertLines: { visible: false },
          horzLines: { visible: false },
        },
        timeScale: {
          visible: false,
        },
        rightPriceScale: {
          visible: false,
        },
        leftPriceScale: {
          visible: false,
        },
        crosshair: {
          horzLine: { visible: false },
          vertLine: { visible: false },
        },
      })

      chartInstanceRef.current = chart

      const series = chart.addLineSeries({
        color: trend === "up" ? "#10b981" : trend === "down" ? "#ef4444" : "#6b7280",
        lineWidth: 2,
      })

      if (processedData.length > 0) {
        series.setData(processedData)
      }
      chart.timeScale().fitContent()
      const handleResize = () => {
        if (chartInstanceRef.current && chartRef.current) {
          chartInstanceRef.current.applyOptions({ width: chartRef.current.clientWidth })
        }
      }

      const observer = new ResizeObserver(handleResize)
      observer.observe(chartRef.current)

      return () => {
        observer.disconnect()
        if (chartInstanceRef.current) {
          try {
            chartInstanceRef.current.remove()
          } catch (e) {
            console.warn("Error removing mini chart:", e)
          }
          chartInstanceRef.current = null
        }
      }
    } catch {
      chartInstanceRef.current?.remove()
      chartInstanceRef.current = null
      setError("Chart unavailable")
    }
  }, [processedData, trend, isTransitioning, selectedPeriod])

  return (
    <div className="relative w-full h-full">
      <div ref={chartRef} className="w-full h-full" />
      {(error || processedData.length === 0) && (
        <div className="absolute inset-0 w-full h-full flex items-center justify-center text-gray-400 text-xs">
          {error || "No data"}
        </div>
      )}
    </div>
  )
}
