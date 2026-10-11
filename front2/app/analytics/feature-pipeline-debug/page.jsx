import FeaturePipelineDebug from "@/components/analytics/feature-pipeline-debug"
import Layout from "@/components/kokonutui/layout"
import { requireAdminPage } from "@/lib/admin-page"

export const metadata = {
  title: "Feature Pipeline JSON | GreenPeak",
  description: "Development view for intermediate rate feature pipeline data",
}

export default async function FeaturePipelineDebugPage() {
  await requireAdminPage()
  return <Layout><FeaturePipelineDebug /></Layout>
}
