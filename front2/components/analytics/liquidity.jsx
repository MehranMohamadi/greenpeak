"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Droplets, TrendingUp, TrendingDown, Activity, Info, ExternalLink } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import MiniChart from "./mini-chart"
import { prepareChartData } from "@/lib/chart-utils"

export default function Liquidity() {
  const [selectedTimeframe, setSelectedTimeframe] = useState('6M')

  // Mock data for liquidity indicators
  const liquidityIndicators = [
    {
      id: "real-interest-rate",
      title: "Real Interest Rate",
      category: "Interest Rates",
      currentValue: "2.1%",
      change: "+0.3%",
      trend: "up",
      severity: "normal",
      description: "Federal Funds Rate adjusted for inflation (CPI)",
      data: [
        { date: "2024-01", value: 1.5 },
        { date: "2024-02", value: 1.7 },
        { date: "2024-03", value: 1.8 },
        { date: "2024-04", value: 1.9 },
        { date: "2024-05", value: 2.0 },
        { date: "2024-06", value: 2.1 },
      ],
      source: "Federal Reserve / BLS",
      benchmark: "Positive = Restrictive, Negative = Accommodative"
    },
    {
      id: "money-supply-m1",
      title: "Money Supply (M1)",
      category: "Money Supply",
      currentValue: "$18.1T",
      change: "-2.1%",
      trend: "down",
      severity: "contractionary",
      description: "Most liquid money supply (currency + demand deposits)",
      data: [
        { date: "2024-01", value: 18.8 },
        { date: "2024-02", value: 18.6 },
        { date: "2024-03", value: 18.4 },
        { date: "2024-04", value: 18.3 },
        { date: "2024-05", value: 18.2 },
        { date: "2024-06", value: 18.1 },
      ],
      source: "Federal Reserve",
      benchmark: "YoY Growth: >5% = Expansionary, 0-5% = Normal, <0% = Contractionary"
    },
    {
      id: "money-supply-m2",
      title: "Money Supply (M2)",
      category: "Money Supply",
      currentValue: "$21.7T",
      change: "-1.8%",
      trend: "down",
      severity: "contractionary",
      description: "Broader money supply including savings and time deposits",
      data: [
        { date: "2024-01", value: 22.2 },
        { date: "2024-02", value: 22.0 },
        { date: "2024-03", value: 21.9 },
        { date: "2024-04", value: 21.8 },
        { date: "2024-05", value: 21.7 },
        { date: "2024-06", value: 21.7 },
      ],
      source: "Federal Reserve",
      benchmark: "YoY Growth: >8% = Expansionary, 3-8% = Normal, <3% = Contractionary"
    },
    {
      id: "reverse-repo",
      title: "Reverse Repo",
      category: "Fed Tools",
      currentValue: "$450B",
      change: "-$25B",
      trend: "down",
      severity: "normal",
      description: "Federal Reserve Overnight Reverse Repurchase Operations",
      data: [
        { date: "2024-01", value: 520 },
        { date: "2024-02", value: 495 },
        { date: "2024-03", value: 485 },
        { date: "2024-04", value: 470 },
        { date: "2024-05", value: 460 },
        { date: "2024-06", value: 450 },
      ],
      source: "Federal Reserve Bank of New York",
      benchmark: "Lower levels indicate more market liquidity"
    },
    {
      id: "bank-lending-rate",
      title: "Bank Lending Rate",
      category: "Credit Conditions",
      currentValue: "6.75%",
      change: "+0.25%",
      trend: "up",
      severity: "tightening",
      description: "Average prime lending rate for commercial banks",
      data: [
        { date: "2024-01", value: 6.25 },
        { date: "2024-02", value: 6.25 },
        { date: "2024-03", value: 6.50 },
        { date: "2024-04", value: 6.50 },
        { date: "2024-05", value: 6.75 },
        { date: "2024-06", value: 6.75 },
      ],
      source: "Federal Reserve",
      benchmark: "Higher rates indicate tighter credit conditions"
    },
    {
      id: "sofr",
      title: "SOFR Rate",
      category: "Funding Markets",
      currentValue: "5.35%",
      change: "+0.05%",
      trend: "up",
      severity: "normal",
      description: "Secured Overnight Financing Rate",
      data: [
        { date: "2024-01", value: 5.30 },
        { date: "2024-02", value: 5.32 },
        { date: "2024-03", value: 5.31 },
        { date: "2024-04", value: 5.33 },
        { date: "2024-05", value: 5.34 },
        { date: "2024-06", value: 5.35 },
      ],
      source: "ICE Benchmark Administration",
      benchmark: "Risk-free rate benchmark for derivatives and loans"
    },
    {
      id: "bank-reserves",
      title: "Bank Reserves",
      category: "Banking System",
      currentValue: "$3.2T",
      change: "+$45B",
      trend: "up",
      severity: "normal",
      description: "Total reserves held by depository institutions",
      data: [
        { date: "2024-01", value: 3.05 },
        { date: "2024-02", value: 3.08 },
        { date: "2024-03", value: 3.12 },
        { date: "2024-04", value: 3.15 },
        { date: "2024-05", value: 3.18 },
        { date: "2024-06", value: 3.20 },
      ],
      source: "Federal Reserve",
      benchmark: "Higher reserves support banking system liquidity"
    }
  ]

  const liquidityScore = {
    current: 6.8,
    previous: 7.2,
    level: "Moderate",
    color: "bg-yellow-500"
  }

  const timeframeOptions = ['1M', '3M', '6M', '1Y', '2Y']

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'expansionary': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'normal': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'contractionary': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      case 'tightening': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    }
  }

  const getTrendIcon = (trend) => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-4 w-4 text-blue-600" />
      case 'down': return <TrendingDown className="h-4 w-4 text-red-600" />
      default: return <Activity className="h-4 w-4 text-gray-600" />
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-4">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-3">
            <Activity className="h-8 w-8 text-cyan-600" />
            Liquidity
          </h1>
          
          {/* Time Frame Selector */}
          <div className="flex gap-2 flex-wrap">
            {timeframeOptions.map(option => (
              <Button
                key={option}
                variant={selectedTimeframe === option ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedTimeframe(option)}
                className="min-w-[3rem]"
              >
                {option}
              </Button>
            ))}
          </div>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          Market liquidity conditions, funding markets, and flow analysis
        </p>
      </div>

      {/* Overall Liquidity Score */}
      <Card className="border-l-4 border-l-cyan-500">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Droplets className="h-5 w-5 text-cyan-600" />
              Market Liquidity Score
            </div>
            <Badge className={`${liquidityScore.color} text-white`}>
              {liquidityScore.level}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="text-3xl font-bold text-gray-900 dark:text-white">
              {liquidityScore.current}/10
            </div>
            <div className="flex items-center gap-1 text-sm">
              <span className="text-gray-600 dark:text-gray-400">Previous:</span>
              <span>{liquidityScore.previous}</span>
              <TrendingDown className="h-4 w-4 text-red-600" />
              <span className="text-red-600">{(liquidityScore.current - liquidityScore.previous).toFixed(1)}</span>
            </div>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            Composite score based on money supply, interest rates, funding conditions, and credit availability
          </p>
        </CardContent>
      </Card>

      {/* Liquidity Indicators Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {liquidityIndicators.map((indicator) => (
          <Card key={indicator.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  {getTrendIcon(indicator.trend)}
                  {indicator.title}
                </CardTitle>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="p-1 h-8 w-8">
                      <Info className="h-4 w-4 text-gray-500" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Activity className="h-5 w-5 text-cyan-600" />
                        {indicator.title}
                      </DialogTitle>
                      <DialogDescription className="space-y-3 text-left">
                        <p>{indicator.description}</p>
                        <div className="space-y-2 text-sm">
                          <div><strong>Category:</strong> {indicator.category}</div>
                          <div><strong>Source:</strong> {indicator.source}</div>
                          <div><strong>Benchmark:</strong> {indicator.benchmark}</div>
                          <a 
                            href="#" 
                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            View Data Source <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </DialogDescription>
                    </DialogHeader>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {indicator.category}
                </Badge>
                <Badge className={`text-xs ${getSeverityColor(indicator.severity)}`}>
                  {indicator.severity.toUpperCase()}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">
                    {indicator.currentValue}
                  </span>
                  <div className="flex items-center gap-1 text-sm">
                    {getTrendIcon(indicator.trend)}
                    <span className={
                      indicator.trend === 'up' ? 'text-blue-600' : 
                      indicator.trend === 'down' ? 'text-red-600' : 'text-gray-600'
                    }>
                      {indicator.change}
                    </span>
                  </div>
                </div>
                
                {/* Chart */}
                <div className="h-16 w-full">
                  <MiniChart 
                    data={prepareChartData(indicator.data)}
                    trend={indicator.trend}
                  />
                </div>
                
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {indicator.description}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
