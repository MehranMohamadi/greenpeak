"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Clock, Globe, TrendingUp } from "lucide-react"
import { endpoints } from "../../api/api"

export default function MarketHours() {
  const [currentTime, setCurrentTime] = useState(new Date())
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
    // Update time every second
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    // Fetch market data initially and every 30 seconds
    fetchMarketData()
    const marketTimer = setInterval(fetchMarketData, 30000)

    return () => {
      clearInterval(timer)
      clearInterval(marketTimer)
    }
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

  const formatTime = (minutes) => {
    if (!minutes || minutes < 0) return ""
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }

  if (loading && !marketData) {
    return (
      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Clock className="h-4 w-4" />
            {currentTime.toLocaleTimeString()}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">{currentTime.toLocaleDateString()}</div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm text-gray-500 dark:text-gray-400">Loading market data...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Clock className="h-4 w-4" />
            {currentTime.toLocaleTimeString()}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">{currentTime.toLocaleDateString()}</div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm text-red-500">Market data unavailable</div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Time and Market Overview */}
      <div className="flex items-center justify-between">
        {marketData?.market_overview && (
          <div className="flex items-center gap-3 text-sm">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              <span className="text-gray-900 dark:text-white">
                {marketData.market_overview.is_weekend ? "Weekend - Markets Closed" : 
                 `Active: ${marketData.market_overview.active_sessions.join(", ")}`}
              </span>
            </div>
            {!marketData.market_overview.is_weekend && marketData.market_overview.active_sessions_count > 1 && (
              <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                <TrendingUp className="h-3 w-3" />
                <span className="text-xs">High Volume</span>
              </div>
            )}
          </div>
        )}

        <div className="text-right">
          <div className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Clock className="h-4 w-4" />
            {currentTime.toLocaleTimeString()}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {currentTime.toLocaleDateString()}
          </div>
        </div>
      </div>

      {/* Market Sessions */}
      <div className="flex items-center gap-3 flex-wrap">
        {marketData?.sessions?.map((session, index) => (
          <motion.div 
            key={session.name} 
            className="flex items-center gap-2"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1, duration: 0.4 }}
          >
            <motion.div 
              className="flex items-center gap-2 px-3 py-1 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
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
              {session.status === 'open' && session.next_close_minutes && (
                <motion.span 
                  className="text-xs text-orange-600"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  {formatTime(session.next_close_minutes)}
                </motion.span>
              )}
              {session.status === 'closed' && session.next_open_minutes && (
                <motion.span 
                  className="text-xs text-blue-600"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  {formatTime(session.next_open_minutes)}
                </motion.span>
              )}
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
    </div>
  )
}
