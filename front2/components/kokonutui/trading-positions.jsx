"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Target, TrendingUp, TrendingDown, X } from "lucide-react"
import LoadingCard from "../ui/loading-card"

const OPEN_POSITIONS = [
  {
    id: "1",
    symbol: "SPY",
    type: "LONG",
    quantity: 200,
    entryPrice: 445.67,
    currentPrice: 448.23,
    unrealizedPnL: 512.0,
    unrealizedPnLPercent: 1.15,
    stopLoss: 440.0,
    takeProfit: 455.0,
  },
  {
    id: "2",
    symbol: "QQQ",
    type: "SHORT",
    quantity: 100,
    entryPrice: 378.45,
    currentPrice: 376.89,
    unrealizedPnL: 156.0,
    unrealizedPnLPercent: 0.41,
    stopLoss: 382.0,
    takeProfit: 370.0,
  },
  {
    id: "3",
    symbol: "IWM",
    type: "LONG",
    quantity: 150,
    entryPrice: 198.34,
    currentPrice: 196.78,
    unrealizedPnL: -234.0,
    unrealizedPnLPercent: -0.79,
    stopLoss: 195.0,
    takeProfit: 205.0,
  },
]

export default function TradingPositions() {
  const [positions, setPositions] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setTimeout(() => {
      setPositions(OPEN_POSITIONS)
      setIsLoading(false)
    }, 900)
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

  const closePosition = (positionId) => {
    setPositions(positions.filter((pos) => pos.id !== positionId))
  }

  if (isLoading) {
    return <LoadingCard height="h-96" />
  }

  return (
    <Card className="bg-white dark:bg-[#1F1F23] border-gray-200 dark:border-[#2B2B30] shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2">
          <Target className="h-5 w-5 text-orange-600 dark:text-orange-400" />
          Open Positions
          <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></div>
        </CardTitle>
        <div className="text-gray-600 dark:text-gray-400 text-sm">{positions.length} active positions</div>
      </CardHeader>
      <CardContent className="space-y-3 max-h-80 overflow-y-auto">
        {positions.map((position) => (
          <div
            key={position.id}
            className="p-3 rounded-lg bg-gray-50 dark:bg-[#0F0F12] border border-gray-200 dark:border-[#2B2B30] hover:bg-gray-100 dark:hover:bg-[#1F1F23] transition-all duration-200"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={
                    position.type === "LONG"
                      ? "border-green-500 text-green-700 dark:text-green-400 dark:border-green-400"
                      : "border-red-500 text-red-700 dark:text-red-400 dark:border-red-400"
                  }
                >
                  {position.type}
                </Badge>
                <span className="font-medium text-gray-900 dark:text-white">{position.symbol}</span>
                <span className="text-gray-600 dark:text-gray-400 text-sm">×{position.quantity}</span>
                <div
                  className={`w-2 h-2 rounded-full animate-pulse ${position.unrealizedPnL >= 0 ? "bg-green-400" : "bg-red-400"}`}
                ></div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => closePosition(position.id)}
                className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 p-1"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm mb-2">
              <div>
                <p className="text-gray-600 dark:text-gray-400">Entry</p>
                <p className="text-gray-900 dark:text-white">{formatCurrency(position.entryPrice)}</p>
              </div>
              <div>
                <p className="text-gray-600 dark:text-gray-400">Current</p>
                <p className="text-gray-900 dark:text-white">{formatCurrency(position.currentPrice)}</p>
              </div>
            </div>

            <div className="mb-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400 text-sm">P&L</span>
                <div className="flex items-center gap-1">
                  <span
                    className={`font-medium ${position.unrealizedPnL >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
                  >
                    {formatCurrency(position.unrealizedPnL)}
                  </span>
                  <span
                    className={`text-xs ${position.unrealizedPnL >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
                  >
                    ({formatPercent(position.unrealizedPnLPercent)})
                  </span>
                  {position.unrealizedPnL >= 0 ? (
                    <TrendingUp className="h-3 w-3 text-green-500 animate-pulse" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-500 animate-pulse" />
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs text-gray-600 dark:text-gray-400">
              <div>SL: {formatCurrency(position.stopLoss)}</div>
              <div>TP: {formatCurrency(position.takeProfit)}</div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
