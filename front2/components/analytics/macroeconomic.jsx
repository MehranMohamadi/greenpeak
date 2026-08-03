"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import MultiLineChart from "../charts/multi-line-chart"
import MiniChart from "./mini-chart"
import FullScreenChart from './fullscreen-chart'
import { LineChart, TrendingUp, TrendingDown, Activity, Users, Briefcase, Target, Zap, Building, Info, ExternalLink, Maximize2, Minimize2, ChevronLeft, ChevronRight, Grid3X3 } from "lucide-react"
import useMacroEcoData from "../../hooks/useMacroEcoData"
import { 
  getLatestValue, 
  calculateChange,
  getDataForPeriod,
  calculateChangeForPeriod
} from "../../hooks/macroeconomicDataUtils"
import useUpdateInfo from "../../hooks/useUpdateInfo"
import { analyticsCategories, getCategoryByName, getCategoryIndex } from "../../lib/analytics-utils"
import '../../styles/analytics-animations.css'

export default function Macroeconomic() {
  const router = useRouter()
  const [selectedFactor, setSelectedFactor] = useState('gdp-growth')
  const [selectedPeriod, setSelectedPeriod] = useState('5Y')
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState('Macroeconomic')
  const [showCategoryGrid, setShowCategoryGrid] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [prevPeriod, setPrevPeriod] = useState('MAX')

  // Use imported categories from utils
  const categories = analyticsCategories
  
  // Use update info hook
  const { processUpdateInfo } = useUpdateInfo()

  // Find current category based on page
  const getCurrentCategory = () => {
    return categories.find(cat => cat.page === 'macroeconomic') || categories[0]
  }
  
  // Use custom hooks to fetch data - now with metadata
  const { data: macroData, metadata: macroMetadata, loading, error } = useMacroEcoData()
  
  // Extract individual datasets
  const gdpData = macroData?.gdp || []
  const unrateData = macroData?.unemployment || []
  const payrollData = macroData?.payroll || []
  const confidenceData = macroData?.confidence || []
  const cpiData = macroData?.cpi || []
  const retailSalesData = macroData?.retailSales || []
  
  // Get current values and changes for main charts
  const latestGDP = gdpData.length > 0 ? getLatestValue(gdpData) : 0
  const latestUNRATE = unrateData.length > 0 ? getLatestValue(unrateData) : 0
  const latestPayroll = payrollData.length > 0 ? getLatestValue(payrollData) : 0
  const latestConfidence = confidenceData.length > 0 ? getLatestValue(confidenceData) : 0
  const latestCPI = cpiData.length > 0 ? getLatestValue(cpiData) : 0
  const latestRetailSales = retailSalesData.length > 0 ? getLatestValue(retailSalesData) : 0

  const gdpChange = gdpData.length > 0 ? calculateChangeForPeriod(gdpData, selectedPeriod) : { direction: 'neutral', change: 0 }
  const unrateChange = unrateData.length > 0 ? calculateChangeForPeriod(unrateData, selectedPeriod) : { direction: 'neutral', change: 0 }
  const payrollChange = payrollData.length > 0 ? calculateChangeForPeriod(payrollData, selectedPeriod) : { direction: 'neutral', change: 0 }
  const confidenceChange = confidenceData.length > 0 ? calculateChangeForPeriod(confidenceData, selectedPeriod) : { direction: 'neutral', change: 0 }
  const cpiChange = cpiData.length > 0 ? calculateChangeForPeriod(cpiData, selectedPeriod) : { direction: 'neutral', change: 0 }
  const retailSalesChange = retailSalesData.length > 0 ? calculateChangeForPeriod(retailSalesData, selectedPeriod) : { direction: 'neutral', change: 0 }

  // Create macroeconomic factors with real-time data from APIs and update info
  const macroeconomicFactors = [
    {
      id: "gdp-growth",
      title: "GDP Growth Rate",
      category: "Economic Growth",
      currentValue: loading ? "Loading..." : error ? "Error" : `${latestGDP.toFixed(1)}%`,
      change: loading ? "Loading..." : error ? "Error" : `${gdpChange.direction === 'up' ? '+' : ''}${gdpChange.change.toFixed(1)}%`,
      trend: loading || error ? "neutral" : gdpChange.direction,
      description: "Quarterly real GDP growth rate at seasonally adjusted annual rate",
      data: gdpData,
      source: "Bureau of Economic Analysis (BEA)",
      score: 7.5,
      impact: "High",
      updateInfo: processUpdateInfo(macroMetadata?.gdp)
    },
    {
      id: "unemployment-rate",
      title: "Unemployment Rate",
      category: "Labor Market", 
      currentValue: loading ? "Loading..." : error ? "Error" : `${latestUNRATE.toFixed(1)}%`,
      change: loading ? "Loading..." : error ? "Error" : `${unrateChange.direction === 'up' ? '+' : ''}${unrateChange.change.toFixed(1)}%`,
      trend: loading || error ? "neutral" : unrateChange.direction,
      description: "Unemployment rate as percentage of labor force (seasonally adjusted)",
      data: unrateData,
      source: "Bureau of Labor Statistics (BLS)",
      score: 8.0,
      impact: "High",
      updateInfo: processUpdateInfo(macroMetadata?.unemployment)
    },
    {
      id: "nonfarm-payrolls",
      title: "Nonfarm Payrolls",
      category: "Labor Market",
      currentValue: loading ? "Loading..." : error ? "Error" : latestPayroll > 0 ? `${(latestPayroll/1000).toFixed(0)}K` : "No Data",
      change: loading ? "Loading..." : error ? "Error" : payrollChange.change !== 0 ? `${payrollChange.direction === 'up' ? '+' : ''}${(payrollChange.change/1000).toFixed(0)}K` : "N/A",
      trend: loading || error ? "neutral" : payrollChange.direction,
      description: "Monthly change in total nonfarm payroll employment",
      data: payrollData,
      source: "Bureau of Labor Statistics (BLS)",
      score: 7.8,
      impact: "High",
      updateInfo: processUpdateInfo(macroMetadata?.payroll)
    },
    {
      id: "consumer-confidence",
      title: "Consumer Confidence",
      category: "Sentiment",
      currentValue: loading ? "Loading..." : error ? "Error" : `${latestConfidence.toFixed(1)}`,
      change: loading ? "Loading..." : error ? "Error" : `${confidenceChange.direction === 'up' ? '+' : ''}${confidenceChange.change.toFixed(1)}`,
      trend: loading || error ? "neutral" : confidenceChange.direction,
      description: "Consumer confidence index measuring optimism about economic conditions",
      data: confidenceData,
      source: "Conference Board",
      score: 6.5,
      impact: "Medium",
      updateInfo: processUpdateInfo(macroMetadata?.confidence)
    },
    {
      id: "cpi-inflation",
      title: "CPI Inflation",
      category: "Inflation",
      currentValue: loading ? "Loading..." : error ? "Error" : `${latestCPI.toFixed(1)}%`,
      change: loading ? "Loading..." : error ? "Error" : `${cpiChange.direction === 'up' ? '+' : ''}${cpiChange.change.toFixed(1)}%`,
      trend: loading || error ? "neutral" : cpiChange.direction,
      description: "Consumer Price Index year-over-year inflation rate",
      data: cpiData,
      source: "Bureau of Labor Statistics (BLS)",
      score: 7.2,
      impact: "High",
      updateInfo: processUpdateInfo(macroMetadata?.cpi)
    },
    {
      id: "retail-sales",
      title: "Retail Sales",
      category: "Consumer Spending",
      currentValue: loading ? "Loading..." : error ? "Error" : `${latestRetailSales.toFixed(1)}%`,
      change: loading ? "Loading..." : error ? "Error" : `${retailSalesChange.direction === 'up' ? '+' : ''}${retailSalesChange.change.toFixed(1)}%`,
      trend: loading || error ? "neutral" : retailSalesChange.direction,
      description: "Monthly retail and food services sales growth (seasonally adjusted)",
      data: retailSalesData,
      source: "US Census Bureau",
      score: 6.8,
      impact: "Medium",
      updateInfo: processUpdateInfo(macroMetadata?.retailSales)
    }
  ]

  // Calculate overall score
  const overallScore = (macroeconomicFactors.reduce((sum, factor) => sum + (factor.score || 7), 0) / macroeconomicFactors.length).toFixed(1)
  
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
    if (isTransitioning) return
    setSelectedFactor(factor.id)
  }

  // Handle period change with smooth transition
  const handlePeriodChange = (period) => {
    if (isTransitioning || selectedPeriod === period) return
    
    setIsTransitioning(true)
    setSelectedPeriod(period)
    
    // Reset transition state after animation completes
    setTimeout(() => {
      setIsTransitioning(false)
    }, 300)
  }

  // Get selected factor data
  const getSelectedFactor = () => {
    return macroeconomicFactors.find(factor => factor.id === selectedFactor) || macroeconomicFactors[0]
  }

  // Navigation functions for factor switching
  const navigateToNextFactor = () => {
    if (isTransitioning) return
    const currentIndex = macroeconomicFactors.findIndex(factor => factor.id === selectedFactor)
    const nextIndex = (currentIndex + 1) % macroeconomicFactors.length
    setSelectedFactor(macroeconomicFactors[nextIndex].id)
  }

  const navigateToPrevFactor = () => {
    if (isTransitioning) return
    const currentIndex = macroeconomicFactors.findIndex(factor => factor.id === selectedFactor)
    const prevIndex = currentIndex === 0 ? macroeconomicFactors.length - 1 : currentIndex - 1
    setSelectedFactor(macroeconomicFactors[prevIndex].id)
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
      case "gdp-growth":
        return {
          title: "GDP Growth Rate",
          description: "Gross Domestic Product measures the total value of all goods and services produced in the economy. Growth rate shows quarterly change at seasonally adjusted annual rate.",
          provider: "Bureau of Economic Analysis (BEA)",
          frequency: "Quarterly",
          availability: "1947 to Present",
          methodology: "Real GDP is adjusted for inflation using chain-weighted price indexes. Growth rates are calculated as annualized percent change from previous quarter.",
          url: "https://fred.stlouisfed.org/series/GDPC1",
          lastUpdated: "Updated quarterly, about 3 weeks after quarter end"
        }
      case "unemployment-rate":
        return {
          title: "Unemployment Rate",
          description: "The unemployment rate represents the number of unemployed as a percentage of the labor force. Based on monthly household survey data.",
          provider: "Bureau of Labor Statistics (BLS)",
          frequency: "Monthly",
          availability: "1948 to Present", 
          methodology: "Calculated from Current Population Survey. Unemployed persons are those who had no employment, were available for work, and made specific efforts to find employment.",
          url: "https://fred.stlouisfed.org/series/UNRATE",
          lastUpdated: "Updated monthly, first Friday of the month"
        }
      case "nonfarm-payrolls":
        return {
          title: "Nonfarm Payrolls",
          description: "Total nonfarm payroll employment measures the number of paid employees working part-time or full-time in business and government establishments.",
          provider: "Bureau of Labor Statistics (BLS)",
          frequency: "Monthly",
          availability: "1939 to Present",
          methodology: "Based on establishment survey covering approximately 650,000 business establishments. Excludes agricultural workers, self-employed, and government military personnel.",
          url: "https://fred.stlouisfed.org/series/PAYEMS",
          lastUpdated: "Updated monthly, first Friday of the month"
        }
      case "consumer-confidence":
        return {
          title: "Consumer Confidence Index",
          description: "Measures consumer optimism about the state of the economy based on surveys of household spending and saving intentions.",
          provider: "Conference Board",
          frequency: "Monthly",
          availability: "1967 to Present",
          methodology: "Based on survey of 3,000 households across US. Index compares current conditions to baseline year 1985=100. Includes present situation and expectations components.",
          url: "https://fred.stlouisfed.org/series/CSCICP03USM665S",
          lastUpdated: "Updated monthly, last Tuesday of the month"
        }
      case "cpi-inflation":
        return {
          title: "Consumer Price Index",
          description: "Measures the average change in prices paid by consumers for goods and services. Primary inflation gauge used by Federal Reserve for policy decisions.",
          provider: "Bureau of Labor Statistics (BLS)",
          frequency: "Monthly",
          availability: "1947 to Present",
          methodology: "Based on prices of about 80,000 items collected monthly from 23,000 retail and service establishments. Covers all urban consumers (about 93% of US population).",
          url: "https://fred.stlouisfed.org/series/CPIAUCSL",
          lastUpdated: "Updated monthly, mid-month"
        }
      case "retail-sales":
        return {
          title: "Retail Sales",
          description: "Total receipts of retail stores, providing insight into consumer spending patterns and economic health.",
          provider: "US Census Bureau",
          frequency: "Monthly",
          availability: "1992 to Present",
          methodology: "Based on Monthly Retail Trade Survey covering approximately 5,500 retail and food service firms. Seasonally adjusted to remove typical monthly variation.",
          url: "https://fred.stlouisfed.org/series/RSAFS",
          lastUpdated: "Updated monthly, mid-month"
        }
      default:
        return {
          title: "Data Source",
          description: "Economic data source information",
          provider: "Federal Reserve Economic Data",
          frequency: "Varies",
          availability: "Historical data",
          methodology: "Standard economic data collection",
          url: "#",
          lastUpdated: "Regular updates"
        }
    }
  }

  const getIconComponent = (factorId) => {
    switch (factorId) {
      case "gdp-growth":
        return LineChart
      case "unemployment-rate":
        return Users
      case "nonfarm-payrolls":
        return Briefcase
      case "consumer-confidence":
        return Target
      case "cpi-inflation":
        return Zap
      case "retail-sales":
        return Building
      default:
        return LineChart
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
            Unable to load macroeconomic data
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
          <div className="p-2 bg-gradient-to-br from-green-600 to-emerald-600 rounded-xl shadow-lg">
            <LineChart className="h-6 w-6 text-white" />
          </div>
          Macroeconomic Analysis
        </h1>
        <div className="flex flex-wrap justify-between items-center gap-4">
          <p className="text-gray-600 dark:text-gray-400">
            GDP growth, employment, inflation, and economic health indicators
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
            <CardTitle className="flex items-center gap-2 group-hover:text-green-600 transition-all duration-200 text-base font-semibold">
              <div className="p-1.5 bg-gradient-to-br from-green-600 to-emerald-600 rounded-lg shadow-md group-hover:scale-105 transition-transform duration-200">
                <Target className="h-4 w-4 text-white" />
              </div>
              Economic Health
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
                  <span className="leading-tight">Labor market resilient</span>
                </div>
                <div className="flex items-start gap-2 hover:bg-gray-50 dark:hover:bg-[#0F0F12] p-1.5 rounded-lg transition-all duration-200 cursor-pointer">
                  <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full mt-1.5 flex-shrink-0"></div>
                  <span className="leading-tight">Inflation moderating</span>
                </div>
                <div className="flex items-start gap-2 hover:bg-gray-50 dark:hover:bg-[#0F0F12] p-1.5 rounded-lg transition-all duration-200 cursor-pointer">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1.5 flex-shrink-0"></div>
                  <span className="leading-tight">Consumer spending stable</span>
                </div>
              </div>
            </div>

            {/* Economic Outlook */}
            <div className="space-y-2">
              <h4 className="font-semibold text-gray-900 dark:text-white text-xs">Economic Outlook</h4>
              <div className="space-y-1 text-xs">
                <div className="flex items-center justify-between hover:bg-gray-50 dark:hover:bg-[#0F0F12] p-1.5 rounded-lg transition-all duration-200 cursor-pointer">
                  <span>Growth</span>
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs hover:shadow-md transition-all duration-200 hover:scale-105">Stable</Badge>
                </div>
                <div className="flex items-center justify-between hover:bg-gray-50 dark:hover:bg-[#0F0F12] p-1.5 rounded-lg transition-all duration-200 cursor-pointer">
                  <span>Employment</span>
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs hover:shadow-md transition-all duration-200 hover:scale-105">Strong</Badge>
                </div>
                <div className="flex items-center justify-between hover:bg-gray-50 dark:hover:bg-[#0F0F12] p-1.5 rounded-lg transition-all duration-200 cursor-pointer">
                  <span>Inflation</span>
                  <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 text-xs hover:shadow-md transition-all duration-200 hover:scale-105">Moderate</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right: Main Chart (3/4 width) */}
        <Card className="lg:col-span-5 slide-in-right stagger-2 hover:shadow-lg transition-all duration-200 border border-gray-200 dark:border-[#2B2B30] shadow-sm bg-white dark:bg-[#1F1F23] card-glow">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-lg font-semibold">
              <div className="flex items-center gap-3">
                {selectedFactorObject ? (
                  <div className="flex items-center gap-2">
                    {(() => {
                      const IconComponent = getIconComponent(selectedFactorObject.id)
                      return <IconComponent className="h-5 w-5 text-green-600" />
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
                    className="h-8 w-8 p-0 ml-2 hover:bg-green-50 dark:hover:bg-green-900 hover:scale-105 transition-all duration-200 hover:shadow-md"
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
                    className={`timeframe-button  text-xs transition-all duration-200 hover:scale-105 hover:shadow-md ${
                      selectedPeriod === period ? 'bg-green-600 text-white shadow-lg' : ''
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
            <div className={`h-80 w-full chart-transition ${isTransitioning ? 'transitioning' : ''}`}>
              {selectedFactorData && selectedFactorData.length > 0 && selectedFactorData[0].length > 0 ? (
                <MultiLineChart dataSets={selectedFactorData} />
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
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
                  className="h-8 w-8 p-0 hover:bg-green-50 dark:hover:bg-green-950/30"
                  title="Previous Factor"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={navigateToNextFactor}
                  className="h-8 w-8 p-0 hover:bg-green-50 dark:hover:bg-green-950/30"
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
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Macroeconomic Factors</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {macroeconomicFactors.map((factor, index) => {
            const IconComponent = getIconComponent(factor.id)
            return (
              <Card
                key={factor.id}
                className={`cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] hover:-translate-y-1 ${
                  selectedFactor === factor.id ? 'ring-2 ring-green-500 shadow-lg scale-[1.02] bg-green-50 dark:bg-green-950/30' : ''
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
                                return <IconComponent className="h-5 w-5 text-green-600" />
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
                      <Badge className="text-sm bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-2 py-1">
                        {factor.score}/10
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 flex-1 flex flex-col">
                  <div className={`h-20 mb-4 p-2 bg-transparent rounded-lg transition-all duration-300 mini-chart-container ${
                    selectedFactor === factor.id ? 'selected' : ''
                  }`}>
                    <MiniChart 
                      data={getDataForPeriod(factor.data, selectedPeriod)}
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