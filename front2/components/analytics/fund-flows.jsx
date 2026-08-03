"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Users, TrendingUp, TrendingDown, Activity, Info, ExternalLink, ArrowUpDown } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import MiniChart from "./mini-chart"
import { prepareChartData } from "@/lib/chart-utils"

export default function FundFlows() {
  const [selectedTimeframe, setSelectedTimeframe] = useState('3M')

  // Mock data for fund flows indicators
  const flowIndicators = [
    {
      id: "fund-flows",
      title: "Equity Fund Flows",
      category: "Fund Flows",
      currentValue: "+$12.5B",
      change: "+$3.2B",
      trend: "up",
      description: "Weekly net flows into equity mutual funds and ETFs",
      data: [
        { date: "Week 1", value: 8.2 },
        { date: "Week 2", value: 9.1 },
        { date: "Week 3", value: 10.3 },
        { date: "Week 4", value: 11.8 },
        { date: "Week 5", value: 12.1 },
        { date: "Week 6", value: 12.5 },
      ],
      source: "ICI / Morningstar",
      benchmark: "Positive flows indicate investor confidence"
    },
    {
      id: "etf-inflows",
      title: "ETF Inflows",
      category: "ETF Activity",
      currentValue: "+$18.7B",
      change: "+$4.1B",
      trend: "up",
      description: "Monthly net inflows to U.S. equity ETFs",
      data: [
        { date: "Jan", value: 12.2 },
        { date: "Feb", value: 14.5 },
        { date: "Mar", value: 15.8 },
        { date: "Apr", value: 16.9 },
        { date: "May", value: 17.2 },
        { date: "Jun", value: 18.7 },
      ],
      source: "Bloomberg",
      benchmark: "Strong ETF inflows often precede market strength"
    },
    {
      id: "etf-outflows",
      title: "Bond ETF Outflows",
      category: "ETF Activity",
      currentValue: "-$5.2B",
      change: "-$1.8B",
      trend: "down",
      description: "Monthly net outflows from bond ETFs",
      data: [
        { date: "Jan", value: -2.1 },
        { date: "Feb", value: -2.8 },
        { date: "Mar", value: -3.2 },
        { date: "Apr", value: -4.1 },
        { date: "May", value: -4.8 },
        { date: "Jun", value: -5.2 },
      ],
      source: "Bloomberg",
      benchmark: "Bond outflows may indicate risk-on sentiment"
    },
    {
      id: "margin-debt",
      title: "Margin Debt",
      category: "Leverage",
      currentValue: "$684B",
      change: "+$28B",
      trend: "up",
      description: "Total margin debt outstanding (NYSE)",
      data: [
        { date: "Jan", value: 632 },
        { date: "Feb", value: 645 },
        { date: "Mar", value: 658 },
        { date: "Apr", value: 667 },
        { date: "May", value: 675 },
        { date: "Jun", value: 684 },
      ],
      source: "NYSE",
      benchmark: "High margin debt can signal market tops"
    },
    {
      id: "institutional-flows",
      title: "Institutional Flows",
      category: "Professional Money",
      currentValue: "+$8.9B",
      change: "+$2.1B",
      trend: "up",
      description: "Net institutional equity flows (13F filings)",
      data: [
        { date: "Q4 2023", value: 5.2 },
        { date: "Q1 2024", value: 6.1 },
        { date: "Q2 2024", value: 6.8 },
        { date: "Q3 2024", value: 7.5 },
        { date: "Q4 2024", value: 8.1 },
        { date: "Q1 2025", value: 8.9 },
      ],
      source: "13F Filings",
      benchmark: "Institutional buying provides market stability"
    },
    {
      id: "retail-flows",
      title: "Retail vs Institutional",
      category: "Flow Composition",
      currentValue: "65%",
      change: "+5%",
      trend: "up",
      description: "Retail flows as % of total equity flows",
      data: [
        { date: "Jan", value: 55 },
        { date: "Feb", value: 58 },
        { date: "Mar", value: 60 },
        { date: "Apr", value: 62 },
        { date: "May", value: 63 },
        { date: "Jun", value: 65 },
      ],
      source: "Vanda Research",
      benchmark: "High retail participation can signal market extremes"
    },
    {
      id: "money-market-inflows",
      title: "Money Market Inflows",
      category: "Safe Haven",
      currentValue: "+$22.1B",
      change: "+$8.5B",
      trend: "up",
      description: "Weekly inflows to money market funds",
      data: [
        { date: "Week 1", value: 12.8 },
        { date: "Week 2", value: 14.2 },
        { date: "Week 3", value: 16.5 },
        { date: "Week 4", value: 18.9 },
        { date: "Week 5", value: 20.3 },
        { date: "Week 6", value: 22.1 },
      ],
      source: "ICI",
      benchmark: "High MM inflows can indicate risk-off sentiment"
    }
  ]

  const flowScore = {
    current: 7.2,
    previous: 6.8,
    level: "Strong Inflows",
    color: "bg-green-500"
  }

  const timeframeOptions = ['1M', '3M', '6M', '1Y', '2Y']

  const getTrendIcon = (trend) => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-4 w-4 text-green-600" />
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
            <Users className="h-8 w-8 text-violet-600" />
            Fund Flows
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
          ETF flows, mutual fund activity, and capital allocation trends
        </p>
      </div>

      {/* Overall Flow Score */}
      <Card className="border-l-4 border-l-green-500">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowUpDown className="h-5 w-5 text-green-600" />
              Fund Flow Momentum Score
            </div>
            <Badge className={`${flowScore.color} text-white`}>
              {flowScore.level}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="text-3xl font-bold text-gray-900 dark:text-white">
              {flowScore.current}/10
            </div>
            <div className="flex items-center gap-1 text-sm">
              <span className="text-gray-600 dark:text-gray-400">Previous:</span>
              <span>{flowScore.previous}</span>
              <TrendingUp className="h-4 w-4 text-green-600" />
              <span className="text-green-600">+{(flowScore.current - flowScore.previous).toFixed(1)}</span>
            </div>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            Composite score based on equity inflows, ETF activity, and institutional vs retail flows
          </p>
        </CardContent>
      </Card>

      {/* Flow Indicators Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {flowIndicators.map((indicator) => (
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
                        <Users className="h-5 w-5 text-violet-600" />
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
                            View Flow Data <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </DialogDescription>
                    </DialogHeader>
                  </DialogContent>
                </Dialog>
              </div>
              <Badge variant="outline" className="text-xs w-fit">
                {indicator.category}
              </Badge>
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
                      indicator.trend === 'up' ? 'text-green-600' : 
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
