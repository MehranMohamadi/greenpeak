"use client"

import { useEffect, useRef, useState } from "react"
import { createChart } from "lightweight-charts"

/**
 * @typedef {Object} SP500Candle
 * @property {string | number} time
 * @property {number} open
 * @property {number} high
 * @property {number} low
 * @property {number} close
 * @property {number} [volume]
 */

/**
 * @param {{ data?: SP500Candle[] }} props
 */
export default function SP500Chart({ data = [] }) {
  const chartContainerRef = useRef()
  const chartInstanceRef = useRef()
  const [isClient, setIsClient] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (!isClient || !chartContainerRef.current) return
    if (!data || !Array.isArray(data) || data.length === 0) return

    // Clean up previous chart
    if (chartInstanceRef.current) {
      try {
        chartInstanceRef.current.remove()
      } catch (e) {
        console.warn("Error removing previous chart:", e)
      }
      chartInstanceRef.current = null
    }

    try {
      const chart = createChart(chartContainerRef.current, {
        width: chartContainerRef.current.clientWidth || 800,
        height: 500,
        layout: {
          background: { type: 'solid', color: "transparent" }, // Transparent to match card background
          textColor: "#e0e0e0",
        },
        grid: {
          vertLines: { visible: false },
          horzLines: { visible: false },
        },
        timeScale: {
          timeVisible: true,
          secondsVisible: false,
          borderColor: "#374151", // Neutral gray
        },
        rightPriceScale: {
          borderColor: "#374151", // Neutral gray
        },
      })

      chartInstanceRef.current = chart

      // Add resize event listener
      const handleResize = () => {
        if (chartInstanceRef.current && chartContainerRef.current) {
          chartInstanceRef.current.applyOptions({
            width: chartContainerRef.current.clientWidth,
          })
        }
      }

      window.addEventListener('resize', handleResize)

      // Add candlestick series
      const candleSeries = chart.addCandlestickSeries({
        upColor: "#26a69a",
        downColor: "#ef5350",
        borderUpColor: "#26a69a",
        borderDownColor: "#ef5350",
        wickUpColor: "#888",
        wickDownColor: "#888",
      })

      // Add volume series
      const volumeSeries = chart.addHistogramSeries({
        color: "#26a69a",
        priceFormat: {
          type: "volume",
        },
        priceScaleId: "",
      })

      // Configure price scale for volume
      chart.priceScale("").applyOptions({
        scaleMargins: {
          top: 0.9,
          bottom: 0,
        },
      })

      // Filter and validate data
      const validData = data.filter(item => 
        item && 
        typeof item.time !== "undefined" &&
        typeof item.open === "number" &&
        typeof item.high === "number" &&
        typeof item.low === "number" &&
        typeof item.close === "number" &&
        !isNaN(item.open) &&
        !isNaN(item.high) &&
        !isNaN(item.low) &&
        !isNaN(item.close)
      )

      if (validData.length > 0) {
        candleSeries.setData(validData)

        // Set volume data if available
        const volumeData = validData
          .filter(item => typeof item.volume === "number" && !isNaN(item.volume))
          .map((item) => ({
            time: item.time,
            value: item.volume,
            color: item.close > item.open ? "#26a69a" : "#ef5350",
          }))

        if (volumeData.length > 0) {
          volumeSeries.setData(volumeData)
        }
      }

      setError(null)

      // Cleanup function
      return () => {
        window.removeEventListener('resize', handleResize)
        if (chartInstanceRef.current) {
          try {
            chartInstanceRef.current.remove()
          } catch (e) {
            console.warn("Error removing chart on cleanup:", e)
          }
          chartInstanceRef.current = null
        }
      }
    } catch (chartError) {
      console.error("Error creating SP500 chart:", chartError)
      setError("Failed to create chart")
    }
  }, [data, isClient])

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (chartInstanceRef.current && chartContainerRef.current) {
        try {
          chartInstanceRef.current.applyOptions({
            width: chartContainerRef.current.clientWidth,
            height: 500
          })
        } catch (e) {
          console.warn("Error resizing SP500 chart:", e)
        }
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  if (!isClient) {
    return (
      <div 
        style={{ width: "100%", height: "500px" }} 
        className="bg-gray-100 dark:bg-gray-800 animate-pulse rounded flex items-center justify-center"
      >
        <div className="text-gray-500 dark:text-gray-400">Loading S&P 500 chart...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div 
        style={{ width: "100%", height: "500px" }} 
        className="bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center"
      >
        <div className="text-red-500 text-center">
          <p>{error}</p>
          <p className="text-sm mt-2">S&P 500 chart unavailable</p>
        </div>
      </div>
    )
  }

  if (!data || !Array.isArray(data) || data.length === 0) {
    return (
      <div 
        style={{ width: "100%", height: "500px" }} 
        className="bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center"
      >
        <div className="text-gray-500 dark:text-gray-400 text-center">
          <p>No data available</p>
          <p className="text-sm mt-2">S&P 500 data will appear here when available</p>
        </div>
      </div>
    )
  }

  return <div ref={chartContainerRef} style={{ width: "100%", height: "500px" }} />
}
