"use client"

import Layout from "@/components/kokonutui/layout"
import Derivatives from "@/components/analytics/derivatives"
import { Badge } from "@/components/ui/badge"
import { Clock } from "lucide-react"

export default function DerivativesPage() {
  return (
    <Layout>
      {/* Coming Soon Banner */}
      <div className="mb-4 p-3 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950 dark:to-yellow-950 border-l-4 border-amber-500 rounded-lg">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400 animate-pulse" />
            <span className="font-semibold text-amber-900 dark:text-amber-100">Coming Soon</span>
          </div>
          <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/30">
            UNDER DEVELOPMENT
          </Badge>
          <span className="text-sm text-amber-800 dark:text-amber-200 ml-auto">This feature is currently being enhanced with additional data and functionality.</span>
        </div>
      </div>
      <Derivatives />
    </Layout>
  )
}
