"use client"

import { useEffect, useRef } from "react"
import { createChart } from "lightweight-charts"

// Helper function to format date for chart
const formatDateForChart = (dateStr, index = 0) => {
  // Handle undefined or null dateStr
  if (!dateStr || typeof dateStr !== 'string') {
    const currentYear = new Date().getFullYear()
    const month = Math.min(index + 1, 12).toString().padStart(2, '0')
    const day = Math.min(15 + index, 28).toString().padStart(2, '0')
    return `${currentYear}-${month}-${day}`
  }
  
  // If already in YYYY-MM-DD format, return as is
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return dateStr
  }
  
  // Convert "2024-01" to "2024-01-15" format with unique days
  if (dateStr.match(/^\d{4}-\d{2}$/)) {
    const day = Math.min(1 + index, 28).toString().padStart(2, '0')
    return `${dateStr}-${day}`
  }
  
  // Convert month names to dates
  const monthMap = {
    'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06',
    'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
  }
  
  if (monthMap[dateStr]) {
    const currentYear = new Date().getFullYear()
    const day = Math.min(1 + index, 28).toString().padStart(2, '0')
    return `${currentYear}-${monthMap[dateStr]}-${day}`
  }
  
  // Fallback - return as is
  return dateStr
}

export default function MiniChart({ data, trend, isTransitioning = false, selectedPeriod = 'MAX' }) {
  const chartRef = useRef()
  const chartInstanceRef = useRef()

  useEffect(() => {
    if (!chartRef.current || !data || !Array.isArray(data) || data.length === 0) {
      console.log('MiniChart: No data or container available', { 
        hasContainer: !!chartRef.current, 
        dataType: typeof data, 
        dataLength: data?.length,
        selectedPeriod 
      })
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

      // Process the data to the format expected by lightweight-charts
      const processedData = data
        .filter(d => d && typeof d === 'object' && d.value !== undefined)
        .map((d, i) => ({ 
          time: formatDateForChart(d.date || d.time, i), 
          value: typeof d.value === 'number' ? d.value : parseFloat(d.value) || 0
        }))
        .sort((a, b) => new Date(a.time) - new Date(b.time))
        .reduce((acc, current, index) => {
          // Ensure unique timestamps by adding milliseconds if needed
          const existingIndex = acc.findIndex(item => item.time === current.time)
          if (existingIndex !== -1) {
            // If duplicate time found, modify it slightly
            const baseDate = new Date(current.time)
            baseDate.setDate(baseDate.getDate() + index)
            current.time = baseDate.toISOString().split('T')[0]
          }
          acc.push(current)
          return acc
      }, [])
      .sort((a, b) => new Date(a.time) - new Date(b.time))

      if (processedData.length > 0) {
        series.setData(processedData)
      }      const handleResize = () => {
        if (chartInstanceRef.current && chartRef.current) {
          chartInstanceRef.current.applyOptions({ width: chartRef.current.clientWidth })
        }
      }

      window.addEventListener("resize", handleResize)

      return () => {
        window.removeEventListener("resize", handleResize)
        if (chartInstanceRef.current) {
          try {
            chartInstanceRef.current.remove()
          } catch (e) {
            console.warn("Error removing mini chart:", e)
          }
          chartInstanceRef.current = null
        }
      }
    } catch (error) {
      console.error('MiniChart error:', error)
    }
  }, [data, trend, isTransitioning, selectedPeriod])

  return (
    <div ref={chartRef} className="w-full h-full">
      {(!data || !Array.isArray(data) || data.length === 0) && (
        <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
          No data
        </div>
      )}
    </div>
  )
}
