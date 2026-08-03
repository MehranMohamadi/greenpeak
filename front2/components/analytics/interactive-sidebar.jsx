"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import { motion } from "framer-motion"
import MiniChart from "./mini-chart"

export default function InteractiveSidebar({ factors, category, onFactorSelect }) {
  const handleFactorClick = (factor) => {
    // Just trigger the callback to select the factor for the main chart
    if (onFactorSelect) {
      onFactorSelect(factor)
    }
  }

  const getTrendIcon = (trend) => {
    switch (trend) {
      case "up":
        return <TrendingUp className="h-4 w-4 text-green-500" />
      case "down":
        return <TrendingDown className="h-4 w-4 text-red-500" />
      default:
        return <Minus className="h-4 w-4 text-gray-500" />
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

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Related Factors</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {(!factors || factors.length === 0) ? (
          <div className="col-span-full text-center text-gray-500 py-8">
            No related factors found
          </div>
        ) : (
          factors.map((factor) => (
            <motion.div
              key={factor.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ 
                duration: 0.3, 
                delay: factors.indexOf(factor) * 0.1,
                ease: "easeOut"
              }}
              whileHover={{ 
                scale: 1.02,
                transition: { duration: 0.2 }
              }}
              className="stagger-animation"
              style={{ '--stagger-delay': `${factors.indexOf(factor) * 0.1}s` }}
            >
              <Card
                className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:-translate-y-1 flex flex-col h-full"
                onClick={() => handleFactorClick(factor)}
              >
                <CardHeader className="pb-3 flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium truncate">{factor.title}</CardTitle>
                    {getTrendIcon(factor.trend)}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-gray-900 dark:text-white">{factor.currentValue}</span>
                    <span className={`text-sm font-medium ${getTrendColor(factor.trend)}`}>{factor.change}</span>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 flex flex-col flex-grow">
                  <div className="h-16 mb-3 flex-shrink-0 mini-chart-container">
                    <MiniChart data={factor.chartData || factor.data} trend={factor.trend} />
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 line-clamp-2 flex-grow">{factor.description}</p>
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mt-auto flex-shrink-0">
                    <span className="truncate">Source: {factor.source}</span>
                    <span className="flex-shrink-0 ml-2">Click to view →</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))
        )}
      </div>
    </div>
  )
}
