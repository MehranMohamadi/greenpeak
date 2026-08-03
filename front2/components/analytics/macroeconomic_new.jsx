"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import MultiLineChart from "../charts/multi-line-chart"
import InteractiveSidebar from "./interactive-sidebar"
import { Activity, TrendingUp, Users, Loader2, Info, ExternalLink } from "lucide-react"
import useGDPData from "@/hooks/useGDPData"
import useUNRATEData from "@/hooks/useUNRATEData"
import { 
  processGDPData, 
  processUNRATEData, 
  getLatestValue, 
  calculateChange, 
  calculateYoYChange,
  getDataForPeriod 
} from "@/hooks/macroeconomicDataUtils"

const macroFactors = [
  {
    id: "nonfarm-payroll",
    title: "Non-Farm Payroll",
    currentValue: "+187K",
    change: "-23K",
    trend: "down",
    description: "Monthly change in non-farm employment",
    source: "BLS",
    chartData: [
      { time: "2023-01-01", value: 230 },
      { time: "2023-02-01", value: 210 },
      { time: "2023-03-01", value: 195 },
      { time: "2023-04-01", value: 175 },
      { time: "2023-05-01", value: 190 },
      { time: "2023-06-01", value: 187 },
    ],
  },
  {
    id: "ism-pmi",
    title: "ISM PMI Manufacturing",
    currentValue: "48.7",
    change: "-1.2",
    trend: "down",
    description: "Manufacturing purchasing managers index",
    source: "ISM",
    chartData: [
      { time: "2023-01-01", value: 52.1 },
      { time: "2023-02-01", value: 51.3 },
      { time: "2023-03-01", value: 50.2 },
      { time: "2023-04-01", value: 49.8 },
      { time: "2023-05-01", value: 49.9 },
      { time: "2023-06-01", value: 48.7 },
    ],
  },
  {
    id: "retail-sales",
    title: "Retail Sales",
    currentValue: "+0.7%",
    change: "+0.2%",
    trend: "up",
    description: "Monthly retail sales growth",
    source: "U.S. Census Bureau",
    chartData: [
      { time: "2023-01-01", value: 0.3 },
      { time: "2023-02-01", value: 0.4 },
      { time: "2023-03-01", value: 0.5 },
      { time: "2023-04-01", value: 0.6 },
      { time: "2023-05-01", value: 0.5 },
      { time: "2023-06-01", value: 0.7 },
    ],
  },
  {
    id: "consumer-confidence",
    title: "Consumer Confidence",
    currentValue: "117.0",
    change: "+2.3",
    trend: "up",
    description: "Consumer confidence index",
    source: "The Conference Board",
    chartData: [
      { time: "2023-01-01", value: 112.0 },
      { time: "2023-02-01", value: 113.5 },
      { time: "2023-03-01", value: 114.2 },
      { time: "2023-04-01", value: 115.1 },
      { time: "2023-05-01", value: 114.7 },
      { time: "2023-06-01", value: 117.0 },
    ],
  },
]

