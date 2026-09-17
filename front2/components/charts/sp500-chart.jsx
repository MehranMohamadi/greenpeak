"use client"

import { useEffect, useRef, useState } from "react"
import { useTheme } from "next-themes"
import { createChart } from "lightweight-charts"

/**
 * @typedef {Object} SP500Candle
 * @property {number} time
 * @property {number} open
 * @property {number} high
 * @property {number} low
 * @property {number} close
 * @property {number} [volume]
 */

/** @param {SP500Candle[]} data */
function normalizeCandles(data) {
  const candlesByTime = new Map()

  for (const item of data) {
    if (
      !item ||
      !Number.isFinite(item.time) ||
      !Number.isFinite(item.open) ||
      !Number.isFinite(item.high) ||
      !Number.isFinite(item.low) ||
      !Number.isFinite(item.close)
    ) {
      continue
    }

    candlesByTime.set(item.time, item)
  }

  return Array.from(candlesByTime.values()).sort((a, b) => a.time - b.time)
}

/** @param {{ data?: SP500Candle[] }} props */
export default function SP500Chart({ data = [] }) {
  const chartContainerRef = useRef(null)
  const [error, setError] = useState(null)
  const { theme, resolvedTheme } = useTheme()
  const isDarkTheme =
    resolvedTheme === "dark" || theme === "trading-dark" || theme === "terminal"

  useEffect(() => {
    const container = chartContainerRef.current
    if (!container || !Array.isArray(data) || data.length === 0) return

    const candles = normalizeCandles(data)
    if (candles.length === 0) {
      setError("No valid S&P 500 candles were returned")
      return
    }

    try {
      const chart = createChart(container, {
        width: container.clientWidth || 800,
        height: container.clientHeight || 500,
        layout: {
          background: {
            type: "solid",
            color: isDarkTheme ? "#0f172a" : "#ffffff",
          },
          textColor: isDarkTheme ? "#cbd5e1" : "#475569",
        },
        grid: {
          vertLines: {
            color: isDarkTheme ? "rgba(148, 163, 184, 0.08)" : "#f1f5f9",
          },
          horzLines: {
            color: isDarkTheme ? "rgba(148, 163, 184, 0.08)" : "#f1f5f9",
          },
        },
        timeScale: {
          timeVisible: true,
          secondsVisible: false,
          borderColor: isDarkTheme ? "#334155" : "#e2e8f0",
          rightOffset: 4,
          barSpacing: 6,
        },
        rightPriceScale: {
          borderColor: isDarkTheme ? "#334155" : "#e2e8f0",
          scaleMargins: {
            top: 0.08,
            bottom: 0.2,
          },
        },
        crosshair: {
          vertLine: {
            color: isDarkTheme ? "#64748b" : "#94a3b8",
            labelBackgroundColor: isDarkTheme ? "#334155" : "#475569",
          },
          horzLine: {
            color: isDarkTheme ? "#64748b" : "#94a3b8",
            labelBackgroundColor: isDarkTheme ? "#334155" : "#475569",
          },
        },
      })

      const candleSeries = chart.addCandlestickSeries({
        upColor: "#10b981",
        downColor: "#ef4444",
        borderUpColor: "#10b981",
        borderDownColor: "#ef4444",
        wickUpColor: "#10b981",
        wickDownColor: "#ef4444",
      })
      candleSeries.setData(candles)

      const volumeData = candles
        .filter((item) => Number.isFinite(item.volume))
        .map((item) => ({
          time: item.time,
          value: item.volume,
          color:
            item.close >= item.open
              ? "rgba(16, 185, 129, 0.35)"
              : "rgba(239, 68, 68, 0.35)",
        }))

      if (volumeData.length > 0) {
        const volumeSeries = chart.addHistogramSeries({
          priceFormat: { type: "volume" },
          priceScaleId: "",
        })
        chart.priceScale("").applyOptions({
          scaleMargins: { top: 0.86, bottom: 0 },
        })
        volumeSeries.setData(volumeData)
      }

      chart.timeScale().fitContent()
      setError(null)

      const resizeObserver = new ResizeObserver(([entry]) => {
        if (!entry) return
        chart.applyOptions({
          width: Math.floor(entry.contentRect.width),
          height: Math.floor(entry.contentRect.height),
        })
      })
      resizeObserver.observe(container)

      return () => {
        resizeObserver.disconnect()
        chart.remove()
      }
    } catch (chartError) {
      console.error("Error creating S&P 500 chart:", chartError)
      setError("Failed to create the S&P 500 chart")
    }
  }, [data, isDarkTheme])

  if (error) {
    return (
      <div className="flex h-[420px] items-center justify-center bg-slate-50 p-6 text-center text-sm text-red-500 sm:h-[520px] lg:h-[600px] dark:bg-slate-950/50">
        {error}
      </div>
    )
  }

  return (
    <div
      ref={chartContainerRef}
      className="h-[420px] w-full sm:h-[520px] lg:h-[600px]"
      aria-label="S&P 500 candlestick chart"
    />
  )
}
