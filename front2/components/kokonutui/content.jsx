"use client"

import { motion } from "framer-motion"
import MarketWatch from "../dashboard/market-watch"
import MarketHours from "../dashboard/market-hours"
import NewsTicker from "../dashboard/news-ticker"
import MT5AccountSnapshot from "../dashboard/mt5-account-snapshot"
// import NotificationSystem from "../ui/notification-system" // Hidden but keeping animations

export default function Content() {
  // Animation variants for staggered entrance
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  }

  const itemVariants = {
    hidden: { y: 30, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.6,
        ease: [0.16, 1, 0.3, 1]
      }
    }
  }

  const slideInVariants = {
    hidden: { x: -50, opacity: 0 },
    visible: {
      x: 0,
      opacity: 1,
      transition: {
        duration: 0.8,
        ease: "easeOut"
      }
    }
  }

  return (
    <div className="min-h-screen w-full bg-background">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="px-4 pt-1 md:p-6 md:pt-1 space-y-4 md:space-y-6 max-w-full overflow-hidden"
      >
        {/* Header with Market Hours - Responsive */}
        <motion.div
          variants={slideInVariants}
          dir="rtl"
          className="flex flex-col gap-4 text-right sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0 flex-1">
            <motion.h1
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="mb-1 flex items-center justify-start gap-2 text-xl font-bold text-gray-900 dark:text-white md:text-2xl"
            >
              داشبورد معاملاتی
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-2 h-2 bg-cyan-400 rounded-full flex-shrink-0 live-indicator"
              />
            </motion.h1>
          </div>
          <motion.div
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="flex-shrink-0"
          >
            <MarketHours />
          </motion.div>
        </motion.div>

        {/* News Ticker - Full Width Responsive */}
        <motion.div
          variants={itemVariants}
          className="w-full"
        >
          <NewsTicker />
        </motion.div>

        {/* Market Watch - Full Width Responsive */}
        <motion.div
          variants={itemVariants}
          className="w-full"
        >
          <MarketWatch />
        </motion.div>

        <motion.div variants={itemVariants} className="w-full">
          <MT5AccountSnapshot />
        </motion.div>
      </motion.div>

      {/* Notification System - Hidden but keeping animations */}
      {/* <NotificationSystem /> */}
    </div>
  )
}
