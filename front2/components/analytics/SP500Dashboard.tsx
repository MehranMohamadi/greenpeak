"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  BarChart3,
  LoaderCircle,
  RefreshCw,
  Zap,
} from "lucide-react"
import Link from "next/link"
import SP500Chart from "@/components/charts/sp500-chart"
import useSP500Data from "@/hooks/useSP500Data"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const analysisLinks = [
  {
    href: "/analytics/monetary-policy",
    icon: Zap,
    text: "Monetary Policy Analysis",
  },
  {
    href: "/analytics/market-internals",
    icon: BarChart3,
    text: "Market Structure & Sectors",
  },
  {
    href: "/analytics/sentiment",
    icon: Activity,
    text: "Market Sentiment",
  },
]

const chartTimeframes = ["1D", "5D", "1M", "6M", "YTD", "1Y", "5Y", "MAX"]

export default function SP500Dashboard() {
  const [selectedTab, setSelectedTab] = useState("overview")
  const [selectedTimeframe, setSelectedTimeframe] = useState("5D")
  const { data, loading, refreshing, error, lastUpdated, refresh } =
    useSP500Data(selectedTimeframe)
  const lastUpdatedLabel = lastUpdated
    ? new Intl.DateTimeFormat("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(lastUpdated)
    : null

  return (
    <div className="min-h-screen w-full bg-white dark:bg-[#0F0F12]">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-full space-y-6 overflow-hidden p-4 md:p-6"
      >
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-5">
          <TabsList className="grid w-full grid-cols-2 rounded-xl bg-gray-100 p-1 dark:bg-gray-800 sm:w-[320px]">
            <TabsTrigger
              value="overview"
              className="flex items-center gap-2 rounded-lg transition-all duration-300 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700"
            >
              <BarChart3 className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="analytics"
              className="flex items-center gap-2 rounded-lg transition-all duration-300 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700"
            >
              <Zap className="h-4 w-4" />
              Analytics
            </TabsTrigger>
          </TabsList>

          <AnimatePresence mode="wait">
            <TabsContent value="overview" key="overview" className="mt-0">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.35 }}
              >
                <Card className="overflow-hidden border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900/50">
                  <CardHeader className="border-b border-border/60 pb-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <CardTitle className="flex items-center gap-2 text-xl">
                          <Activity className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
                          US 500
                          <span
                            className={`h-2 w-2 shrink-0 rounded-full ${
                              error
                                ? "bg-amber-500 shadow-[0_0_0_4px_rgba(245,158,11,0.12)]"
                                : loading
                                  ? "bg-slate-400"
                                  : "bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.12)]"
                            }`}
                          />
                        </CardTitle>
                        <CardDescription className="mt-2 max-w-2xl leading-6">
                          Interactive S&amp;P 500 candlestick chart with selectable
                          timeframes and automatic five-minute refreshes.
                        </CardDescription>
                        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span>Range: {selectedTimeframe}</span>
                          <span aria-hidden="true">•</span>
                          <span>Auto-refresh: 5 min</span>
                          {lastUpdatedLabel && (
                            <>
                              <span aria-hidden="true">•</span>
                              <span>Refreshed: {lastUpdatedLabel}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={refresh}
                        disabled={loading || refreshing}
                        className="shrink-0 gap-2"
                      >
                        <RefreshCw
                          className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                        />
                        Refresh
                      </Button>
                    </div>

                    <div
                      className="mt-4 flex w-full gap-1 overflow-x-auto rounded-lg bg-muted/70 p-1"
                      role="group"
                      aria-label="S&P 500 chart timeframe"
                    >
                      {chartTimeframes.map((timeframe) => (
                        <button
                          key={timeframe}
                          type="button"
                          onClick={() => setSelectedTimeframe(timeframe)}
                          aria-pressed={selectedTimeframe === timeframe}
                          className={`min-w-12 flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm ${
                            selectedTimeframe === timeframe
                              ? "bg-background text-foreground shadow-sm"
                              : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                          }`}
                        >
                          {timeframe}
                        </button>
                      ))}
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    {loading && data.length === 0 ? (
                      <div className="flex h-[420px] items-center justify-center bg-slate-50 text-sm text-muted-foreground sm:h-[520px] lg:h-[600px] dark:bg-slate-950/50">
                        <LoaderCircle className="mr-2 h-5 w-5 animate-spin text-blue-600 dark:text-blue-400" />
                        Loading S&amp;P 500 data…
                      </div>
                    ) : error && data.length === 0 ? (
                      <div className="flex h-[420px] flex-col items-center justify-center gap-3 bg-slate-50 p-6 text-center sm:h-[520px] lg:h-[600px] dark:bg-slate-950/50">
                        <AlertCircle className="h-7 w-7 text-amber-500" />
                        <div>
                          <p className="font-medium text-foreground">
                            Market data is unavailable
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            S&amp;P 500 candles could not be loaded. Please try again.
                          </p>
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={refresh}>
                          Try again
                        </Button>
                      </div>
                    ) : (
                      <div>
                        {error && (
                          <div className="flex items-center gap-2 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-xs text-amber-700 dark:text-amber-300">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            Refresh failed; showing the most recently loaded candles.
                          </div>
                        )}
                        <SP500Chart data={data} />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>

            <TabsContent value="analytics" key="analytics" className="mt-0">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.35 }}
              >
                <Card className="border-blue-200 dark:border-blue-800">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      Market Analysis
                    </CardTitle>
                    <CardDescription>
                      Continue from the S&amp;P 500 chart to GreenPeak market analysis.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3 md:grid-cols-3">
                    {analysisLinks.map((item, index) => (
                      <Link key={item.href} href={item.href}>
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.08, duration: 0.3 }}
                          whileHover={{ y: -2 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <Button
                            variant="outline"
                            className="h-auto w-full justify-start gap-3 bg-white px-4 py-3 text-left transition-colors hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700"
                          >
                            <item.icon className="h-4 w-4 shrink-0" />
                            <span className="truncate">{item.text}</span>
                            <ArrowUpRight className="ml-auto h-3.5 w-3.5 shrink-0" />
                          </Button>
                        </motion.div>
                      </Link>
                    ))}
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>
          </AnimatePresence>
        </Tabs>
      </motion.div>
    </div>
  )
}
