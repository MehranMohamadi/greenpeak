"use client"

import { motion } from "framer-motion"
import { Clock, Sparkles, Rocket, Code, Wrench } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

export default function ComingSoonBanner({ 
  title = "Coming Soon", 
  description = "This feature is currently under development and will be available soon.",
  icon: Icon = Rocket,
  showAnimation = true 
}) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-2xl w-full"
      >
        <Card className="border-2 border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950 dark:to-yellow-950">
          <CardContent className="p-8 md:p-12 text-center space-y-6">
            {/* Icon with animation */}
            <motion.div
              animate={showAnimation ? {
                y: [0, -10, 0],
                rotate: [0, 5, -5, 0]
              } : {}}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="flex justify-center"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-amber-400 dark:bg-amber-600 rounded-full blur-xl opacity-30 animate-pulse" />
                <div className="relative p-6 bg-amber-100 dark:bg-amber-900 rounded-full">
                  <Icon className="h-12 w-12 md:h-16 md:w-16 text-amber-600 dark:text-amber-400" />
                </div>
              </div>
            </motion.div>

            {/* Title */}
            <div className="space-y-2">
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
                {title}
              </h1>
              <div className="flex items-center justify-center gap-2">
                <span className="px-3 py-1 bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded-full text-sm font-semibold border border-amber-500/30">
                  UNDER DEVELOPMENT
                </span>
              </div>
            </div>

            {/* Description */}
            <p className="text-gray-600 dark:text-gray-400 text-lg max-w-lg mx-auto">
              {description}
            </p>

            {/* Features Coming Soon */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="p-4 bg-white dark:bg-gray-900 rounded-lg border border-amber-200 dark:border-amber-800"
              >
                <Sparkles className="h-8 w-8 text-amber-500 mx-auto mb-2" />
                <h3 className="font-semibold text-sm text-gray-900 dark:text-white mb-1">
                  Advanced Analytics
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Powerful data visualization tools
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="p-4 bg-white dark:bg-gray-900 rounded-lg border border-amber-200 dark:border-amber-800"
              >
                <Code className="h-8 w-8 text-amber-500 mx-auto mb-2" />
                <h3 className="font-semibold text-sm text-gray-900 dark:text-white mb-1">
                  Real-time Data
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Live market data integration
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="p-4 bg-white dark:bg-gray-900 rounded-lg border border-amber-200 dark:border-amber-800"
              >
                <Wrench className="h-8 w-8 text-amber-500 mx-auto mb-2" />
                <h3 className="font-semibold text-sm text-gray-900 dark:text-white mb-1">
                  Custom Insights
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Tailored analysis and reports
                </p>
              </motion.div>
            </div>

            {/* Timeline indicator */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400 pt-4"
            >
              <Clock className="h-4 w-4" />
              <span>Expected in the next update</span>
            </motion.div>

            {/* Animated dots */}
            <div className="flex items-center justify-center gap-2 pt-2">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-2 h-2 bg-amber-500 rounded-full"
                  animate={{
                    scale: [1, 1.5, 1],
                    opacity: [0.5, 1, 0.5]
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    delay: i * 0.2
                  }}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
