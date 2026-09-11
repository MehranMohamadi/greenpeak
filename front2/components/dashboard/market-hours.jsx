"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { endpoints } from "../../api/api"

export default function MarketHours() {
  const [marketData, setMarketData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Fetch market session data
  const fetchMarketData = async () => {
    try {
      setLoading(true)
      const response = await fetch(endpoints.system.session)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()
      setMarketData(data)
      setError(null)
    } catch (err) {
      console.error("Failed to fetch market session data:", err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Fetch market data initially and every 30 seconds
    fetchMarketData()
    const marketTimer = setInterval(fetchMarketData, 30000)

    return () => clearInterval(marketTimer)
  }, [])

  const getStatusColor = (status) => {
    switch (status) {
      case "open":
        return "bg-green-500"
      case "closed":
        return "bg-red-500"
      default:
        return "bg-gray-400"
    }
  }

  if (loading && !marketData) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">در حال دریافت وضعیت بازار…</p>
  }

  if (error) {
    return <p className="text-sm text-red-500">وضعیت بازار در دسترس نیست.</p>
  }

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="نشست‌های بازار">
        {marketData?.sessions?.map((session, index) => (
          <motion.div 
            key={session.name} 
            className="flex items-center gap-2"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1, duration: 0.4 }}
          >
            <motion.div 
              className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-1 dark:bg-gray-800"
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.2 }}
            >
              <motion.div
                className={`w-3 h-3 rounded-full ${getStatusColor(session.status)}`}
                animate={
                  session.status === 'open' 
                    ? { 
                        scale: [1, 1.3, 1],
                        opacity: [1, 0.6, 1]
                      }
                    : {}
                }
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              <span className="text-sm text-gray-900 dark:text-white font-medium">
                {session.name}
              </span>
            </motion.div>
            {index < marketData.sessions.length - 1 && (
              <motion.div 
                className="w-2 h-0.5 bg-gray-300 dark:bg-gray-600"
                initial={{ width: 0 }}
                animate={{ width: 8 }}
                transition={{ delay: index * 0.1 + 0.2 }}
              />
            )}
          </motion.div>
        ))}
    </div>
  )
}
