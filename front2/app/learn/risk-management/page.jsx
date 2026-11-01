import Layout from "@/components/kokonutui/layout"
import RiskLearning from "@/components/learning/risk-learning"
import { requireAdminPage } from "@/lib/admin-page"

export const metadata = { title: "آموزش مدیریت ریسک | GreenPeak", description: "شش درس فارسی، سی کارت تمرین تألیفی، مرور فاصله‌دار و آزمون کوتاه مدیریت ریسک." }

export default async function RiskLearningPage() {
  await requireAdminPage()
  return <Layout><RiskLearning /></Layout>
}
