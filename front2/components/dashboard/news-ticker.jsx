"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Card } from "@/components/ui/card"
import { Calendar, TrendingUp, AlertCircle } from "lucide-react"
import { endpoints } from "@/api/api"

const VISIBLE_NEWS_COUNT = 4
const NEWS_PRESENTATION = [
  { icon: TrendingUp, colorClass: "text-red-600 dark:text-red-400" },
  { icon: Calendar, colorClass: "text-yellow-600 dark:text-yellow-400" },
  { icon: TrendingUp, colorClass: "text-yellow-600 dark:text-yellow-400" },
  { icon: AlertCircle, colorClass: "text-red-600 dark:text-red-400" },
]

function formatRelativeTime(value) {
  const publishedAt = new Date(value)
  if (Number.isNaN(publishedAt.getTime())) return ""

  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - publishedAt.getTime()) / 1000))
  if (elapsedSeconds < 60) return "just now"

  const elapsedMinutes = Math.floor(elapsedSeconds / 60)
  if (elapsedMinutes < 60) return `${elapsedMinutes} ${elapsedMinutes === 1 ? "minute" : "minutes"} ago`

  const elapsedHours = Math.floor(elapsedMinutes / 60)
  if (elapsedHours < 24) return `${elapsedHours} ${elapsedHours === 1 ? "hour" : "hours"} ago`

  const elapsedDays = Math.floor(elapsedHours / 24)
  return `${elapsedDays} ${elapsedDays === 1 ? "day" : "days"} ago`
}

export default function NewsTicker() {
  const [newsItems, setNewsItems] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => {
    const controller = new AbortController()

    async function loadNews() {
      try {
        const response = await fetch(endpoints.news.source("cnbc_rss", 20), { signal: controller.signal })
        if (!response.ok) throw new Error("CNBC news is unavailable")

        const payload = await response.json()
        const items = (payload.data?.items || []).slice(0, VISIBLE_NEWS_COUNT).map((article, index) => ({
          ...NEWS_PRESENTATION[index],
          id: article.item_id || article.url,
          title: article.title,
          time: formatRelativeTime(article.published_at),
        }))

        if (items.length > 0) {
          setNewsItems(items)
          setCurrentIndex(0)
        } else {
          setLoadFailed(true)
        }
      } catch (error) {
        if (error.name !== "AbortError") setLoadFailed(true)
      }
    }

    loadNews()
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (newsItems.length < 2) return undefined

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % newsItems.length)
    }, 5000)

    return () => clearInterval(timer)
  }, [newsItems.length])

  const currentNews = newsItems[currentIndex] || {
    id: "cnbc-status",
    title: loadFailed ? "CNBC news is temporarily unavailable" : "Loading CNBC news...",
    time: "",
    ...NEWS_PRESENTATION[0],
  }
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
                  <Icon className={`h-4 w-4 ${currentNews.colorClass} flex-shrink-0`} />
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
            {Array.from({ length: newsItems.length || VISIBLE_NEWS_COUNT }).map((_, index) => (
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
