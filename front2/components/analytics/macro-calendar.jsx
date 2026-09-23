"use client"

import { Building2, Calendar, Database } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import EarningsCalendarWidget from "./earnings-calendar-widget"
import EconomicCalendarWidget from "./economic-calendar-widget"

export default function MacroCalendar({ showPageHeader = true }) {
  return (
    <div className={showPageHeader ? "space-y-6 p-4 md:p-6" : "space-y-6"}>
      {showPageHeader && <header className="space-y-2">
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-primary/10 p-2 text-primary"><Calendar className="h-6 w-6" /></span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Economic Events</h1>
            <p className="mt-1 text-sm text-muted-foreground">A shared event layer for all eight analysis groups—not a separate analytical scorecard.</p>
          </div>
        </div>
      </header>}

      <div className="grid min-w-0 grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="p-4 sm:p-5">
            <CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5 text-primary" />Economic calendar</CardTitle>
            <CardDescription>Release times, published values, forecasts, and prior observations supplied by Tradays.</CardDescription>
          </CardHeader>
          <CardContent className="p-0 sm:px-3 sm:pb-3">
            <EconomicCalendarWidget />
          </CardContent>
        </Card>

        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="p-4 sm:p-5">
            <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" />Earnings calendar</CardTitle>
            <CardDescription>Expected company earnings dates, EPS, revenue, forecasts, and release timing supplied by Finlogix.</CardDescription>
          </CardHeader>
          <CardContent className="p-0 sm:px-3 sm:pb-3">
            <EarningsCalendarWidget />
          </CardContent>
        </Card>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
        <Database className="mt-0.5 h-4 w-4 shrink-0" />
        GreenPeak does not synthesize event values, release dates, earnings forecasts, economic-health labels, or market-impact scores on this page.
      </div>
    </div>
  )
}
