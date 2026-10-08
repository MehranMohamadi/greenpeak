"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Settings, Layout, RotateCcw } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

const DEFAULT_LAYOUT = {
  showMarketWatch: true,
  showMarketHours: true,
  showNewsTicker: true,
  showAccounts: true,
  showTransactions: true,
  showUpcomingEvents: true,
  dashboardLayout: "default",
}

export default function CustomizationPanel({ onLayoutChange }) {
  const [isOpen, setIsOpen] = useState(false)
  const [layoutSettings, setLayoutSettings] = useState(DEFAULT_LAYOUT)

  const handleLayoutChange = (key, value) => {
    const nextSettings = { ...layoutSettings, [key]: value }
    setLayoutSettings(nextSettings)
    onLayoutChange?.(nextSettings)
  }

  const resetToDefault = () => {
    const defaults = { ...DEFAULT_LAYOUT }
    setLayoutSettings(defaults)
    onLayoutChange?.(defaults)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2 bg-transparent">
          <Settings className="h-4 w-4" />
          Customize
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Dashboard Customization
          </DialogTitle>
          <DialogDescription>Personalize the dashboard layout and visible components.</DialogDescription>
        </DialogHeader>

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
              <Select value={layoutSettings.dashboardLayout} onValueChange={(value) => handleLayoutChange("dashboardLayout", value)}>
                <SelectTrigger id="layout-style"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default</SelectItem>
                  <SelectItem value="compact">Compact</SelectItem>
                  <SelectItem value="wide">Wide</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium">Dashboard Components</h4>
              {[
                ["showMarketWatch", "market-watch", "Market Watch"],
                ["showMarketHours", "market-hours", "Market Hours"],
                ["showNewsTicker", "news-ticker", "News Ticker"],
                ["showAccounts", "accounts", "Accounts Overview"],
                ["showTransactions", "transactions", "Recent Transactions"],
                ["showUpcomingEvents", "events", "Upcoming Events"],
              ].map(([key, id, label]) => (
                <div key={key} className="flex items-center justify-between">
                  <Label htmlFor={id}>{label}</Label>
                  <Switch id={id} checked={layoutSettings[key]} onCheckedChange={(checked) => handleLayoutChange(key, checked)} />
                </div>
              ))}
            </div>

            <div className="border-t pt-4">
              <Button variant="outline" onClick={resetToDefault} className="flex items-center gap-2 bg-transparent">
                <RotateCcw className="h-4 w-4" />
                Reset to Default
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end border-t pt-4">
          <Button onClick={() => setIsOpen(false)}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
