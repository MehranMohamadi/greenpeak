"use client"

import Layout from "@/components/kokonutui/layout"
import Intermarket from "@/components/analytics/intermarket"
import { Badge } from "@/components/ui/badge"
import { Clock } from "lucide-react"

export default function IntermarketPage() {
  return (
    <Layout>
      <Intermarket />
    </Layout>
  )
}
