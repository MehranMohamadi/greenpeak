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
import { Shield, AlertTriangle, TrendingUp, TrendingDown, Activity, Target, ExternalLink, Info, Maximize2, Minimize2, ChevronLeft, ChevronRight, Grid3X3, Zap, Brain } from "lucide-react"
import useSystemicRiskData from "../../hooks/useSystemicRiskData"
import { 
  getLatestValue, 
  calculateChange,
  calculateChangeForPeriod,
  getDataForPeriod
} from "../../hooks/monetaryDataUtils"
import useUpdateInfo from "../../hooks/useUpdateInfo"
import { analyticsCategories, getCategoryByName, getCategoryIndex } from "../../lib/analytics-utils"
import '../../styles/analytics-animations.css'

export default function SystemicRisk() {
  const router = useRouter()
  const [selectedFactor, setSelectedFactor] = useState('vix')
  const [selectedPeriod, setSelectedPeriod] = useState('5Y')
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState('Systemic Risk')
  const [showCategoryGrid, setShowCategoryGrid] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [prevPeriod, setPrevPeriod] = useState('MAX')

  // Use imported categories from utils
  const categories = analyticsCategories
  
  // Use update info hook
  const { processUpdateInfo } = useUpdateInfo()

  // Find current category based on page
  const getCurrentCategory = () => {
    return categories.find(cat => cat.page === 'systemic-risk') || categories[0]
  }
  
  // Use custom hooks to fetch data - now with metadata
  const { data: systemicData, metadata: systemicMetadata, loading, error } = useSystemicRiskData()
  
  // Process data
  const processSystemicData = (data) => {
    if (!data || data.length === 0) return []
    return data.map(item => ({
      time: item.time,
      value: item.value
    })).sort((a, b) => new Date(a.time) - new Date(b.time))
  }

  // Process systemic risk data - Apply timeframe filtering to ALL data
  const processedVIXData = systemicData?.vix ? getDataForPeriod(processSystemicData(systemicData.vix), selectedPeriod) : []
  const processedCreditData = systemicData?.creditSpreads ? getDataForPeriod(processSystemicData(systemicData.creditSpreads), selectedPeriod) : []
  const processedYieldData = systemicData?.yieldCurve ? getDataForPeriod(processSystemicData(systemicData.yieldCurve), selectedPeriod) : []
  const processedCDSData = systemicData?.cdsSpreads ? getDataForPeriod(processSystemicData(systemicData.cdsSpreads), selectedPeriod) : []
  const processedStressData = systemicData?.financialStress ? getDataForPeriod(processSystemicData(systemicData.financialStress), selectedPeriod) : []

  // Get current values and changes - Calculate changes based on selected timeframe
  const latestVIX = processedVIXData.length > 0 ? processedVIXData[processedVIXData.length - 1].value : 0
  const latestCredit = processedCreditData.length > 0 ? processedCreditData[processedCreditData.length - 1].value : 0
  const latestYield = processedYieldData.length > 0 ? processedYieldData[processedYieldData.length - 1].value : 0
  const latestCDS = processedCDSData.length > 0 ? processedCDSData[processedCDSData.length - 1].value : 0
  const latestStress = processedStressData.length > 0 ? processedStressData[processedStressData.length - 1].value : 0

  const vixChange = processedVIXData.length > 0 ? calculateChangeForPeriod(processedVIXData, selectedPeriod) : { direction: 'neutral', change: 0 }
  const creditChange = processedCreditData.length > 0 ? calculateChangeForPeriod(processedCreditData, selectedPeriod) : { direction: 'neutral', change: 0 }
  const yieldChange = processedYieldData.length > 0 ? calculateChangeForPeriod(processedYieldData, selectedPeriod) : { direction: 'neutral', change: 0 }
  const cdsChange = processedCDSData.length > 0 ? calculateChangeForPeriod(processedCDSData, selectedPeriod) : { direction: 'neutral', change: 0 }
  const stressChange = processedStressData.length > 0 ? calculateChangeForPeriod(processedStressData, selectedPeriod) : { direction: 'neutral', change: 0 }

  // Create systemic risk factors with real-time data from APIs and update info
  const systemicRiskFactors = [
    {
      id: "vix",
      title: "VIX Volatility Index",
      category: "Market Volatility",
      currentValue: loading ? "Loading..." : error ? "Error" : `${latestVIX.toFixed(2)}`,
      change: loading ? "Loading..." : error ? "Error" : `${vixChange.direction === 'up' ? '+' : ''}${vixChange.change.toFixed(2)}`,
      trend: loading || error ? "neutral" : vixChange.direction,
      description: "CBOE Volatility Index - Market fear gauge and volatility expectations",
      data: processedVIXData, // Now uses timeframe-filtered data
      source: "Chicago Board Options Exchange (CBOE)",
      score: 7.5,
      impact: "High",
      updateInfo: processUpdateInfo(systemicMetadata?.vix)
    },
    {
      id: "credit-spreads",
      title: "Credit Spreads (High Yield)",
      category: "Credit Risk",
      currentValue: loading ? "Loading..." : error ? "Error" : `${latestCredit.toFixed(0)} bps`,
      change: loading ? "Loading..." : error ? "Error" : `${creditChange.direction === 'up' ? '+' : ''}${creditChange.change.toFixed(0)} bps`,
      trend: loading || error ? "neutral" : creditChange.direction,
      description: "High Yield Corporate Bond Spreads vs Treasury",
      data: processedCreditData, // Now uses timeframe-filtered data
      source: "ICE Bank of America",
      score: 6.8,
      impact: "High",
      updateInfo: processUpdateInfo(systemicMetadata?.creditSpreads)
    },
    {
      id: "yield-curve",
      title: "2Y/10Y Yield Curve",
      category: "Interest Rates",
      currentValue: loading ? "Loading..." : error ? "Error" : `${latestYield.toFixed(2)}%`,
      change: loading ? "Loading..." : error ? "Error" : `${yieldChange.direction === 'up' ? '+' : ''}${yieldChange.change.toFixed(2)}%`,
      trend: loading || error ? "neutral" : yieldChange.direction,
      description: "Difference between 10Y and 2Y Treasury yields (inversion indicator)",
      data: processedYieldData, // Now uses timeframe-filtered data
      source: "US Treasury",
      score: 6.2,
      impact: "High",
      updateInfo: processUpdateInfo(systemicMetadata?.yieldCurve)
    },
    {
      id: "cds-spreads",
      title: "CDS Spreads (Investment Grade)",
      category: "Credit Risk",
      currentValue: loading ? "Loading..." : error ? "Error" : `${latestCDS.toFixed(0)} bps`,
      change: loading ? "Loading..." : error ? "Error" : `${cdsChange.direction === 'up' ? '+' : ''}${cdsChange.change.toFixed(0)} bps`,
      trend: loading || error ? "neutral" : cdsChange.direction,
      description: "5-Year Investment Grade Credit Default Swap Index",
      data: processedCDSData, // Now uses timeframe-filtered data
      source: "Markit CDX",
      score: 6.5,
      impact: "Medium",
      updateInfo: processUpdateInfo(systemicMetadata?.cdsSpreads)
    },
    {
      id: "financial-stress",
      title: "Financial Stress Index",
      category: "System Health",
      currentValue: loading ? "Loading..." : error ? "Error" : `${latestStress.toFixed(2)}`,
      change: loading ? "Loading..." : error ? "Error" : `${stressChange.direction === 'up' ? '+' : ''}${stressChange.change.toFixed(2)}`,
      trend: loading || error ? "neutral" : stressChange.direction,
      description: "Chicago Fed National Financial Conditions Index",
      data: processedStressData, // Now uses timeframe-filtered data
      source: "Chicago Fed",
      score: 7.0,
      impact: "High",
      updateInfo: processUpdateInfo(systemicMetadata?.financialStress)
    }
  ]

  // Calculate overall score
  const overallScore = (systemicRiskFactors.reduce((sum, factor) => sum + (factor.score || 7), 0) / systemicRiskFactors.length).toFixed(1)
  
  const getScoreColor = (score) => {
    if (score >= 8) return "text-green-600"
    if (score >= 6) return "text-yellow-600"  
    return "text-red-600"
  }

  const getScoreBadge = (score) => {
    if (score >= 8) return { label: "Low Risk", color: "bg-green-100 text-green-800" }
    if (score >= 6) return { label: "Medium Risk", color: "bg-yellow-100 text-yellow-800" }
    return { label: "High Risk", color: "bg-red-100 text-red-800" }
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
      }, 200) // Reduced for faster response
    }, 50) // Reduced for immediate response
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

  // Get selected factor data
  const getSelectedFactor = () => {
    return systemicRiskFactors.find(factor => factor.id === selectedFactor) || systemicRiskFactors[0]
  }

  // Navigation functions for factor switching
  const navigateToNextFactor = () => {
    const currentIndex = systemicRiskFactors.findIndex(factor => factor.id === selectedFactor)
    const nextIndex = (currentIndex + 1) % systemicRiskFactors.length
    setSelectedFactor(systemicRiskFactors[nextIndex].id)
  }

  const navigateToPrevFactor = () => {
    const currentIndex = systemicRiskFactors.findIndex(factor => factor.id === selectedFactor)
    const prevIndex = currentIndex === 0 ? systemicRiskFactors.length - 1 : currentIndex - 1
    setSelectedFactor(systemicRiskFactors[prevIndex].id)
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
      case "vix":
        return {
          title: "VIX Volatility Index",
          description: "The CBOE Volatility Index (VIX) is a real-time market index representing the market's expectations for volatility over the coming 30 days. Often called the 'fear gauge', it measures implied volatility from S&P 500 options.",
          provider: "Chicago Board Options Exchange (CBOE)",
          frequency: "Real-time during market hours",
          availability: "1990 to Present",
          methodology: "Calculated using the implied volatilities of a wide range of S&P 500 index options. The VIX is quoted in percentage points and represents the expected annualized change in the S&P 500 index over the next 30 days.",
          url: "https://www.cboe.com/tradable_products/vix/",
          lastUpdated: "Updated every 15 seconds during market hours"
        }
      case "credit-spreads":
        return {
          title: "Credit Spreads (High Yield)",
          description: "The difference in yield between high-yield corporate bonds and comparable Treasury securities. Higher spreads indicate increased credit risk appetite and potential financial stress in credit markets.",
          provider: "Federal Reserve Economic Data (FRED)",
          frequency: "Daily",
          availability: "1996 to Present",
          methodology: "Option-Adjusted Spread (OAS) between ICE BofA US High Yield Index and comparable Treasury securities. Reflects credit risk premium demanded by investors for corporate default risk.",
          url: "https://fred.stlouisfed.org/series/BAMLH0A0HYM2",
          lastUpdated: "Updated daily"
        }
      case "yield-curve":
        return {
          title: "Yield Curve (10Y-2Y Spread)",
          description: "The spread between 10-year and 2-year Treasury yields. A key economic indicator where yield curve inversion (negative spread) has historically preceded recessions, signaling economic stress.",
          provider: "Federal Reserve Economic Data (FRED)",
          frequency: "Daily",
          availability: "1976 to Present",
          methodology: "Difference between 10-Year Treasury Constant Maturity Rate and 2-Year Treasury Constant Maturity Rate. Calculated from daily closing yields on actively traded Treasury securities.",
          url: "https://fred.stlouisfed.org/series/T10Y2Y",
          lastUpdated: "Updated daily"
        }
      case "cds-spreads":
        return {
          title: "CDS Spreads (Investment Grade)",
          description: "Credit Default Swap spreads on investment grade corporate debt. Measures the cost of insuring against corporate defaults and reflects market perception of systemic credit risk.",
          provider: "Markit/IHS (via FRED)",
          frequency: "Daily",
          availability: "2004 to Present",
          methodology: "Average spread of 5-year Credit Default Swaps on investment grade corporate bonds. Represents the annual premium paid to insure $10,000 of debt against default.",
          url: "https://fred.stlouisfed.org/series/BAMLC0A4CBBB",
          lastUpdated: "Updated daily"
        }
      case "financial-stress":
        return {
          title: "Financial Stress Index",
          description: "A composite index measuring stress in financial markets by incorporating multiple indicators including yield spreads, volatility measures, and safe haven flows. Higher values indicate elevated systemic risk.",
          provider: "Federal Reserve Bank of St. Louis",
          frequency: "Weekly",
          availability: "1993 to Present", 
          methodology: "Principal component analysis of 18 financial market variables including interest rate spreads, volatility measures, and market performance indicators. Values above zero indicate above-average financial stress.",
          url: "https://fred.stlouisfed.org/series/STLFSI4",
          lastUpdated: "Updated weekly on Fridays"
        }
      default:
        return {
          title: "Data Source",
          description: "Financial risk data source information",
          provider: "Federal Reserve Economic Data",
          frequency: "Varies",
          availability: "Historical data available",
          methodology: "Standard financial risk measurement techniques",
          url: "#",
          lastUpdated: "Updated regularly"
        }
    }
  }

  const getIconComponent = (factorId) => {
    switch (factorId) {
      case "vix":
        return AlertTriangle
      case "credit-spreads":
        return TrendingDown
      case "yield-curve":
        return Activity
      case "cds-spreads":
        return Shield
      case "financial-stress":
        return Target
      default:
        return AlertTriangle
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
            Unable to load systemic risk data
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
          <div className="p-2 bg-gradient-to-br from-red-600 to-orange-600 rounded-xl shadow-lg">
            <Shield className="h-6 w-6 text-white" />
          </div>
          Systemic Risk Analysis
        </h1>
        <div className="flex flex-wrap justify-between items-center gap-4">
          <p className="text-gray-600 dark:text-gray-400">
            Market volatility, credit risk, and financial system stability indicators
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
            <CardTitle className="flex items-center gap-2 group-hover:text-red-600 transition-all duration-200 text-base font-semibold">
              <div className="p-1.5 bg-gradient-to-br from-red-600 to-orange-600 rounded-lg shadow-md group-hover:scale-105 transition-transform duration-200">
                <AlertTriangle className="h-4 w-4 text-white" />
              </div>
              Risk Assessment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Enhanced Score Display */}
            <div className="text-center group-hover:scale-105 transition-transform duration-300 p-3 bg-gray-50 dark:bg-[#0F0F12] rounded-xl border border-gray-200 dark:border-[#2B2B30]">
              <div className={`text-4xl font-black ${getScoreColor(parseFloat(overallScore))} drop-shadow-lg mb-2 tracking-tight`}>
                {overallScore}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-2">Risk Level</div>
              <Badge className={`mt-1 px-3 py-1 text-xs font-semibold ${getScoreBadge(parseFloat(overallScore)).color} group-hover:shadow-md transition-all duration-300 hover:scale-105`}>
                {getScoreBadge(parseFloat(overallScore)).label}
              </Badge>
            </div>

            {/* Key Insights */}
            <div className="space-y-2">
              <h4 className="font-semibold text-gray-900 dark:text-white text-xs">Key Indicators</h4>
              <div className="space-y-1 text-xs">
                <div className="flex items-start gap-2 hover:bg-gray-50 dark:hover:bg-[#0F0F12] p-1.5 rounded-lg transition-all duration-200 cursor-pointer">
                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full mt-1.5 flex-shrink-0"></div>
                  <span className="leading-tight">VIX elevated above 18</span>
                </div>
                <div className="flex items-start gap-2 hover:bg-gray-50 dark:hover:bg-[#0F0F12] p-1.5 rounded-lg transition-all duration-200 cursor-pointer">
                  <div className="w-1.5 h-1.5 bg-orange-500 rounded-full mt-1.5 flex-shrink-0"></div>
                  <span className="leading-tight">Credit spreads widening</span>
                </div>
                <div className="flex items-start gap-2 hover:bg-gray-50 dark:hover:bg-[#0F0F12] p-1.5 rounded-lg transition-all duration-200 cursor-pointer">
                  <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full mt-1.5 flex-shrink-0"></div>
                  <span className="leading-tight">Yield curve monitoring</span>
                </div>
              </div>
            </div>

            {/* Risk Outlook */}
            <div className="space-y-2">
              <h4 className="font-semibold text-gray-900 dark:text-white text-xs">Risk Outlook</h4>
              <div className="space-y-1 text-xs">
                <div className="flex items-center justify-between hover:bg-gray-50 dark:hover:bg-[#0F0F12] p-1.5 rounded-lg transition-all duration-200 cursor-pointer">
                  <span>Volatility</span>
                  <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 text-xs hover:shadow-md transition-all duration-200 hover:scale-105">High</Badge>
                </div>
                <div className="flex items-center justify-between hover:bg-gray-50 dark:hover:bg-[#0F0F12] p-1.5 rounded-lg transition-all duration-200 cursor-pointer">
                  <span>Credit Risk</span>
                  <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 text-xs hover:shadow-md transition-all duration-200 hover:scale-105">Medium</Badge>
                </div>
                <div className="flex items-center justify-between hover:bg-gray-50 dark:hover:bg-[#0F0F12] p-1.5 rounded-lg transition-all duration-200 cursor-pointer">
                  <span>Systemic</span>
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs hover:shadow-md transition-all duration-200 hover:scale-105">Low</Badge>
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
                      return <IconComponent className="h-5 w-5 text-red-600" />
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
                    className="h-8 w-8 p-0 ml-2 hover:bg-red-50 dark:hover:bg-red-900 hover:scale-105 transition-all duration-200 hover:shadow-md"
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
                      selectedPeriod === period ? 'bg-red-600 text-white shadow-lg' : ''
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
            <div className={`h-80 w-full main-chart-container ${isTransitioning ? 'chart-updating' : ''}`}>
              {selectedFactorData && selectedFactorData.length > 0 && selectedFactorData[0].length > 0 ? (
                <div className="chart-fade-in">
                  <MultiLineChart dataSets={selectedFactorData} isTransitioning={isTransitioning} />
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
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
                  className="h-8 w-8 p-0 hover:bg-red-50 dark:hover:bg-red-950/30"
                  title="Previous Factor"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={navigateToNextFactor}
                  className="h-8 w-8 p-0 hover:bg-red-50 dark:hover:bg-red-950/30"
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
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Systemic Risk Factors</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {systemicRiskFactors.map((factor, index) => {
            const IconComponent = getIconComponent(factor.id)
            return (
              <Card
                key={factor.id}
                className={`cursor-pointer factor-card transition-all duration-200 hover:shadow-lg hover:scale-[1.02] hover:-translate-y-1 ${
                  selectedFactor === factor.id ? 'ring-2 ring-red-500 shadow-lg scale-[1.02] bg-red-50 dark:bg-red-950/30 selected' : ''
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
                                return <IconComponent className="h-5 w-5 text-red-600" />
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
                    <span className={`text-2xl font-bold text-gray-900 dark:text-white value-transition`}>
                      {factor.currentValue}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className={`text-base font-medium ${getTrendColor(factor.trend)} value-transition`}>
                        {factor.change}
                      </span>
                      <Badge className="text-sm bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 px-2 py-1">
                        {factor.score}/10
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 flex-1 flex flex-col">
                  <div className={`h-20 mb-4 p-2 bg-transparent rounded-lg mini-chart-container transition-all duration-200 ${
                    isTransitioning ? 'opacity-95' : ''
                  }`}>
                    <MiniChart 
                      key={`${factor.id}-${selectedPeriod}`}
                      data={factor.data} 
                      trend={factor.trend} 
                      isTransitioning={isTransitioning}
                      selectedPeriod={selectedPeriod}
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
