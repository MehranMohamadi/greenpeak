import { CalendarDays, Newspaper } from "lucide-react"

import AlphaVantageNews from "./alpha-vantage-news"
import MacroCalendar from "./macro-calendar"

export default function NewsEvents() {
  return <main className="space-y-6 p-4 md:p-6">
    <header className="space-y-2">
      <div className="flex items-center gap-3">
        <span className="rounded-xl border bg-muted/50 p-2"><Newspaper className="h-6 w-6" /></span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">News &amp; Events</h1>
          <p className="mt-1 text-sm text-muted-foreground">Economic releases first, followed by independent market-news feeds.</p>
        </div>
      </div>
    </header>
    <section aria-labelledby="calendar-summary-title" className="space-y-2">
      <h2 id="calendar-summary-title" className="flex items-center gap-2 text-lg font-semibold"><CalendarDays className="h-5 w-5 text-blue-600" />Calendar summary</h2>
      <MacroCalendar showPageHeader={false} />
    </section>
    <section aria-label="Market news"><AlphaVantageNews /></section>
  </main>
}
