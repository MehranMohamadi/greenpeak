"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DollarSign, ArrowLeft } from "lucide-react"
import { motion } from "framer-motion"

export default function FedBalanceSheetLoadingSkeleton() {
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-full overflow-hidden fed-balance-sheet-main">
      {/* Back Button Loading */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="mb-4 flex items-center gap-2 h-10 w-48 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>
      </motion.div>
      
      <div className="mb-8">
        {/* Header Loading */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-4">
          <div className="flex items-center gap-3">
            <DollarSign className="h-6 w-6 md:h-8 md:w-8 text-gray-300 dark:text-gray-600" />
            <div className="h-8 md:h-10 bg-gray-200 dark:bg-gray-600 rounded w-64 md:w-80 animate-pulse"></div>
          </div>
          
          {/* Time Frame Buttons Loading */}
          <div className="flex gap-2 flex-wrap">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-8 w-12 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>
            ))}
          </div>
        </div>
        
        {/* Description Loading */}
        <div className="h-5 bg-gray-100 dark:bg-gray-700 rounded w-full max-w-2xl mb-4 animate-pulse"></div>

        {/* Key Metrics Loading */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="bg-white dark:bg-[#1F1F23] border-gray-200 dark:border-[#2B2B30]">
              <CardContent className="p-4">
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-20 animate-pulse"></div>
                  <div className="h-8 bg-gray-200 dark:bg-gray-600 rounded w-16 animate-pulse"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Main Chart Loading */}
      <motion.div
        layoutId="fed-balance-sheet-card"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="zoom-in-animation"
      >
        <Card className="bg-white dark:bg-[#1F1F23] border-gray-200 dark:border-[#2B2B30]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-gray-300 dark:text-gray-600" />
                <div className="h-6 bg-gray-200 dark:bg-gray-600 rounded w-64 animate-pulse"></div>
              </div>
              <div className="h-8 bg-gray-200 dark:bg-gray-600 rounded w-24 animate-pulse"></div>
            </div>
            <div className="space-y-2 mt-2">
              <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-full max-w-lg animate-pulse"></div>
              <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-3/4 animate-pulse"></div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-96 bg-gray-50 dark:bg-gray-800 rounded-lg animate-pulse flex items-center justify-center">
              <div className="space-y-4 text-center">
                <div className="h-6 bg-gray-200 dark:bg-gray-600 rounded w-32 mx-auto animate-pulse"></div>
                <div className="grid grid-cols-12 gap-2 h-48">
                  {[...Array(12)].map((_, i) => (
                    <div 
                      key={i} 
                      className="bg-gray-200 dark:bg-gray-600 rounded animate-pulse"
                      style={{ height: `${Math.random() * 80 + 20}%` }}
                    ></div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Additional Information Loading */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(2)].map((_, i) => (
          <Card key={i} className="bg-white dark:bg-[#1F1F23] border-gray-200 dark:border-[#2B2B30]">
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>
                <div className="h-6 bg-gray-200 dark:bg-gray-600 rounded w-48 animate-pulse"></div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-full animate-pulse"></div>
              <div className="space-y-2">
                {[...Array(4)].map((_, j) => (
                  <div key={j} className="flex items-start gap-2">
                    <div className="h-3 w-3 bg-gray-200 dark:bg-gray-600 rounded-full animate-pulse mt-1"></div>
                    <div className="flex-1 space-y-1">
                      <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-3/4 animate-pulse"></div>
                      <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-1/2 animate-pulse"></div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Interactive Sidebar Loading */}
      <div className="w-full mt-8">
        <div className="space-y-4">
          <div className="h-6 bg-gray-200 dark:bg-gray-600 rounded w-32 animate-pulse"></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="bg-white dark:bg-[#1F1F23] border-gray-200 dark:border-[#2B2B30]">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-24 animate-pulse"></div>
                    <div className="h-4 w-4 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="h-6 bg-gray-200 dark:bg-gray-600 rounded w-16 animate-pulse"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-12 animate-pulse"></div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="h-16 bg-gray-100 dark:bg-gray-700 rounded mb-3 animate-pulse"></div>
                  <div className="space-y-2">
                    <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-full animate-pulse"></div>
                    <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-3/4 animate-pulse"></div>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-16 animate-pulse"></div>
                    <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-20 animate-pulse"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
