"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import MultiLineChart from "@/components/charts/multi-line-chart"
import MiniChart from "@/components/analytics/mini-chart"
import FullScreenChart from '@/components/analytics/fullscreen-chart'
import { DollarSign, TrendingUp, TrendingDown, Activity, Target, PieChart, BarChart3, Calculator, Building2, Zap, Info, ExternalLink, Maximize2, Minimize2, ChevronLeft, ChevronRight, Grid3X3 } from "lucide-react"
import useCorporateEarningsData from "@/hooks/useCorporateEarningsData"
import { 
  getLatestValue, 
  calculateChange,
  getDataForPeriod
} from "@/hooks/macroeconomicDataUtils"
import useUpdateInfo from "@/hooks/useUpdateInfo"
import { analyticsCategories, getCategoryByName, getCategoryIndex } from "@/lib/analytics-utils"
import '@/styles/analytics-animations.css'

function CorporateEarnings() {
  const router = useRouter()
  const [selectedFactor, setSelectedFactor] = useState('sp500-eps')
  const [selectedPeriod, setSelectedPeriod] = useState('5Y')
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState('Corporate Earnings')
  const [showCategoryGrid, setShowCategoryGrid] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [prevPeriod, setPrevPeriod] = useState('MAX')

  // Use imported categories from utils
  const categories = analyticsCategories
  
  // Use update info hook
  const { processUpdateInfo } = useUpdateInfo()

  // Smooth transition handler for period changes
  const handlePeriodChange = (newPeriod) => {
    if (newPeriod === selectedPeriod) return
    
    setIsTransitioning(true)
    setPrevPeriod(selectedPeriod)
    
    // Faster, more seamless transition
    setTimeout(() => {
      setSelectedPeriod(newPeriod)
      setTimeout(() => {
        setIsTransitioning(false)
      }, 200) // Reduced from 400ms for faster response
    }, 50) // Reduced from 100ms for immediate response
  }

  // Effect to handle smooth data transitions
  React.useEffect(() => {
    if (isTransitioning) {
      // Add any additional logic needed during transitions
      const timer = setTimeout(() => {
        // Ensure transition state is cleared even if something goes wrong
        setIsTransitioning(false)
      }, 1000) // Fallback timeout
      
      return () => clearTimeout(timer)
    }
  }, [isTransitioning])

  // Find current category based on page
  const getCurrentCategory = () => {
    return categories.find(cat => cat.page === 'corporate-earnings') || categories[0]
  }
  
  // Use custom hooks to fetch data - now with metadata
  const { data: corporateData, metadata: corporateMetadata, loading, error } = useCorporateEarningsData()
  
  // Extract individual datasets
  const epsData = corporateData?.sp500eps || []
  const revenueData = corporateData?.revenue || []
  const marginsData = corporateData?.margins || []
  const peRatioData = corporateData?.peRatio || []
  const dividendYieldData = corporateData?.dividendYield || []
  const roiData = corporateData?.roi || []
  
  // Get current values and changes for main charts
  const latestEPS = epsData.length > 0 ? getLatestValue(epsData) : 0
  const latestRevenue = revenueData.length > 0 ? getLatestValue(revenueData) : 0
  const latestMargins = marginsData.length > 0 ? getLatestValue(marginsData) : 0
  const latestPE = peRatioData.length > 0 ? getLatestValue(peRatioData) : 0
  const latestDividend = dividendYieldData.length > 0 ? getLatestValue(dividendYieldData) : 0
  const latestROI = roiData.length > 0 ? getLatestValue(roiData) : 0

  const epsChange = epsData.length > 0 ? calculateChange(epsData) : { direction: 'neutral', change: 0 }
  const revenueChange = revenueData.length > 0 ? calculateChange(revenueData) : { direction: 'neutral', change: 0 }
  const marginsChange = marginsData.length > 0 ? calculateChange(marginsData) : { direction: 'neutral', change: 0 }
  const peChange = peRatioData.length > 0 ? calculateChange(peRatioData) : { direction: 'neutral', change: 0 }
  const dividendChange = dividendYieldData.length > 0 ? calculateChange(dividendYieldData) : { direction: 'neutral', change: 0 }
  const roiChange = roiData.length > 0 ? calculateChange(roiData) : { direction: 'neutral', change: 0 }

  // Create corporate earnings factors with real-time data from APIs and update info
  const corporateEarningsFactors = [
    {
      id: "sp500-eps",
      title: "S&P 500 EPS",
      category: "Earnings Metrics",
      currentValue: loading ? "Loading..." : error ? "Error" : `$${latestEPS.toFixed(2)}`,
      change: loading ? "Loading..." : error ? "Error" : `${epsChange.direction === 'up' ? '+' : ''}${epsChange.change.toFixed(1)}%`,
      trend: loading || error ? "neutral" : epsChange.direction,
      description: "S&P 500 earnings per share showing corporate profitability trends",
      data: epsData,
      source: "S&P Global",
      score: 8.2,
      impact: "High",
      updateInfo: processUpdateInfo(corporateMetadata?.sp500eps)
    },
    {
      id: "revenue-growth",
      title: "Revenue Growth",
      category: "Growth Metrics",
      currentValue: loading ? "Loading..." : error ? "Error" : `${latestRevenue.toFixed(1)}%`,
      change: loading ? "Loading..." : error ? "Error" : `${revenueChange.direction === 'up' ? '+' : ''}${revenueChange.change.toFixed(1)}%`,
      trend: loading || error ? "neutral" : revenueChange.direction,
      description: "Year-over-year revenue growth for S&P 500 companies",
      data: revenueData,
      source: "FactSet Research",
      score: 7.8,
      impact: "High",
      updateInfo: processUpdateInfo(corporateMetadata?.revenue)
    },
    {
      id: "profit-margins",
      title: "Profit Margins",
      category: "Efficiency Metrics",
      currentValue: loading ? "Loading..." : error ? "Error" : `${latestMargins.toFixed(1)}%`,
      change: loading ? "Loading..." : error ? "Error" : `${marginsChange.direction === 'up' ? '+' : ''}${marginsChange.change.toFixed(1)}%`,
      trend: loading || error ? "neutral" : marginsChange.direction,
      description: "Net profit margins reflecting operational efficiency",
      data: marginsData,
      source: "Bloomberg",
      score: 7.5,
      impact: "Medium",
      updateInfo: processUpdateInfo(corporateMetadata?.margins)
    },
    {
      id: "pe-ratio",
      title: "P/E Ratio",
      category: "Valuation Metrics",
      currentValue: loading ? "Loading..." : error ? "Error" : `${latestPE.toFixed(1)}x`,
      change: loading ? "Loading..." : error ? "Error" : `${peChange.direction === 'up' ? '+' : ''}${peChange.change.toFixed(1)}%`,
      trend: loading || error ? "neutral" : peChange.direction,
      description: "Price-to-earnings ratio indicating market valuation levels",
      data: peRatioData,
      source: "S&P Global",
      score: 6.8,
      impact: "Medium",
      updateInfo: processUpdateInfo(corporateMetadata?.peRatio)
    },
    {
      id: "dividend-yield",
      title: "Dividend Yield",
      category: "Income Metrics",
      currentValue: loading ? "Loading..." : error ? "Error" : `${latestDividend.toFixed(2)}%`,
      change: loading ? "Loading..." : error ? "Error" : `${dividendChange.direction === 'up' ? '+' : ''}${dividendChange.change.toFixed(1)}%`,
      trend: loading || error ? "neutral" : dividendChange.direction,
      description: "Average dividend yield for S&P 500 companies",
      data: dividendYieldData,
      source: "S&P Dow Jones Indices",
      score: 7.2,
      impact: "Medium",
      updateInfo: processUpdateInfo(corporateMetadata?.dividendYield)
    },
    {
      id: "return-on-investment",
      title: "Return on Investment",
      category: "Performance Metrics",
      currentValue: loading ? "Loading..." : error ? "Error" : `${latestROI.toFixed(1)}%`,
      change: loading ? "Loading..." : error ? "Error" : `${roiChange.direction === 'up' ? '+' : ''}${roiChange.change.toFixed(1)}%`,
      trend: loading || error ? "neutral" : roiChange.direction,
      description: "Return on investment showing capital efficiency",
      data: roiData,
      source: "Morningstar",
      score: 7.9,
      impact: "High",
      updateInfo: processUpdateInfo(corporateMetadata?.roi)
    }
  ]

  // Calculate overall score
  const overallScore = (corporateEarningsFactors.reduce((sum, factor) => sum + (factor.score || 7), 0) / corporateEarningsFactors.length).toFixed(1)
  
  const getScoreColor = (score) => {
    if (score >= 8) return "text-green-600"
    if (score >= 6) return "text-yellow-600"  
    return "text-red-600"
  }

  const getScoreBadge = (score) => {
    if (score >= 8) return { label: "Strong", color: "bg-green-100 text-green-800" }
    if (score >= 6) return { label: "Moderate", color: "bg-yellow-100 text-yellow-800" }
    return { label: "Weak", color: "bg-red-100 text-red-800" }
  }

  const getTrendIcon = (trend) => {
    switch (trend) {
      case "up":
        return <TrendingUp className="h-4 w-4 text-green-500" />
      case "down":
        return <TrendingDown className="h-4 w-4 text-red-500" />
      default:
        return <Activity className="h-4 w-4 text-gray-400" />
    }
  }

  const getTrendColor = (trend) => {
    switch (trend) {
      case "up":
        return "text-green-600 dark:text-green-400"
      case "down":
        return "text-red-600 dark:text-red-400"
      default:
        return "text-gray-600 dark:text-gray-400"
    }
  }

  const handleFactorClick = (factor) => {
    setSelectedFactor(factor.id)
  }

  // Get selected factor data
  const getSelectedFactor = () => {
    return corporateEarningsFactors.find(factor => factor.id === selectedFactor) || corporateEarningsFactors[0]
  }

  // Navigation functions for factor switching
  const navigateToNextFactor = () => {
    const currentIndex = corporateEarningsFactors.findIndex(factor => factor.id === selectedFactor)
    const nextIndex = (currentIndex + 1) % corporateEarningsFactors.length
    setSelectedFactor(corporateEarningsFactors[nextIndex].id)
  }

  const navigateToPrevFactor = () => {
    const currentIndex = corporateEarningsFactors.findIndex(factor => factor.id === selectedFactor)
    const prevIndex = currentIndex === 0 ? corporateEarningsFactors.length - 1 : currentIndex - 1
    setSelectedFactor(corporateEarningsFactors[prevIndex].id)
  }

  // Category navigation functions
  const navigateToNextCategory = () => {
    const currentIndex = categories.findIndex(cat => cat.name === selectedCategory)
    const nextIndex = (currentIndex + 1) % categories.length
    const nextCategory = categories[nextIndex]
    router.push(`/analytics/${nextCategory.page}`)
  }

  const navigateToPrevCategory = () => {
    const currentIndex = categories.findIndex(cat => cat.name === selectedCategory)
    const prevIndex = currentIndex === 0 ? categories.length - 1 : currentIndex - 1
    const prevCategory = categories[prevIndex]
    router.push(`/analytics/${prevCategory.page}`)
  }

  // Get category info for display
  const currentCategory = getCurrentCategory()
  const currentCategoryIndex = categories.findIndex(cat => cat.name === selectedCategory)
  const totalCategories = categories.length

  const selectedFactorObject = getSelectedFactor()
  const selectedFactorData = selectedFactorObject && Array.isArray(selectedFactorObject.data) && selectedFactorObject.data.length > 0 ? 
    [getDataForPeriod(selectedFactorObject.data, selectedPeriod)] : []

  // Add source details for each factor
  const getSourceDetails = (factorId) => {
    switch (factorId) {
      case "sp500-eps":
        return {
          title: "S&P 500 Earnings Per Share",
          description: "Measures the profitability of S&P 500 companies by calculating earnings per share on a trailing twelve-month basis.",
          provider: "S&P Global",
          frequency: "Quarterly",
          availability: "1988 to Present",
          methodology: "Calculated as sum of earnings divided by shares outstanding for all S&P 500 constituent companies.",
          url: "https://www.spglobal.com/spdji/en/indices/equity/sp-500/",
          lastUpdated: "Updated quarterly after earnings season"
        }
      case "revenue-growth":
        return {
          title: "Revenue Growth",
          description: "Year-over-year revenue growth rate for S&P 500 companies, indicating business expansion and market demand.",
          provider: "FactSet Research",
          frequency: "Quarterly",
          availability: "1990 to Present",
          methodology: "Aggregated revenue data from company financial statements, calculated as YoY percentage change.",
          url: "https://www.factset.com/",
          lastUpdated: "Updated quarterly after earnings reports"
        }
      case "profit-margins":
        return {
          title: "Profit Margins",
          description: "Net profit margins showing operational efficiency and pricing power of corporations.",
          provider: "Bloomberg",
          frequency: "Quarterly",
          availability: "1985 to Present",
          methodology: "Net income divided by total revenue, averaged across S&P 500 companies by market capitalization.",
          url: "https://www.bloomberg.com/professional/",
          lastUpdated: "Updated quarterly with financial reports"
        }
      case "pe-ratio":
        return {
          title: "Price-to-Earnings Ratio",
          description: "Valuation metric comparing market price to earnings, indicating investor sentiment and market valuations.",
          provider: "S&P Global",
          frequency: "Daily",
          availability: "1870 to Present",
          methodology: "Market capitalization divided by trailing twelve-month earnings for the S&P 500 index.",
          url: "https://www.spglobal.com/spdji/en/",
          lastUpdated: "Updated daily with market close"
        }
      case "dividend-yield":
        return {
          title: "Dividend Yield",
          description: "Average dividend yield across S&P 500 companies, showing income generation potential.",
          provider: "S&P Dow Jones Indices",
          frequency: "Daily",
          availability: "1926 to Present",
          methodology: "Weighted average of dividend yields based on market capitalization of constituent companies.",
          url: "https://www.spglobal.com/spdji/en/",
          lastUpdated: "Updated daily with dividend declarations"
        }
      case "return-on-investment":
        return {
          title: "Return on Investment",
          description: "Measures how effectively companies use capital to generate profits and create shareholder value.",
          provider: "Morningstar",
          frequency: "Quarterly",
          availability: "1995 to Present",
          methodology: "Net income divided by total invested capital, averaged across S&P 500 companies.",
          url: "https://www.morningstar.com/",
          lastUpdated: "Updated quarterly with financial statements"
        }
      default:
        return {
          title: "Data Source",
          description: "Corporate earnings data source information",
          provider: "Financial Data Providers",
          frequency: "Varies",
          availability: "Historical data",
          methodology: "Standard financial metrics calculation",
          url: "#",
          lastUpdated: "Regular updates"
        }
    }
  }

  const getIconComponent = (factorId) => {
    switch (factorId) {
      case "sp500-eps":
        return DollarSign
      case "revenue-growth":
        return BarChart3
      case "profit-margins":
        return Calculator
      case "pe-ratio":
        return PieChart
      case "dividend-yield":
        return Target
      case "return-on-investment":
        return Building2
      default:
        return DollarSign
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6 bg-white dark:bg-[#0F0F12]">
        <div className="animate-pulse">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 bg-gray-200 dark:bg-gray-600 rounded-xl animate-pulse"></div>
            <div className="h-8 bg-gray-200 dark:bg-gray-600 rounded-lg w-64 animate-pulse"></div>
          </div>
          <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded-lg w-96 mb-2 animate-pulse"></div>
          <div className="flex gap-4 mb-8">
            <div className="h-8 bg-gray-100 dark:bg-gray-700 rounded-lg w-48 animate-pulse"></div>
            <div className="h-8 bg-gray-100 dark:bg-gray-700 rounded-lg w-32 animate-pulse"></div>
          </div>
          
          {/* Top Section: Score + Main Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-7 gap-6 mb-8">
            {/* Score Card Loading */}
            <div className="bg-white dark:bg-[#1F1F23] border border-gray-200 dark:border-[#2B2B30] rounded-xl shadow-lg lg:col-span-2 p-6 space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-6 w-6 bg-gray-200 dark:bg-gray-600 rounded-lg animate-pulse"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-24 animate-pulse"></div>
              </div>
              <div className="text-center space-y-3 p-4 bg-gray-50 dark:bg-[#0F0F12] rounded-xl">
                <div className="h-16 w-16 bg-gray-200 dark:bg-gray-600 rounded-full mx-auto animate-pulse"></div>
                <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-16 mx-auto animate-pulse"></div>
                <div className="h-6 bg-gray-200 dark:bg-gray-600 rounded w-20 mx-auto animate-pulse"></div>
              </div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-20 animate-pulse"></div>
                <div className="space-y-1">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-[#0F0F12] rounded-lg">
                      <div className="h-2 w-2 bg-gray-300 dark:bg-gray-600 rounded-full animate-pulse"></div>
                      <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded flex-1 animate-pulse"></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Main Chart Loading */}
            <div className="bg-white dark:bg-[#1F1F23] border border-gray-200 dark:border-[#2B2B30] rounded-xl shadow-lg lg:col-span-5 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="h-6 bg-gray-200 dark:bg-gray-600 rounded w-48 animate-pulse"></div>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                    <div key={i} className="h-8 w-12 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>
                  ))}
                </div>
              </div>
              <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-64 mb-4 animate-pulse"></div>
              <div className="h-80 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse"></div>
            </div>
          </div>
          
          {/* Bottom Section: Factor Grid */}
          <div className="space-y-4">
            <div className="h-6 bg-gray-200 dark:bg-gray-600 rounded-lg w-48 animate-pulse"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="bg-white dark:bg-[#1F1F23] border border-gray-200 dark:border-[#2B2B30] rounded-xl shadow-lg p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>
                      <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-32 animate-pulse"></div>
                    </div>
                    <div className="flex gap-2">
                      <div className="h-4 w-4 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>
                      <div className="h-4 w-4 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="h-8 bg-gray-200 dark:bg-gray-600 rounded w-20 animate-pulse"></div>
                    <div className="flex items-center gap-2">
                      <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-12 animate-pulse"></div>
                      <div className="h-6 bg-gray-200 dark:bg-gray-600 rounded w-12 animate-pulse"></div>
                    </div>
                  </div>
                  <div className="h-20 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse"></div>
                  <div className="space-y-2">
                    <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-full animate-pulse"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-3/4 animate-pulse"></div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="h-6 bg-gray-200 dark:bg-gray-600 rounded w-16 animate-pulse"></div>
                    <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-24 animate-pulse"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Show error state if there's an error
  if (error) {
    return (
      <div className="p-6 space-y-6 bg-white dark:bg-[#0F0F12]">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
          <div className="text-red-600 dark:text-red-400 text-lg font-semibold mb-2">
            Unable to load corporate earnings data
          </div>
          <p className="text-red-600 dark:text-red-400">
            Please check your internet connection and try again.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 fade-in bg-white dark:bg-[#0F0F12]">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl shadow-lg">
            <DollarSign className="h-6 w-6 text-white" />
          </div>
          Corporate Earnings Analysis
        </h1>
        <div className="flex flex-wrap justify-between items-center gap-4">
          <p className="text-gray-600 dark:text-gray-400">
            S&P 500 earnings, revenue growth, margins, and corporate profitability metrics
          </p>
          
          {/* Minimal Category Navigation */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={navigateToPrevCategory}
                className="h-6 w-6 p-0 hover:bg-gray-100 dark:hover:bg-gray-800"
                title="Previous"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCategoryGrid(!showCategoryGrid)}
                className={`h-6 w-6 p-0 ${showCategoryGrid ? 'bg-gray-100 dark:bg-gray-800' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                title="All Categories"
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={navigateToNextCategory}
                className="h-6 w-6 p-0 hover:bg-gray-100 dark:hover:bg-gray-800"
                title="Next"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Minimal Category Grid */}
      {showCategoryGrid && (
        <div className="mb-6 animate-in slide-in-from-top-2 duration-200">
          <Card className="border border-gray-200 dark:border-[#2B2B30] bg-white dark:bg-[#1F1F23]">
            <CardContent className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                {categories.map((category, index) => (
                  <Button
                    key={category.page}
                    variant={index === currentCategoryIndex ? "secondary" : "ghost"}
                    size="sm"
                    className={`h-auto p-2 justify-start gap-2 ${
                      index === currentCategoryIndex ? 'bg-blue-50 dark:bg-blue-950/20' : ''
                    }`}
                    onClick={() => {
                      router.push(`/analytics/${category.page}`)
                      setShowCategoryGrid(false)
                    }}
                  >
                    <div className={`p-1 bg-gradient-to-r ${category.color} rounded`}>
                      <category.icon className="h-3 w-3 text-white" />
                    </div>
                    <span className="text-xs font-medium truncate">{category.name}</span>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Top Section: Score + Main Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-7 gap-6 mb-8">
        {/* Left: Score & Analysis (1/4 width) */}
        <Card className="lg:col-span-2 slide-in-left stagger-1 hover:shadow-lg transition-all duration-200 cursor-pointer group border border-gray-200 dark:border-[#2B2B30] shadow-sm bg-white dark:bg-[#1F1F23] card-glow">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 group-hover:text-blue-600 transition-all duration-200 text-base font-semibold">
              <div className="p-1.5 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg shadow-md group-hover:scale-105 transition-transform duration-200">
                <Target className="h-4 w-4 text-white" />
              </div>
              Earnings Health
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Enhanced Score Display */}
            <div className="text-center group-hover:scale-105 transition-transform duration-300 p-3 bg-gray-50 dark:bg-[#0F0F12] rounded-xl border border-gray-200 dark:border-[#2B2B30]">
              <div className={`text-4xl font-black ${getScoreColor(parseFloat(overallScore))} drop-shadow-lg mb-2 tracking-tight`}>
                {overallScore}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-2">out of 10</div>
              <Badge className={`mt-1 px-3 py-1 text-xs font-semibold ${getScoreBadge(parseFloat(overallScore)).color} group-hover:shadow-md transition-all duration-300 hover:scale-105`}>
                {getScoreBadge(parseFloat(overallScore)).label}
              </Badge>
            </div>

            {/* Key Insights */}
            <div className="space-y-2">
              <h4 className="font-semibold text-gray-900 dark:text-white text-xs">Key Insights</h4>
              <div className="space-y-1 text-xs">
                <div className="flex items-start gap-2 hover:bg-gray-50 dark:hover:bg-[#0F0F12] p-1.5 rounded-lg transition-all duration-200 cursor-pointer">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-1.5 flex-shrink-0"></div>
                  <span className="leading-tight">Earnings growth strong</span>
                </div>
                <div className="flex items-start gap-2 hover:bg-gray-50 dark:hover:bg-[#0F0F12] p-1.5 rounded-lg transition-all duration-200 cursor-pointer">
                  <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full mt-1.5 flex-shrink-0"></div>
                  <span className="leading-tight">Margins under pressure</span>
                </div>
                <div className="flex items-start gap-2 hover:bg-gray-50 dark:hover:bg-[#0F0F12] p-1.5 rounded-lg transition-all duration-200 cursor-pointer">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1.5 flex-shrink-0"></div>
                  <span className="leading-tight">Valuations elevated</span>
                </div>
              </div>
            </div>

            {/* Corporate Outlook */}
            <div className="space-y-2">
              <h4 className="font-semibold text-gray-900 dark:text-white text-xs">Corporate Outlook</h4>
              <div className="space-y-1 text-xs">
                <div className="flex items-center justify-between hover:bg-gray-50 dark:hover:bg-[#0F0F12] p-1.5 rounded-lg transition-all duration-200 cursor-pointer">
                  <span>Earnings</span>
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs hover:shadow-md transition-all duration-200 hover:scale-105">Strong</Badge>
                </div>
                <div className="flex items-center justify-between hover:bg-gray-50 dark:hover:bg-[#0F0F12] p-1.5 rounded-lg transition-all duration-200 cursor-pointer">
                  <span>Revenue</span>
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs hover:shadow-md transition-all duration-200 hover:scale-105">Growing</Badge>
                </div>
                <div className="flex items-center justify-between hover:bg-gray-50 dark:hover:bg-[#0F0F12] p-1.5 rounded-lg transition-all duration-200 cursor-pointer">
                  <span>Valuation</span>
                  <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 text-xs hover:shadow-md transition-all duration-200 hover:scale-105">Elevated</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right: Main Chart (5/7 width) */}
        <Card className="lg:col-span-5 slide-in-right stagger-2 hover:shadow-lg transition-all duration-200 border border-gray-200 dark:border-[#2B2B30] shadow-sm bg-white dark:bg-[#1F1F23] card-glow">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-lg font-semibold">
              <div className="flex items-center gap-3">
                {selectedFactorObject ? (
                  <div className="flex items-center gap-2">
                    {(() => {
                      const IconComponent = getIconComponent(selectedFactorObject.id)
                      return <IconComponent className="h-5 w-5 text-blue-600" />
                    })()}
                    {selectedFactorObject.title}
                  </div>
                ) : (
                  <span>Select a factor to view detailed chart</span>
                )}
                {selectedFactorObject && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsFullScreen(true)}
                    className="h-8 w-8 p-0 ml-2 hover:bg-blue-50 dark:hover:bg-blue-900 hover:scale-105 transition-all duration-200 hover:shadow-md"
                    title="Full Screen"
                  >
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                {['1M', '6M', '1Y', '5Y', '10Y', '25Y', 'MAX'].map((period) => (
                  <Button
                    key={period}
                    variant={selectedPeriod === period ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePeriodChange(period)}
                    className={`timeframe-button transition-all text-xs duration-200 hover:scale-105 hover:shadow-md ${
                      selectedPeriod === period ? 'bg-blue-600 text-white shadow-lg' : ''
                    } ${isTransitioning ? 'pointer-events-none opacity-70' : ''}`}
                    disabled={isTransitioning}
                  >
                    {period}
                  </Button>
                ))}
              </div>
            </CardTitle>
            {selectedFactorObject && (
              <CardDescription className="flex flex-wrap items-center gap-4 text-sm mt-2">
                <span>
                  Current: {selectedFactorObject.currentValue} | 
                  <span className={`ml-1 ${getTrendColor(selectedFactorObject.trend)}`}>
                    {selectedFactorObject.change}
                  </span>
                </span>
                <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                  <span>Source: {selectedFactorObject.source}</span>
                </div>
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-80 w-full">
              {selectedFactorData && selectedFactorData.length > 0 && selectedFactorData[0].length > 0 ? (
                <MultiLineChart dataSets={selectedFactorData} />
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      <span>Loading chart data...</span>
                    </div>
                  ) : (
                    <span>No data available for this factor</span>
                  )}
                </div>
              )}
            </div>
            
            {/* Updated info with navigation buttons */}
            <div className="flex justify-between items-center mt-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                {selectedFactorObject?.updateInfo && (
                  <>
                    <span className={`flex items-center gap-1 px-2 py-1 bg-gray-50 dark:bg-[#1A1A1A] rounded-md border border-gray-200 dark:border-[#2B2B30] ${selectedFactorObject.updateInfo.statusColor}`}>
                      <Info className="h-4 w-4" />
                      Updated: {selectedFactorObject.updateInfo.lastUpdate}
                    </span>
                    <span className="flex items-center gap-1 px-2 py-1 bg-gray-50 dark:bg-[#1A1A1A] rounded-md border border-gray-200 dark:border-[#2B2B30]">
                      <Target className="h-4 w-4" />
                      Next Release: {selectedFactorObject.updateInfo.nextRelease}
                    </span>
                  </>
                )}
                {!selectedFactorObject?.updateInfo && (
                  <>
                    <span className="flex items-center gap-1 px-2 py-1 bg-gray-50 dark:bg-[#1A1A1A] rounded-md border border-gray-200 dark:border-[#2B2B30]">
                      <Info className="h-4 w-4" />
                      Updated: Loading...
                    </span>
                    <span className="flex items-center gap-1 px-2 py-1 bg-gray-50 dark:bg-[#1A1A1A] rounded-md border border-gray-200 dark:border-[#2B2B30]">
                      <Target className="h-4 w-4" />
                      Next Release: TBD
                    </span>
                  </>
                )}
              </div>
              
              {/* Factor Navigation Buttons */}
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={navigateToPrevFactor}
                  className="h-8 w-8 p-0 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                  title="Previous Factor"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={navigateToNextFactor}
                  className="h-8 w-8 p-0 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                  title="Next Factor"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Section: Factor Grid */}
      <div className="slide-in-up">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Corporate Earnings Factors</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {corporateEarningsFactors.map((factor, index) => {
            const IconComponent = getIconComponent(factor.id)
            return (
              <Card
                key={factor.id}
                className={`cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] hover:-translate-y-1 ${
                  selectedFactor === factor.id ? 'ring-2 ring-blue-500 shadow-lg scale-[1.02] bg-blue-50 dark:bg-blue-950/30' : ''
                } slide-in-up stagger-${(index % 6) + 1} border border-gray-200 dark:border-[#2B2B30] shadow-sm bg-white dark:bg-[#1F1F23] group card-glow h-full flex flex-col`}
                onClick={() => handleFactorClick(factor)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <IconComponent className="h-4 w-4" />
                      {factor.title}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      {getTrendIcon(factor.trend)}
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 hover:bg-gray-100 dark:hover:bg-[#0F0F12]"
                            title="View Source Details"
                          >
                            <Info className="h-3 w-3" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-lg bg-white dark:bg-[#1F1F23] border border-gray-200 dark:border-[#2B2B30]">
                          <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                              {(() => {
                                const IconComponent = getIconComponent(factor.id)
                                return <IconComponent className="h-5 w-5 text-blue-600" />
                              })()}
                              {getSourceDetails(factor.id).title}
                            </DialogTitle>
                            <DialogDescription asChild>
                              <div className="space-y-4 text-left">
                                <p className="text-sm text-gray-700 dark:text-gray-300">
                                  {getSourceDetails(factor.id).description}
                                </p>
                                <div className="space-y-3 text-sm">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <div className="font-semibold text-gray-900 dark:text-white">Provider</div>
                                      <div className="text-gray-600 dark:text-gray-400">{getSourceDetails(factor.id).provider}</div>
                                    </div>
                                    <div>
                                      <div className="font-semibold text-gray-900 dark:text-white">Frequency</div>
                                      <div className="text-gray-600 dark:text-gray-400">{getSourceDetails(factor.id).frequency}</div>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <div className="font-semibold text-gray-900 dark:text-white">Data Range</div>
                                      <div className="text-gray-600 dark:text-gray-400">{getSourceDetails(factor.id).availability}</div>
                                    </div>
                                    <div>
                                      <div className="font-semibold text-gray-900 dark:text-white">Updates</div>
                                      <div className="text-gray-600 dark:text-gray-400">{getSourceDetails(factor.id).lastUpdated}</div>
                                    </div>
                                  </div>
                                  <div>
                                    <div className="font-semibold text-gray-900 dark:text-white">Methodology</div>
                                    <div className="text-gray-600 dark:text-gray-400 text-xs leading-relaxed">{getSourceDetails(factor.id).methodology}</div>
                                  </div>
                                  <div className="pt-2 border-t border-gray-200 dark:border-[#2B2B30]">
                                    <a 
                                      href={getSourceDetails(factor.id).url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 hover:underline text-sm font-medium"
                                    >
                                      <ExternalLink className="h-4 w-4" />
                                      View Original Data Source
                                    </a>
                                  </div>
                                </div>
                              </div>
                            </DialogDescription>
                          </DialogHeader>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">
                      {factor.currentValue}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className={`text-base font-medium ${getTrendColor(factor.trend)}`}>
                        {factor.change}
                      </span>
                      <Badge className="text-sm bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-2 py-1">
                        {factor.score}/10
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 flex-1 flex flex-col">
                  <div className="h-20 mb-4 p-2 bg-transparent rounded-lg transition-all duration-300">
                    <MiniChart 
                      data={factor.data} 
                      trend={factor.trend} 
                    />
                  </div>
                  <div className="text-base text-gray-600 dark:text-gray-400 line-clamp-3 mb-3 group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors duration-300 leading-relaxed flex-1">
                    {factor.description}
                  </div>
                  
                  {/* Update Information */}
                  
                  <div className="flex items-center justify-between text-sm text-gray-500 mt-auto pt-2">
                    <div className="flex items-center gap-1">
                      <Badge className={`text-sm transition-all duration-300 hover:scale-105 ${factor.impact === 'High' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 hover:bg-red-200' : factor.impact === 'Medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 hover:bg-yellow-200' : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 hover:bg-green-200'} px-2 py-1`}>
                        {factor.impact}
                      </Badge>
                      <span>Impact</span>
                    </div>
                    <span className="truncate text-sm group-hover:text-gray-600 dark:group-hover:text-gray-400 transition-colors duration-300">{factor.source}</span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Full Screen Chart Modal */}
      <FullScreenChart
        isOpen={isFullScreen}
        onClose={() => setIsFullScreen(false)}
        selectedFactor={selectedFactorObject}
        getIconComponent={getIconComponent}
      />
    </div>
  )
}

export default CorporateEarnings
