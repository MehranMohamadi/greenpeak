"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Grid3X3,
  ChevronRight,
  ChevronLeft,
  DollarSign,
  TrendingUp,
  Zap,
  PieChart,
  BarChart3,
  Activity,
  Maximize2,Info,Target ,
  Globe,
} from "lucide-react"

import CategoryGrid from "../analytics/category-grid"
import MiniChart from "./mini-chart"
import MainLoading from "@/components/ui/MainLoading"
import useIntermarketSymbol from "@/hooks/useIntermarketSymbol"

const MultiLineChart = dynamic(() => import("../charts/multi-line-chart"), { ssr: false })
const FullScreenChart = dynamic(() => import("./fullscreen-chart"), { ssr: false })

export default function Intermarket() {
  // UI States
  const [selectedFactor, setSelectedFactor] = useState("dxy")
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [showCategoryGrid, setShowCategoryGrid] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState("Intermarket")

  const intermarketFactors = [
    { id: "dxy", series: "DTWEXBGS", name: "Dollar Index (DXY)" },
    { id: "10y-yield", series: "DGS10", name: "10Y Treasury Yield" },
    { id: "gold", series: "GOLDAMGBD228NLBM", name: "Gold Price" },
    { id: "oil", series: "DCOILWTICO", name: "Crude Oil WTI" },
    { id: "copper", series: "PCOPPUSDM", name: "Copper Price" },
    { id: "hyg", series: "BAMLH0A0HYM2", name: "High-Yield Credit Spread" },
    { id: "tlt", series: "DGS20", name: "20Y Treasury Yield" },
  ]


  const [selectedPeriod, setSelectedPeriod] = useState("5Y")
const [isTransitioning, setIsTransitioning] = useState(false)

function slicePeriodData(data, period) {
  if (!data || data.length === 0) return []

  const map = {
    "1M": 22,
    "6M": 22 * 6,
    "1Y": 252,
    "5Y": 252 * 5,
    "10Y": 252 * 10,
    "25Y": 252 * 25,
    "MAX": data.length,
  }

  const size = map[period] || data.length
  return data.slice(-size)
}

function handlePeriodChange(period) {
  if (period === selectedPeriod) return

  setIsTransitioning(true)
  setSelectedPeriod(period)

  setTimeout(() => {
    setIsTransitioning(false)
  }, 300)
}



  function getPeriodDescription(period) {
  switch (period) {
    case "1M": return "1 Month"
    case "6M": return "6 Months"
    case "1Y": return "1 Year"
    case "5Y": return "5 Years"
    case "10Y": return "10 Years"
    case "25Y": return "25 Years"
    default: return "Full History"
  }
}



  // Current factor
  const selectedFactorObject =
    intermarketFactors.find((x) => x.id === selectedFactor) || intermarketFactors[0]


    
  // Fetch from FRED API
  const { data: apiData, loading: chartLoading, error } = useIntermarketSymbol(
    selectedFactorObject.series
  )

  // Convert FRED → ChartData
  let chartData = []

  if (apiData?.length > 0) {
    chartData = apiData
      .filter((d) => d.value !== "." && d.value !== null)
      .map((d) => ({
        date: d.date,
        value: Number(d.value),
        category: selectedFactorObject.name,
      }))
  }

const selectedFactorData = chartData.length
  ? [slicePeriodData(chartData, selectedPeriod)]
  : [[]]


  // Latest values for Main Card + Score
  const latest = chartData[chartData.length - 1]?.value
  const prev = chartData[chartData.length - 2]?.value
  const change = latest && prev ? (latest - prev) : null
  const changePercent = latest && prev ? ((change / prev) * 100) : null
  const trend = change > 0 ? "up" : "down"

  // Factor icon

  function getRateCutSignal(fedFundsData) {
  if (!fedFundsData?.length) return "Unknown"

  const last = Number(fedFundsData[fedFundsData.length - 1]?.value)
  const prev = Number(fedFundsData[fedFundsData.length - 2]?.value)

  if (!last || !prev) return "Unknown"

  if (last < prev) return "Yes"
  if (last === prev) return "Neutral"
  return "No"
}

function getQTSignal(balanceSheetData) {
  if (!balanceSheetData?.length) return "Unknown"

  const last = Number(balanceSheetData[balanceSheetData.length - 1]?.value)
  const prev = Number(balanceSheetData[balanceSheetData.length - 2]?.value)

  if (last < prev) return "QT Continue"
  if (last > prev) return "QE Trend"
  return "Flat"
}

function getPolicyRisk(curveData) {
  if (!curveData?.length) return "Unknown"

  const last = Number(curveData[curveData.length - 1]?.value)

  if (last < -0.5) return "High"
  if (last < 0) return "Medium"
  return "Low"
}
  const getIconComponent = (id) => {
    switch (id) {
      case "dxy": return DollarSign
      case "10y-yield": return TrendingUp
      case "gold": return Zap
      case "oil": return Activity
      case "hyg": return BarChart3
      case "copper": return PieChart
      default: return Globe
    }
  }

  const { data: fedFunds } = useIntermarketSymbol("FEDFUNDS")
const { data: balanceSheet } = useIntermarketSymbol("WALCL")
const { data: yieldCurve } = useIntermarketSymbol("T10Y3M")
const rateCut = getRateCutSignal(fedFunds)
const qtStatus = getQTSignal(balanceSheet)
const policyRisk = getPolicyRisk(yieldCurve)

  const policyColorMap = {
  Yes: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  No: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  Neutral: "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-200",

  "QT Continue": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  "QE Trend": "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  Flat: "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-200",

  High: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  Medium: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  Low: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",

  Unknown: "bg-gray-300 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
}

function navigateToPrevFactor() {
  const index = intermarketFactors.findIndex(f => f.id === selectedFactor)
  const prevIndex = (index - 1 + intermarketFactors.length) % intermarketFactors.length
  setSelectedFactor(intermarketFactors[prevIndex].id)
}

function navigateToNextFactor() {
  const index = intermarketFactors.findIndex(f => f.id === selectedFactor)
  const nextIndex = (index + 1) % intermarketFactors.length
  setSelectedFactor(intermarketFactors[nextIndex].id)
}

const updateInfo = {
  lastUpdate: chartData.at(-1)?.date || "—",
  nextRelease: "FRED Scheduled",
  statusColor: "text-blue-500"
}

const chartDataForChart = selectedFactorData.map(series =>
  series.map(d => ({
    ...d,
    time: d.date, // یک property جدید time اضافه کن
  }))
)

  // Loading state
  if (chartLoading) return <MainLoading />

  // Error state
  if (error) return <div className="p-8 text-red-500">Error: {error.message}</div>

  return (
    <div className="p-6 space-y-6 fade-in bg-white dark:bg-[#0F0F12]">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-teal-600 to-cyan-600 rounded-xl shadow-lg">
            <Globe className="h-6 w-6 text-white" />
          </div>
          Intermarket Analysis
        </h1>

        <div className="flex justify-between items-center">
          <p className="text-gray-600 dark:text-gray-400">
            Cross‑asset relationships between currencies, commodities, bonds & credit markets
          </p>

          <div className="flex gap-2">
            <Button variant="ghost" size="sm "          className="h-8 w-8 p-0 hover:bg-gray-100 dark:hover:bg-gray-800"
>
              <ChevronLeft className="h-5 w-5" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCategoryGrid(!showCategoryGrid)}
              
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>

            <Button variant="ghost" size="sm"           className="h-8 w-8 p-0 hover:bg-gray-100 dark:hover:bg-gray-800"
>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Category Grid */}
      {showCategoryGrid && (
        <CategoryGrid
          selectedCategory={selectedCategory}
          show={showCategoryGrid}
          onClose={() => setShowCategoryGrid(false)}
        />
      )}

      {/* MAIN GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">

        {/* SCORE CARD */}
        <Card className="lg:col-span-2 card-glow">
          <CardHeader>
            <CardTitle>Latest Value</CardTitle>
          </CardHeader>

          <CardContent>
            <div className="text-center p-3 rounded-xl border">
              <div className="text-4xl font-black text-teal-600">
                {latest ? latest.toFixed(2) : "—"}
              </div>

              <Badge className="mt-3 bg-teal-100 text-teal-800">
                {trend === "up" ? "Bullish" : "Bearish"}
              </Badge>
            </div>
