"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import MultiLineChart from "../charts/multi-line-chart"
import { ArrowLeft, ExternalLink, TrendingUp, TrendingDown } from "lucide-react"
import { useRouter } from "next/navigation"

export default function FactorDetail({ factor, category }) {
  const router = useRouter()

  const getTrendIcon = (trend) => {
    return trend === "up" ? (
      <TrendingUp className="h-5 w-5 text-green-500" />
    ) : (
      <TrendingDown className="h-5 w-5 text-red-500" />
    )
  }

  const getTrendColor = (trend) => {
    return trend === "up" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="outline" onClick={() => router.back()} className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-3">
            {getTrendIcon(factor.trend)}
            {factor.title}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">{factor.description}</p>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Current Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{factor.currentValue}</div>
            <div className={`text-sm ${getTrendColor(factor.trend)}`}>{factor.change}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Data Source</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold text-gray-900 dark:text-white">{factor.source}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Official Source</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Last Updated</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold text-gray-900 dark:text-white">2 hours ago</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Real-time data</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Market Impact</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold text-gray-900 dark:text-white">High</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">S&P 500 correlation</div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {getTrendIcon(factor.trend)}
                {factor.title} - Historical Data
              </CardTitle>
              <CardDescription>Detailed time series analysis with extended historical data</CardDescription>
            </div>
            <Button variant="outline" className="flex items-center gap-2 bg-transparent">
              <ExternalLink className="h-4 w-4" />
              View Source
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-96">
            <MultiLineChart dataSets={[factor.chartData]} />
          </div>
        </CardContent>
      </Card>

      {/* Analysis & Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Key Insights</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li>• Recent trend shows {factor.trend === "up" ? "upward" : "downward"} momentum</li>
              <li>• Current level is {factor.trend === "up" ? "above" : "below"} historical average</li>
              <li>• Strong correlation with S&P 500 performance</li>
              <li>• Market expects continued {factor.trend === "up" ? "growth" : "decline"} in coming months</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Market Impact</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">S&P 500 Correlation</span>
                <span className="font-semibold">0.78</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Volatility Impact</span>
                <span className="font-semibold">Medium</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Next Update</span>
                <span className="font-semibold">Next Week</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
