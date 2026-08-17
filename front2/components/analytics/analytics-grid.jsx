"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown,
  Activity,
  Search,
  Filter,
  Clock,
  ArrowRight,
  Zap,
  Building2,
  PieChart,
  Globe,
  MessageSquare,
  Calendar,
  Users,
  Target,
  AlertTriangle,
  Briefcase,
  Radio,
  Eye,
  Star
} from "lucide-react"
import Link from "next/link"

export default function AnalyticsGrid() {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [animatedCards, setAnimatedCards] = useState([])
  const [hoveredCard, setHoveredCard] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Simulate initial loading
    const loadingTimer = setTimeout(() => {
      setIsLoading(false)
    }, 800)

    // Stagger animation for cards
    const animationTimer = setTimeout(() => {
      setAnimatedCards(analyticsCategories.map((_, index) => index))
    }, 1000)

    return () => {
      clearTimeout(loadingTimer)
      clearTimeout(animationTimer)
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

  const legacyAnalyticsCategories = [
    {
      id: "monetary-policy",
      title: "Monetary Policy",
      description: "Federal Reserve policy analysis, interest rates, and central bank communications",
      status: "active",
      metrics: "9 indicators",
      lastUpdated: "2 min ago",
      trend: "up",
      trendValue: "+2.3%",
      href: "/analytics/monetary-policy",
      icon: Zap,
      color: "blue",
      category: "macro",
      priority: "high",
      subscribers: "2.4k"
    },
    {
      id: "corporate-earnings",
      title: "Corporate Earnings",
      description: "Earnings performance, guidance updates, and corporate financial health",
      status: "active", 
      metrics: "8 indicators",
      lastUpdated: "5 min ago",
      trend: "up",
      trendValue: "+5.7%",
      href: "/analytics/corporate-earnings",
      icon: Building2,
      color: "purple",
      category: "fundamental",
      priority: "high",
      subscribers: "1.8k"
    },
    {
      id: "sector-performance",
      title: "Sector Performance",
      description: "Sector rotation analysis, relative performance, and industry trends",
      status: "active",
      metrics: "11 indicators", 
      lastUpdated: "3 min ago",
      trend: "up",
      trendValue: "+1.9%",
      href: "/analytics/sector-performance",
      icon: PieChart,
      color: "green",
      category: "technical",
      priority: "medium",
      subscribers: "1.5k"
    },
    {
      id: "liquidity-flows",
      title: "Liquidity Flows",
      description: "Market liquidity analysis, capital flows, and funding conditions",
      status: "active",
      metrics: "7 indicators",
      lastUpdated: "1 min ago", 
      trend: "neutral",
      trendValue: "-0.8%",
      href: "/analytics/liquidity-flows",
      icon: Activity,
      color: "cyan",
      category: "macro",
      priority: "high",
      subscribers: "2.1k"
    },
    {
      id: "market-valuation",
      title: "Market Valuation",
      description: "Valuation metrics, price multiples, and market pricing analysis",
      status: "active",
      metrics: "9 indicators",
      lastUpdated: "6 min ago",
      trend: "down",
      trendValue: "-1.2%",
      href: "/analytics/valuation",
      icon: BarChart3,
      color: "indigo",
      category: "fundamental",
      priority: "medium",
      subscribers: "1.3k"
    },
    {
      id: "derivatives",
      title: "Derivatives",
      description: "Options flow, volatility analysis, and derivatives positioning",
      status: "active",
      metrics: "6 indicators",
      lastUpdated: "4 min ago",
      trend: "up",
      trendValue: "+3.1%",
      href: "/analytics/derivatives",
      icon: Target,
      color: "red",
      category: "technical",
      priority: "medium",
      subscribers: "1.7k"
    },
    {
      id: "market-internals",
      title: "Market Internals",
      description: "Breadth analysis, volume patterns, and internal market structure",
      status: "active",
      metrics: "4 indicators",
      lastUpdated: "8 min ago",
      trend: "up",
      trendValue: "+2.8%",
      href: "/analytics/market-internals",
      icon: Activity,
      color: "orange",
      category: "technical",
      priority: "medium",
      subscribers: "1.1k"
    },
    {
      id: "intermarket",
      title: "Intermarket Analysis",
      description: "Cross-asset relationships, currencies, bonds, and commodities",
      status: "active",
      metrics: "6 indicators",
      lastUpdated: "7 min ago",
      trend: "neutral",
      trendValue: "+0.5%",
      href: "/analytics/intermarket",
      icon: Globe,
      color: "teal",
      category: "macro",
      priority: "medium",
      subscribers: "1.6k"
    },
    {
      id: "sentiment",
      title: "Sentiment Analysis",
      description: "Market psychology, investor sentiment, and behavioral indicators",
      status: "active",
      metrics: "6 indicators",
      lastUpdated: "10 min ago",
      trend: "up",
      trendValue: "+4.2%",
      href: "/analytics/sentiment",
      icon: MessageSquare,
      color: "purple",
      category: "behavioral",
      priority: "high",
      subscribers: "2.2k"
    },
    {
      id: "macro-calendar",
      title: "Macro Calendar",
      description: "Economic indicators, release schedules, and market impact analysis",
      status: "active",
      metrics: "6 indicators",
      lastUpdated: "12 min ago",
      trend: "neutral",
      trendValue: "+0.9%",
      href: "/analytics/macro-calendar",
      icon: Calendar,
      color: "slate",
      category: "macro",
      priority: "high",
      subscribers: "1.9k"
    },
    {
      id: "institutional",
      title: "Institutional Analysis",
      description: "Institutional flows, holdings, and large investor behavior",
      status: "active",
      metrics: "6 indicators",
      lastUpdated: "15 min ago",
      trend: "up",
      trendValue: "+1.6%",
      href: "/analytics/institutional",
      icon: Briefcase,
      color: "emerald",
      category: "fundamental",
      priority: "medium",
      subscribers: "1.4k"
    }
  ]

  const domainRoutes = [
    { id: "monetary_liquidity", title: "Monetary Policy & Liquidity", description: "Policy rates, central-bank balance sheet, money and liquidity conditions", href: "/analytics/monetary-policy", icon: Zap, color: "blue", category: "macro" },
    { id: "growth_inflation_labor", title: "Growth, Inflation & Labor", description: "Growth, prices, employment and economic activity", href: "/analytics/macroeconomic", icon: BarChart3, color: "cyan", category: "macro" },
    { id: "credit_financial_risk", title: "Credit & Financial Risk", description: "Credit conditions, yield curves and systemic financial stress", href: "/analytics/systemic-risk", icon: Target, color: "red", category: "macro" },
    { id: "corporate_fundamentals", title: "Corporate Fundamentals", description: "Earnings, margins, profitability, dividends and corporate health", href: "/analytics/corporate-earnings", icon: Building2, color: "purple", category: "fundamental" },
    { id: "valuation", title: "Valuation", description: "Market multiples, pricing and long-horizon valuation context", href: "/analytics/valuation", icon: BarChart3, color: "indigo", category: "fundamental" },
    { id: "market_internals_sectors", title: "Market Internals & Sectors", description: "Breadth, leadership, sector rotation, momentum and volume", href: "/analytics/market-internals", icon: Activity, color: "orange", category: "technical" },
    { id: "positioning_sentiment_derivatives_volatility", title: "Positioning, Sentiment & Volatility", description: "Positioning, investor psychology, derivatives and volatility", href: "/analytics/sentiment", icon: MessageSquare, color: "purple", category: "behavioral" },
    { id: "capital_flows_intermarket", title: "Capital Flows & Intermarket", description: "Fund flows and relationships across rates, currencies and commodities", href: "/analytics/intermarket", icon: Globe, color: "teal", category: "macro" },
  ]

  const analyticsCategories = domainRoutes.map(domain => ({
    ...domain,
    status: "active",
    metrics: "Domain view",
    lastUpdated: "Persisted analysis",
    trend: "neutral",
    trendValue: "—",
    priority: "high",
    subscribers: "",
  }))

  const categories = [
    { id: "all", name: "All Categories", count: analyticsCategories.length },
    { id: "macro", name: "Macro", count: analyticsCategories.filter(c => c.category === "macro").length },
    { id: "fundamental", name: "Fundamental", count: analyticsCategories.filter(c => c.category === "fundamental").length },
    { id: "technical", name: "Technical", count: analyticsCategories.filter(c => c.category === "technical").length },
    { id: "behavioral", name: "Behavioral", count: analyticsCategories.filter(c => c.category === "behavioral").length }
  ]

  const filteredCategories = analyticsCategories.filter(category => {
    const matchesSearch = category.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         category.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === "all" || category.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'warning': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      case 'error': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    }
  }

  const getTrendIcon = (trend) => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-4 w-4 text-green-500" />
      case 'down': return <TrendingDown className="h-4 w-4 text-red-500" />
      default: return <Activity className="h-4 w-4 text-gray-400" />
    }
  }

  const getColorClasses = (color, isHovered = false) => {
    const colors = {
      blue: {
        border: 'border-blue-200 dark:border-blue-800',
        bg: 'bg-blue-50 dark:bg-blue-900/20',
        icon: 'text-blue-600 dark:text-blue-400',
        hover: 'hover:border-blue-300 dark:hover:border-blue-600'
      },
      purple: {
        border: 'border-purple-200 dark:border-purple-800',
        bg: 'bg-purple-50 dark:bg-purple-900/20',
        icon: 'text-purple-600 dark:text-purple-400',
        hover: 'hover:border-purple-300 dark:hover:border-purple-600'
      },
      green: {
        border: 'border-green-200 dark:border-green-800',
        bg: 'bg-green-50 dark:bg-green-900/20',
        icon: 'text-green-600 dark:text-green-400',
        hover: 'hover:border-green-300 dark:hover:border-green-600'
      },
      cyan: {
        border: 'border-cyan-200 dark:border-cyan-800',
        bg: 'bg-cyan-50 dark:bg-cyan-900/20',
        icon: 'text-cyan-600 dark:text-cyan-400',
        hover: 'hover:border-cyan-300 dark:hover:border-cyan-600'
      },
      indigo: {
        border: 'border-indigo-200 dark:border-indigo-800',
        bg: 'bg-indigo-50 dark:bg-indigo-900/20',
        icon: 'text-indigo-600 dark:text-indigo-400',
        hover: 'hover:border-indigo-300 dark:hover:border-indigo-600'
      },
      red: {
        border: 'border-red-200 dark:border-red-800',
        bg: 'bg-red-50 dark:bg-red-900/20',
        icon: 'text-red-600 dark:text-red-400',
        hover: 'hover:border-red-300 dark:hover:border-red-600'
      },
      orange: {
        border: 'border-orange-200 dark:border-orange-800',
        bg: 'bg-orange-50 dark:bg-orange-900/20',
        icon: 'text-orange-600 dark:text-orange-400',
        hover: 'hover:border-orange-300 dark:hover:border-orange-600'
      },
      teal: {
        border: 'border-teal-200 dark:border-teal-800',
        bg: 'bg-teal-50 dark:bg-teal-900/20',
        icon: 'text-teal-600 dark:text-teal-400',
        hover: 'hover:border-teal-300 dark:hover:border-teal-600'
      },
      slate: {
        border: 'border-slate-200 dark:border-slate-800',
        bg: 'bg-slate-50 dark:bg-slate-900/20',
        icon: 'text-slate-600 dark:text-slate-400',
        hover: 'hover:border-slate-300 dark:hover:border-slate-600'
      },
      emerald: {
        border: 'border-emerald-200 dark:border-emerald-800',
        bg: 'bg-emerald-50 dark:bg-emerald-900/20',
        icon: 'text-emerald-600 dark:text-emerald-400',
        hover: 'hover:border-emerald-300 dark:hover:border-emerald-600'
      }
    }
    return colors[color] || colors.blue
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#0F0F12] w-full">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="p-4 md:p-6 space-y-6 md:space-y-8 max-w-full overflow-hidden"
      >
        {/* Header Section */}
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="text-center space-y-4"
        >
          <div className="space-y-2">
            <motion.h1 
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.8 }}
              className="text-3xl md:text-4xl font-bold tracking-tight bg-gradient-to-r from-blue-600 via-purple-600 to-teal-600 bg-clip-text text-transparent flex items-center justify-center gap-3"
            >
              Analytics Dashboard
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-3 h-3 bg-green-400 rounded-full"
              />
            </motion.h1>
            <motion.p 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.6 }}
              className="text-lg md:text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto"
            >
              Real-time market analysis with live indicators across all major asset classes
            </motion.p>
          </div>

          {/* Live Stats Row */}
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.6 }}
            className="flex flex-wrap items-center justify-center gap-4 md:gap-6 text-sm text-gray-600 dark:text-gray-400"
          >
            <motion.div 
              whileHover={{ scale: 1.05 }}
              className="flex items-center gap-2 px-3 py-1 bg-green-50 dark:bg-green-900/20 rounded-full"
            >
              <motion.div
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-2 h-2 bg-green-500 rounded-full"
              />
              <span className="font-medium">{analyticsCategories.length} Live Categories</span>
            </motion.div>
            <motion.div 
              whileHover={{ scale: 1.05 }}
              className="flex items-center gap-2 px-3 py-1 bg-blue-50 dark:bg-blue-900/20 rounded-full"
            >
              <motion.div
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                className="w-2 h-2 bg-blue-500 rounded-full"
              />
              <span className="font-medium">{analyticsCategories.reduce((acc, cat) => acc + parseInt(cat.metrics), 0)} Active Indicators</span>
            </motion.div>
            <motion.div 
              whileHover={{ scale: 1.05 }}
              className="flex items-center gap-2 px-3 py-1 bg-purple-50 dark:bg-purple-900/20 rounded-full"
            >
              <motion.div
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 2, repeat: Infinity, delay: 1 }}
                className="w-2 h-2 bg-purple-500 rounded-full"
              />
              <span className="font-medium">Real-time Updates</span>
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Search and Filter Section */}
        <motion.div 
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.6 }}
          className="flex flex-col lg:flex-row gap-4 items-center justify-between"
        >
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search analytics categories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-white dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-blue-500 transition-all duration-300"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {categories.map((category, index) => (
              <motion.div
                key={category.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.8 + index * 0.1, duration: 0.4 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button
                  variant={selectedCategory === category.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(category.id)}
                  className="flex items-center gap-2 transition-all duration-300 hover:shadow-md"
                >
                  <Filter className="h-3 w-3" />
                  {category.name}
                  <Badge variant="secondary" className="text-xs bg-gray-100 dark:bg-gray-700">
                    {category.count}
                  </Badge>
                </Button>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Analytics Grid */}
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6"
          initial="hidden"
          animate="visible"
          variants={containerVariants}
        >
          <AnimatePresence>
            {filteredCategories.map((category, index) => {
              const IconComponent = category.icon
              const colorClasses = getColorClasses(category.color)
              const isHovered = hoveredCard === category.id

              return (
                <motion.div
                  key={category.id}
                  variants={cardVariants}
                  initial="hidden"
                  animate="visible"
                  exit="hidden"
                  layout
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ 
                    y: -8, 
                    scale: 1.02,
                    transition: { duration: 0.3, ease: "easeOut" }
                  }}
                  whileTap={{ scale: 0.98 }}
                  onHoverStart={() => setHoveredCard(category.id)}
                  onHoverEnd={() => setHoveredCard(null)}
                >
                  <Link href={category.href}>
                    <Card 
                      className={`group cursor-pointer transition-all duration-500 hover:shadow-2xl border-2 ${
                        colorClasses.border
                      } ${colorClasses.hover} bg-white dark:bg-gray-900/50 backdrop-blur-sm min-h-[320px] flex flex-col relative overflow-hidden`}
                    >
                      {/* Blinking Dot Indicator */}
                      <motion.div
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="absolute top-4 right-4 w-3 h-3 bg-blue-400 rounded-full shadow-lg"
                      />

                      <CardHeader className="pb-3 flex-none">
                        <div className="flex items-start justify-between">
                          <motion.div 
                            className={`p-3 rounded-xl ${colorClasses.bg} relative`}
                            whileHover={{ scale: 1.1, rotate: 5 }}
                            transition={{ duration: 0.3 }}
                          >
                            <IconComponent className={`h-6 w-6 ${colorClasses.icon}`} />
                            {isHovered && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full"
                              />
                            )}
                          </motion.div>
                          <div className="text-right space-y-1">
                            <div className="flex items-center gap-1 text-sm text-gray-500">
                              <Clock className="h-3 w-3" />
                              {category.lastUpdated}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg group-hover:text-gray-900 dark:group-hover:text-white transition-colors duration-300 flex items-center gap-2">
                              {category.title}
                              {category.priority === 'high' && (
                                <motion.div
                                  animate={{ rotate: [0, 10, -10, 0] }}
                                  transition={{ duration: 2, repeat: Infinity }}
                                >
                                  <Star className="h-4 w-4 text-yellow-500" />
                                </motion.div>
                              )}
                            </CardTitle>
                            <motion.div
                              animate={{ x: isHovered ? 5 : 0 }}
                              transition={{ duration: 0.3 }}
                            >
                              <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors duration-300" />
                            </motion.div>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 leading-relaxed">
                            {category.description}
                          </p>
                        </div>
                      </CardHeader>

                      <CardContent className="pt-0 flex-1 flex flex-col justify-between">
                        <div className="space-y-4">
                          {/* Metrics Row */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <BarChart3 className="h-4 w-4 text-gray-500" />
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                {category.metrics}
                              </span>
                            </div>
                            <motion.div 
                              className="flex items-center gap-1"
                              whileHover={{ scale: 1.1 }}
                              transition={{ duration: 0.2 }}
                            >
                              {getTrendIcon(category.trend)}
                              <span className={`text-sm font-semibold ${
                                category.trend === 'up' ? 'text-green-600' : 
                                category.trend === 'down' ? 'text-red-600' : 'text-gray-600'
                              }`}>
                                {category.trendValue}
                              </span>
                            </motion.div>
                          </div>

                          {/* Live Activity Indicator */}
                          <motion.div 
                            className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
                            whileHover={{ scale: 1.02 }}
                          >
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                            >
                              <Radio className="h-3 w-3 text-blue-500" />
                            </motion.div>
                            <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                              Live Updates Active
                            </span>
                          </motion.div>

                          {/* Footer Info */}
                          <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                            <motion.div 
                              className="flex items-center gap-1 text-xs text-gray-500"
                              whileHover={{ scale: 1.05 }}
                            >
                              <Users className="h-3 w-3" />
                              {category.subscribers} viewers
                            </motion.div>
                            <Badge 
                              variant="outline" 
                              className={`text-xs transition-all duration-300 hover:scale-105 ${
                                category.priority === 'high' ? 'border-red-300 text-red-700 dark:border-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20' :
                                category.priority === 'medium' ? 'border-yellow-300 text-yellow-700 dark:border-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/20' :
                                'border-gray-300 text-gray-700 dark:border-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/20'
                              }`}
                            >
                              {category.priority} priority
                            </Badge>
                          </div>
                        </div>
                      </CardContent>

                      {/* Hover Overlay Effect */}
                      <motion.div
                        className={`absolute inset-0 ${colorClasses.bg} opacity-0 group-hover:opacity-5 transition-opacity duration-500 pointer-events-none`}
                      />
                    </Card>
                  </Link>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </motion.div>

        {/* Empty State */}
        <AnimatePresence>
          {filteredCategories.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              transition={{ duration: 0.6 }}
              className="text-center py-16"
            >
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <AlertTriangle className="h-16 w-16 text-gray-400 mx-auto mb-6" />
              </motion.div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                No analytics found
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Try adjusting your search terms or filter criteria to find relevant analytics.
              </p>
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setSearchTerm("")
                    setSelectedCategory("all")
                  }}
                  className="transition-all duration-300"
                >
                  Clear Filters
                </Button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Live Footer Stats with counting animation */}
        <motion.div 
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.8 }}
          className="mt-12 p-6 bg-gradient-to-r from-gray-50 via-blue-50 to-purple-50 dark:from-gray-900 dark:via-blue-900/20 dark:to-purple-900/20 rounded-2xl border border-gray-200 dark:border-gray-700 relative overflow-hidden"
        >
          <div className="relative grid grid-cols-1 md:grid-cols-4 gap-6 text-center">
            {[
              {
                value: analyticsCategories.reduce((acc, cat) => acc + parseInt(cat.metrics), 0),
                label: "Live Indicators",
                color: "text-blue-600",
                icon: Activity
              },
              {
                value: analyticsCategories.length,
                label: "Categories",
                color: "text-green-600",
                icon: Eye
              },
              {
                value: Math.round(analyticsCategories.reduce((acc, cat) => 
                  acc + parseFloat(cat.subscribers.replace('k', '')) * 1000, 0
                ) / 1000),
                label: "Total Viewers (K)",
                color: "text-purple-600",
                icon: Users
              },
              {
                value: 100,
                label: "Uptime %",
                color: "text-orange-600",
                icon: Radio
              }
            ].map((stat, index) => {
              const IconComponent = stat.icon
              const [count, setCount] = useState(0)
              
              useEffect(() => {
                if (typeof stat.value !== 'number') return
                let start = 0
                const end = stat.value
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
                    setCount(Math.floor(current))
                  }
                }, duration / steps)
                return () => clearInterval(interval)
              }, [stat.value])
              
              return (
                <motion.div
                  key={stat.label}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 1.4 + index * 0.1, duration: 0.6 }}
                  whileHover={{ scale: 1.05, y: -5 }}
                  className="space-y-3 p-6 rounded-xl bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-white/30 dark:border-gray-700/30"
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                    className="flex justify-center"
                  >
                    <IconComponent className={`h-6 w-6 ${stat.color}`} />
                  </motion.div>
                  <div className={`text-3xl font-bold ${stat.color}`}>
                    {typeof stat.value === 'number' ? count : stat.value}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                    {stat.label}
                  </div>
                </motion.div>
              )
            })}
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}
