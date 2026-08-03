"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, TrendingUp, TrendingDown, AlertCircle, CheckCircle, DollarSign } from "lucide-react"

export default function NotificationSystem() {
  const [notifications, setNotifications] = useState([])

  // Mock notification data
  const mockNotifications = [
    {
      id: 1,
      type: "success",
      title: "Trade Executed",
      message: "AAPL Buy order for 100 shares filled at $175.43",
      icon: CheckCircle,
      color: "green",
      duration: 5000
    },
    {
      id: 2,
      type: "warning",
      title: "Price Alert",
      message: "TSLA has reached your target price of $250",
      icon: TrendingUp,
      color: "yellow",
      duration: 6000
    },
    {
      id: 3,
      type: "info",
      title: "Market Update",
      message: "S&P 500 up 0.5% in pre-market trading",
      icon: DollarSign,
      color: "blue",
      duration: 4000
    }
  ]

  useEffect(() => {
    // Simulate incoming notifications
    const interval = setInterval(() => {
      if (Math.random() > 0.7) { // 30% chance every 10 seconds
        const randomNotification = mockNotifications[Math.floor(Math.random() * mockNotifications.length)]
        const newNotification = {
          ...randomNotification,
          id: Date.now(),
          timestamp: new Date()
        }
        setNotifications(prev => [...prev, newNotification])
      }
    }, 10000)

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    // Auto-remove notifications after their duration
    notifications.forEach(notification => {
      const timer = setTimeout(() => {
        removeNotification(notification.id)
      }, notification.duration)
      
      return () => clearTimeout(timer)
    })
  }, [notifications])

  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id))
  }

  const getColorClasses = (color) => {
    switch (color) {
      case "green":
        return "border-green-500 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200"
      case "yellow":
        return "border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200"
      case "blue":
        return "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200"
      case "red":
        return "border-red-500 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200"
      default:
        return "border-gray-500 bg-gray-50 dark:bg-gray-900/20 text-gray-800 dark:text-gray-200"
    }
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-3 max-w-sm">
      <AnimatePresence>
        {notifications.map((notification) => {
          const Icon = notification.icon
          return (
            <motion.div
              key={notification.id}
              initial={{ x: 400, opacity: 0, scale: 0.8 }}
              animate={{ x: 0, opacity: 1, scale: 1 }}
              exit={{ x: 400, opacity: 0, scale: 0.8 }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 30
              }}
              className={`
                border-l-4 p-4 rounded-lg shadow-lg backdrop-blur-sm
                ${getColorClasses(notification.color)}
                relative overflow-hidden
              `}
            >
              {/* Background animation */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent to-white/10 dark:to-white/5"
                initial={{ x: "-100%" }}
                animate={{ x: "100%" }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              />
              
              <div className="flex items-start justify-between relative z-10">
                <div className="flex items-start gap-3 flex-1">
                  <motion.div
                    animate={{ 
                      rotate: [0, 10, -10, 0],
                      scale: [1, 1.1, 1]
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Icon className="h-5 w-5 mt-0.5 flex-shrink-0" />
                  </motion.div>
                  <div className="min-w-0 flex-1">
                    <motion.h4
                      initial={{ y: 10, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.1 }}
                      className="font-medium text-sm"
                    >
                      {notification.title}
                    </motion.h4>
                    <motion.p
                      initial={{ y: 10, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.2 }}
                      className="text-sm opacity-90 mt-1"
                    >
                      {notification.message}
                    </motion.p>
                  </div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => removeNotification(notification.id)}
                  className="text-current opacity-60 hover:opacity-100 transition-opacity ml-2"
                >
                  <X className="h-4 w-4" />
                </motion.button>
              </div>

              {/* Progress bar */}
              <motion.div
                className="absolute bottom-0 left-0 h-1 bg-current opacity-30"
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: notification.duration / 1000, ease: "linear" }}
              />
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
