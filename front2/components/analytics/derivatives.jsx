"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import MultiLineChart from "../charts/multi-line-chart"
import MiniChart from "./mini-chart"
import FullScreenChart from './fullscreen-chart'
import { TrendingUp, TrendingDown, Activity, Info, ExternalLink, Maximize2, Target, PieChart, BarChart3, Calculator, Building2, Zap, DollarSign, Percent, TrendingDown as Decline, Scale, Award, Banknote } from "lucide-react"

export default function Derivatives() {
  const [selectedFactor, setSelectedFactor] = useState('vix')
  const [selectedPeriod, setSelectedPeriod] = useState('5Y')
  const [isFullScreen, setIsFullScreen] = useState(false)

  // Derivatives factors with mock data
  const derivativesFactors = [
    {
      id: "futures-positioning",
      title: "Futures Positioning",
      category: "Positioning",
      currentValue: "+85K",
      change: "+12K",
      trend: "up",
      description: "Net long positions in S&P 500 futures (COT)",
      data: [
        { date: "2024-01-02", value: 65 },
        { date: "2024-02-01", value: 68 },
        { date: "2024-03-01", value: 72 },
        { date: "2024-04-01", value: 78 },
        { date: "2024-05-01", value: 82 },
        { date: "2024-06-01", value: 85 },
      ],
      source: "CFTC COT Reports",
      benchmark: "Net long >50K = Bullish, <-50K = Bearish"
    },
    {
      id: "vix",
      title: "VIX",
      category: "Implied Volatility",
      currentValue: "18.5",
      change: "-2.1",
      trend: "down",
      description: "CBOE Volatility Index (S&P 500 implied volatility)",
      data: [
        { date: "2024-01-02", value: 24.2 },
        { date: "2024-02-01", value: 22.8 },
        { date: "2024-03-01", value: 21.5 },
        { date: "2024-04-01", value: 20.1 },
        { date: "2024-05-01", value: 19.2 },
        { date: "2024-06-01", value: 18.5 },
      ],
      source: "CBOE",
      benchmark: "<20 = Low Fear, 20-30 = Normal, >30 = High Fear"
    },
    {
      id: "put-call-ratio",
      title: "Put/Call Ratio",
      category: "Options Sentiment",
      currentValue: "0.78",
      change: "-0.05",
      trend: "down",
      description: "CBOE total put/call volume ratio",
      data: [
        { date: "2024-01-02", value: 0.95 },
        { date: "2024-02-01", value: 0.91 },
        { date: "2024-03-01", value: 0.86 },
        { date: "2024-04-01", value: 0.82 },
        { date: "2024-05-01", value: 0.80 },
        { date: "2024-06-01", value: 0.78 },
      ],
      source: "CBOE",
      benchmark: ">1.0 = Bearish, 0.7-1.0 = Neutral, <0.7 = Bullish"
    },
    {
      id: "skew",
      title: "SKEW Index",
      category: "Risk Metrics",
      currentValue: "142.8",
      change: "+3.2",
      trend: "up",
      description: "CBOE SKEW Index (tail risk measure)",
      data: [
        { date: "2024-01-02", value: 135.2 },
        { date: "2024-02-01", value: 137.1 },
        { date: "2024-03-01", value: 138.9 },
        { date: "2024-04-01", value: 140.5 },
        { date: "2024-05-01", value: 141.8 },
        { date: "2024-06-01", value: 142.8 },
      ],
      source: "CBOE",
      benchmark: "100-135 = Normal, 135-150 = Elevated, >150 = High Tail Risk"
    },
    {
      id: "vvix",
      title: "VVIX",
      category: "Volatility of Volatility",
      currentValue: "89.2",
      change: "-4.1",
      trend: "down",
      description: "Volatility of VIX (vol of vol indicator)",
      data: [
        { date: "2024-01-02", value: 102.8 },
        { date: "2024-02-01", value: 98.5 },
        { date: "2024-03-01", value: 95.2 },
        { date: "2024-04-01", value: 92.1 },
        { date: "2024-05-01", value: 90.8 },
        { date: "2024-06-01", value: 89.2 },
      ],
      source: "CBOE",
      benchmark: "<80 = Low Vol Uncertainty, >120 = High Vol Uncertainty"
    },
    {
      id: "volatility-term-structure",
      title: "Vol Term Structure",
      category: "Term Structure",
      currentValue: "Backwardation",
      change: "Steepening",
      trend: "up",
      description: "VIX9D vs VIX relationship (short vs long-term vol)",
      data: [
        { date: "2024-01-02", value: 0.92 },
        { date: "2024-02-01", value: 0.94 },
        { date: "2024-03-01", value: 0.96 },
        { date: "2024-04-01", value: 0.98 },
        { date: "2024-05-01", value: 1.02 },
        { date: "2024-06-01", value: 1.05 },
      ],
      source: "CBOE",
      benchmark: "<1.0 = Backwardation (Stressed), >1.0 = Contango (Normal)"
    }
  ]

  // Calculate overall score
  const overallScore = (derivativesFactors.reduce((sum, factor) => sum + (factor.score || 7), 0) / derivativesFactors.length).toFixed(1)

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
    return derivativesFactors.find(factor => factor.id === selectedFactor) || derivativesFactors[0]
  }

  const selectedFactorObject = getSelectedFactor()
  const selectedFactorData = selectedFactorObject && Array.isArray(selectedFactorObject.data) && selectedFactorObject.data.length > 0 ?
    [selectedFactorObject.data] : []

  // Add source details for each factor
  const getSourceDetails = (factorId) => {
    switch (factorId) {
      case "futures-positioning":
        return {
          title: "Futures Positioning",
          description: "Commitment of Traders (COT) data showing net long/short positions in S&P 500 futures contracts, indicating institutional sentiment.",
          provider: "CFTC",
          frequency: "Weekly",
          availability: "1986 to Present",
          methodology: "Net positions of large speculators and commercial hedgers in S&P 500 E-mini futures contracts reported weekly.",
          url: "https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm",
          lastUpdated: "Updated weekly on Friday"
        }
      case "vix":
        return {
          title: "VIX Volatility Index",
          description: "CBOE Volatility Index measuring market's expectation of 30-day forward-looking volatility from S&P 500 options prices.",
          provider: "CBOE",
          frequency: "Real-time",
          availability: "1990 to Present",
          methodology: "Calculated from S&P 500 options prices using a weighted average of puts and calls across multiple strike prices.",
          url: "https://www.cboe.com/tradable_products/vix/",
          lastUpdated: "Updated real-time during market hours"
        }
      case "put-call-ratio":
        return {
          title: "Put/Call Ratio",
          description: "Total put option volume divided by call option volume, measuring investor sentiment and potential market reversals.",
          provider: "CBOE",
          frequency: "Daily",
          availability: "1995 to Present",
          methodology: "Total put volume divided by total call volume across all equity options traded on CBOE exchanges.",
          url: "https://www.cboe.com/us/options/market_statistics/",
          lastUpdated: "Updated daily after market close"
        }
      case "skew":
        return {
          title: "CBOE SKEW Index",
          description: "Measures perceived tail risk of S&P 500 returns, calculated from out-of-the-money S&P 500 options prices.",
          provider: "CBOE",
          frequency: "Real-time",
          availability: "1990 to Present",
          methodology: "Based on prices of S&P 500 out-of-the-money options, measuring the slope of the implied volatility curve.",
          url: "https://www.cboe.com/tradable_products/volatility/volatility_indexes/skew/",
          lastUpdated: "Updated real-time during market hours"
        }
      case "vvix":
        return {
          title: "VVIX - Volatility of VIX",
          description: "Measures the volatility of the VIX index itself, indicating uncertainty about future volatility levels.",
          provider: "CBOE",
          frequency: "Real-time",
          availability: "2012 to Present",
          methodology: "Calculated from VIX options prices using the same methodology as VIX but applied to VIX futures.",
          url: "https://www.cboe.com/tradable_products/volatility/volatility_indexes/vvix/",
          lastUpdated: "Updated real-time during market hours"
        }
      case "volatility-term-structure":
        return {
          title: "Volatility Term Structure",
          description: "Relationship between short-term and long-term implied volatility, indicating market stress and volatility expectations.",
          provider: "CBOE",
          frequency: "Real-time",
          availability: "2008 to Present",
          methodology: "Ratio of VIX9D (9-day volatility) to VIX (30-day volatility), showing term structure slope.",
          url: "https://www.cboe.com/tradable_products/volatility/",
          lastUpdated: "Updated real-time during market hours"
        }
      default:
        return {
          title: "Data Source",
          description: "Derivatives and volatility data source information",
          provider: "Financial Data Providers",
          frequency: "Varies",
          availability: "Historical data",
          methodology: "Standard derivatives measurement techniques",
          url: "#",
          lastUpdated: "Regular updates"
        }
    }
  }

  const getIconComponent = (factorId) => {
    switch (factorId) {
      case "futures-positioning":
        return BarChart3
      case "vix":
        return TrendingDown
      case "put-call-ratio":
        return Activity
      case "skew":
        return Calculator
      case "vvix":
        return TrendingUp
      case "volatility-term-structure":
        return PieChart
      default:
        return Zap
    }
  }

  return (
    <div className="p-6 space-y-6 fade-in bg-white dark:bg-[#0F0F12]">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-red-600 to-pink-600 rounded-xl shadow-lg">
            <TrendingDown className="h-6 w-6 text-white" />
          </div>
          Derivatives & Volatility Analysis
        </h1>
        <div className="flex flex-wrap justify-between items-center">
          <p className="text-gray-600 dark:text-gray-400">
            Options flow, VIX levels, volatility term structure, and derivatives positioning indicators
          </p>
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mt-2 lg:mt-0">
            <span className="flex items-center gap-1 px-3 py-1.5 bg-white dark:bg-[#1F1F23] rounded-lg border border-gray-200 dark:border-[#2B2B30]">
              <Info className="h-4 w-4" />
              Updated: Aug 3, 2025 9:15 AM EDT
            </span>
            <span className="flex items-center gap-1 px-3 py-1.5 bg-white dark:bg-[#1F1F23] rounded-lg border border-gray-200 dark:border-[#2B2B30]">
              <Target className="h-4 w-4" />
              Next Release: Aug 4, 2025
            </span>
          </div>
        </div>
      </div>

      {/* Top Section: Corporate Earnings Factor + Main Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
        {/* Left: Selected Derivatives Factor (1/4 width) */}
        <Card className="lg:col-span-1 slide-in-left stagger-1 hover:shadow-lg transition-all duration-200 cursor-pointer group border border-gray-200 dark:border-[#2B2B30] shadow-sm bg-white dark:bg-[#1F1F23] card-glow">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 group-hover:text-red-600 transition-all duration-200 text-base font-semibold">
              <div className="p-1.5 bg-gradient-to-br from-red-600 to-pink-600 rounded-lg shadow-md group-hover:scale-105 transition-transform duration-200">
                <TrendingDown className="h-4 w-4 text-white" />
              </div>
              Volatility Health
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full mt-1.5 flex-shrink-0"></div>
                  <span className="leading-tight">VIX levels subdued</span>
                </div>
                <div className="flex items-start gap-2 hover:bg-gray-50 dark:hover:bg-[#0F0F12] p-1.5 rounded-lg transition-all duration-200 cursor-pointer">
                  <div className="w-1.5 h-1.5 bg-pink-500 rounded-full mt-1.5 flex-shrink-0"></div>
                  <span className="leading-tight">Put/call ratio neutral</span>
                </div>
                <div className="flex items-start gap-2 hover:bg-gray-50 dark:hover:bg-[#0F0F12] p-1.5 rounded-lg transition-all duration-200 cursor-pointer">
                  <div className="w-1.5 h-1.5 bg-orange-500 rounded-full mt-1.5 flex-shrink-0"></div>
                  <span className="leading-tight">SKEW elevated</span>
                </div>
              </div>
            </div>

            {/* Volatility Outlook */}
            <div className="space-y-2">
              <h4 className="font-semibold text-gray-900 dark:text-white text-xs">Volatility Outlook</h4>
              <div className="space-y-1 text-xs">
                <div className="flex items-center justify-between hover:bg-gray-50 dark:hover:bg-[#0F0F12] p-1.5 rounded-lg transition-all duration-200 cursor-pointer">
                  <span>Fear Level</span>
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs hover:shadow-md transition-all duration-200 hover:scale-105">Low</Badge>
                </div>
                <div className="flex items-center justify-between hover:bg-gray-50 dark:hover:bg-[#0F0F12] p-1.5 rounded-lg transition-all duration-200 cursor-pointer">
                  <span>Term Structure</span>
                  <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 text-xs hover:shadow-md transition-all duration-200 hover:scale-105">Backwardation</Badge>
                </div>
                <div className="flex items-center justify-between hover:bg-gray-50 dark:hover:bg-[#0F0F12] p-1.5 rounded-lg transition-all duration-200 cursor-pointer">
                  <span>Tail Risk</span>
                  <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 text-xs hover:shadow-md transition-all duration-200 hover:scale-105">Elevated</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right: Main Chart (3/4 width) */}
        <Card className="lg:col-span-3 slide-in-right stagger-2 hover:shadow-lg transition-all duration-200 border border-gray-200 dark:border-[#2B2B30] shadow-sm bg-white dark:bg-[#1F1F23] card-glow">
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
                    onClick={() => setSelectedPeriod(period)}
                    className="transition-all duration-200  text-xs hover:scale-105 hover:shadow-md"
                  >
                    {period}
                  </Button>
                ))}
              </div>
            </CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-4 text-sm mt-2">
              <span>
                Current: {selectedFactorObject.currentValue} |
                <span className={`ml-1 ${getTrendColor(selectedFactorObject.trend)}`}>
                  {selectedFactorObject.change}
                </span>
              </span>
              <span className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                <span>Source: {selectedFactorObject.source}</span>
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-80 w-full">
              {selectedFactorObject ? (
                <MultiLineChart dataSets={selectedFactorData} />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500 text-base">
                  Click on any factor below to view its detailed chart
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Section: Derivatives Factors Grid */}
      <div className="slide-in-up">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Derivatives & Volatility Factors</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {derivativesFactors.map((factor, index) => {
            const IconComponent = getIconComponent(factor.id)
            return (
              <Card
                key={factor.id}
                className={`cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] hover:-translate-y-1 ${selectedFactor === factor.id ? 'ring-2 ring-red-500 shadow-lg scale-[1.02] bg-red-50 dark:bg-red-950/30' : ''
                  } slide-in-up stagger-${(index % 6) + 1} border border-gray-200 dark:border-[#2B2B30] shadow-sm bg-white dark:bg-[#1F1F23] group card-glow`}
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
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">
                      {factor.currentValue}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className={`text-base font-medium ${getTrendColor(factor.trend)}`}>
                        {factor.change}
                      </span>
                      <Badge className="text-sm bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 px-2 py-1">
                        {factor.category}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="h-20 mb-4 p-2 bg-transparent rounded-lg transition-all duration-300">
                    <MiniChart
                      data={factor.data}
                      trend={factor.trend}
                    />
                  </div>
                  <p className="text-base text-gray-600 dark:text-gray-400 line-clamp-3 mb-3 group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors duration-300 leading-relaxed">
                    {factor.description}
                  </p>
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <Badge className={`text-xs transition-all duration-300 hover:scale-105 ${
                        factor.trend === 'up' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 hover:bg-red-200' : 
                        factor.trend === 'down' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 hover:bg-green-200' : 
                        'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200 hover:bg-gray-200'
                      } px-2 py-1`}>
                        {factor.trend === 'up' ? 'Rising Vol' : factor.trend === 'down' ? 'Falling Vol' : 'Stable'}
                      </Badge>
                      <span className="text-xs">Volatility</span>
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
      />
    </div>
  )
}
