"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Plus, TrendingUp, BarChart3, Settings, RefreshCw, Zap } from "lucide-react"

export default function FloatingActionMenu() {
  const [isOpen, setIsOpen] = useState(false)

  const menuItems = [
    { icon: TrendingUp, label: "Quick Trade", color: "bg-green-500" },
    { icon: BarChart3, label: "Analytics", color: "bg-blue-500" },
    { icon: RefreshCw, label: "Refresh Data", color: "bg-purple-500" },
    { icon: Settings, label: "Settings", color: "bg-gray-500" },
  ]

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.1
      }
    }
  }

  const itemVariants = {
    hidden: { scale: 0, rotate: -180 },
    visible: {
      scale: 1,
      rotate: 0,
      transition: {
        type: "spring",
        stiffness: 260,
        damping: 20
      }
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="absolute bottom-16 right-0 flex flex-col gap-3"
          >
            {menuItems.map((item, index) => {
              const Icon = item.icon
              return (
                <motion.button
                  key={item.label}
                  variants={itemVariants}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className={`${item.color} text-white p-3 rounded-full shadow-lg hover:shadow-xl transition-shadow flex items-center gap-2 pr-4 group`}
                >
                  <Icon className="h-5 w-5" />
                  <motion.span
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: "auto", opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="text-sm font-medium whitespace-nowrap overflow-hidden"
                  >
                    {item.label}
                  </motion.span>
                </motion.button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all relative overflow-hidden"
      >
        <motion.div
          animate={{ rotate: isOpen ? 45 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <Plus className="h-6 w-6" />
        </motion.div>
        
        {/* Ripple effect */}
        <motion.div
          className="absolute inset-0 bg-white rounded-full"
          initial={{ scale: 0, opacity: 0.3 }}
          animate={{ scale: 2, opacity: 0 }}
          transition={{ duration: 0.6, repeat: Infinity }}
        />
      </motion.button>
    </div>
  )
}
