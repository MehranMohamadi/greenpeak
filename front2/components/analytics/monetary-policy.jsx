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
import RateFeatureCard from "./rate-feature-card"
import DomainUnderstandingPanel from "./domain-understanding-panel"
import { DollarSign, TrendingUp, TrendingDown, Activity, Target, ExternalLink, Info, Maximize2, Minimize2, ChevronLeft, ChevronRight, Grid3X3, Zap, Brain } from "lucide-react"
import CategoryGrid from "../analytics/category-grid"
import MainLoading from '@/components/ui/MainLoading'
import useDFFData from "../../hooks/useDFFData"
import useTenYearData from "../../hooks/useTenYearData"
import useWALCLData from "../../hooks/useWALCLData"
import useSOFRData from "../../hooks/useSOFRData"
import useRealInterestRateData from "../../hooks/useRealInterestRateData"
import { 
  calculateChangeForPeriod,
  processDFFData,
  processTenYearData,
  processWALCLData,
  processSOFRData,
  processRealInterestRateData,
  getDataForPeriod
} from "../../hooks/monetaryDataUtils"
import useUpdateInfo from "../../hooks/useUpdateInfo"
import { analyticsCategories } from "../../lib/analytics-utils"

export default function MonetaryPolicy() {
  const router = useRouter()
  const [selectedFactor, setSelectedFactor] = useState('ten-year-treasury')
  const [selectedPeriod, setSelectedPeriod] = useState('5Y')
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState('Monetary Policy')
  const [showCategoryGrid, setShowCategoryGrid] = useState(false)

  // Use imported categories from utils
  const categories = analyticsCategories
  
  // Use update info hook
  const { processUpdateInfo } = useUpdateInfo()

  // Find current category based on page
  const getCurrentCategory = () => {
    return categories.find(cat => cat.page === 'monetary-policy') || categories[0]
  }
  
  // Use custom hooks to fetch data - now with metadata
  const { data: dffData, metadata: dffMetadata, loading: dffLoading, error: dffError } = useDFFData()
  const { data: tenYearData, metadata: tenYearMetadata, loading: tenYearLoading, error: tenYearError } = useTenYearData()
  const { data: walclData, metadata: walclMetadata, loading: walclLoading, error: walclError } = useWALCLData()
  const { data: sofrData, metadata: sofrMetadata, loading: sofrLoading, error: sofrError } = useSOFRData()
  const { data: realRateData, metadata: realRateMetadata, loading: realRateLoading, error: realRateError } = useRealInterestRateData()
  
  // Loading and error states
  const loading = dffLoading || tenYearLoading || walclLoading || sofrLoading || realRateLoading
  const error = dffError || tenYearError || walclError || sofrError || realRateError
  
  // Process API data for charts using utility functions - Apply timeframe to ALL data
  const processedDFFData = dffData ? getDataForPeriod(processDFFData(dffData, true, selectedPeriod), selectedPeriod) : []
  const processedTenYearData = tenYearData ? getDataForPeriod(processTenYearData(tenYearData), selectedPeriod) : []
  const processedWALCLData = walclData ? getDataForPeriod(processWALCLData(walclData), selectedPeriod) : []
  const processedSOFRData = sofrData ? getDataForPeriod(processSOFRData(sofrData), selectedPeriod) : []
  const processedRealRateData = realRateData ? getDataForPeriod(processRealInterestRateData(realRateData), selectedPeriod) : []

  // Get current values and changes for main charts (using processed data)
  const latestDFF = processedDFFData.length > 0 ? processedDFFData[processedDFFData.length - 1].value : 0
  const latestTenYear = processedTenYearData.length > 0 ? processedTenYearData[processedTenYearData.length - 1].value : 0
  const latestWALCL = processedWALCLData.length > 0 ? processedWALCLData[processedWALCLData.length - 1].value : 0

  // Calculate changes based on selected timeframe
  const dffChange = processedDFFData.length > 0 ? calculateChangeForPeriod(processedDFFData, selectedPeriod) : { direction: 'neutral', change: 0 }
  const tenYearChange = processedTenYearData.length > 0 ? calculateChangeForPeriod(processedTenYearData, selectedPeriod) : { direction: 'neutral', change: 0 }
  const walclChange = processedWALCLData.length > 0 ? calculateChangeForPeriod(processedWALCLData, selectedPeriod) : { direction: 'neutral', change: 0 }

  // Get latest values for SOFR and Real Interest Rate from API data
  const latestSOFR = processedSOFRData.length > 0 ? processedSOFRData[processedSOFRData.length - 1].value : 0
  const latestRealRate = processedRealRateData.length > 0 ? processedRealRateData[processedRealRateData.length - 1].value : 0

  const sofrChange = processedSOFRData.length > 0 ? calculateChangeForPeriod(processedSOFRData, selectedPeriod) : { direction: 'neutral', change: 0 }
  const realRateChange = processedRealRateData.length > 0 ? calculateChangeForPeriod(processedRealRateData, selectedPeriod) : { direction: 'neutral', change: 0 }

  // Create monetary factors with real-time data from APIs and update info
  const monetaryFactors = [
    {
      id: "ten-year-treasury",
      title: "10-Year Treasury Yield",
      category: "Interest Rates",
      currentValue: loading ? "Loading..." : error ? "Error" : `${latestTenYear.toFixed(2)}%`,
      change: loading ? "Loading..." : error ? "Error" : `${tenYearChange.direction === 'up' ? '+' : ''}${tenYearChange.change.toFixed(2)}%`,
      trend: loading || error ? "neutral" : tenYearChange.direction,
      description: "10-year U.S. Treasury constant maturity rate",
      data: processedTenYearData, // Now uses timeframe-filtered data
      source: "Federal Reserve Economic Data (FRED)",
      score: 6.8,
      impact: "High",
      updateInfo: processUpdateInfo(tenYearMetadata)
    },
    {
      id: "fed-funds-rate",
      title: "Federal Funds Rate",
      category: "Interest Rates",
      currentValue: loading ? "Loading..." : error ? "Error" : `${latestDFF.toFixed(2)}%`,
      change: loading ? "Loading..." : error ? "Error" : `${dffChange.direction === 'up' ? '+' : ''}${dffChange.change.toFixed(2)}%`,
      trend: loading || error ? "neutral" : dffChange.direction,
      description: "The interest rate set by the Federal Reserve",
      data: processedDFFData, // Now uses timeframe-filtered data
      source: "Federal Reserve Economic Data (FRED)",
      score: 7.2,
      impact: "High",
      updateInfo: processUpdateInfo(dffMetadata)
    },
    {
      id: "fed-balance-sheet",
      title: "Federal Reserve Balance Sheet",
      category: "Monetary Policy",
      currentValue: loading ? "Loading..." : error ? "Error" : latestWALCL > 0 ? `$${latestWALCL.toFixed(1)}T` : "No Data",
      change: loading ? "Loading..." : error ? "Error" : walclChange.change !== 0 ? `${walclChange.direction === 'up' ? '+' : ''}${walclChange.change.toFixed(2)}%` : "N/A",
      trend: loading || error ? "neutral" : walclChange.direction,
      description: "Total assets held by the Federal Reserve",
      data: processedWALCLData, // Now uses timeframe-filtered data
      source: "Board of Governors of the Federal Reserve System (US)",
      score: 6.2,
      impact: "High",
      updateInfo: processUpdateInfo(walclMetadata)
    },
    {
      id: "sofr-rate",
      title: "SOFR Rate",
      category: "Interest Rates",
      currentValue: loading ? "Loading..." : error ? "Error" : `${latestSOFR.toFixed(2)}%`,
      change: loading ? "Loading..." : error ? "Error" : `${sofrChange.direction === 'up' ? '+' : ''}${sofrChange.change.toFixed(2)}%`,
      trend: loading || error ? "neutral" : sofrChange.direction,
      description: "Secured Overnight Financing Rate - key benchmark for USD derivatives",
      data: processedSOFRData, // Now uses timeframe-filtered data
      source: "Federal Reserve Economic Data (FRED)",
      score: 6.5,
      impact: "Medium",
      updateInfo: processUpdateInfo(sofrMetadata)
    },
    {
      id: "real-interest-rate",
      title: "Real Interest Rate",
      category: "Interest Rates",
      currentValue: loading ? "Loading..." : error ? "Error" : `${latestRealRate.toFixed(2)}%`,
      change: loading ? "Loading..." : error ? "Error" : `${realRateChange.direction === 'up' ? '+' : ''}${realRateChange.change.toFixed(2)}%`,
      trend: loading || error ? "neutral" : realRateChange.direction,
      description: "Inflation-adjusted interest rate showing real borrowing costs",
      data: processedRealRateData, // Now uses timeframe-filtered data
      source: "Calculated (Nominal Rate - Inflation)",
      score: 7.0,
      impact: "High",
      updateInfo: processUpdateInfo(realRateMetadata)
    }
  ]

  // Calculate overall score
  const overallScore = (monetaryFactors.reduce((sum, factor) => sum + (factor.score || 7), 0) / monetaryFactors.length).toFixed(1)
  
  const getScoreColor = (score) => {
    if (score >= 8) return "text-green-600"
    if (score >= 6) return "text-yellow-600"  
    return "text-red-600"
  }

  const getScoreBadge = (score) => {
    if (score >= 8) return { label: "Accommodative", color: "bg-green-100 text-green-800" }
    if (score >= 6) return { label: "Neutral", color: "bg-yellow-100 text-yellow-800" }
    return { label: "Restrictive", color: "bg-red-100 text-red-800" }
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

  const handlePeriodChange = (newPeriod) => {
    if (newPeriod === selectedPeriod) return
    setSelectedPeriod(newPeriod)
  }

  // Get selected factor data
  const getSelectedFactor = () => {
    return monetaryFactors.find(factor => factor.id === selectedFactor) || monetaryFactors[0]
  }

  // Navigation functions for factor switching
  const navigateToNextFactor = () => {
    const currentIndex = monetaryFactors.findIndex(factor => factor.id === selectedFactor)
    const nextIndex = (currentIndex + 1) % monetaryFactors.length
    setSelectedFactor(monetaryFactors[nextIndex].id)
  }

  const navigateToPrevFactor = () => {
    const currentIndex = monetaryFactors.findIndex(factor => factor.id === selectedFactor)
    const prevIndex = currentIndex === 0 ? monetaryFactors.length - 1 : currentIndex - 1
    setSelectedFactor(monetaryFactors[prevIndex].id)
  }

  // Get period description for change display
  const getPeriodDescription = (period) => {
    switch (period) {
      case '1M': return '1 month'
      case '3M': return '3 months'
      case '6M': return '6 months'
      case '1Y': return '1 year'
      case '5Y': return '5 years'
      case '10Y': return '10 years'
      case '25Y': return '25 years'
      case 'MAX': return 'inception'
      default: return 'period'
    }
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
  // Fix timeframe synchronization for selected factor data
  const selectedFactorData = selectedFactorObject && Array.isArray(selectedFactorObject.data) && selectedFactorObject.data.length > 0 ? 
    [selectedFactorObject.data] : []

  // Add source details for each factor
  const getSourceDetails = (factorId) => {
    switch (factorId) {
      case "fed-funds-rate":
        return {
          title: "Federal Funds Rate",
          description: "The interest rate at which depository institutions trade federal funds with each other overnight. This rate influences borrowing costs throughout the economy and is the primary tool of U.S. monetary policy.",
          provider: "Federal Reserve Economic Data (FRED)",
          frequency: "Daily",
          availability: "1954 to Present",
          methodology: "The effective federal funds rate is a volume-weighted median of overnight federal funds transactions.",
          url: "https://fred.stlouisfed.org/series/DFF",
          lastUpdated: "Updated daily"
        }
      case "ten-year-treasury":
        return {
          title: "10-Year Treasury Yield",
          description: "The yield on 10-year U.S. Treasury constant maturity securities. This benchmark rate reflects long-term interest rate expectations and is widely used for mortgage rates and corporate borrowing costs.",
          provider: "Federal Reserve Economic Data (FRED)",
          frequency: "Daily",
          availability: "1962 to Present", 
          methodology: "Yields are interpolated by the U.S. Treasury from the daily yield curve based on closing market bid yields on actively traded Treasury securities.",
          url: "https://fred.stlouisfed.org/series/DGS10",
          lastUpdated: "Updated daily"
        }
      case "fed-balance-sheet":
        return {
          title: "Federal Reserve Balance Sheet",
          description: "Total assets held by the Federal Reserve System, including Treasury securities, mortgage-backed securities, and other financial instruments. Reflects the scale of Fed monetary policy operations.",
          provider: "Board of Governors of the Federal Reserve System",
          frequency: "Weekly",
          availability: "2002 to Present",
          methodology: "Consolidated balance sheet of all 12 Federal Reserve Banks, including securities held outright, repurchase agreements, and other assets.",
          url: "https://fred.stlouisfed.org/series/WALCL",
          lastUpdated: "Updated weekly on Thursdays"
        }
      case "sofr-rate":
        return {
          title: "SOFR Rate (Secured Overnight Financing Rate)",
          description: "A broad measure of the cost of borrowing cash overnight collateralized by Treasury securities. SOFR is the preferred alternative to LIBOR for USD derivatives and loans.",
          provider: "Federal Reserve Economic Data (FRED)",
          frequency: "Daily",
          availability: "2018 to Present",
          methodology: "Volume-weighted median of transaction-level repo data collected from the Bank of New York Mellon's tri-party repo platform and data from DTCC's GCF Repo service.",
          url: "https://fred.stlouisfed.org/series/SOFR",
          lastUpdated: "Updated daily"
        }
      case "real-interest-rate":
        return {
          title: "Real Interest Rate",
          description: "Inflation-adjusted interest rate calculated as nominal rate minus expected or actual inflation. Represents the true cost of borrowing and real return to savers.",
          provider: "Calculated (Nominal Rate - Inflation)",
          frequency: "Monthly",
          availability: "Historical estimates from 2000",
          methodology: "Real rate = Nominal 10-Year Treasury Yield - Core PCE Inflation Rate. Forward-looking estimates use market-based inflation expectations.",
          url: "https://fred.stlouisfed.org/series/REAINTRATREARAT10Y",
          lastUpdated: "Updated monthly"
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
      case "fed-funds-rate":
        return DollarSign
      case "ten-year-treasury":
        return Activity
      case "fed-balance-sheet":
        return Target
      case "real-interest-rate":
        return Brain
      case "sofr-rate":
        return Zap
      default:
        return DollarSign
    }
  }

  if (loading) {
     return <MainLoading />
  }

  // Show error state if there's an error
  if (error) {
    return (
      <div className="p-6 space-y-6 bg-white dark:bg-[#0F0F12]">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
          <div className="text-red-600 dark:text-red-400 text-lg font-semibold mb-2">
            Unable to load monetary policy data
          </div>
          <p className="text-red-600 dark:text-red-400">
            Please check your internet connection and try again.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 bg-white dark:bg-[#0F0F12]">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl shadow-lg">
            <DollarSign className="h-6 w-6 text-white" />
          </div>
          Monetary Policy Analysis
        </h1>
        <div className="flex flex-wrap justify-between items-center gap-4">
          <p className="text-gray-600 dark:text-gray-400">
            Federal Reserve policy tools, interest rates, and monetary conditions
          </p>
          
          {/* Minimal Category Navigation */}
          <div className="flex items-center gap-2">

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={navigateToPrevCategory}
                className="h-15 w-15 p-0 hover:bg-gray-100 dark:hover:bg-gray-800"
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
                className="h-15 w-15 p-0 hover:bg-gray-100 dark:hover:bg-gray-800"
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
     <CategoryGrid
  selectedCategory={selectedCategory}
  show={showCategoryGrid}
  onClose={() => setShowCategoryGrid(false)}
/>
      )}

      {/* Top Section: Score + Main Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-7 gap-6 mb-8">
        {/* Left: Score & Analysis (2/7 width) */}
        <Card className="lg:col-span-2 cursor-pointer border border-gray-200 dark:border-[#2B2B30] shadow-sm bg-white dark:bg-[#1F1F23]">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <div className="p-1.5 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg shadow-md">
                <Target className="h-4 w-4 text-white" />
              </div>
              Policy Stance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <DomainUnderstandingPanel domainId="monetary_liquidity" />
            {/* Enhanced Score Display */}
            <div className="text-center p-3 bg-gray-50 dark:bg-[#0F0F12] rounded-xl border border-gray-200 dark:border-[#2B2B30]">
                  <div className={`text-4xl font-black ${getScoreColor(parseFloat(overallScore))} mb-2 tracking-tight`}>
                {overallScore}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-2">out of 10</div>
              <Badge className={`mt-1 px-3 py-1 text-xs font-semibold ${getScoreBadge(parseFloat(overallScore)).color}`}>
                {getScoreBadge(parseFloat(overallScore)).label}
              </Badge>
            </div>

            {/* Key Insights */}
            <div className="space-y-2">
              <h4 className="font-semibold text-gray-900 dark:text-white text-xs">Key Insights</h4>
              <div className="space-y-1 text-xs">
                <div className="flex items-start gap-2 p-1.5 rounded-lg">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1.5 flex-shrink-0"></div>
                  <span className="leading-tight">Fed funds rate restrictive</span>
                </div>
                <div className="flex items-start gap-2 p-1.5 rounded-lg">
                  <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full mt-1.5 flex-shrink-0"></div>
                  <span className="leading-tight">Balance sheet normalization</span>
                </div>
                <div className="flex items-start gap-2 p-1.5 rounded-lg">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-1.5 flex-shrink-0"></div>
                  <span className="leading-tight">Real rates positive</span>
                </div>
              </div>
            </div>

            {/* Policy Outlook */}
            <div className="space-y-2">
              <h4 className="font-semibold text-gray-900 dark:text-white text-xs">Policy Outlook</h4>
              <div className="space-y-1 text-xs">
                <div className="flex items-center justify-between p-1.5 rounded-lg">
                  <span>Rate Cuts</span>
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs">Yes</Badge>
                </div>
                <div className="flex items-center justify-between p-1.5 rounded-lg">
                  <span>QT Continue</span>
                  <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 text-xs">Likely</Badge>
                </div>
                <div className="flex items-center justify-between p-1.5 rounded-lg">
                  <span>Policy Risk</span>
                  <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs">Medium</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right: Main Chart (5/7 width) */}
        <Card className="lg:col-span-5 border border-gray-200 dark:border-[#2B2B30] shadow-sm bg-white dark:bg-[#1F1F23]">
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
                    className="h-8 w-8 p-0 ml-2"
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
                    className={`timeframe-button text-xs ${
                      selectedPeriod === period ? 'bg-blue-600 text-white shadow-lg' : ''
                    }`}
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
                    {selectedFactorObject.change} over {getPeriodDescription(selectedPeriod)}
                  </span>
                </span>
                <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                  <span>Source: {selectedFactorObject.source}</span>
                </div>
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-80 w-full main-chart-container">
              {selectedFactorData && selectedFactorData.length > 0 && selectedFactorData[0].length > 0 ? (
                <MultiLineChart dataSets={selectedFactorData} isTransitioning={false} />
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

      <RateFeatureCard factorId={selectedFactorObject?.id} />

      {/* Bottom Section: Factor Grid */}
      <div>
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Monetary Policy Factors</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {monetaryFactors.map((factor, index) => {
            const IconComponent = getIconComponent(factor.id)
            return (
              <Card
                key={factor.id}
                className={`cursor-pointer factor-card ${
                  selectedFactor === factor.id ? 'ring-2 ring-blue-500 shadow-lg bg-blue-50 dark:bg-blue-950/30 selected' : ''
                } border border-gray-200 dark:border-[#2B2B30] shadow-sm bg-white dark:bg-[#1F1F23] h-full flex flex-col`}
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
                  <div className="h-20 mb-4 p-2 bg-transparent rounded-lg mini-chart-container">
                    <MiniChart 
                      data={factor.data} 
                      trend={factor.trend} 
                      isTransitioning={false}
                    />
                  </div>
                  <div className="text-base text-gray-600 dark:text-gray-400 line-clamp-3 mb-3 leading-relaxed flex-1">
                    {factor.description}
                  </div>
                  
                  {/* Update Information */}
                  
                  <div className="flex items-center justify-between text-sm text-gray-500 mt-auto pt-2">
                    <div className="flex items-center gap-1">
                      <Badge className={`text-sm ${factor.impact === 'High' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : factor.impact === 'Medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'} px-2 py-1`}>
                        {factor.impact}
                      </Badge>
                      <span>Impact</span>
                    </div>
                    <span className="truncate text-sm">{factor.source}</span>
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
