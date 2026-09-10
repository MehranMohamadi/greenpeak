"use client"

import { BarChart3, Gauge, Scale, Users, Waves } from "lucide-react"
import useSentimentData from "@/hooks/useSentimentData"
import { sliceChartPeriod } from "@/lib/chart-data"
import GroupAnalysisLayout from "./group-analysis-layout"

const factors = [
  { id: "vix", key: "vix", indicatorId: "vix", title: "CBOE Volatility Index", group: "Volatility", icon: Gauge, unit: "index", decimals: 2, description: "Market expectation of near-term S&P 500 volatility conveyed by option prices." },
  { id: "spx_put_call_ratio", key: "spx_put_call_ratio", indicatorId: "spx_put_call_ratio", title: "SPX + SPXW Put/Call Ratio", group: "Options sentiment", icon: Scale, unit: "ratio", decimals: 2, description: "Cboe reported SPX and SPXW put volume divided by call volume." },
  { id: "aaii_bull_bear_spread", key: "aaii_bull_bear_spread", indicatorId: "aaii_bull_bear_spread", title: "AAII Investor Sentiment", group: "Survey sentiment", icon: Users, unit: "percentage points", decimals: 1, description: "The card shows the weekly bullish-minus-bearish spread; the selected chart shows bullish, neutral, and bearish shares." },
  { id: "cftc_sp500_positioning", key: "cftc_sp500_positioning", indicatorId: "cftc_sp500_positioning", title: "CFTC S&P 500 Futures Positioning", group: "Positioning", icon: BarChart3, unit: "contracts", decimals: 0, description: "TFF futures-only net positions for E-mini S&P 500 Asset Managers and Leveraged Money." },
  { id: "vix_term_structure", key: "vix_term_structure", indicatorId: "vix_term_structure", title: "VIX Term Structure", group: "Volatility", icon: Waves, unit: "volatility points", decimals: 2, description: "The card shows VIX1Y minus VIX9D; the selected chart shows VIX9D, VIX, VIX3M, VIX6M, and VIX1Y." },
]
const periods = ["1M", "6M", "1Y", "5Y", "10Y", "25Y", "MAX"]
const labels = {
  bullish: "Bullish", neutral: "Neutral", bearish: "Bearish",
  asset_manager_net: "Asset Manager net", leveraged_money_net: "Leveraged Money net",
  vix9d: "VIX9D", vix: "VIX", vix3m: "VIX3M", vix6m: "VIX6M", vix1y: "VIX1Y",
}

export default function SentimentAnalysis() {
  const { results } = useSentimentData()
  return <GroupAnalysisLayout
    page="sentiment"
    title="Positioning, Sentiment & Volatility"
    domainId="positioning_sentiment_derivatives_volatility"
    factors={factors}
    periods={periods}
    results={results}
    getData={(item) => item?.data || []}
    getMetadata={(item) => item?.metadata}
    getError={(item) => item?.error}
    getChartSeries={(item) => Object.entries(item?.series || {}).map(([key, data]) => ({ label: labels[key] || key, data }))}
    slicePeriod={sliceChartPeriod}
    formatValue={(value, factor) => {
      if (!Number.isFinite(value)) return "N/A"
      if (factor.unit === "contracts") return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value)
      if (factor.unit === "percentage points") return `${value.toFixed(factor.decimals)} pp`
      return value.toFixed(factor.decimals)
    }}
  />
}
