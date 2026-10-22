"use client"

import { useEffect, useState } from "react"
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
  return <MarketIntelligenceContent key={`${accessToken || "public"}:${canViewPremiumAnalysis}`} accessToken={accessToken} />
}

function MarketIntelligenceContent({ accessToken }) {
  const [market, setMarket] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [reloadKey, setReloadKey] = useState(0)
  const reload = () => setReloadKey(current => current + 1)

  useEffect(() => {
    let stopped = false
    let active = null
    const load = async () => {
      if (active || stopped) return
      const controller = new AbortController()
      active = controller
      const timeout = setTimeout(() => controller.abort(), 20000)
      try {
        const response = await fetch("/analytics-data/market/analysis/latest", { cache: "no-store", signal: controller.signal, headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {} })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const payload = await response.json()
        if (!payload?.data) throw new Error("empty market analysis")
        if (stopped) return
        setMarket({
          ...payload.data,
          next_analysis_at: payload.metadata?.next_analysis_at,
          analysis_freshness: payload.metadata?.freshness,
        })
        setError("")
      } catch {
        if (!stopped) setError("دریافت آخرین تحلیل معتبر بازار انجام نشد.")
      } finally {
        clearTimeout(timeout)
        if (active === controller) active = null
        if (!stopped) setLoading(false)
      }
    }
    setLoading(true)
    void load()
    const refreshVisible = () => { if (!document.hidden) void load() }
    const timer = window.setInterval(refreshVisible, 60000)
    document.addEventListener("visibilitychange", refreshVisible)
    window.addEventListener("focus", refreshVisible)
    return () => {
      stopped = true
      active?.abort()
      window.clearInterval(timer)
      document.removeEventListener("visibilitychange", refreshVisible)
      window.removeEventListener("focus", refreshVisible)
    }
  }, [accessToken, reloadKey])

  if (loading && !market) return <ReportFrame><div className="flex min-h-[420px] items-center justify-center bg-background text-muted-foreground" dir="rtl"><LoaderCircle className="ml-2 h-5 w-5 animate-spin text-primary" />در حال دریافت آخرین تحلیل بازار…</div></ReportFrame>

  if (!market) return <ReportFrame><div className="mx-3 md:mx-4"><MarketStatusCards /></div><Card className="mx-3 border-amber-500/30 md:mx-4" dir="rtl"><CardHeader><CardTitle className="flex items-center gap-2"><AlertCircle className="h-5 w-5 text-amber-500" />تحلیل بازار در دسترس نیست</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm text-muted-foreground">{error}</p><Button type="button" variant="outline" onClick={reload} className="gap-2"><RefreshCw className="h-4 w-4" />تلاش دوباره</Button></CardContent></Card></ReportFrame>

  return <ReportFrame>{error && <div role="status" dir="rtl" className="mx-3 flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm md:mx-4"><span>{error}</span><Button type="button" variant="outline" size="sm" onClick={reload}>تلاش دوباره</Button></div>}<MarketIntelligenceSections market={market} onRefresh={reload} loading={loading} /></ReportFrame>
}