export default function Macroeconomic() {
  const [selectedPeriod, setSelectedPeriod] = useState('5Y')  // Start with maximum zoom out
  
  const { data: gdpData, loading: gdpLoading, error: gdpError, metadata: gdpMetadata } = useGDPData()
  const { data: unrateData, loading: unrateLoading, error: unrateError, metadata: unrateMetadata } = useUNRATEData()

  // Loading and error states
  const loading = gdpLoading || unrateLoading
  const error = gdpError || unrateError

  // Process data for the selected time period
  const processedGDPData = processGDPData(getDataForPeriod(gdpData, selectedPeriod))
  const processedUNRATEData = processUNRATEData(getDataForPeriod(unrateData, selectedPeriod))

  // Get current values and changes for main charts
  const latestGDP = getLatestValue(gdpData)
  const latestUNRATE = getLatestValue(unrateData)
  const gdpChange = calculateYoYChange(gdpData)
  const unrateChange = calculateYoYChange(unrateData)

  // Time frame buttons
  const timeFrameButtons = [
    { label: '1Y', value: '1Y' },
    { label: '5Y', value: '5Y' },
    { label: '10Y', value: '10Y' },
    { label: '25Y', value: '25Y' },
    { label: 'MAX', value: 'MAX' }
  ]

  // Data source information
  const dataSources = {
    gdp: {
      title: "Gross Domestic Product (GDP)",
      description: "Gross Domestic Product (GDP) is a comprehensive measure of the total economic output of a country. It represents the market value of all final goods and services produced within a country's borders during a specific time period.",
      source: "U.S. Bureau of Economic Analysis (BEA)",
      updateFrequency: "Quarterly",
      coverage: "1947 to Present",
      link: "https://fred.stlouisfed.org/series/GDP",
    },
    unrate: {
      title: "Unemployment Rate (UNRATE)",
      description: "The unemployment rate represents the number of unemployed as a percentage of the labor force. Labor force data are restricted to people 16 years of age and older, who currently reside in 1 of the 50 states or the District of Columbia.",
      source: "U.S. Bureau of Labor Statistics (BLS)",
      updateFrequency: "Monthly",
      coverage: "1948 to Present", 
      link: "https://fred.stlouisfed.org/series/UNRATE",
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-6 max-w-full overflow-hidden">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-3">
            <Activity className="h-6 w-6 md:h-8 md:w-8 text-green-600" />
            Macroeconomic Indicators
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Key economic indicators showing growth, employment, inflation, and consumer sentiment
          </p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardHeader>
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="h-64 md:h-80 bg-gray-200 dark:bg-gray-700 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="p-4 md:p-6 space-y-6 max-w-full overflow-hidden">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-3">
            <Activity className="h-6 w-6 md:h-8 md:w-8 text-green-600" />
            Macroeconomic Indicators
          </h1>
          <p className="text-red-600 dark:text-red-400">
            Error loading data: {error}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-full overflow-hidden">
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-4">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Activity className="h-6 w-6 md:h-8 md:w-8 text-green-600" />
            Macroeconomic Indicators
          </h1>
          
          {/* Time Frame Selector - Top Right */}
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
          Key economic indicators showing growth, employment, inflation, and consumer sentiment
        </p>
      </div>

      {/* Main Charts - Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card className="min-h-0">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-sm md:text-base">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-green-600" />
                <span className="truncate">GDP Growth Rate</span>
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
                      <TrendingUp className="h-5 w-5 text-green-600" />
                      {dataSources.gdp.title}
                    </DialogTitle>
                    <DialogDescription className="space-y-3 text-left">
                      <p>{dataSources.gdp.description}</p>
                      <div className="space-y-2 text-sm">
                        <div><strong>Source:</strong> {dataSources.gdp.source}</div>
                        <div><strong>Update Frequency:</strong> {dataSources.gdp.updateFrequency}</div>
                        <div><strong>Coverage:</strong> {dataSources.gdp.coverage}</div>
                        <a 
                          href={dataSources.gdp.link} 
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
              Current: {latestGDP.toFixed(1)}T | 
              <span className={`ml-1 ${gdpChange.direction === 'up' ? 'text-green-600' : gdpChange.direction === 'down' ? 'text-red-600' : 'text-gray-600'}`}>
                {gdpChange.direction === 'up' ? '↑' : gdpChange.direction === 'down' ? '↓' : '→'} {gdpChange.change.toFixed(2)}% YoY
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-64 md:h-80 w-full">
              <MultiLineChart dataSets={[processedGDPData]} />
            </div>
          </CardContent>
        </Card>

        <Card className="min-h-0">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-sm md:text-base">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 md:h-5 md:w-5 text-blue-600" />
                <span className="truncate">Unemployment Rate</span>
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
                      <Users className="h-5 w-5 text-blue-600" />
                      {dataSources.unrate.title}
                    </DialogTitle>
                    <DialogDescription className="space-y-3 text-left">
                      <p>{dataSources.unrate.description}</p>
                      <div className="space-y-2 text-sm">
                        <div><strong>Source:</strong> {dataSources.unrate.source}</div>
                        <div><strong>Update Frequency:</strong> {dataSources.unrate.updateFrequency}</div>
                        <div><strong>Coverage:</strong> {dataSources.unrate.coverage}</div>
                        <a 
                          href={dataSources.unrate.link} 
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
              Current: {latestUNRATE.toFixed(1)}% | 
              <span className={`ml-1 ${unrateChange.direction === 'up' ? 'text-red-600' : unrateChange.direction === 'down' ? 'text-green-600' : 'text-gray-600'}`}>
                {unrateChange.direction === 'up' ? '↑' : unrateChange.direction === 'down' ? '↓' : '→'} {unrateChange.change.toFixed(2)}pp YoY
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-64 md:h-80 w-full">
              <MultiLineChart dataSets={[processedUNRATEData]} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Interactive Sidebar */}
      <InteractiveSidebar factors={macroFactors} category="macroeconomic" />
    </div>
  )
}
