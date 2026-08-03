"use client"

import Layout from "@/components/kokonutui/layout"
import CorporateEarnings from "@/components/analytics/corporate-earnings"
import { Clock } from "lucide-react"

export default function CorporateEarningsPage() {
  return (
    <Layout>
          <CorporateEarnings />
    </Layout>
  )
}