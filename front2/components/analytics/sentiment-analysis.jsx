"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { MessageSquare, TrendingUp, TrendingDown, Users, Activity, Brain, Target, Gauge, Info, ExternalLink, BarChart3 } from "lucide-react"
import MultiLineChart from "../charts/multi-line-chart"
import InteractiveSidebar from "./interactive-sidebar"

// Real-time Fear & Greed Index Component
function FearGreedIndex({ value = 65 }) {
  const getColor = (val) => {
    if (val <= 25) return "from-red-500 to-red-600"
    if (val <= 45) return "from-orange-500 to-red-500"
    if (val <= 55) return "from-yellow-500 to-orange-500"
    if (val <= 75) return "from-green-400 to-yellow-500"
    return "from-green-500 to-green-600"
  }

  const getLabel = (val) => {
    if (val <= 25) return "Extreme Fear"
    if (val <= 45) return "Fear"
    if (val <= 55) return "Neutral"
    if (val <= 75) return "Greed"
    return "Extreme Greed"
  }

  const getIndicatorColor = (val) => {
    if (val <= 25) return "text-red-500"
    if (val <= 45) return "text-orange-500"
    if (val <= 55) return "text-yellow-500"
    if (val <= 75) return "text-green-400"
    return "text-green-500"
  }

  return (
    <div className="relative w-40 h-40 mx-auto">
      {/* Circular Progress with improved styling */}
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r="35"
          stroke="currentColor"
          strokeWidth="6"
          fill="none"
          className="text-gray-200 dark:text-gray-700"
        />
        <circle
          cx="50"
          cy="50"
          r="35"
          stroke="currentColor"
          strokeWidth="6"
          fill="none"
          strokeDasharray={`${(value / 100) * 219.8} 219.8`}
          strokeLinecap="round"
          className={`transition-all duration-1000 ease-out ${getIndicatorColor(value)}`}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <div className={`text-2xl font-bold ${getIndicatorColor(value)}`}>{value}</div>
          <div className={`text-xs font-medium ${getIndicatorColor(value)}`}>
            {getLabel(value)}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SentimentAnalysis() {
  const [selectedPeriod, setSelectedPeriod] = useState('30D')

  // Mock data for Fear & Greed Index timeline
  const fearGreedData = [
    { time: "2025-07-01", value: 45 },
    { time: "2025-07-02", value: 48 },
    { time: "2025-07-03", value: 52 },
    { time: "2025-07-05", value: 49 },
    { time: "2025-07-08", value: 55 },
    { time: "2025-07-10", value: 58 },
    { time: "2025-07-12", value: 62 },
    { time: "2025-07-15", value: 59 },
    { time: "2025-07-17", value: 65 },
    { time: "2025-07-20", value: 68 },
    { time: "2025-07-22", value: 63 },
    { time: "2025-07-25", value: 65 },
    { time: "2025-07-28", value: 67 },
    { time: "2025-07-30", value: 65 }
  ]

  // Mock data for Put/Call Ratio
  const putCallData = [
    { time: "2025-07-01", value: 0.95 },
    { time: "2025-07-02", value: 0.92 },
    { time: "2025-07-03", value: 0.88 },
    { time: "2025-07-05", value: 0.90 },
    { time: "2025-07-08", value: 0.85 },
    { time: "2025-07-10", value: 0.82 },
    { time: "2025-07-12", value: 0.78 },
    { time: "2025-07-15", value: 0.80 },
    { time: "2025-07-17", value: 0.75 },
    { time: "2025-07-20", value: 0.72 },
    { time: "2025-07-22", value: 0.76 },
    { time: "2025-07-25", value: 0.73 },
    { time: "2025-07-28", value: 0.70 },
    { time: "2025-07-30", value: 0.72 }
  ]

  // Sentiment factors for InteractiveSidebar
  const sentimentFactors = [
    {
      id: "vix-fear-index",
      title: "VIX Fear Index",
      currentValue: "18.45",
      change: "-2.3%",
      trend: "down",
      description: "Market volatility expectation indicator",
      source: "CBOE",
      url: "/analytics/sentiment/vix",
      chartData: [
        { time: "2025-07-01", value: 22.8 },
        { time: "2025-07-03", value: 21.2 },
        { time: "2025-07-05", value: 20.5 },
        { time: "2025-07-08", value: 19.8 },
        { time: "2025-07-10", value: 18.9 },
        { time: "2025-07-12", value: 17.8 },
        { time: "2025-07-15", value: 18.2 },
        { time: "2025-07-17", value: 17.5 },
        { time: "2025-07-20", value: 16.9 },
        { time: "2025-07-22", value: 17.8 },
        { time: "2025-07-25", value: 18.1 },
        { time: "2025-07-28", value: 18.7 },
        { time: "2025-07-30", value: 18.45 }
      ]
    },
    {
      id: "aaii-sentiment",
      title: "AAII Investor Sentiment",
      currentValue: "45% Bulls",
      change: "+3.1%",
      trend: "up",
      description: "Individual investor sentiment survey",
      source: "American Association of Individual Investors",
      url: "/analytics/sentiment/aaii",
      chartData: [
        { time: "2025-07-01", value: 38 },
        { time: "2025-07-03", value: 40 },
        { time: "2025-07-05", value: 42 },
        { time: "2025-07-08", value: 44 },
        { time: "2025-07-10", value: 43 },
        { time: "2025-07-12", value: 45 },
        { time: "2025-07-15", value: 46 },
        { time: "2025-07-17", value: 44 },
        { time: "2025-07-20", value: 47 },
        { time: "2025-07-22", value: 46 },
        { time: "2025-07-25", value: 45 },
        { time: "2025-07-28", value: 44 },
        { time: "2025-07-30", value: 45 }
      ]
    },
    {
      id: "social-media-sentiment",
      title: "Social Media Sentiment",
      currentValue: "72% Positive",
      change: "+8.5%",
      trend: "up",
      description: "Aggregated sentiment from Twitter, Reddit, StockTwits",
      source: "Social Media Analytics",
      url: "/analytics/sentiment/social",
      chartData: [
        { time: "2025-07-01", value: 58 },
        { time: "2025-07-03", value: 60 },
        { time: "2025-07-05", value: 62 },
        { time: "2025-07-08", value: 65 },
        { time: "2025-07-10", value: 67 },
        { time: "2025-07-12", value: 69 },
        { time: "2025-07-15", value: 68 },
        { time: "2025-07-17", value: 70 },
        { time: "2025-07-20", value: 71 },
        { time: "2025-07-22", value: 69 },
        { time: "2025-07-25", value: 72 },
        { time: "2025-07-28", value: 73 },
        { time: "2025-07-30", value: 72 }
      ]
    },
    {
      id: "insider-trading",
      title: "Insider Trading Ratio",
      currentValue: "2.3:1 Buy/Sell",
      change: "-1.8%",
      trend: "down",
      description: "Corporate insider buy vs sell activity",
      source: "SEC Filings",
      url: "/analytics/sentiment/insider",
      chartData: [
        { time: "2025-07-01", value: 2.8 },
        { time: "2025-07-03", value: 2.7 },
        { time: "2025-07-05", value: 2.6 },
        { time: "2025-07-08", value: 2.5 },
        { time: "2025-07-10", value: 2.4 },
        { time: "2025-07-12", value: 2.3 },
        { time: "2025-07-15", value: 2.4 },
        { time: "2025-07-17", value: 2.2 },
        { time: "2025-07-20", value: 2.3 },
        { time: "2025-07-22", value: 2.4 },
        { time: "2025-07-25", value: 2.2 },
        { time: "2025-07-28", value: 2.3 },
        { time: "2025-07-30", value: 2.3 }
      ]
    }
  ]

  const timeFrameButtons = [
    { label: '7D', value: '7D' },
    { label: '30D', value: '30D' },
    { label: '90D', value: '90D' },
    { label: '1Y', value: '1Y' },
    { label: 'MAX', value: 'MAX' }
  ]

  // Data source information
  const dataSources = {
    fearGreed: {
      title: "CNN Fear & Greed Index",
      description: "Market sentiment indicator based on seven different factors including stock price momentum, stock price strength, stock price breadth, put and call options, junk bond demand, market volatility and safe haven demand.",
      source: "CNN Business",
      link: "https://money.cnn.com/data/fear-and-greed/",
      updateFrequency: "Daily",
      lastUpdated: "Market close",
      coverage: "Daily market sentiment"
    },
    putCall: {
      title: "CBOE Put/Call Ratio",
      description: "The put/call ratio is a popular contrarian sentiment indicator. High put/call ratios are generally viewed as bullish (contrary indicator) while low ratios are viewed as bearish.",
      source: "Chicago Board Options Exchange (CBOE)",
      link: "https://www.cboe.com/tradable_products/vix/",
      updateFrequency: "Real-time",
      lastUpdated: "Market hours",
      coverage: "Options market sentiment"
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-full overflow-hidden">
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-4">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Brain className="h-6 w-6 md:h-8 md:w-8 text-pink-600" />
            Market Sentiment & Psychology
          </h1>
          
          {/* Time Frame Selector */}
          <div className="flex gap-2 flex-wrap">
            {timeFrameButtons.map(button => (
              <Button
                key={button.value}
                variant={selectedPeriod === button.value ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedPeriod(button.value)}
                className="min-w-[3rem]"
              >
                {button.label}
              </Button>
            ))}
          </div>
        </div>
        
        <p className="text-gray-600 dark:text-gray-400">
          Real-time market sentiment analysis, investor psychology, and behavioral indicators
        </p>
      </div>

      {/* Overall Sentiment Status Banner */}
      <Card className="border-l-4 border-l-pink-500 bg-gradient-to-r from-pink-50 to-transparent dark:from-pink-950">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-pink-600 dark:text-pink-400">
              <Gauge className="h-5 w-5" />
              Current Market Sentiment
            </div>
            <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-300">
              CAUTIOUSLY OPTIMISTIC
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <FearGreedIndex value={65} />
            <div className="flex-1">
              <h3 className="font-semibold text-lg text-gray-900 dark:text-white mb-2">
                Market Shows Moderate Greed
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
                Fear subsiding with selective optimism emerging across social sentiment indicators and options positioning. VIX remains below historical averages.
              </p>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">Fear & Greed: 65</div>
                  <div className="text-green-600">↑ +3 from yesterday</div>
                </div>
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">Social Sentiment: 72%</div>
                  <div className="text-green-600">↑ +8.5% this week</div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Charts - Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mb-6">
        <Card className="min-h-0">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-sm md:text-base">
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 md:h-5 md:w-5 text-pink-600" />
                <span className="truncate">Fear & Greed Index</span>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="p-1 h-8 w-8 flex-shrink-0">
                    <Info className="h-4 w-4 text-gray-500" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Brain className="h-5 w-5 text-pink-600" />
                      {dataSources.fearGreed.title}
                    </DialogTitle>
                    <DialogDescription className="space-y-3 text-left">
                      <p>{dataSources.fearGreed.description}</p>
                      <div className="space-y-2 text-sm">
                        <div><strong>Source:</strong> {dataSources.fearGreed.source}</div>
                        <div><strong>Update Frequency:</strong> {dataSources.fearGreed.updateFrequency}</div>
                        <div><strong>Coverage:</strong> {dataSources.fearGreed.coverage}</div>
                        <a 
                          href={dataSources.fearGreed.link} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          View Original Data <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </DialogDescription>
                  </DialogHeader>
                </DialogContent>
              </Dialog>
            </CardTitle>
            <CardDescription className="text-sm">
              Current: 65 (Greed) | 
              <span className="ml-1 text-green-600">
                ↑ +3 points from yesterday
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-64 md:h-80 w-full">
              <MultiLineChart dataSets={[{
                name: "Fear & Greed Index",
                data: fearGreedData,
                color: '#ec4899'
              }]} />
            </div>
          </CardContent>
        </Card>

        <Card className="min-h-0">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-sm md:text-base">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 md:h-5 md:w-5 text-purple-600" />
                <span className="truncate">Put/Call Ratio</span>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="p-1 h-8 w-8 flex-shrink-0">
                    <Info className="h-4 w-4 text-gray-500" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5 text-purple-600" />
                      {dataSources.putCall.title}
                    </DialogTitle>
                    <DialogDescription className="space-y-3 text-left">
                      <p>{dataSources.putCall.description}</p>
                      <div className="space-y-2 text-sm">
                        <div><strong>Source:</strong> {dataSources.putCall.source}</div>
                        <div><strong>Update Frequency:</strong> {dataSources.putCall.updateFrequency}</div>
                        <div><strong>Coverage:</strong> {dataSources.putCall.coverage}</div>
                        <a 
                          href={dataSources.putCall.link} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          View Original Data <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </DialogDescription>
                  </DialogHeader>
                </DialogContent>
              </Dialog>
            </CardTitle>
            <CardDescription className="text-sm">
              Current: 0.72 | 
              <span className="ml-1 text-green-600">
                ↓ -5.2% (Bullish signal)
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-64 md:h-80 w-full">
              <MultiLineChart dataSets={[{
                name: "Put/Call Ratio",
                data: putCallData,
                color: '#8b5cf6'
              }]} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Interactive Sidebar */}
      <div className="w-full max-w-full">
        <InteractiveSidebar 
          factors={sentimentFactors} 
          category="sentiment-analysis"
        />
      </div>
    </div>
  )
}
