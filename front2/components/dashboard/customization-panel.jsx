"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Settings, Layout, Bell, Save, RotateCcw } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export default function CustomizationPanel({ onLayoutChange, onAlertsChange }) {
  const [isOpen, setIsOpen] = useState(false)
  const [layoutSettings, setLayoutSettings] = useState({
    showMarketWatch: true,
    showMarketHours: true,
    showNewsTicker: true,
    showAccounts: true,
    showTransactions: true,
    showUpcomingEvents: true,
    dashboardLayout: "default", // default, compact, wide
  })

  const [alertSettings, setAlertSettings] = useState({
    priceAlerts: [],
    newsAlerts: true,
    economicEvents: true,
    earningsAlerts: true,
    volatilityAlerts: false,
  })

  const [newAlert, setNewAlert] = useState({
    symbol: "",
    condition: "above",
    value: "",
    type: "price",
  })

  const handleLayoutChange = (key, value) => {
    const newSettings = { ...layoutSettings, [key]: value }
    setLayoutSettings(newSettings)
    onLayoutChange?.(newSettings)
  }

  const handleAlertChange = (key, value) => {
    const newSettings = { ...alertSettings, [key]: value }
    setAlertSettings(newSettings)
    onAlertsChange?.(newSettings)
  }

  const addPriceAlert = () => {
    if (newAlert.symbol && newAlert.value) {
      const alert = {
        id: Date.now(),
        ...newAlert,
        created: new Date().toISOString(),
        active: true,
      }
      const updatedAlerts = [...alertSettings.priceAlerts, alert]
      handleAlertChange("priceAlerts", updatedAlerts)
      setNewAlert({ symbol: "", condition: "above", value: "", type: "price" })
    }
  }

  const removeAlert = (alertId) => {
    const updatedAlerts = alertSettings.priceAlerts.filter((alert) => alert.id !== alertId)
    handleAlertChange("priceAlerts", updatedAlerts)
  }

  const resetToDefault = () => {
    const defaultLayout = {
      showMarketWatch: true,
      showMarketHours: true,
      showNewsTicker: true,
      showAccounts: true,
      showTransactions: true,
      showUpcomingEvents: true,
      dashboardLayout: "default",
    }
    setLayoutSettings(defaultLayout)
    onLayoutChange?.(defaultLayout)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2 bg-transparent">
          <Settings className="h-4 w-4" />
          Customize
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Dashboard Customization
          </DialogTitle>
          <DialogDescription>Personalize your dashboard layout and set up alerts</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Layout Customization */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layout className="h-5 w-5" />
                Layout Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="layout-style">Dashboard Layout</Label>
                <Select
                  value={layoutSettings.dashboardLayout}
                  onValueChange={(value) => handleLayoutChange("dashboardLayout", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Default</SelectItem>
                    <SelectItem value="compact">Compact</SelectItem>
                    <SelectItem value="wide">Wide</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <h4 className="font-medium">Dashboard Components</h4>

                <div className="flex items-center justify-between">
                  <Label htmlFor="market-watch">Market Watch</Label>
                  <Switch
                    id="market-watch"
                    checked={layoutSettings.showMarketWatch}
                    onCheckedChange={(checked) => handleLayoutChange("showMarketWatch", checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="market-hours">Market Hours</Label>
                  <Switch
                    id="market-hours"
                    checked={layoutSettings.showMarketHours}
                    onCheckedChange={(checked) => handleLayoutChange("showMarketHours", checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="news-ticker">News Ticker</Label>
                  <Switch
                    id="news-ticker"
                    checked={layoutSettings.showNewsTicker}
                    onCheckedChange={(checked) => handleLayoutChange("showNewsTicker", checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="accounts">Accounts Overview</Label>
                  <Switch
                    id="accounts"
                    checked={layoutSettings.showAccounts}
                    onCheckedChange={(checked) => handleLayoutChange("showAccounts", checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="transactions">Recent Transactions</Label>
                  <Switch
                    id="transactions"
                    checked={layoutSettings.showTransactions}
                    onCheckedChange={(checked) => handleLayoutChange("showTransactions", checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="events">Upcoming Events</Label>
                  <Switch
                    id="events"
                    checked={layoutSettings.showUpcomingEvents}
                    onCheckedChange={(checked) => handleLayoutChange("showUpcomingEvents", checked)}
                  />
                </div>
              </div>

              <div className="pt-4 border-t">
                <Button variant="outline" onClick={resetToDefault} className="flex items-center gap-2 bg-transparent">
                  <RotateCcw className="h-4 w-4" />
                  Reset to Default
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Alert Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Alert Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* General Alert Settings */}
              <div className="space-y-3">
                <h4 className="font-medium">General Alerts</h4>

                <div className="flex items-center justify-between">
                  <Label htmlFor="news-alerts">News Alerts</Label>
                  <Switch
                    id="news-alerts"
                    checked={alertSettings.newsAlerts}
                    onCheckedChange={(checked) => handleAlertChange("newsAlerts", checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="economic-events">Economic Events</Label>
                  <Switch
                    id="economic-events"
                    checked={alertSettings.economicEvents}
                    onCheckedChange={(checked) => handleAlertChange("economicEvents", checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="earnings-alerts">Earnings Alerts</Label>
                  <Switch
                    id="earnings-alerts"
                    checked={alertSettings.earningsAlerts}
                    onCheckedChange={(checked) => handleAlertChange("earningsAlerts", checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="volatility-alerts">Volatility Alerts</Label>
                  <Switch
                    id="volatility-alerts"
                    checked={alertSettings.volatilityAlerts}
                    onCheckedChange={(checked) => handleAlertChange("volatilityAlerts", checked)}
                  />
                </div>
              </div>

              {/* Price Alerts */}
              <div className="space-y-3 border-t pt-4">
                <h4 className="font-medium">Price Alerts</h4>

                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Symbol (e.g., AAPL)"
                    value={newAlert.symbol}
                    onChange={(e) => setNewAlert({ ...newAlert, symbol: e.target.value.toUpperCase() })}
                  />
                  <Select
                    value={newAlert.condition}
                    onValueChange={(value) => setNewAlert({ ...newAlert, condition: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="above">Above</SelectItem>
                      <SelectItem value="below">Below</SelectItem>
                      <SelectItem value="change">% Change</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2">
                  <Input
                    placeholder="Value"
                    type="number"
                    value={newAlert.value}
                    onChange={(e) => setNewAlert({ ...newAlert, value: e.target.value })}
                  />
                  <Button onClick={addPriceAlert} className="flex items-center gap-2">
                    <Bell className="h-4 w-4" />
                    Add Alert
                  </Button>
                </div>

                {/* Active Alerts */}
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {alertSettings.priceAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-lg"
                    >
                      <span className="text-sm">
                        {alert.symbol} {alert.condition} {alert.value}
                        {alert.condition === "change" ? "%" : ""}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAlert(alert.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => setIsOpen(false)} className="flex items-center gap-2">
            <Save className="h-4 w-4" />
            Save Settings
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
