import Layout from "@/components/kokonutui/layout"
import AnalyticsGrid from "@/components/analytics/analytics-grid"
import SP500Dashboard from "@/components/analytics/SP500Dashboard"
import DailyMarketReport from "@/components/analytics/daily-market-report"

export default function AnalyticsPage() {
  return (
    <Layout>
      <DailyMarketReport />
      <SP500Dashboard />
      <AnalyticsGrid />
    </Layout>
  )
}
