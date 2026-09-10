"use client"

import { Calendar, Database } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import EconomicCalendarWidget from "./economic-calendar-widget"

export default function MacroCalendar({ showPageHeader = true }) {
  return (
    <div className="space-y-6 p-4 md:p-6">
      {showPageHeader && <header className="space-y-2">
        <div className="flex items-center gap-3">
          <span className="rounded-xl border bg-muted/50 p-2"><Calendar className="h-6 w-6" /></span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Economic Events</h1>
            <p className="mt-1 text-sm text-muted-foreground">A shared event layer for all eight analysis groups—not a separate analytical scorecard.</p>
          </div>
        </div>
      </header>}

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Economic calendar</CardTitle>
          <CardDescription>Release times, published values, forecasts, and prior observations supplied by the embedded calendar provider.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:p-6 sm:pt-0">
          <EconomicCalendarWidget />
        </CardContent>
      </Card>

      <div className="flex items-start gap-2 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
        <Database className="mt-0.5 h-4 w-4 shrink-0" />
        GreenPeak does not synthesize event values, release dates, economic-health labels, or market-impact scores on this page.
      </div>
    </div>
  )
}
