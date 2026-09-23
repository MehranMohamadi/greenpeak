import Link from "next/link"
import { ArrowRight, CalendarDays, Newspaper } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { marketAnalysisCategories } from "@/lib/analytics-registry"

export default function AnalyticsGrid() {
  return (
    <section className="space-y-5 px-4 pb-10 md:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Research map</p>
          <h2 className="mt-1 text-2xl font-semibold text-foreground">Eight market-analysis groups</h2>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Each indicator has one owner. Missing or unverified inputs are shown as unavailable instead of being replaced with placeholder values or scores.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {marketAnalysisCategories.map((category, index) => {
          const Icon = category.icon
          return (
            <Link key={category.page} href={`/analytics/${category.page}`} className="group h-full">
              <Card className="h-full transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <span className="rounded-xl bg-primary/10 p-2.5 text-primary">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="text-xs font-medium tabular-nums text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
                  </div>
                  <CardTitle className="pt-2 leading-snug">{category.name}</CardTitle>
                </CardHeader>
                <CardContent className="flex h-[calc(100%-7rem)] flex-col justify-between gap-4">
                  <p className="text-sm leading-6 text-muted-foreground">{category.description}</p>
                  <div>
                    <div className="flex flex-wrap gap-1.5">
                      {category.subgroups.map((subgroup) => (
                        <span key={subgroup} className="rounded-full bg-secondary px-2 py-1 text-[11px] text-secondary-foreground">{subgroup}</span>
                      ))}
                    </div>
                    <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                      Open analysis
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      <div>
        <Link href="/analytics/events" className="group">
          <Card className="h-full transition-colors hover:border-primary/50">
            <CardHeader><CardTitle className="flex items-center gap-2"><Newspaper className="h-5 w-5 text-primary" />News &amp; Events</CardTitle></CardHeader>
            <CardContent className="flex items-center gap-2 text-sm text-muted-foreground"><CalendarDays className="h-4 w-4 shrink-0" />Economic calendar summary followed by independent market-news feeds.</CardContent>
          </Card>
        </Link>
      </div>
    </section>
  )
}
