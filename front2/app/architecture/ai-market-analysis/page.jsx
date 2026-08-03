import { readFile } from "node:fs/promises"
import path from "node:path"

import ArchitectureMarkdown from "@/components/documentation/architecture-markdown"
import Layout from "@/components/kokonutui/layout"

export const metadata = {
  title: "AI Market Analysis Architecture | GreenPeak",
  description: "GreenPeak AI market analysis system architecture",
}

export const dynamic = "force-static"

async function getArchitectureDocument() {
  const documentPath = path.resolve(
    process.cwd(),
    "..",
    "docs",
    "AI_MARKET_ANALYSIS_ARCHITECTURE.md",
  )

  return readFile(documentPath, "utf8")
}

export default async function AIMarketAnalysisArchitecturePage() {
  const markdown = await getArchitectureDocument()

  return (
    <Layout>
      <ArchitectureMarkdown markdown={markdown} />
    </Layout>
  )
}
