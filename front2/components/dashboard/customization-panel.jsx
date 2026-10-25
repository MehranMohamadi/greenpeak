"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Layout, RotateCcw } from "lucide-react"

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
    <Card dir="rtl">
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <CardTitle className="flex items-center gap-2">
          <Layout className="h-5 w-5" />
          شخصی‌سازی چیدمان
        </CardTitle>
        <Button type="button" variant="outline" size="sm" onClick={resetToDefault} className="ms-auto h-8 shrink-0 gap-1.5 bg-transparent px-2 text-xs">
          <RotateCcw className="h-3.5 w-3.5" />
          بازگشت به پیش‌فرض
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="layout-style">چیدمان داشبورد</Label>
          <Select value={layoutSettings.dashboardLayout} onValueChange={(value) => handleLayoutChange("dashboardLayout", value)}>
            <SelectTrigger id="layout-style"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="default">پیش‌فرض</SelectItem>
              <SelectItem value="compact">فشرده</SelectItem>
              <SelectItem value="wide">عریض</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          <h4 className="font-medium">اجزای داشبورد</h4>
          {[
            ["showMarketWatch", "market-watch", "دیده‌بان بازار"],
            ["showMarketHours", "market-hours", "ساعت بازارها"],
            ["showNewsTicker", "news-ticker", "نوار اخبار"],
            ["showAccounts", "accounts", "نمای کلی حساب‌ها"],
            ["showTransactions", "transactions", "معاملات اخیر"],
            ["showUpcomingEvents", "events", "رویدادهای پیش‌رو"],
          ].map(([key, id, label]) => (
            <div key={key} className="flex items-center justify-between">
              <Label htmlFor={id}>{label}</Label>
              <Switch id={id} checked={layoutSettings[key]} onCheckedChange={(checked) => handleLayoutChange(key, checked)} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
