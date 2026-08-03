import Layout from "@/components/kokonutui/layout"
import AnalyticsGrid from "@/components/analytics/analytics-grid"
import SP500Dashboard from "@/components/analytics/SP500Dashboard"

export default function AnalyticsPage() {
  return (
    <Layout>
      <SP500Dashboard />
      <AnalyticsGrid />
    </Layout>
  )
}