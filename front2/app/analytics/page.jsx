import Layout from "@/components/kokonutui/layout"
import MarketIntelligenceReport from "@/components/analytics/market-intelligence-report"
import SP500Dashboard from "@/components/analytics/SP500Dashboard"

export default function AnalyticsPage() {
  return (
    <Layout>
      <MarketIntelligenceReport />
      <SP500Dashboard />
    </Layout>
  )
}
