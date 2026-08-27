"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import BrokerAccounts from "./broker-accounts"
import LastTrades from "./last-trades"
import Portfolio from "./portfolio"
import MarketWatch from "../dashboard/market-watch"
import MarketHours from "../dashboard/market-hours"
import NewsTicker from "../dashboard/news-ticker"
import TradingPositions from "./trading-positions"
import MT5AccountSnapshot from "../dashboard/mt5-account-snapshot"
import DashboardLoadingSkeleton from "./dashboard-loading"
// import NotificationSystem from "../ui/notification-system" // Hidden but keeping animations

export default function Content() {
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Simulate loading time
    const loadingTimer = setTimeout(() => {
      setIsLoading(false)
      // Dispatch event when content is fully loaded
      window.dispatchEvent(new CustomEvent('contentLoaded'))
    }, 1500)

    return () => clearTimeout(loadingTimer)
  }, [])

  if (isLoading) {
    return <DashboardLoadingSkeleton />
  }

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
    <div className="min-h-screen bg-white dark:bg-[#0F0F12] w-full">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="px-4 pt-1 md:p-6 md:pt-1 space-y-4 md:space-y-6 max-w-full overflow-hidden"
      >
        {/* Header with Market Hours - Responsive */}
        <motion.div
          variants={slideInVariants}
          className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4"
        >
          <div className="min-w-0 flex-1">
            <motion.h1
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-2"
            >
              Trading Dashboard
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-2 h-2 bg-green-400 rounded-full flex-shrink-0 live-indicator"
              />
            </motion.h1>
            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="text-sm md:text-base text-gray-600 dark:text-gray-400 truncate"
            >
              Live market monitoring and portfolio management
            </motion.p>
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

        {/* Main Trading Grid - Responsive Grid */}
        <motion.div
          variants={containerVariants}
          className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6 w-full"
        >
          {/* Left Column - Portfolio & Broker Accounts Combined */}
          <motion.div
            variants={itemVariants}
            className="space-y-4 md:space-y-6 min-w-0"
          >
            <motion.div
              whileHover={{ y: -2 }}
              transition={{ duration: 0.2 }}
            >
              <Portfolio />
            </motion.div>
            <motion.div
              whileHover={{ y: -2 }}
              transition={{ duration: 0.2 }}
            >
              <BrokerAccounts />
            </motion.div>
          </motion.div>

          {/* Right Column - Last Trades & Open Positions Combined */}
          <motion.div
            variants={itemVariants}
            className="space-y-4 md:space-y-6 min-w-0"
          >
            <motion.div
              whileHover={{ y: -2 }}
              transition={{ duration: 0.2 }}
            >
              <LastTrades />
            </motion.div>
            <motion.div
              whileHover={{ y: -2 }}
              transition={{ duration: 0.2 }}
            >
              <TradingPositions />
            </motion.div>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Notification System - Hidden but keeping animations */}
      {/* <NotificationSystem /> */}
    </div>
  )
}
