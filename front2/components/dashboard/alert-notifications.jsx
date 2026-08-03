"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Bell, X, TrendingUp, AlertTriangle, Calendar, ChevronDown, ChevronUp } from "lucide-react"
import { toast } from "sonner"

export default function AlertNotifications({ alerts = [] }) {
  const [activeAlerts, setActiveAlerts] = useState([])
  const [isMinimized, setIsMinimized] = useState(false)

  // Simulate incoming alerts
  useEffect(() => {
    const mockAlerts = [
      {
        id: 1,
        type: "price",
        title: "AAPL Price Alert",
        message: "Apple Inc. has reached $175.00",
        timestamp: new Date(),
        severity: "info",
        icon: TrendingUp,
      },
      {
        id: 2,
        type: "news",
        title: "Market News",
        message: "Fed announces interest rate decision",
        timestamp: new Date(Date.now() - 300000),
        severity: "high",
        icon: AlertTriangle,
      },
      {
        id: 3,
        type: "economic",
        title: "Economic Event",
        message: "Non-Farm Payrolls data released",
        timestamp: new Date(Date.now() - 600000),
        severity: "medium",
        icon: Calendar,
      },
    ]

    // Simulate alerts coming in over time
    const timer = setTimeout(() => {
      setActiveAlerts(mockAlerts)
      // Show toast notification for new alerts
      mockAlerts.forEach((alert) => {
        toast(alert.title, {
          description: alert.message,
          duration: 5000,
        })
      })
    }, 2000)

    return () => clearTimeout(timer)
  }, [])

  const dismissAlert = (alertId) => {
    setActiveAlerts((prev) => prev.filter((alert) => alert.id !== alertId))
  }

  const dismissAll = () => {
    setActiveAlerts([])
  }

  const toggleMinimized = () => {
    setIsMinimized(!isMinimized)
  }

  const getSeverityColor = (severity) => {
    switch (severity) {
      case "high":
        return "border-red-500 bg-red-500/10 backdrop-blur-sm"
      case "medium":
        return "border-yellow-500 bg-yellow-500/10 backdrop-blur-sm"
      case "info":
        return "border-blue-500 bg-blue-500/10 backdrop-blur-sm"
      default:
        return "border-slate-500 bg-slate-500/10 backdrop-blur-sm"
    }
  }

  if (activeAlerts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 w-80">
      <Card className="bg-slate-800/90 border-slate-700 shadow-2xl backdrop-blur-sm">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-blue-400" />
              <span className="font-semibold text-white">Alerts ({activeAlerts.length})</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleMinimized}
                className="text-slate-400 hover:text-white p-1"
              >
                {isMinimized ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="sm" onClick={dismissAll} className="text-slate-400 hover:text-white">
                Clear All
              </Button>
            </div>
          </div>

          {!isMinimized && (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {activeAlerts.map((alert) => {
                const Icon = alert.icon
                return (
                  <div
                    key={alert.id}
                    className={`p-3 rounded-lg border-l-4 ${getSeverityColor(alert.severity)} relative`}
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-1 right-1 h-6 w-6 p-0 text-slate-400 hover:text-white"
                      onClick={() => dismissAlert(alert.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                    <div className="flex items-start gap-2 pr-6">
                      <Icon className="h-4 w-4 mt-0.5 text-slate-400" />
                      <div className="flex-1">
                        <div className="font-medium text-sm text-white">{alert.title}</div>
                        <div className="text-xs text-slate-300 mt-1">{alert.message}</div>
                        <div className="text-xs text-slate-500 mt-1">{alert.timestamp.toLocaleTimeString()}</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
