import Layout from "@/components/kokonutui/layout"
import MarketIntelligenceReport from "@/components/analytics/market-intelligence-report"

export const metadata = {
  title: "بازار آمریکا US500 | GreenPeak",
  description: "گزارش تحلیلی بازار آمریکا و شاخص S&P 500 در GreenPeak",
}

export default function AnalyticsPage() {
  return (
    <Layout>
      <MarketIntelligenceReport />
    </Layout>
  )
}
