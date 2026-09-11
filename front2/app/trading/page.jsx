import MT5AccountSnapshot from "@/components/dashboard/mt5-account-snapshot"
import Layout from "@/components/kokonutui/layout"

export const metadata = {
  title: "داشبورد معاملات | GreenPeak",
}

export default function TradingDashboardPage() {
  return <Layout>
    <div className="min-h-full bg-white px-1 py-2 dark:bg-[#0F0F12] sm:px-2" dir="rtl">
      <header className="mb-4">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white md:text-2xl">داشبورد معاملات</h1>
      </header>
      <MT5AccountSnapshot />
    </div>
  </Layout>
}
