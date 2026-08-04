import FeaturePipelineDebug from "@/components/analytics/feature-pipeline-debug"
import Layout from "@/components/kokonutui/layout"

export const metadata = {
  title: "Feature Pipeline JSON | GreenPeak",
  description: "Development view for intermediate rate feature pipeline data",
}

export default function FeaturePipelineDebugPage() {
  return <Layout><FeaturePipelineDebug /></Layout>
}
