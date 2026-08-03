"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Activity, TrendingUp, TrendingDown, Clock } from "lucide-react"
import LoadingCard from "../ui/loading-card"

const MOCK_TRADES = [
  {
    id: "1",
    symbol: "AAPL",
    side: "BUY",
    quantity: 100,
    price: 175.43,
    timestamp: new Date(Date.now() - 300000),
    status: "filled",
    pnl: 234.5,
  },
  {
    id: "2",
    symbol: "TSLA",
    side: "SELL",
    quantity: 50,
    price: 248.67,
    timestamp: new Date(Date.now() - 600000),
    status: "filled",
    pnl: -123.75,
  },
  {
    id: "3",
    symbol: "MSFT",
    side: "BUY",
    quantity: 75,
    price: 378.92,
    timestamp: new Date(Date.now() - 900000),
    status: "filled",
    pnl: 456.25,
  },
  {
    id: "4",
    symbol: "GOOGL",
    side: "SELL",
    quantity: 25,
    price: 138.45,
    timestamp: new Date(Date.now() - 1200000),
    status: "partial",
    pnl: 0,
  },
]

export default function LastTrades() {
  const [trades, setTrades] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setTimeout(() => {
      setTrades(MOCK_TRADES)
      setIsLoading(false)
    }, 800)
  }, [])

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount)
  }

  const formatTime = (date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getStatusColor = (status) => {
    switch (status) {
      case "filled":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800"
      case "partial":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400 border-gray-200 dark:border-gray-800"
    }
  }

  if (isLoading) {
    return <LoadingCard height="h-96" />
  }

  return (
    <Card className="bg-white dark:bg-[#1F1F23] border-gray-200 dark:border-[#2B2B30] shadow-sm card-glow">
      <CardHeader className="pb-3">
        <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2">
          <motion.div
            animate={{ 
              scale: [1, 1.1, 1],
              rotate: [0, 5, -5, 0]
            }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Activity className="h-5 w-5 text-green-600 dark:text-green-400" />
          </motion.div>
          Last Trades
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-2 h-2 bg-green-400 rounded-full live-indicator"
          />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 max-h-80 overflow-y-auto">
        <AnimatePresence>
          {trades.map((trade, index) => (
            <motion.div
              key={trade.id}
              initial={{ x: -50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 50, opacity: 0 }}
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
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: index * 0.1 + 0.2 }}
                  >
                    <Badge
                      variant="outline"
                      className={
                        trade.side === "BUY"
                          ? "border-green-500 text-green-700 dark:text-green-400 dark:border-green-400"
                          : "border-red-500 text-red-700 dark:text-red-400 dark:border-red-400"
                      }
                    >
                      {trade.side}
                    </Badge>
                  </motion.div>
                  <motion.span 
                    className="font-medium text-gray-900 dark:text-white"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.1 + 0.3 }}
                  >
                    {trade.symbol}
                  </motion.span>
                  <motion.span 
                    className="text-gray-600 dark:text-gray-400 text-sm"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.1 + 0.4 }}
                  >
                    ×{trade.quantity}
                  </motion.span>
                  <motion.div
                    animate={{ 
                      scale: [1, 1.2, 1],
                      opacity: [1, 0.7, 1]
                    }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className={`w-2 h-2 rounded-full ${trade.pnl >= 0 ? "bg-green-400" : "bg-red-400"}`}
                  />
                </div>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: index * 0.1 + 0.5 }}
                >
                  <Badge className={getStatusColor(trade.status)}>{trade.status}</Badge>
                </motion.div>
              </div>

              <motion.div 
                className="grid grid-cols-2 gap-4 text-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.1 + 0.6 }}
              >
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Price</p>
                  <p className="text-gray-900 dark:text-white font-medium">{formatCurrency(trade.price)}</p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400">P&L</p>
                  <div className="flex items-center gap-1">
                    <motion.span
                      className={`font-medium ${trade.pnl >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
                      whileHover={{ scale: 1.05 }}
                    >
                      {trade.pnl === 0 ? "-" : formatCurrency(trade.pnl)}
                    </motion.span>
                    {trade.pnl > 0 && (
                      <motion.div
                        animate={{ y: [-2, 0, -2] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        <TrendingUp className="h-3 w-3 text-green-500" />
                      </motion.div>
                    )}
                    {trade.pnl < 0 && (
                      <motion.div
                        animate={{ y: [2, 0, 2] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        <TrendingDown className="h-3 w-3 text-red-500" />
                      </motion.div>
                    )}
                  </div>
                </div>
              </motion.div>

              <motion.div 
                className="flex items-center justify-end mt-2 pt-2 border-t border-gray-200 dark:border-[#2B2B30]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.1 + 0.7 }}
              >
                <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                  <motion.div
                    animate={{ rotate: [0, 360] }}
                    transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
                  >
                    <Clock className="h-3 w-3" />
                  </motion.div>
                  {formatTime(trade.timestamp)}
                </div>
              </motion.div>
            </motion.div>
          ))}
        </AnimatePresence>
      </CardContent>
    </Card>
  )
}
