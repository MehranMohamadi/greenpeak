"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Card } from "@/components/ui/card"
import { Calendar, TrendingUp, AlertCircle } from "lucide-react"

const newsItems = [
  {
    id: 1,
    title: "Fed Chair Powell speaks at Jackson Hole Symposium",
    time: "2 hours ago",
    impact: "high",
    icon: TrendingUp,
  },
  {
    id: 2,
    title: "US GDP Growth revised to 2.9% for Q2",
    time: "4 hours ago",
    impact: "medium",
    icon: Calendar,
  },
  {
    id: 3,
    title: "Apple earnings beat expectations, stock up 3%",
    time: "6 hours ago",
    impact: "medium",
    icon: TrendingUp,
  },
  {
    id: 4,
    title: "ECB signals potential rate cut in December",
    time: "8 hours ago",
    impact: "high",
    icon: AlertCircle,
  },
]

export default function NewsTicker() {
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % newsItems.length)
    }, 5000)

    return () => clearInterval(timer)
  }, [])

  const getImpactColor = (impact) => {
    switch (impact) {
      case "high":
        return "text-red-600 dark:text-red-400"
      case "medium":
        return "text-yellow-600 dark:text-yellow-400"
      case "low":
        return "text-green-600 dark:text-green-400"
      default:
        return "text-gray-600 dark:text-gray-400"
    }
  }

  const currentNews = newsItems[currentIndex]
  const Icon = currentNews.icon

  return (
    <Card className="bg-gradient-to-r from-blue-600/10 to-indigo-600/10 dark:from-blue-400/10 dark:to-indigo-400/10 border-blue-200 dark:border-blue-800 shadow-sm card-glow overflow-hidden">
      <div className="p-4">
        <div className="flex items-center gap-3">
          <motion.div 
            className="flex items-center gap-2"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <motion.div
              animate={{ 
                scale: [1, 1.3, 1],
                opacity: [1, 0.6, 1]
              }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="w-2 h-2 bg-red-500 rounded-full"
            />
            <span className="text-sm font-medium text-gray-900 dark:text-white">LIVE</span>
          </motion.div>
          
          <div className="flex-1 flex items-center gap-3 overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentIndex}
                initial={{ x: 100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -100, opacity: 0 }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
                className="flex items-center gap-3 min-w-0 flex-1"
              >
                <motion.div
                  animate={{ 
                    rotate: [0, 5, -5, 0],
                    scale: [1, 1.1, 1]
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Icon className={`h-4 w-4 ${getImpactColor(currentNews.impact)} flex-shrink-0`} />
                </motion.div>
                <motion.span 
                  className="text-sm font-medium text-gray-900 dark:text-white truncate"
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  {currentNews.title}
                </motion.span>
                <motion.span 
                  className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap"
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  {currentNews.time}
                </motion.span>
              </motion.div>
            </AnimatePresence>
          </div>
          
          <div className="flex gap-1">
            {newsItems.map((_, index) => (
              <motion.div
                key={index}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: index * 0.1 }}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  index === currentIndex ? "bg-blue-500 scale-125" : "bg-gray-300 dark:bg-gray-600"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </Card>
  )
}
