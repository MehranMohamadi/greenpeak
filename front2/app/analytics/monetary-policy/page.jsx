import Layout from "@/components/kokonutui/layout"
import MonetaryPolicy from "@/components/analytics/monetary-policy"
import { monetaryFontVariables } from "./fonts"

export default function MonetaryPolicyPage() {
  return (
    <Layout>
      <MonetaryPolicy fontClassName={monetaryFontVariables} />
    </Layout>
  )
}
