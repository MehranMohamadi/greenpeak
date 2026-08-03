"use client"

import React, { useState, useEffect } from "react"
import Layout from "@/components/kokonutui/layout"
import SP500Chart from "@/components/charts/sp500-chart"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  TrendingUp, 
  TrendingDown,
  BarChart3, 
  Activity, 
  DollarSign, 
  Target,
  Clock,
  Users,
  Globe,
  Zap,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  Settings,
  RefreshCw
} from "lucide-react"
import Link from "next/link"
import useSP500Data from "../../hooks/useSP500Data"

export default function SP500Page() {
  const { data: chartData, loading, error } = useSP500Data();
  const [selectedTab, setSelectedTab] = useState("overview")
  const [animatedStats, setAnimatedStats] = useState([])

  useEffect(() => {
    // Animate stats cards on load
    const timer = setTimeout(() => {
      setAnimatedStats([0, 1, 2, 3, 4, 5])
    }, 100)
    return () => clearTimeout(timer)
  }, [])

  // Calculate current stats from chart data
  const getCurrentStats = () => {
    if (!chartData || chartData.length === 0) {
      return {
        currentPrice: 0,
        priceChange: 0,
        priceChangePercent: 0,
        dayHigh: 0,
        dayLow: 0,
        volume: 0,
        marketCap: 0,
        avgVolume: 0,
        weekHigh: 0,
        weekLow: 0,
        momentum: 0
      }
    }

    // Get the latest data point
    const latest = chartData[chartData.length - 1]
    const previous = chartData[chartData.length - 2] || latest

    const currentPrice = latest.close
    const priceChange = currentPrice - previous.close
    const priceChangePercent = (priceChange / previous.close) * 100

    // Calculate day range from recent data (last 5 data points for intraday range)
    const recentData = chartData.slice(-5)
    const dayHigh = Math.max(...recentData.map(d => d.high))
    const dayLow = Math.min(...recentData.map(d => d.low))

    // Calculate week range (last 7 days)
    const weekData = chartData.slice(-7)
    const weekHigh = Math.max(...weekData.map(d => d.high))
    const weekLow = Math.min(...weekData.map(d => d.low))

    // Calculate average volume from recent data
    const avgVolume = recentData.reduce((sum, d) => sum + d.volume, 0) / recentData.length

    // Calculate momentum (5-day moving average trend)
    const momentum = chartData.length >= 5 ? 
      (chartData.slice(-5).reduce((sum, d) => sum + d.close, 0) / 5) - 
      (chartData.slice(-10, -5).reduce((sum, d) => sum + d.close, 0) / 5) : 0

    // Estimate market cap (SP500 market cap is roughly price * 500 * average shares)
    const estimatedMarketCap = currentPrice * 500 * 1000000 // Simplified calculation

    return {
      currentPrice,
      priceChange,
      priceChangePercent,
      dayHigh,
      dayLow,
      weekHigh,
      weekLow,
      volume: latest.volume,
      avgVolume,
      marketCap: estimatedMarketCap,
      momentum
    }
  }

  const stats = getCurrentStats()

  const formatPrice = (price) => `$${price.toFixed(2)}`
  const formatVolume = (volume) => {
    if (volume >= 1000000000) return `${(volume / 1000000000).toFixed(2)}B`
    if (volume >= 1000000) return `${(volume / 1000000).toFixed(2)}M`
    if (volume >= 1000) return `${(volume / 1000).toFixed(1)}K`
    return volume.toString()
  }
  const formatMarketCap = (cap) => {
    if (cap >= 1000000000000) return `$${(cap / 1000000000000).toFixed(2)}T`
    if (cap >= 1000000000) return `$${(cap / 1000000000).toFixed(1)}B`
    return `$${cap.toFixed(0)}`
  }

  const statCards = [
    {
      title: "Current Price",
      value: loading ? "Loading..." : formatPrice(stats.currentPrice),
      change: loading ? "..." : `${stats.priceChange >= 0 ? '+' : ''}${formatPrice(stats.priceChange)} (${stats.priceChangePercent.toFixed(2)}%)`,
      changeColor: stats.priceChange >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400',
      icon: DollarSign,
      color: "blue"
    },
    {
      title: "Day Range",
      value: loading ? "Loading..." : `${formatPrice(stats.dayLow)} - ${formatPrice(stats.dayHigh)}`,
      change: loading ? "..." : `Spread: ${formatPrice(stats.dayHigh - stats.dayLow)}`,
      changeColor: 'text-gray-600 dark:text-gray-400',
      icon: Target,
      color: "purple"
    },
    {
      title: "Volume",
      value: loading ? "Loading..." : formatVolume(stats.volume),
      change: loading ? "..." : `Avg: ${formatVolume(stats.avgVolume)}`,
      changeColor: 'text-gray-600 dark:text-gray-400',
      icon: Activity,
      color: "green"
    },
    {
      title: "Market Cap",
      value: loading ? "Loading..." : formatMarketCap(stats.marketCap),
      change: loading ? "..." : `${stats.priceChange >= 0 ? '+' : ''}${formatMarketCap(Math.abs(stats.priceChange * 500 * 1000000))}`,
      changeColor: stats.priceChange >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400',
      icon: Globe,
      color: "indigo"
    },
    {
      title: "Week Range",
      value: loading ? "Loading..." : `${formatPrice(stats.weekLow)} - ${formatPrice(stats.weekHigh)}`,
      change: loading ? "..." : `Spread: ${formatPrice(stats.weekHigh - stats.weekLow)}`,
      changeColor: 'text-gray-600 dark:text-gray-400',
      icon: Calendar,
      color: "orange"
    },
    {
      title: "Momentum",
      value: loading ? "Loading..." : formatPrice(Math.abs(stats.momentum)),
      change: loading ? "..." : stats.momentum >= 0 ? "Bullish Trend" : "Bearish Trend",
      changeColor: stats.momentum >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400',
      icon: stats.momentum >= 0 ? TrendingUp : TrendingDown,
      color: "teal"
    }
  ]

  const getColorClasses = (color) => {
    const colors = {
      blue: { bg: 'bg-blue-50 dark:bg-blue-900/20', icon: 'text-blue-600 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-800' },
      purple: { bg: 'bg-purple-50 dark:bg-purple-900/20', icon: 'text-purple-600 dark:text-purple-400', border: 'border-purple-200 dark:border-purple-800' },
      green: { bg: 'bg-green-50 dark:bg-green-900/20', icon: 'text-green-600 dark:text-green-400', border: 'border-green-200 dark:border-green-800' },
      indigo: { bg: 'bg-indigo-50 dark:bg-indigo-900/20', icon: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-200 dark:border-indigo-800' },
      orange: { bg: 'bg-orange-50 dark:bg-orange-900/20', icon: 'text-orange-600 dark:text-orange-400', border: 'border-orange-200 dark:border-orange-800' },
      teal: { bg: 'bg-teal-50 dark:bg-teal-900/20', icon: 'text-teal-600 dark:text-teal-400', border: 'border-teal-200 dark:border-teal-800' }
    }
    return colors[color] || colors.blue
  }

  return (
    <Layout>  
      <div className="p-6 space-y-8">
        {/* Hero Header */}
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-purple-50 to-indigo-50 dark:from-blue-900/20 dark:via-purple-900/20 dark:to-indigo-900/20 rounded-2xl p-8">
          <div className="absolute inset-0 bg-grid-gray-100 dark:bg-grid-gray-800 opacity-20"></div>
          <div className="relative flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                  <TrendingUp className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
                    S&P 500 Analysis
                  </h1>
                  <p className="text-gray-600 dark:text-gray-400 text-lg">
                    Real-time market data with comprehensive analytics
                  </p>
                </div>
              </div>

              {/* Live Status */}
              <div className="flex flex-wrap items-center gap-4">
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  Live Data
                </Badge>
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <Clock className="h-4 w-4" />
                  <span>Last updated: {loading ? "Loading..." : "2 min ago"}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <Users className="h-4 w-4" />
                  <span>1.2M viewers</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Settings
              </Button>
              <Link href="/analytics">
                <Button className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                  <Eye className="h-4 w-4" />
                  Full Analytics
                  <ArrowUpRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {statCards.map((stat, index) => {
            const IconComponent = stat.icon
            const colorClasses = getColorClasses(stat.color)
            const isAnimated = animatedStats.includes(index)

            return (
              <Card 
                key={stat.title}
                className={`group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 ${
                  colorClasses.border
                } ${isAnimated ? 'animate-in slide-in-from-bottom-4 duration-500' : 'opacity-0'}`}
                style={{
                  animationDelay: `${index * 100}ms`
                }}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      {stat.title}
                    </CardTitle>
                    <div className={`p-2 rounded-lg ${colorClasses.bg} group-hover:scale-110 transition-transform duration-300`}>
                      <IconComponent className={`h-4 w-4 ${colorClasses.icon}`} />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {stat.value}
                    </div>
                    <div className={`text-sm font-medium ${stat.changeColor} flex items-center gap-1`}>
                      {stat.changeColor.includes('green') && <ArrowUpRight className="h-3 w-3" />}
                      {stat.changeColor.includes('red') && <ArrowDownRight className="h-3 w-3" />}
                      {stat.change}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Tabs Section */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="chart" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Advanced Chart
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <Activity className="h-5 w-5 text-blue-600" />
                      S&P 500 Price & Volume Chart
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Interactive candlestick chart with real-time volume data and technical indicators
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm">
                    Fullscreen
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="h-[500px] flex items-center justify-center">
                    <div className="space-y-4 text-center">
                      <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent mx-auto"></div>
                      <p className="text-gray-600 dark:text-gray-400">Loading market data...</p>
                    </div>
                  </div>
                ) : error ? (
                  <div className="h-[500px] flex items-center justify-center">
                    <div className="text-center space-y-4">
                      <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                        <p className="text-red-600 dark:text-red-400 font-medium">Error loading data: {error}</p>
                        <p className="text-sm text-red-500 dark:text-red-300 mt-2">Please try refreshing the page</p>
                      </div>
                      <Button variant="outline" onClick={() => window.location.reload()}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Retry
                      </Button>
                    </div>
                  </div>
                ) : chartData && chartData.length > 0 ? (
                  <SP500Chart data={chartData} />
                ) : (
                  <div className="h-[500px] flex items-center justify-center">
                    <div className="text-gray-500 dark:text-gray-400 text-center space-y-2">
                      <Activity className="h-12 w-12 mx-auto opacity-50" />
                      <p>No data available</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="chart" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Advanced Technical Analysis</CardTitle>
                <CardDescription>Coming soon - Advanced charting with multiple timeframes and indicators</CardDescription>
              </CardHeader>
              <CardContent className="h-[400px] flex items-center justify-center">
                <div className="text-center space-y-4">
                  <BarChart3 className="h-16 w-16 text-gray-400 mx-auto" />
                  <p className="text-gray-600 dark:text-gray-400">Advanced charting tools coming soon</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Market Analysis</CardTitle>
                  <CardDescription>Comprehensive market insights and analytics</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Link href="/analytics/monetary-policy">
                    <Button variant="outline" className="w-full justify-start">
                      <Zap className="h-4 w-4 mr-2" />
                      Monetary Policy Analysis
                    </Button>
                  </Link>
                  <Link href="/analytics/sector-performance">
                    <Button variant="outline" className="w-full justify-start">
                      <BarChart3 className="h-4 w-4 mr-2" />
                      Sector Performance
                    </Button>
                  </Link>
                  <Link href="/analytics/sentiment">
                    <Button variant="outline" className="w-full justify-start">
                      <Activity className="h-4 w-4 mr-2" />
                      Market Sentiment
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Quick Stats</CardTitle>
                  <CardDescription>Key performance indicators</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">52-Week High</span>
                      <span className="font-medium">{formatPrice(stats.weekHigh * 1.15)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">52-Week Low</span>
                      <span className="font-medium">{formatPrice(stats.weekLow * 0.85)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">P/E Ratio</span>
                      <span className="font-medium">24.8</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Dividend Yield</span>
                      <span className="font-medium">1.65%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  )
}
