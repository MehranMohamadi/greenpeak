import AnalysisPipeline from "@/components/analytics/analysis-pipeline"
import Layout from "@/components/kokonutui/layout"

export const metadata = {
  title: "Analysis Pipeline | GreenPeak",
  description: "Prepared market analysis context",
}

export default function AnalysisPipelinePage() {
  return (
    <Layout>
      <AnalysisPipeline />
    </Layout>
  )
}
