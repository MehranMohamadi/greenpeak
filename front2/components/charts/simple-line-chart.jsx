"use client"

import { useEffect, useRef, useState } from "react"
import { createChart } from "lightweight-charts"

export default function SimpleLineChart({ data, color = "#8b5cf6", height = 128 }) {
  const chartRef = useRef()
  const chartInstanceRef = useRef()
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (!isClient || !chartRef.current || !data || !Array.isArray(data) || data.length === 0) return

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
      const chart = createChart(chartRef.current, {
        width: chartRef.current.clientWidth || 400,
        height: height,
        layout: {
          background: { type: 'solid', color: 'transparent' },
          textColor: "#888",
        },
        grid: {
          vertLines: { color: 'rgba(42, 46, 57, 0.06)' },
          horzLines: { color: 'rgba(42, 46, 57, 0.06)' },
        },
        timeScale: {
          visible: false,
          fixLeftEdge: true,
          fixRightEdge: true,
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
        handleScroll: false,
        handleScale: false,
      })

      chartInstanceRef.current = chart

      const series = chart.addLineSeries({
        color: color,
        lineWidth: 2,
        lineStyle: 0, // solid
        crosshairMarkerVisible: false,
        priceLineVisible: false,
        lastValueVisible: false,
      })

      // Convert data to TradingView format
      // Assumes each item has a 'time' property in ISO string or UNIX timestamp format
      const chartData = data.map((item) => ({
        time: typeof item.time === "string" ? Math.floor(new Date(item.time).getTime() / 1000) : item.time,
        value: parseFloat(item.value)
      }))

      series.setData(chartData)

      // Fit content to show all data
      chart.timeScale().fitContent()

      // Handle resize with smooth animations
      let resizeTimeout
      const handleResize = () => {
        // Clear previous timeout to debounce rapid resize events
        if (resizeTimeout) {
          clearTimeout(resizeTimeout)
        }
        
        // Debounce resize for smoother sidebar animations
        resizeTimeout = setTimeout(() => {
          if (chartRef.current && chartInstanceRef.current) {
            try {
              const containerWidth = chartRef.current.clientWidth
              
              chartInstanceRef.current.applyOptions({ 
                width: containerWidth,
                height: height,
                // Ensure smooth layout transitions
                layout: {
                  background: { type: 'solid', color: 'transparent' },
                  textColor: "#888",
                },
              })
              
              // Force a smooth content fit
              chartInstanceRef.current.timeScale().fitContent()
            } catch (e) {
              console.warn("Error resizing simple chart:", e)
            }
          }
        }, 50) // Fast debounce for responsive feel
      }

      window.addEventListener('resize', handleResize)

      return () => {
        window.removeEventListener('resize', handleResize)
        if (resizeTimeout) {
          clearTimeout(resizeTimeout)
        }
        if (chartInstanceRef.current) {
          try {
            chartInstanceRef.current.remove()
          } catch (e) {
            console.warn("Error cleaning up chart:", e)
          }
        }
      }

    } catch (error) {
      console.error("Error creating chart:", error)
    }

  }, [data, color, height, isClient])

  if (!isClient) {
    return (
      <div 
        className="w-full bg-transparent transition-all duration-300 ease-out" 
        style={{ height: `${height}px` }} 
      />
    )
  }

  return (
    <div 
      ref={chartRef} 
      className="w-full bg-transparent transition-all duration-300 ease-out"
      style={{ height: `${height}px` }}
    />
  )
}
