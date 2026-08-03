"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PieChart, TrendingUp, TrendingDown } from "lucide-react"
import LoadingCard from "../ui/loading-card"

const PORTFOLIO_DATA = {
  totalValue: 447580.5,
  dayChange: 2700.25,
  dayChangePercent: 0.61,
  totalReturn: 58750.5,
  totalReturnPercent: 15.12,
  positions: [
    {
      symbol: "AAPL",
      quantity: 500,
      marketValue: 87715.0,
      unrealizedPnL: 5000.0,
      unrealizedPnLPercent: 6.04,
      weight: 19.6,
    },
    {
      symbol: "MSFT",
      quantity: 200,
      marketValue: 75784.0,
      unrealizedPnL: 5734.0,
      unrealizedPnLPercent: 8.19,
      weight: 16.9,
    },
    {
      symbol: "TSLA",
      quantity: 150,
      marketValue: 37300.5,
      unrealizedPnL: 450.0,
      unrealizedPnLPercent: 1.22,
      weight: 8.3,
    },
    {
      symbol: "GOOGL",
      quantity: 300,
      marketValue: 41535.0,
      unrealizedPnL: 900.0,
      unrealizedPnLPercent: 2.21,
      weight: 9.3,
    },
  ],
}

export default function Portfolio() {
  const [portfolio, setPortfolio] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setTimeout(() => {
      setPortfolio(PORTFOLIO_DATA)
      setIsLoading(false)
    }, 1200)
  }, [])

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount)
  }

  const formatPercent = (percent) => {
    return `${percent > 0 ? "+" : ""}${percent.toFixed(2)}%`
  }

  if (isLoading) {
    return <LoadingCard height="h-96" />
  }

  return (
    <Card className="bg-white dark:bg-[#1F1F23] border-gray-200 dark:border-[#2B2B30] shadow-sm card-glow">
      <CardHeader className="pb-3">
        <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2">
          <motion.div
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          >
            <PieChart className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </motion.div>
          Portfolio
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-2 h-2 bg-purple-400 rounded-full live-indicator"
          />
        </CardTitle>
        <div className="space-y-2">
          <motion.div 
            className="flex items-center justify-between"
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <span className="text-gray-600 dark:text-gray-400 text-sm">Total Value</span>
            <motion.span 
              className="text-2xl font-bold text-gray-900 dark:text-white count-up"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.4, type: "spring", stiffness: 200 }}
            >
              {formatCurrency(portfolio.totalValue)}
            </motion.span>
          </motion.div>
          <motion.div 
            className="flex items-center justify-between"
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <span className="text-gray-600 dark:text-gray-400 text-sm">Day Change</span>
            <motion.div 
              className="flex items-center gap-1"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.5, type: "spring", stiffness: 200 }}
            >
              <span
                className={`font-medium ${portfolio.dayChange >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
              >
                {formatCurrency(portfolio.dayChange)}
              </span>
              <span
                className={`text-sm ${portfolio.dayChange >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
              >
                ({formatPercent(portfolio.dayChangePercent)})
              </span>
              <motion.div
                animate={{ 
                  y: portfolio.dayChange >= 0 ? [-2, 0, -2] : [2, 0, 2],
                  scale: [1, 1.1, 1]
                }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                {portfolio.dayChange >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 max-h-64 overflow-y-auto">
        <AnimatePresence>
          {portfolio.positions.map((position, index) => (
            <motion.div
              key={position.symbol}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              transition={{ delay: index * 0.1, duration: 0.4 }}
              whileHover={{ 
                x: 8, 
                scale: 1.02,
                transition: { duration: 0.2 } 
              }}
              className="p-3 rounded-lg bg-gray-50 dark:bg-[#0F0F12] border border-gray-200 dark:border-[#2B2B30] portfolio-item cursor-pointer"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <motion.span 
                    className="font-medium text-gray-900 dark:text-white"
                    whileHover={{ scale: 1.05 }}
                  >
                    {position.symbol}
                  </motion.span>
                  <motion.div
                    animate={{ 
                      scale: [1, 1.2, 1],
                      opacity: [1, 0.7, 1]
                    }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className={`w-2 h-2 rounded-full ${position.unrealizedPnL >= 0 ? "bg-green-400" : "bg-red-400"}`}
                  />
                </div>
                <motion.span 
                  className="text-gray-600 dark:text-gray-400 text-sm"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.1 + 0.3 }}
                >
                  {position.weight}%
                </motion.span>
              </div>

              <motion.div 
                className="grid grid-cols-2 gap-4 text-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.1 + 0.4 }}
              >
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Quantity</p>
                  <p className="text-gray-900 dark:text-white">{position.quantity}</p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Market Value</p>
                  <p className="text-gray-900 dark:text-white font-medium">{formatCurrency(position.marketValue)}</p>
                </div>
              </motion.div>

              <motion.div 
                className="mt-2 pt-2 border-t border-gray-200 dark:border-[#2B2B30]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.1 + 0.5 }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400 text-sm">P&L</span>
                  <div className="flex items-center gap-1">
                    <motion.span
                      className={`font-medium ${position.unrealizedPnL >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
                      whileHover={{ scale: 1.05 }}
                    >
                      {formatCurrency(position.unrealizedPnL)}
                    </motion.span>
                    <span
                      className={`text-xs ${position.unrealizedPnL >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
                    >
                      ({formatPercent(position.unrealizedPnLPercent)})
                    </span>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          ))}
        </AnimatePresence>
      </CardContent>
    </Card>
  )
}
