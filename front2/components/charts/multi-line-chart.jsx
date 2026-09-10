"use client"

import { useEffect, useRef, useState } from "react"
import { createChart } from "lightweight-charts"
import { normalizeChartData } from "@/lib/chart-data"

export default function MultiLineChart({ dataSets = [], isTransitioning = false, height = 300, textColor = "#e0e0e0" }) {
  const chartRef = useRef()
  const chartInstanceRef = useRef()
  const timeoutRef = useRef()
  const transitionRef = useRef()
  const [isClient, setIsClient] = useState(false)
  const [error, setError] = useState(null)
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (!isClient || !chartRef.current) return
    if (!dataSets || !Array.isArray(dataSets)) return

    // Handle smooth transitions
    if (isTransitioning) {
      setIsUpdating(true)
      // Add a small delay for smooth transition
      transitionRef.current = setTimeout(() => {
        updateChart()
      }, 150)
    } else {
      updateChart()
    }

    function updateChart() {
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
          width: chartRef.current.clientWidth || 600,
          height,
          layout: {
            background: { type: 'solid', color: 'transparent' },
            textColor,
          },
          grid: {
            vertLines: { color: 'rgba(0, 0, 0, 0)' },
            horzLines: { color: 'rgba(0, 0, 0, 0)' },
          },
          timeScale: {
            timeVisible: true,
            secondsVisible: false,
            borderColor: "#444",
            rightOffset: 12,
            barSpacing: 6,
            fixLeftEdge: false,
            fixRightEdge: false,
            lockVisibleTimeRangeOnResize: false,
            rightBarStaysOnScroll: true,
            allowBoldLabels: true,
            visible: true,
            ticksVisible: true,
          },
          rightPriceScale: {
            borderColor: "#444",
            backgroundColor: 'transparent',
          },
        })

        chartInstanceRef.current = chart

        // Define colors for the lines
        const colors = ["#26a69a", "#ef5350", "#42a5f5", "#ab47bc", "#ffa726"]

        setError(null)
        dataSets.forEach((seriesData, index) => {
          if (!Array.isArray(seriesData) || seriesData.length === 0) return

          try {
            const series = chart.addLineSeries({
              color: colors[index % colors.length],
              lineWidth: 2,
            })

            const safeData = normalizeChartData(seriesData)

            if (safeData.length > 0) {
              series.setData(safeData)
            }
          } catch (seriesError) {
            console.error("Error adding series:", seriesError)
            setError("Error adding chart series")
          }
        })

        // After all series are added, fit the data to the visible range
        timeoutRef.current = setTimeout(() => {
          try {
            // Check if chart instance still exists and hasn't been disposed
            if (chartInstanceRef.current && typeof chartInstanceRef.current.timeScale === 'function') {
              chartInstanceRef.current.timeScale().fitContent()
            }
            setIsUpdating(false)
          } catch (e) {
            console.warn("Error fitting chart content:", e)
            setIsUpdating(false)
          }
        }, isTransitioning ? 150 : 50) // Faster transitions

      } catch (chartError) {
        console.error("Error creating chart:", chartError)
        setError("Failed to create chart")
        setIsUpdating(false)
      }
    }

    return () => {
      clearTimeout(transitionRef.current)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      if (chartInstanceRef.current) {
        try {
          chartInstanceRef.current.remove()
        } catch (e) {
          console.warn("Error removing chart on cleanup:", e)
        }
        chartInstanceRef.current = null
      }
    }
  }, [dataSets, isClient, isTransitioning, height, textColor])

  // Handle window resize with debouncing and smooth animations
  useEffect(() => {
    let resizeTimeout
    const handleResize = () => {
      // Clear previous timeout to debounce rapid resize events
      if (resizeTimeout) {
        clearTimeout(resizeTimeout)
      }
      
      // Debounce resize to avoid excessive calls during sidebar animation
      resizeTimeout = setTimeout(() => {
        if (chartInstanceRef.current && chartRef.current) {
          try {
            // Get the current container dimensions
            const containerWidth = chartRef.current.clientWidth
            const containerHeight = height
            
            // Smooth resize with animation options
            chartInstanceRef.current.applyOptions({
              width: containerWidth,
              height: containerHeight,
              // Add animation options for smoother transitions
              layout: {
                background: { type: 'solid', color: 'transparent' },
                textColor,
              },
              timeScale: {
                rightOffset: 12,
                barSpacing: 6,
                fixLeftEdge: false,
                fixRightEdge: false,
                lockVisibleTimeRangeOnResize: false,
              }
            })
            
            // Force a chart update to ensure smooth transition
            chartInstanceRef.current.timeScale().fitContent()
          } catch (e) {
            console.warn("Error resizing chart:", e)
          }
        }
      }, 50) // 50ms debounce - faster response for smoother feel
    }

    window.addEventListener('resize', handleResize)
    const observer = new ResizeObserver(handleResize)
    if (chartRef.current) observer.observe(chartRef.current)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', handleResize)
      if (resizeTimeout) {
        clearTimeout(resizeTimeout)
      }
    }
  }, [isClient, height, textColor])

  // Cleanup effect for component unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      if (chartInstanceRef.current) {
        try {
          chartInstanceRef.current.remove()
        } catch (e) {
          console.warn("Error removing chart on unmount:", e)
        }
        chartInstanceRef.current = null
      }
    }
  }, [])

  if (!isClient) {
    return (
      <div 
        style={{ width: "100%", height }}
        className="bg-gray-100 dark:bg-gray-800 animate-pulse rounded flex items-center justify-center"
      >
        <div className="text-gray-500 dark:text-gray-400">Loading chart...</div>
      </div>
    )
  }

  return (
    <div className="relative w-full" style={{ height }}>
      <div
        ref={chartRef}
        style={{ width: "100%", height }}
        className={`transition-opacity duration-200 ${isUpdating ? 'opacity-95' : 'opacity-100'}`}
      />
      {error && <div role="alert" className="absolute inset-0 flex items-center justify-center bg-white/90 text-red-500 dark:bg-gray-900/90">{error}</div>}
    </div>
  )
}
