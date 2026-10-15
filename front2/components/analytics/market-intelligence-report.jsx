"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertCircle, LoaderCircle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import MarketIntelligenceSections from "@/components/analytics/market-intelligence-sections"
import USMarketPageHeader from "@/components/analytics/us-market-page-header"
import MarketStatusCards from "@/components/analytics/market-status-cards"
import { useAuth } from "@/components/auth/auth-context"

function ReportFrame({ children }) {
  return <div className="space-y-4"><USMarketPageHeader className="px-3 pt-3 md:px-4 md:pt-4" />{children}</div>
}

export default function MarketIntelligenceReport() {
  const { accessToken, canViewPremiumAnalysis } = useAuth()
  const [market, setMarket] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/analytics-data/market/analysis/latest", { cache: "no-store", headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {} })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const payload = await response.json()
      if (!payload?.data) throw new Error("empty market analysis")
      setMarket({
        ...payload.data,
        next_analysis_at: payload.metadata?.next_analysis_at,
      })
    } catch {
      setError("آخرین تحلیل معتبر بازار در دسترس نیست.")
    } finally {
      setLoading(false)
    }
  }, [accessToken, canViewPremiumAnalysis])

  useEffect(() => { load() }, [load])

  if (loading) return <ReportFrame><div className="flex min-h-[420px] items-center justify-center bg-background text-muted-foreground" dir="rtl"><LoaderCircle className="ml-2 h-5 w-5 animate-spin text-primary" />در حال دریافت آخرین تحلیل بازار…</div></ReportFrame>

  if (!market) return <ReportFrame><div className="mx-3 md:mx-4"><MarketStatusCards /></div><Card className="mx-3 border-amber-500/30 md:mx-4" dir="rtl"><CardHeader><CardTitle className="flex items-center gap-2"><AlertCircle className="h-5 w-5 text-amber-500" />تحلیل بازار در دسترس نیست</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm text-muted-foreground">{error}</p><Button type="button" variant="outline" onClick={load} className="gap-2"><RefreshCw className="h-4 w-4" />تلاش دوباره</Button></CardContent></Card></ReportFrame>

  return <ReportFrame><MarketIntelligenceSections market={market} /></ReportFrame>
}
