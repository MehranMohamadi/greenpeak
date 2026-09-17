"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertCircle, LoaderCircle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import MarketIntelligenceSections from "@/components/analytics/market-intelligence-sections"

export default function MarketIntelligenceReport() {
  const [market, setMarket] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/analytics-data/market/analysis/latest", { cache: "no-store" })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const payload = await response.json()
      if (!payload?.data) throw new Error("empty market analysis")
      setMarket(payload.data)
    } catch {
      setError("آخرین تحلیل معتبر بازار در دسترس نیست.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="flex min-h-[420px] items-center justify-center bg-[#0b1120] text-slate-300" dir="rtl"><LoaderCircle className="ml-2 h-5 w-5 animate-spin text-cyan-400" />در حال دریافت آخرین تحلیل بازار…</div>

  if (!market) return <Card className="border-amber-500/30 bg-[#111c33] text-slate-100" dir="rtl"><CardHeader><CardTitle className="flex items-center gap-2"><AlertCircle className="h-5 w-5 text-amber-400" />تحلیل بازار در دسترس نیست</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm text-slate-300">{error}</p><Button type="button" variant="outline" onClick={load} className="gap-2 border-slate-600 bg-slate-900"><RefreshCw className="h-4 w-4" />تلاش دوباره</Button></CardContent></Card>

  return <MarketIntelligenceSections market={market} />
}
