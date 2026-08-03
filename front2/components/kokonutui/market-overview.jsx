"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { TrendingUp, TrendingDown, Activity, DollarSign } from "lucide-react"
import LoadingCard from "../ui/loading-card"

const MARKET_OVERVIEW_DATA = [
  {
    title: "S&P 500",
    value: "4,567.89",
    change: "+23.45",
    changePercent: "+0.52%",
    trend: "up",
    icon: TrendingUp,
  },
  {
    title: "NASDAQ",
    value: "15,847.25",
    change: "-45.67",
    changePercent: "-0.29%",
    trend: "down",
    icon: TrendingDown,
  },
  {
    title: "VIX",
    value: "18.45",
    change: "-2.34",
    changePercent: "-11.25%",
    trend: "down",
    icon: Activity,
  },
  {
    title: "USD Index",
    value: "103.45",
    change: "+0.23",
    changePercent: "+0.22%",
    trend: "up",
    icon: DollarSign,
  },
]

export default function MarketOverview() {
  const [marketData, setMarketData] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      setMarketData(MARKET_OVERVIEW_DATA)
      setIsLoading(false)
    }, 600)
  }, [])

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <LoadingCard key={i} height="h-24" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {marketData.map((item) => {
        const Icon = item.icon
        return (
          <Card
            key={item.title}
            className="bg-slate-800/50 border-slate-700 backdrop-blur-sm hover:bg-slate-800/70 transition-all duration-200"
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 text-sm">{item.title}</span>
                <Icon className={`h-4 w-4 ${item.trend === "up" ? "text-green-400" : "text-red-400"}`} />
              </div>
              <div className="space-y-1">
                <div className="text-xl font-bold text-white">{item.value}</div>
                <div
                  className={`text-sm flex items-center gap-1 ${item.trend === "up" ? "text-green-400" : "text-red-400"}`}
                >
                  <span>{item.change}</span>
                  <span>({item.changePercent})</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
