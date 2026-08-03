"use client"

import { useState, useEffect } from "react"
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
  DollarSign,
  Globe,
  MessageSquare,
  Calendar,
  Users,
  Target,
  Shield,
  AlertTriangle,
  Briefcase
} from "lucide-react"
import Link from "next/link"

export default function AnalyticsGrid() {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [animatedCards, setAnimatedCards] = useState([])

  useEffect(() => {
    // Stagger animation for cards
    const timer = setTimeout(() => {
      setAnimatedCards(analyticsCategories.map((_, index) => index))
    }, 100)
    return () => clearTimeout(timer)
  }, [])

  const analyticsCategories = [
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
    <div className="space-y-8">
      {/* Header Section */}
      <div className="text-center space-y-4">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-blue-600 via-purple-600 to-teal-600 bg-clip-text text-transparent">
            Analytics Dashboard
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
            Comprehensive market analysis with real-time indicators across all major asset classes and market segments
          </p>
        </div>

        {/* Stats Row */}
        <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span>{analyticsCategories.length} Active Categories</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span>{analyticsCategories.reduce((acc, cat) => acc + parseInt(cat.metrics), 0)} Total Indicators</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
            <span>Real-time Updates</span>
          </div>
        </div>
      </div>

      {/* Search and Filter Section */}
      <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search analytics categories..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <Button
              key={category.id}
              variant={selectedCategory === category.id ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(category.id)}
              className="flex items-center gap-2"
            >
              <Filter className="h-3 w-3" />
              {category.name}
              <Badge variant="secondary" className="text-xs">
                {category.count}
              </Badge>
            </Button>
          ))}
        </div>
      </div>

      {/* Analytics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCategories.map((category, index) => {
          const IconComponent = category.icon
          const colorClasses = getColorClasses(category.color)
          const isAnimated = animatedCards.includes(index)

          return (
            <Link key={category.id} href={category.href}>
              <Card 
                className={`group cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${
                  colorClasses.border
                } ${colorClasses.hover} ${
                  isAnimated ? 'animate-in slide-in-from-bottom-4 duration-500' : 'opacity-0'
                }`}
                style={{
                  animationDelay: `${index * 100}ms`
                }}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className={`p-3 rounded-xl ${colorClasses.bg} group-hover:scale-110 transition-transform duration-300`}>
                      <IconComponent className={`h-6 w-6 ${colorClasses.icon}`} />
                    </div>
                    <div className="text-right space-y-1">
                      <Badge 
                        variant="secondary" 
                        className={getStatusColor(category.status)}
                      >
                        {category.status}
                      </Badge>
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        <Clock className="h-3 w-3" />
                        {category.lastUpdated}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                        {category.title}
                      </CardTitle>
                      <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300 group-hover:translate-x-1 transition-all duration-300" />
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                      {category.description}
                    </p>
                  </div>
                </CardHeader>

                <CardContent className="pt-0">
                  <div className="space-y-4">
                    {/* Metrics Row */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {category.metrics}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {getTrendIcon(category.trend)}
                        <span className={`text-sm font-medium ${
                          category.trend === 'up' ? 'text-green-600' : 
                          category.trend === 'down' ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          {category.trendValue}
                        </span>
                      </div>
                    </div>

                    {/* Footer Info */}
                    <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Users className="h-3 w-3" />
                        {category.subscribers} subscribers
                      </div>
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${
                          category.priority === 'high' ? 'border-red-300 text-red-700 dark:border-red-700 dark:text-red-300' :
                          category.priority === 'medium' ? 'border-yellow-300 text-yellow-700 dark:border-yellow-700 dark:text-yellow-300' :
                          'border-gray-300 text-gray-700 dark:border-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {category.priority} priority
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      {/* Empty State */}
      {filteredCategories.length === 0 && (
        <div className="text-center py-12">
          <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No analytics found
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Try adjusting your search terms or filter criteria.
          </p>
        </div>
      )}

      {/* Footer Stats */}
      <div className="mt-12 p-6 bg-gray-50 dark:bg-gray-900 rounded-xl">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-center">
          <div className="space-y-2">
            <div className="text-2xl font-bold text-blue-600">
              {analyticsCategories.reduce((acc, cat) => acc + parseInt(cat.metrics), 0)}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Total Indicators</div>
          </div>
          <div className="space-y-2">
            <div className="text-2xl font-bold text-green-600">
              {analyticsCategories.filter(cat => cat.status === 'active').length}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Active Categories</div>
          </div>
          <div className="space-y-2">
            <div className="text-2xl font-bold text-purple-600">
              {analyticsCategories.reduce((acc, cat) => 
                acc + parseFloat(cat.subscribers.replace('k', '')) * 1000, 0
              ).toLocaleString()}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Total Subscribers</div>
          </div>
          <div className="space-y-2">
            <div className="text-2xl font-bold text-orange-600">
              Real-time
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Update Frequency</div>
          </div>
        </div>
      </div>
    </div>
  )
}
