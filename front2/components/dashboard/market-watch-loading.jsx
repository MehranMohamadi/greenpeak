"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Globe } from "lucide-react"

export default function MarketWatchLoadingSkeleton() {
  return (
    <Card className="bg-white dark:bg-[#1F1F23] border-gray-200 dark:border-[#2B2B30] shadow-sm w-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2 text-sm md:text-base">
          <Globe className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
          Market Watch
          <div className="w-2 h-2 bg-gray-300 dark:bg-gray-600 rounded-full animate-pulse ml-2 flex-shrink-0"></div>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 p-3 md:p-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 md:gap-3 w-full">
          {[...Array(6)].map((_, index) => (
            <div
              key={index}
              className="flex flex-col p-2 md:p-3 rounded-lg bg-gray-50 dark:bg-[#0F0F12] border border-gray-200 dark:border-[#2B2B30] min-w-0"
            >
              {/* Symbol and trend icon */}
              <div className="flex items-center justify-between mb-1">
                <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-12 md:w-16 animate-pulse"></div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <div className="h-3 w-3 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>
                  <div className="w-1.5 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full animate-pulse"></div>
                </div>
              </div>

              {/* Price */}
              <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-16 md:w-20 mb-1 animate-pulse"></div>

              {/* Change percentage */}
              <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-14 md:w-18 mb-2 animate-pulse"></div>

              {/* Mini chart placeholder */}
              <div className="h-6 md:h-8 w-full bg-gray-100 dark:bg-gray-700 rounded animate-pulse">
                <div className="h-full w-full bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-600 dark:to-gray-500 rounded animate-pulse"></div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
