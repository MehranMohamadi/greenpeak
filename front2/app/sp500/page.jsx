"use client"

import React, { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
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
  RefreshCw,
  Pulse,
  Star
} from "lucide-react"
import Link from "next/link"
import useSP500Data from "../../hooks/useSP500Data"

export default function SP500Page() {
  const { data: chartData, loading, error } = useSP500Data();
  const [selectedTab, setSelectedTab] = useState("overview")
  const [animatedStats, setAnimatedStats] = useState([])
  const [isLive, setIsLive] = useState(true)

  useEffect(() => {
    // Animate stats cards on load
    const timer = setTimeout(() => {
      setAnimatedStats([0, 1, 2, 3, 4, 5])
    }, 500)

    return () => {
      clearTimeout(timer)
    }
  }, [])

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  }

  const cardVariants = {
    hidden: { y: 50, opacity: 0, scale: 0.9 },
    visible: {
      y: 0,
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.6,
        ease: [0.16, 1, 0.3, 1]
      }
    }
  }

  const pulseVariants = {
    pulse: {
      scale: [1, 1.1, 1],
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  }

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
      <div className="min-h-screen bg-white dark:bg-[#0F0F12] w-full">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="p-4 md:p-6 space-y-6 md:space-y-8 max-w-full overflow-hidden"
        >
          {/* Enhanced Hero Header */}
          <motion.div 
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="relative overflow-hidden bg-gradient-to-br from-blue-50/80 via-purple-50/80 to-indigo-50/80 dark:from-blue-900/10 dark:via-purple-900/10 dark:to-indigo-900/10 rounded-2xl p-6 md:p-8 border border-gray-200/50 dark:border-gray-700/50 backdrop-blur-sm"
          >
            {/* Animated Background */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-blue-400/5 to-purple-400/5"
              animate={{ x: [-50, 50] }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            />
            
            <div className="relative flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
              <div className="space-y-4 flex-1">
                <div className="flex items-center gap-4">
                  <motion.div 
                    className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl border border-blue-200 dark:border-blue-700"
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    transition={{ duration: 0.3 }}
                  >
                    <TrendingUp className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                  </motion.div>
                  <div className="flex-1">
                    <motion.h1
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.4, duration: 0.6 }}
                      className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent flex items-center gap-3"
                    >
                      S&P 500 Live Analysis
                      <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="w-3 h-3 bg-green-400 rounded-full shadow-lg"
                      />
                    </motion.h1>
                    <motion.p
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.5, duration: 0.6 }}
                      className="text-lg text-gray-600 dark:text-gray-400 mt-2"
                    >
                      Real-time market data with comprehensive analytics
                    </motion.p>
                  </div>
                </div>

                {/* Live Status */}
                <motion.div 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.6, duration: 0.6 }}
                  className="flex flex-wrap items-center gap-4"
                >
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    className="flex items-center gap-2 px-3 py-1 bg-green-50 dark:bg-green-900/20 rounded-full border border-green-200 dark:border-green-700"
                  >
                    <motion.div
                      animate={{ scale: [1, 1.3, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="w-2 h-2 bg-green-500 rounded-full"
                    />
                    <span className="text-sm font-medium text-green-700 dark:text-green-300">Live Market Data</span>
                  </motion.div>
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Clock className="h-4 w-4" />
                    <span>Last updated: {loading ? "Loading..." : "30 seconds ago"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Users className="h-4 w-4" />
                    <span>1.2M viewers</span>
                  </div>
                </motion.div>
              </div>

              <motion.div 
                initial={{ x: 30, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.7, duration: 0.6 }}
                className="flex gap-3"
              >
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button variant="outline" size="sm" className="flex items-center gap-2 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm border border-white/20 dark:border-gray-700/20">
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                  </Button>
                </motion.div>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button variant="default" size="sm" className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-lg">
                    <Star className="h-4 w-4" />
                    Follow
                  </Button>
                </motion.div>
                <Link href="/analytics">
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <Button className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg">
                      <Eye className="h-4 w-4" />
                      Full Analytics
                      <ArrowUpRight className="h-4 w-4" />
                    </Button>
                  </motion.div>
                </Link>
              </motion.div>
            </div>
          </motion.div>

          {/* Enhanced Stats Grid */}
          <motion.div 
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            initial="hidden"
            animate="visible"
            variants={containerVariants}
          >
            {statCards.map((stat, index) => {
              const IconComponent = stat.icon
              const colorClasses = getColorClasses(stat.color)
              const isAnimated = animatedStats.includes(index)

              // Counting animation for stat value
              const [count, setCount] = useState(0)
              useEffect(() => {
                if (!isAnimated || loading) return
                const numericValue = parseFloat(stat.value.replace(/[^\d.]/g, ''))
                if (isNaN(numericValue)) return
                
                let start = 0
                const end = numericValue
                const duration = 1500
                const steps = 60
                const stepValue = end / steps
                let current = start
                
                const interval = setInterval(() => {
                  current += stepValue
                  if (current >= end) {
                    setCount(end)
                    clearInterval(interval)
                  } else {
                    setCount(current)
                  }
                }, duration / steps)
                return () => clearInterval(interval)
              }, [isAnimated, stat.value, loading])

              const displayValue = isAnimated && !loading && !isNaN(count) ? 
                stat.value.replace(/[\d.]+/, count.toFixed(2)) : stat.value

              return (
                <motion.div
                  key={stat.title}
                  variants={cardVariants}
                  initial="hidden"
                  animate="visible"
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ 
                    y: -8, 
                    scale: 1.04,
                    transition: { duration: 0.3, ease: "easeOut" }
                  }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Card 
                    className={`group hover:shadow-2xl transition-all duration-500 border-2 ${
                      colorClasses.border
                    } bg-white dark:bg-gray-900/50 backdrop-blur-sm min-h-[200px] flex flex-col relative overflow-hidden`}
                  >
                    {/* Blinking Dot Indicator */}
                    <motion.div
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity, delay: index * 0.3 }}
                      className="absolute top-4 right-4 w-3 h-3 bg-blue-400 rounded-full shadow-lg"
                    />

                    <CardHeader className="pb-4">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base font-semibold text-gray-700 dark:text-gray-200">
                          {stat.title}
                        </CardTitle>
                        <motion.div 
                          className={`p-2 rounded-lg ${colorClasses.bg}`}
                          whileHover={{ scale: 1.1, rotate: 10 }}
                          transition={{ duration: 0.3 }}
                        >
                          <IconComponent className={`h-5 w-5 ${colorClasses.icon}`} />
                        </motion.div>
                      </div>
                      
                    </CardHeader>
                    <CardContent className="pt-0 flex-1 flex flex-col justify-center">
                      <div className="space-y-3">
                        <motion.div 
                          className="text-3xl font-bold text-gray-900 dark:text-white"
                          initial={{ scale: 0.8 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: index * 0.1 + 0.5, duration: 0.6 }}
                        >
                          {displayValue}
                        </motion.div>
                        <div className={`text-sm font-medium ${stat.changeColor} flex items-center gap-1`}>
                          {stat.changeColor.includes('green') && (
                            <motion.div
                              animate={{ y: [-2, 2, -2] }}
                              transition={{ duration: 1.5, repeat: Infinity }}
                            >
                              <ArrowUpRight className="h-4 w-4" />
                            </motion.div>
                          )}
                          {stat.changeColor.includes('red') && (
                            <motion.div
                              animate={{ y: [2, -2, 2] }}
                              transition={{ duration: 1.5, repeat: Infinity }}
                            >
                              <ArrowDownRight className="h-4 w-4" />
                            </motion.div>
                          )}
                          {stat.change}
                        </div>
                      </div>
                    </CardContent>

                    {/* Hover Overlay */}
                    <motion.div
                      className={`absolute inset-0 ${colorClasses.bg} opacity-0 group-hover:opacity-10 transition-opacity duration-500 pointer-events-none`}
                    />
                  </Card>
                </motion.div>
              )
            })}
          </motion.div>

          {/* Enhanced Tabs Section */}
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 1, duration: 0.8 }}
          >
            <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
              <motion.div
                initial={{ x: -50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 1.2, duration: 0.6 }}
              >
                <TabsList className="grid w-full grid-cols-3 lg:w-[400px] bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
                  <TabsTrigger 
                    value="overview" 
                    className="flex items-center gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 rounded-lg transition-all duration-300"
                  >
                    <BarChart3 className="h-4 w-4" />
                    Overview
                  </TabsTrigger>
                  <TabsTrigger 
                    value="chart" 
                    className="flex items-center gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 rounded-lg transition-all duration-300"
                  >
                    <Activity className="h-4 w-4" />
                    Advanced
                  </TabsTrigger>
                  <TabsTrigger 
                    value="analytics" 
                    className="flex items-center gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 rounded-lg transition-all duration-300"
                  >
                    <Zap className="h-4 w-4" />
                    Analytics
                  </TabsTrigger>
                </TabsList>
              </motion.div>

              <AnimatePresence mode="wait">
                <TabsContent value="overview" className="space-y-6">
                  <motion.div
                    key="overview"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.4 }}
                  >
                    <Card className="border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 backdrop-blur-sm">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="flex items-center gap-2 text-xl">
                              <Activity className="h-5 w-5 text-blue-600" />
                              S&P 500 Live Chart
                              <motion.div
                                animate={{ scale: [1, 1.2, 1] }}
                                transition={{ duration: 2, repeat: Infinity }}
                                className="w-2 h-2 bg-green-400 rounded-full"
                              />
                            </CardTitle>
                            <CardDescription className="mt-1">
                              Interactive candlestick chart with real-time volume data and technical indicators
                            </CardDescription>
                          </div>
                          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                            <Button variant="outline" size="sm" className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm">
                              <Eye className="h-4 w-4 mr-2" />
                              Fullscreen
                            </Button>
                          </motion.div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {loading ? (
                          <div className="h-[500px] flex items-center justify-center">
                            <motion.div 
                              className="space-y-4 text-center"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ duration: 0.6 }}
                            >
                              <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"
                              />
                              <motion.p
                                animate={{ opacity: [0.5, 1, 0.5] }}
                                transition={{ duration: 1.5, repeat: Infinity }}
                                className="text-gray-600 dark:text-gray-400 font-medium"
                              >
                                Loading live market data...
                              </motion.p>
                            </motion.div>
                          </div>
                        ) : error ? (
                          <motion.div 
                            className="h-[500px] flex items-center justify-center"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.6 }}
                          >
                            <div className="text-center space-y-4">
                              <div className="p-6 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-700">
                                <p className="text-red-600 dark:text-red-400 font-medium text-lg">Error loading data: {error}</p>
                                <p className="text-sm text-red-500 dark:text-red-300 mt-2">Please try refreshing the page</p>
                              </div>
                              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                <Button variant="outline" onClick={() => window.location.reload()} className="bg-red-50 hover:bg-red-100 border-red-200">
                                  <RefreshCw className="h-4 w-4 mr-2" />
                                  Retry Loading
                                </Button>
                              </motion.div>
                            </div>
                          </motion.div>
                        ) : chartData && chartData.length > 0 ? (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.8 }}
                          >
                            <SP500Chart data={chartData} />
                          </motion.div>
                        ) : (
                          <motion.div 
                            className="h-[500px] flex items-center justify-center"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.6 }}
                          >
                            <div className="text-gray-500 dark:text-gray-400 text-center space-y-4">
                              <Activity className="h-16 w-16 mx-auto opacity-50" />
                              <p className="text-lg">No market data available</p>
                            </div>
                          </motion.div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                </TabsContent>

                <TabsContent value="chart" className="space-y-6">
                  <motion.div
                    key="chart"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.4 }}
                  >
                    <Card className="border-2 border-gray-200 dark:border-gray-700">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Star className="h-5 w-5 text-yellow-500" />
                          Advanced Technical Analysis
                        </CardTitle>
                        <CardDescription>Coming soon - Advanced charting with multiple timeframes and indicators</CardDescription>
                      </CardHeader>
                      <CardContent className="h-[400px] flex items-center justify-center">
                        <motion.div 
                          className="text-center space-y-4"
                          animate={{ y: [0, -10, 0] }}
                          transition={{ duration: 3, repeat: Infinity }}
                        >
                          <BarChart3 className="h-20 w-20 text-gray-400 mx-auto" />
                          <p className="text-gray-600 dark:text-gray-400 text-lg">Advanced charting tools coming soon</p>
                        </motion.div>
                      </CardContent>
                    </Card>
                  </motion.div>
                </TabsContent>

                <TabsContent value="analytics" className="space-y-6">
                  <motion.div
                    key="analytics"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.4 }}
                    className="grid grid-cols-1 lg:grid-cols-2 gap-6"
                  >
                    <Card className="border-2 border-blue-200 dark:border-blue-700">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Zap className="h-5 w-5 text-blue-600" />
                          Market Analysis
                        </CardTitle>
                        <CardDescription>Comprehensive market insights and analytics</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {[
                          { href: "/analytics/monetary-policy", icon: Zap, text: "Monetary Policy Analysis" },
                          { href: "/analytics/sector-performance", icon: BarChart3, text: "Sector Performance" },
                          { href: "/analytics/sentiment", icon: Activity, text: "Market Sentiment" }
                        ].map((item, index) => (
                          <Link key={item.href} href={item.href}>
                            <motion.div
                              whileHover={{ scale: 1.02, x: 5 }}
                              whileTap={{ scale: 0.98 }}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.1, duration: 0.4 }}
                            >
                              <Button variant="outline" className="w-full justify-start bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700 transition-all duration-300">
                                <item.icon className="h-4 w-4 mr-2" />
                                {item.text}
                                <ArrowUpRight className="h-3 w-3 ml-auto" />
                              </Button>
                            </motion.div>
                          </Link>
                        ))}
                      </CardContent>
                    </Card>

                    <Card className="border-2 border-purple-200 dark:border-purple-700">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Target className="h-5 w-5 text-purple-600" />
                          Quick Stats
                        </CardTitle>
                        <CardDescription>Key performance indicators</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-3">
                          {[
                            { label: "52-Week High", value: formatPrice(stats.weekHigh * 1.15) },
                            { label: "52-Week Low", value: formatPrice(stats.weekLow * 0.85) },
                            { label: "P/E Ratio", value: "24.8" },
                            { label: "Dividend Yield", value: "1.65%" }
                          ].map((item, index) => (
                            <motion.div
                              key={item.label}
                              className="flex justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.1, duration: 0.4 }}
                              whileHover={{ scale: 1.02 }}
                            >
                              <span className="text-sm text-gray-600 dark:text-gray-400">{item.label}</span>
                              <span className="font-medium text-gray-900 dark:text-white">{item.value}</span>
                            </motion.div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                </TabsContent>
              </AnimatePresence>
            </Tabs>
          </motion.div>
        </motion.div>
      </div>
    </Layout>
  )
}
