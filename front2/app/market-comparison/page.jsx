import Layout from "@/components/kokonutui/layout"
import MarketComparison from "@/components/analytics/market-comparison"

export const metadata = {
  title: "مقایسه بازارها | GreenPeak",
  description: "مقایسه روزانه بازارهای سهام، طلا، کالاها و روابط بین بازارها بر مبنای داده معتبر",
}

export default function MarketComparisonPage() {
  return <Layout><MarketComparison /></Layout>
}
