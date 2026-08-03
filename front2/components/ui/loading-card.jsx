"use client"

import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function LoadingCard({ height = "h-48", className = "" }) {
  return (
    <Card className={`bg-white dark:bg-[#1F1F23] border-gray-200 dark:border-[#2B2B30] ${className}`}>
      <CardHeader className="pb-3">
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-gray-200 dark:bg-[#2B2B30] rounded w-1/3"></div>
          <div className="h-3 bg-gray-100 dark:bg-[#1F1F23] rounded w-1/2"></div>
        </div>
      </CardHeader>
      <CardContent className={`${height.includes("h-") ? height : "h-48"}`}>
        <div className="animate-pulse space-y-4">
          <div className="space-y-3">
            <div className="h-3 bg-gray-200 dark:bg-[#2B2B30] rounded w-3/4"></div>
            <div className="h-3 bg-gray-200 dark:bg-[#2B2B30] rounded w-1/2"></div>
            <div className="h-3 bg-gray-200 dark:bg-[#2B2B30] rounded w-5/6"></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 dark:bg-[#2B2B30] rounded"></div>
              <div className="h-6 bg-gray-300 dark:bg-[#3B3B40] rounded"></div>
            </div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 dark:bg-[#2B2B30] rounded"></div>
              <div className="h-6 bg-gray-300 dark:bg-[#3B3B40] rounded"></div>
            </div>
          </div>
          <div className="flex space-x-4 pt-4">
            <div className="h-8 bg-gray-300 dark:bg-[#3B3B40] rounded w-20 animate-pulse"></div>
            <div className="h-8 bg-gray-300 dark:bg-[#3B3B40] rounded w-20 animate-pulse"></div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
