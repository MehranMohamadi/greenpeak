"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Globe } from "lucide-react"
import MarketWatchLoadingSkeleton from "../dashboard/market-watch-loading"

export default function DashboardLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-white dark:bg-[#0F0F12] w-full">
      <div className="p-4 pt-2 md:p-6 space-y-4 md:space-y-6 max-w-full overflow-hidden">
        {/* Header Loading - Responsive */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-6 md:h-8 bg-gray-200 dark:bg-gray-600 rounded w-40 md:w-48 animate-pulse"></div>
              <div className="w-2 h-2 bg-gray-300 dark:bg-gray-600 rounded-full animate-pulse flex-shrink-0"></div>
            </div>
            <div className="h-4 md:h-5 bg-gray-100 dark:bg-gray-700 rounded w-60 md:w-80 animate-pulse"></div>
          </div>
          <div className="flex-shrink-0">
            <div className="h-12 md:h-14 bg-gray-100 dark:bg-gray-700 rounded-lg w-48 md:w-60 animate-pulse"></div>
          </div>
        </div>

        {/* News Ticker Loading */}
        <Card className="w-full bg-white dark:bg-[#1F1F23] border-gray-200 dark:border-[#2B2B30]">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="h-6 bg-red-200 dark:bg-red-800 rounded w-16 animate-pulse"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Market Watch Loading */}
        <MarketWatchLoadingSkeleton />

        {/* Main Trading Grid Loading - Responsive */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6 w-full">
          {/* Left Column */}
          <div className="space-y-4 md:space-y-6 min-w-0">
            {/* Portfolio Loading */}
            <Card className="bg-white dark:bg-[#1F1F23] border-gray-200 dark:border-[#2B2B30]">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="h-6 bg-gray-200 dark:bg-gray-600 rounded w-24 animate-pulse"></div>
                  <div className="h-8 bg-gray-200 dark:bg-gray-600 rounded w-20 animate-pulse"></div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-16 animate-pulse"></div>
                    <div className="h-8 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-20 animate-pulse"></div>
                    <div className="h-8 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>
                  </div>
                </div>
                <div className="h-32 bg-gray-100 dark:bg-gray-700 rounded animate-pulse"></div>
              </CardContent>
            </Card>

            {/* Broker Accounts Loading */}
            <Card className="bg-white dark:bg-[#1F1F23] border-gray-200 dark:border-[#2B2B30]">
              <CardHeader>
                <div className="h-6 bg-gray-200 dark:bg-gray-600 rounded w-32 animate-pulse"></div>
              </CardHeader>
              <CardContent className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#0F0F12] rounded">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>
                      <div className="space-y-1">
                        <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-20 animate-pulse"></div>
                        <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-16 animate-pulse"></div>
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-16 animate-pulse"></div>
                      <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-12 animate-pulse"></div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Right Column */}
          <div className="space-y-4 md:space-y-6 min-w-0">
            {/* Last Trades Loading */}
            <Card className="bg-white dark:bg-[#1F1F23] border-gray-200 dark:border-[#2B2B30]">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="h-6 bg-gray-200 dark:bg-gray-600 rounded w-24 animate-pulse"></div>
                  <div className="h-8 bg-gray-200 dark:bg-gray-600 rounded w-20 animate-pulse"></div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#0F0F12] rounded">
                    <div className="space-y-1">
                      <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-16 animate-pulse"></div>
                      <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-12 animate-pulse"></div>
                    </div>
                    <div className="text-right space-y-1">
                      <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-16 animate-pulse"></div>
                      <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-20 animate-pulse"></div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Trading Positions Loading */}
            <Card className="bg-white dark:bg-[#1F1F23] border-gray-200 dark:border-[#2B2B30]">
              <CardHeader>
                <div className="h-6 bg-gray-200 dark:bg-gray-600 rounded w-32 animate-pulse"></div>
              </CardHeader>
              <CardContent className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="p-3 bg-gray-50 dark:bg-[#0F0F12] rounded space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-16 animate-pulse"></div>
                      <div className="h-6 bg-gray-200 dark:bg-gray-600 rounded w-12 animate-pulse"></div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-center space-y-1">
                        <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-full animate-pulse"></div>
                        <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-full animate-pulse"></div>
                      </div>
                      <div className="text-center space-y-1">
                        <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-full animate-pulse"></div>
                        <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-full animate-pulse"></div>
                      </div>
                      <div className="text-center space-y-1">
                        <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-full animate-pulse"></div>
                        <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-full animate-pulse"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
