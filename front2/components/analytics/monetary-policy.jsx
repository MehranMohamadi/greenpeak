"use client"

import React, { useState } from "react"
import dynamic from "next/dynamic"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import IndicatorFeatureCard from "./indicator-feature-card"
import DomainUnderstandingPanel from "./domain-understanding-panel"
import { DollarSign, TrendingUp, TrendingDown, Activity, Target, ExternalLink, Info, Maximize2, Minimize2, ChevronLeft, ChevronRight, Zap, Brain } from "lucide-react"
import MonetaryPolicyLoadingSkeleton from "./monetary-policy-loading"
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
import { AnalysisFactorCard, AnalysisFactorGrid, AnalysisOverviewGrid, AnalysisPageHeader, AnalysisPageShell, AnalysisScoreCard } from "./analysis-page"

const MultiLineChart = dynamic(() => import("../charts/multi-line-chart"), { ssr: false })
const MiniChart = dynamic(() => import("./mini-chart"), { ssr: false })
const FullScreenChart = dynamic(() => import("./fullscreen-chart"), { ssr: false })

export default function MonetaryPolicy() {
  const [selectedFactor, setSelectedFactor] = useState('ten-year-treasury')
  const [selectedPeriod, setSelectedPeriod] = useState('5Y')
  const [isFullScreen, setIsFullScreen] = useState(false)
  // Use update info hook
  const { processUpdateInfo } = useUpdateInfo()

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
    return <MonetaryPolicyLoadingSkeleton />
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
    <AnalysisPageShell>
      <AnalysisPageHeader page="monetary-policy" title="Monetary Policy Analysis" />

      {/* Top Section: Score + Main Chart */}
      <AnalysisOverviewGrid className="mb-8">
        {/* Left: Score & Analysis (2/7 width) */}
        <AnalysisScoreCard title="Policy Stance" icon={Target} className="lg:col-span-7">
          <DomainUnderstandingPanel domainId="monetary_liquidity" />
        </AnalysisScoreCard>

        {/* Right: Main Chart (5/7 width) */}
        <Card className="min-w-0 border border-gray-200 bg-white shadow-sm dark:border-[#2B2B30] dark:bg-[#1F1F23] lg:col-span-7">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <CardTitle className="flex min-w-0 items-center text-lg font-semibold">
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
            </CardTitle>
              <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
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
            </div>
            {selectedFactorObject && (
              <CardDescription className="flex flex-wrap items-center gap-4 text-sm mt-2">
                <span>
                  Current: {selectedFactorObject.currentValue} | 
                  <span className={`ml-1 ${getTrendColor(selectedFactorObject.trend)}`}>
                    {selectedFactorObject.change} over {getPeriodDescription(selectedPeriod)}
                  </span>
                </span>
                <span className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                  <span>Source: {selectedFactorObject.source}</span>
                </span>
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-[420px] w-full main-chart-container">
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
      </AnalysisOverviewGrid>

      <IndicatorFeatureCard page="monetary-policy" factorId={selectedFactorObject?.id} />

      {/* Bottom Section: Factor Grid */}
      <AnalysisFactorGrid title="Monetary Policy Factors" className="gap-6">
          {monetaryFactors.map((factor, index) => {
            const IconComponent = getIconComponent(factor.id)
            return (
              <AnalysisFactorCard
                key={factor.id}
                selected={selectedFactor === factor.id}
                className="factor-card flex flex-col"
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
              </AnalysisFactorCard>
            )
          })}
      </AnalysisFactorGrid>

      {/* Full Screen Chart Modal */}
      {isFullScreen && <FullScreenChart
        isOpen={isFullScreen}
        onClose={() => setIsFullScreen(false)}
        selectedFactor={selectedFactorObject}
        getIconComponent={getIconComponent}
      />}
    </AnalysisPageShell>
  )
}