<div className="space-y-2 mt-6">
  <h4 className="font-semibold text-gray-900 dark:text-white text-xs">
    Key Insights
  </h4>

  <div className="text-xs space-y-1">

    {/* Insight 1 — Trend */}
    <div className="flex items-start gap-2">
      <div
        className={`w-1.5 h-1.5 rounded-full mt-1 ${
          trend === "up" ? "bg-green-500" : "bg-red-500"
        }`}
      />
      <span>
        {selectedFactorObject.name} is showing a{" "}
        <strong>{trend === "up" ? "positive" : "negative"}</strong> momentum
        with a {changePercent?.toFixed(2)}% move.
      </span>
    </div>

    {/* Insight 2 — Strength */}
    <div className="flex items-start gap-2">
      <div
        className={`w-1.5 h-1.5 rounded-full mt-1 ${
          Math.abs(changePercent) > 1
            ? "bg-yellow-500"
            : "bg-gray-400"
        }`}
      />
      <span>
        Recent volatility:{" "}
        <strong>
          {Math.abs(changePercent) > 1 ? "Elevated" : "Stable"}
        </strong>
        .
      </span>
    </div>

    {/* Insight 3 — Factor-specific meaning */}
    <div className="flex items-start gap-2">
      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1" />

      <span>
        {(() => {
          switch (selectedFactorObject.id) {
            case "dxy":
              return trend === "up"
                ? "Stronger USD may pressure commodities & emerging markets."
                : "Weaker USD tends to support risk assets and commodities."

            case "10y-yield":
              return trend === "up"
                ? "Rising yields indicate tighter financial conditions."
                : "Falling yields signal defensive positioning."

            case "gold":
              return trend === "up"
                ? "Gold strength suggests risk aversion or falling yields."
                : "Gold weakness indicates improving risk appetite."

            case "oil":
              return trend === "up"
                ? "Oil rising — possible demand strength or supply risk."
                : "Oil falling — potential slowdown or supply relief."

            case "copper":
              return trend === "up"
                ? "Copper strength suggests improving economic activity."
                : "Copper weakness may indicate slowing industrial demand."

            case "hyg":
              return trend === "up"
                ? "High-yield credit spreads tightening — bullish risk sentiment."
                : "Spreads widening — caution in credit markets."

            case "tlt":
              return trend === "up"
                ? "Long-term yields rising — pressure on duration assets."
                : "Long yields falling — investors seeking safety."

            default:
              return "Mixed signals across intermarket themes."
          }
        })()}
      </span>

    </div>
      <div className="space-y-2 mt-4">
  <h4 className="font-semibold text-gray-900 dark:text-white text-xs">
    Policy Outlook
  </h4>

  <div className="space-y-1 text-xs">

    {/* Rate Cuts */}
    <div className="flex items-center justify-between hover:bg-gray-50 dark:hover:bg-[#0F0F12] p-1.5 rounded-lg transition-all duration-200 cursor-pointer">
      <span>Rate Cuts</span>
      <div className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-semibold text-xs transition-all duration-200 border-transparent hover:shadow-lg hover:scale-105 ${policyColorMap[rateCut]}`}>
        {rateCut}
      </div>
    </div>

    {/* QT / QE */}
    <div className="flex items-center justify-between hover:bg-gray-50 dark:hover:bg-[#0F0F12] p-1.5 rounded-lg transition-all duration-200 cursor-pointer">
      <span>Balance Sheet</span>
      <div className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-semibold text-xs transition-all duration-200 border-transparent hover:shadow-lg hover:scale-105 ${policyColorMap[qtStatus]}`}>
        {qtStatus}
      </div>
    </div>

    {/* Policy Risk */}
    <div className="flex items-center justify-between hover:bg-gray-50 dark:hover:bg-[#0F0F12] p-1.5 rounded-lg transition-all duration-200 cursor-pointer">
      <span>Policy Risk</span>
      <div className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-semibold text-xs transition-all duration-200 border-transparent hover:shadow-lg hover:scale-105 ${policyColorMap[policyRisk]}`}>
        {policyRisk}
      </div>
    </div>

  </div>
</div>
  </div>
</div>
          </CardContent>
        </Card>

        {/* MAIN CHART */}
   <Card className="lg:col-span-5 slide-in-right stagger-2 hover:shadow-lg transition-all duration-200 border border-gray-200 dark:border-[#2B2B30] shadow-sm bg-white dark:bg-[#1F1F23] card-glow">

  <CardHeader className="pb-3">
    <CardTitle className="flex items-center justify-between text-lg font-semibold">
      <div className="flex items-center gap-3">

        {/* Selected Factor */}
        {selectedFactorObject ? (
          <div className="flex items-center gap-2">
            {(() => {
              const IconComponent = getIconComponent(selectedFactorObject.id)
              return <IconComponent className="h-5 w-5 text-blue-600" />
            })()}
            {selectedFactorObject.name}
          </div>
        ) : (
          <span>Select a factor to view detailed chart</span>
        )}

        {/* Full Screen Button */}
        {selectedFactorObject && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsFullScreen(true)}
            className="h-8 w-8 p-0 ml-2 hover:bg-blue-50 dark:hover:bg-blue-900 hover:scale-105 transition-all duration-200 hover:shadow-md"
            title="Full Screen"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Time Frame Buttons */}
      <div className="flex gap-2">
        {['1M', '6M', '1Y', '5Y', '10Y', '25Y', 'MAX'].map((period) => (
          <Button
            key={period}
            variant={selectedPeriod === period ? "default" : "outline"}
            size="sm"
            onClick={() => handlePeriodChange(period)}
            className={`timeframe-button transition-all text-xs duration-200 hover:scale-105 hover:shadow-md ${
              selectedPeriod === period ? 'bg-blue-600 text-white shadow-lg' : ''
            } ${isTransitioning ? 'pointer-events-none opacity-70' : ''}`}
            disabled={isTransitioning}
          >
            {period}
          </Button>
        ))}
      </div>
    </CardTitle>

    {/* DESCRIPTION */}
    {selectedFactorObject && (
      <CardDescription className="flex flex-wrap items-center gap-4 text-sm mt-2">
        <span>
          Current: {latest?.toFixed(2)} |
          <span className={`ml-1 ${trend === "up" ? "text-green-600" : "text-red-500"}`}>
            {change?.toFixed(2)} ({changePercent?.toFixed(2)}%)
          </span>
        </span>

        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
          <span>Source: FRED</span>
        </div>
      </CardDescription>
    )}
  </CardHeader>

  {/* MAIN CHART */}
  <CardContent className="pt-0">
   <div className={`h-80 w-full main-chart-container ${isTransitioning ? 'chart-updating' : ''}`}>
  {selectedFactorData && selectedFactorData[0].length > 0 ? (
    <div className="chart-fade-in">
<MultiLineChart dataSets={chartDataForChart} isTransitioning={isTransitioning} />
    </div>
  ) : (
    <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
      {chartLoading ? (
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

    {/* FOOTER: UPDATE INFO + NAVIGATION */}
    <div className="flex justify-between items-center mt-4">

      {/* Left Info */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1 px-2 py-1 bg-gray-50 dark:bg-[#1A1A1A] rounded-md border border-gray-200 dark:border-[#2B2B30]">
          <Info className="h-4 w-4" />
          Updated: {chartData.length > 0 ? chartData.at(-1).date : "—"}
        </span>

        <span className="flex items-center gap-1 px-2 py-1 bg-gray-50 dark:bg-[#1A1A1A] rounded-md border border-gray-200 dark:border-[#2B2B30]">
          <Target className="h-4 w-4" />
          Next Release: FRED Schedule
        </span>
      </div>

      {/* Navigation */}
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

      {/* FACTOR CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
        {intermarketFactors.map((factor) => {
          const Icon = getIconComponent(factor.id)
          const isSelected = selectedFactor === factor.id

          const smallChart = chartData.slice(-30)

          return (
            <Card
              key={factor.id}
              onClick={() => setSelectedFactor(factor.id)}
              className={`cursor-pointer transition-all ${
                isSelected ? "ring-2 ring-teal-500" : ""
              }`}
            >
              <CardHeader>
                <CardTitle className="flex gap-2 items-center text-sm">
                  <Icon className="h-4 w-4" />
                  {factor.name}
                </CardTitle>
              </CardHeader>

              <CardContent>
                <MiniChart data={smallChart} trend={trend} isTransitioning={false} />

                <div className="mt-3">
                  <span className="text-xl font-bold">
                    {latest?.toFixed(2)}
                  </span>

                  <span
                    className={`ml-2 ${
                      trend === "up" ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {change?.toFixed(2)} ({changePercent?.toFixed(2)}%)
                  </span>
                </div>

                <div className="text-xs mt-2 text-gray-500">
                  FRED Series: {factor.series}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* FULL SCREEN CHART */}
      <FullScreenChart
        isOpen={isFullScreen}
        onClose={() => setIsFullScreen(false)}
        selectedFactor={selectedFactorObject}
        chartData={chartData}
      />
    </div>
  )
}