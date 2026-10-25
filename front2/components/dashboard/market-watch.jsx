"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, TrendingDown, Minus, Globe } from "lucide-react"
import useMarketWatch from "@/hooks/use-market-watch"
import IndicatorGuide from "@/components/analytics/indicator-guide"
import MarketWatchLoadingSkeleton from "./market-watch-loading"

function trendColor(trend) {
  if (trend === "up") return "text-cyan-600 dark:text-cyan-400"
  if (trend === "down") return "text-red-600 dark:text-red-400"
  return "text-gray-500 dark:text-gray-400"
}

function trendStroke(trend) {
  if (trend === "up") return "#06B6D4"
  if (trend === "down") return "#ef4444"
  return "#9ca3af"
}

function MiniChart({ data, trend }) {
  if (data.length === 0) {
    return <div className="h-full w-full rounded border-b border-dashed border-gray-300 dark:border-gray-600" />
  }

  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min
  const denominator = Math.max(data.length - 1, 1)
  const horizontalInset = 3
  const verticalInset = 8
  const chartWidth = 100 - horizontalInset * 2
  const chartHeight = 100 - verticalInset * 2
  const points = data
    .map((value, index) => {
      const x = horizontalInset + (index / denominator) * chartWidth
      const y = range === 0 ? 50 : verticalInset + (1 - (value - min) / range) * chartHeight
      return `${x},${y}`
    })
    .join(" ")
  const latestY = range === 0 ? 50 : verticalInset + (1 - (data.at(-1) - min) / range) * chartHeight
  const stroke = trendStroke(trend)

  return (
    <div className="h-8 w-full" aria-label="نمودار داده واقعی یک هفته اخیر">
      <svg viewBox="0 0 100 100" className="h-full w-full" preserveAspectRatio="none">
        <motion.polyline
          fill="none"
          stroke={stroke}
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
          points={points}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1, ease: "easeInOut" }}
        />
        <motion.circle
          cx={data.length > 1 ? 100 - horizontalInset : horizontalInset}
          cy={latestY}
          r="1.5"
          fill={stroke}
          className="chart-point-pulse"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.8, duration: 0.3 }}
        />
      </svg>
    </div>
  )
}

function TrendIcon({ trend }) {
  if (trend === "up") return <TrendingUp className="h-3 w-3 text-cyan-500" />
  if (trend === "down") return <TrendingDown className="h-3 w-3 text-red-500" />
  return <Minus className="h-3 w-3 text-gray-400" />
}

export default function MarketWatch() {
  const { data, isLoading } = useMarketWatch()

  if (isLoading) return <MarketWatchLoadingSkeleton />

  return (
    <Card className="card-glow w-full border-gray-200 bg-white shadow-sm dark:border-[#2B2B30] dark:bg-[#1F1F23]">
      <CardHeader className="pb-2">
        <CardTitle
          dir="rtl"
          className="flex w-full items-center justify-start gap-2 text-right text-sm text-gray-900 dark:text-white md:text-base"
        >
          <Globe className="h-4 w-4 flex-shrink-0 text-cyan-600 dark:text-cyan-400" />
          <span>دیده بان بازار</span>
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="live-indicator h-2 w-2 flex-shrink-0 rounded-full bg-cyan-400"
          />
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
        <motion.div
          dir="rtl"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: { staggerChildren: 0.1 },
            },
          }}
          className="grid w-full grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 md:gap-3 lg:grid-cols-6"
        >
          <AnimatePresence>
            {data.map((item, index) => (
              <motion.div
                key={item.id}
                dir="rtl"
                variants={{
                  hidden: { y: 20, opacity: 0 },
                  visible: { y: 0, opacity: 1 },
                }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                whileHover={{ y: -4, scale: 1.02, transition: { duration: 0.2 } }}
                whileTap={{ scale: 0.98 }}
                title={item.source ? `منبع: ${item.source}` : item.error || undefined}
                className="market-watch-item relative flex min-w-0 cursor-pointer flex-col overflow-hidden rounded-lg border border-gray-200 bg-gray-50 p-2 dark:border-[#2B2B30] dark:bg-[#0F0F12] md:p-2.5"
              >
                <div className="mb-1 flex items-center justify-between">
                  <motion.span
                    className="ml-1 flex-1 truncate text-xs font-medium text-gray-900 dark:text-white"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 + 0.3 }}
                  >
                    {item.symbol}
                  </motion.span>
                  <div className="flex flex-shrink-0 items-center gap-1">
                    <IndicatorGuide indicatorId={item.id} title={item.symbol} className="h-6 w-6" />
                    <motion.div
                      animate={{
                        rotate: item.trend === "up" ? [0, 5, 0] : item.trend === "down" ? [0, -5, 0] : 0,
                        scale: [1, 1.1, 1],
                      }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <TrendIcon trend={item.trend} />
                    </motion.div>
                    <motion.div
                      animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className={`h-1.5 w-1.5 rounded-full ${
                        item.trend === "up" ? "bg-cyan-400" : item.trend === "down" ? "bg-red-400" : "bg-gray-400"
                      }`}
                    />
                  </div>
                </div>

                <motion.div
                  className="count-up mb-1 truncate text-xs font-bold text-gray-900 dark:text-white md:text-sm"
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: index * 0.1 + 0.4 }}
                >
                  {item.price}
                </motion.div>

                <motion.div
                  className={`mb-1.5 truncate text-xs ${trendColor(item.trend)}`}
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: index * 0.1 + 0.5 }}
                >
                  {item.change} ({item.changePercent})
                </motion.div>

                <motion.div
                  className="h-6 w-full md:h-7"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 + 0.6 }}
                >
                  <MiniChart data={item.chartData} trend={item.trend} />
                </motion.div>

                <div className="mt-1 truncate text-[10px] text-gray-500 dark:text-gray-400">
                  {item.observationDate ? `آخرین داده: ${item.observationDate}` : item.error}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      </CardContent>
    </Card>
  )
}
