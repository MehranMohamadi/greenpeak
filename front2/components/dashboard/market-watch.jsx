"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, TrendingDown, Globe } from "lucide-react"
import MarketWatchLoadingSkeleton from "./market-watch-loading"

const marketData = [
  {
    symbol: "S&P 500",
    price: "4,567.89",
    change: "+23.45",
    changePercent: "+0.52%",
    trend: "up",
    chartData: [4520, 4535, 4542, 4538, 4545, 4552, 4548, 4555, 4562, 4567],
  },
  {
    symbol: "NASDAQ",
    price: "15,847.25",
    change: "-45.67",
    changePercent: "-0.29%",
    trend: "down",
    chartData: [15900, 15885, 15870, 15865, 15860, 15855, 15850, 15848, 15845, 15847],
  },
  {
    symbol: "DOW",
    price: "35,273.03",
    change: "-89.22",
    changePercent: "-0.25%",
    trend: "down",
    chartData: [35350, 35340, 35320, 35310, 35300, 35290, 35285, 35280, 35275, 35273],
  },
  {
    symbol: "VIX",
    price: "18.45",
    change: "-2.34",
    changePercent: "-11.25%",
    trend: "down",
    chartData: [22, 21.5, 21, 20.5, 20, 19.5, 19, 18.8, 18.6, 18.45],
  },
  {
    symbol: "EUR/USD",
    price: "1.0875",
    change: "+0.0023",
    changePercent: "+0.21%",
    trend: "up",
    chartData: [1.0845, 1.085, 1.0855, 1.086, 1.0865, 1.087, 1.0872, 1.0874, 1.0876, 1.0875],
  },
  {
    symbol: "GOLD",
    price: "$2,045.67",
    change: "+12.34",
    changePercent: "+0.61%",
    trend: "up",
    chartData: [2025, 2028, 2032, 2035, 2038, 2040, 2042, 2044, 2045, 2046],
  },
]

function MiniChart({ data, trend }) {
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1

  const points = data
    .map((value, index) => {
      const x = (index / (data.length - 1)) * 100
      const y = 100 - ((value - min) / range) * 100
      return `${x},${y}`
    })
    .join(" ")

  return (
    <div className="h-8 w-full">
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <motion.polyline
          fill="none"
          stroke={trend === "up" ? "#10b981" : "#ef4444"}
          strokeWidth="2"
          points={points}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1, ease: "easeInOut" }}
        />
        <motion.circle
          cx={data.length > 0 ? ((data.length - 1) / (data.length - 1)) * 100 : 0}
          cy={data.length > 0 ? 100 - ((data[data.length - 1] - min) / range) * 100 : 0}
          r="2"
          fill={trend === "up" ? "#10b981" : "#ef4444"}
          className="chart-point-pulse"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.8, duration: 0.3 }}
        />
      </svg>
    </div>
  )
}

export default function MarketWatch() {
  const [data, setData] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      setData(marketData)
      setIsLoading(false)
    }, 700)

    // Update data every 5 seconds
    const interval = setInterval(() => {
      setData((prevData) =>
        prevData.map((item) => ({
          ...item,
          chartData: [
            ...item.chartData.slice(1),
            item.chartData[item.chartData.length - 1] + (Math.random() - 0.5) * 2,
          ],
        })),
      )
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  if (isLoading) {
    return <MarketWatchLoadingSkeleton />
  }

  return (
    <Card className="bg-white dark:bg-[#1F1F23] border-gray-200 dark:border-[#2B2B30] shadow-sm w-full card-glow">
      <CardHeader className="pb-2">
        <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2 text-sm md:text-base">
          <Globe className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
          Market Watch
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-2 h-2 bg-green-400 rounded-full ml-2 flex-shrink-0 live-indicator"
          />
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 p-3 md:p-6">
        <motion.div 
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: {
                staggerChildren: 0.1
              }
            }
          }}
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 md:gap-3 w-full"
        >
          <AnimatePresence>
            {data.map((item, index) => (
              <motion.div
                key={item.symbol}
                variants={{
                  hidden: { y: 20, opacity: 0 },
                  visible: { y: 0, opacity: 1 }
                }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                whileHover={{ 
                  y: -4, 
                  scale: 1.02,
                  transition: { duration: 0.2 }
                }}
                whileTap={{ scale: 0.98 }}
                className="flex flex-col p-2 md:p-3 rounded-lg bg-gray-50 dark:bg-[#0F0F12] border border-gray-200 dark:border-[#2B2B30] market-watch-item cursor-pointer min-w-0 relative overflow-hidden"
              >
                <div className="flex items-center justify-between mb-1">
                  <motion.span 
                    className="text-xs font-medium text-gray-900 dark:text-white truncate flex-1 mr-1"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 + 0.3 }}
                  >
                    {item.symbol}
                  </motion.span>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <motion.div
                      animate={{ 
                        rotate: item.trend === "up" ? [0, 5, 0] : [0, -5, 0],
                        scale: [1, 1.1, 1]
                      }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      {item.trend === "up" ? (
                        <TrendingUp className="h-3 w-3 text-green-500" />
                      ) : (
                        <TrendingDown className="h-3 w-3 text-red-500" />
                      )}
                    </motion.div>
                    <motion.div
                      animate={{ 
                        scale: [1, 1.2, 1],
                        opacity: [1, 0.7, 1]
                      }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className={`w-1.5 h-1.5 rounded-full ${item.trend === "up" ? "bg-green-400" : "bg-red-400"}`}
                    />
                  </div>
                </div>

                <motion.div 
                  className="text-xs md:text-sm font-bold text-gray-900 dark:text-white mb-1 truncate count-up"
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: index * 0.1 + 0.4 }}
                >
                  {item.price}
                </motion.div>

                <motion.div
                  className={`text-xs mb-2 truncate ${item.trend === "up" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: index * 0.1 + 0.5 }}
                >
                  {item.change} ({item.changePercent})
                </motion.div>

                <motion.div 
                  className="h-6 md:h-8 w-full"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 + 0.6 }}
                >
                  <MiniChart data={item.chartData} trend={item.trend} />
                </motion.div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      </CardContent>
    </Card>
  )
}
