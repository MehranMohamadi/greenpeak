import Layout from "@/components/kokonutui/layout"
import MonetaryPolicy from "@/components/analytics/monetary-policy"
import { monetaryFontVariables } from "../fonts"

export default async function MonetaryFactorPage({ params }) {
  const { factorId } = await params
  return <Layout><MonetaryPolicy initialFactorId={factorId} fontClassName={monetaryFontVariables} /></Layout>
}
