"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { X, Maximize2, TrendingUp, TrendingDown, Activity } from "lucide-react"
import MultiLineChart from "../charts/multi-line-chart"
import { getDataForPeriod } from "../../hooks/monetaryDataUtils"

export default function FullScreenChart({
  isOpen,
  onClose,
  selectedFactor
}) {
  // Local state for fullscreen chart period (independent from main chart)
  const [fullscreenPeriod, setFullscreenPeriod] = useState('MAX')
  
  // Local trend functions to avoid prop serialization issues
  const getTrendIcon = (trend) => {
    switch (trend) {
      case "up":
        return <TrendingUp className="h-4 w-4 text-green-500" />
      case "down":
        return <TrendingDown className="h-4 w-4 text-red-500" />
      default:
        return <Activity className="h-4 w-4 text-gray-400" />
    }
  }

  const getTrendColor = (trend) => {
    switch (trend) {
      case "up":
        return "text-green-600 dark:text-green-400"
      case "down":
        return "text-red-600 dark:text-red-400"
      default:
        return "text-gray-600 dark:text-gray-400"
    }
  }

  if (!selectedFactor) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[75vw] max-h-[85vh] w-full h-full p-0 bg-white dark:bg-[#0F0F12] border border-gray-200 dark:border-[#2B2B30] shadow-2xl rounded-xl overflow-hidden [&>button]:hidden">
        <DialogHeader className="px-6 py-4 border-b border-gray-200 dark:border-[#2B2B30] bg-gradient-to-r from-gray-50 to-gray-100 dark:from-[#1A1A1E] dark:to-[#1F1F23]">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-3 text-lg font-semibold text-gray-900 dark:text-white">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                  <Maximize2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    {getTrendIcon(selectedFactor.trend)}
                    <span className="text-base">{selectedFactor.title}</span>
                  </div>
                  <div className="text-xs font-normal text-gray-500 dark:text-gray-400 mt-0.5">
                    Detailed Analysis View
                  </div>
                </div>
              </div>
            </DialogTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-200 dark:hover:border-red-800 transition-all duration-200 rounded-full"
              title="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <DialogDescription className="sr-only">
            Fullscreen chart view for detailed analysis of {selectedFactor.title}
          </DialogDescription>
          
          {/* Time Period Selector - Independent from main chart */}
          <div className="mt-4 pt-3 border-t border-gray-200 dark:border-[#2B2B30]">
            <div className="flex flex-wrap gap-1 bg-white dark:bg-[#0F0F12] rounded-lg p-1 border border-gray-200 dark:border-[#2B2B30] shadow-sm">
              {['1M', '6M', '1Y', '5Y', '10Y', '25Y', 'MAX'].map((period) => (
                <Button
                  key={period}
                  variant={fullscreenPeriod === period ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setFullscreenPeriod(period)}
                  className={`h-7  text-xs px-3 text-xs font-medium transition-all duration-200 ${
                    fullscreenPeriod === period 
                      ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm scale-105' 
                      : 'hover:bg-gray-100 dark:hover:bg-[#1F1F23] text-gray-600 dark:text-gray-400 hover:scale-105'
                  }`}
                >
                  {period}
                </Button>
              ))}
            </div>
          </div>

          {/* Data Info Row - Compact and organized */}
          <div className="flex flex-wrap items-center gap-4 text-sm mt-3 pt-2 border-t border-gray-200 dark:border-[#2B2B30]">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Current:</span>
              <span className="font-semibold text-gray-900 dark:text-white text-sm">{selectedFactor.currentValue}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Change:</span>
              <span className={`font-semibold text-sm ${getTrendColor(selectedFactor.trend)}`}>
                {selectedFactor.change}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Source:</span>
              <span className="text-xs text-gray-600 dark:text-gray-400">{selectedFactor.source}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium">
                {fullscreenPeriod}
              </span>
            </div>
          </div>
        </DialogHeader>
        <div className="flex-1 flex flex-col bg-white dark:bg-[#0F0F12]">
          {/* Main Chart Container */}
          <div className="flex-1 p-4">
            <div className="h-full w-full bg-gradient-to-br from-gray-50 to-gray-100 dark:from-[#1A1A1E] dark:to-[#0F0F12] rounded-xl border border-gray-200 dark:border-[#2B2B30] p-3 shadow-inner">
              <MultiLineChart 
                dataSets={[getDataForPeriod(selectedFactor.chartData || selectedFactor.data || [], fullscreenPeriod)]}
              />
            </div>
          </div>
          
          {/* Bottom Content Section */}
          <div className="px-6 py-4 border-t border-gray-200 dark:border-[#2B2B30] bg-gray-50 dark:bg-[#1A1A1E]">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Key Statistics */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  Key Statistics
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center p-2 bg-white dark:bg-[#0F0F12] rounded-lg border border-gray-200 dark:border-[#2B2B30]">
                    <span className="text-gray-600 dark:text-gray-400">Current Value:</span>
                    <span className="font-medium text-gray-900 dark:text-white">{selectedFactor.currentValue}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-white dark:bg-[#0F0F12] rounded-lg border border-gray-200 dark:border-[#2B2B30]">
                    <span className="text-gray-600 dark:text-gray-400">Period Change:</span>
                    <span className={`font-medium ${getTrendColor(selectedFactor.trend)}`}>
                      {selectedFactor.change}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-white dark:bg-[#0F0F12] rounded-lg border border-gray-200 dark:border-[#2B2B30]">
                    <span className="text-gray-600 dark:text-gray-400">Time Period:</span>
                    <span className="font-medium text-gray-900 dark:text-white">{fullscreenPeriod}</span>
                  </div>
                </div>
              </div>

              {/* Analysis Insights */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  Analysis Insights
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="p-3 bg-white dark:bg-[#0F0F12] rounded-lg border border-gray-200 dark:border-[#2B2B30]">
                    <div className="flex items-center gap-2 mb-2">
                      {getTrendIcon(selectedFactor.trend)}
                      <span className="font-medium text-gray-900 dark:text-white">
                        Trend: {selectedFactor.trend === 'up' ? 'Bullish' : selectedFactor.trend === 'down' ? 'Bearish' : 'Neutral'}
                      </span>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 text-xs leading-relaxed">
                      {selectedFactor.description}
                    </p>
                  </div>
                </div>
              </div>

              {/* Data Source */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  Data Source
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="p-3 bg-white dark:bg-[#0F0F12] rounded-lg border border-gray-200 dark:border-[#2B2B30]">
                    <div className="space-y-2">
                      <div>
                        <span className="text-gray-600 dark:text-gray-400 text-xs">Provider:</span>
                        <p className="font-medium text-gray-900 dark:text-white text-xs">{selectedFactor.source}</p>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400 text-xs">Category:</span>
                        <p className="font-medium text-gray-900 dark:text-white text-xs">{selectedFactor.category || 'Economic Indicator'}</p>
                      </div>
                      <div className="pt-2 border-t border-gray-200 dark:border-[#2B2B30]">
                        <span className="text-gray-600 dark:text-gray-400 text-xs">Impact Level:</span>
                        <div className="flex items-center gap-2 mt-1">
                          <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                            selectedFactor.impact === 'High' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                            selectedFactor.impact === 'Medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                            'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          }`}>
                            {selectedFactor.impact || 'High'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
