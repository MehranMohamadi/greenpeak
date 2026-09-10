import Layout from "@/components/kokonutui/layout"
import AnalyticsGrid from "@/components/analytics/analytics-grid"
import SP500Dashboard from "@/components/analytics/SP500Dashboard"
import DailyMarketReport from "@/components/analytics/daily-market-report"
import { US_MARKET } from "@/lib/navigation-state"

export default function AnalyticsPage() {
  return (
    <Layout>
      <header dir="rtl" className="mb-4 space-y-1 text-right">
        <h1 className="text-xl font-semibold">{US_MARKET.labelFa}</h1>
        <p className="text-sm text-muted-foreground">شاخص ۵۰۰ شرکت بزرگ آمریکایی</p>
      </header>
      <DailyMarketReport />
      <SP500Dashboard />
      <AnalyticsGrid />
    </Layout>
  )
}
