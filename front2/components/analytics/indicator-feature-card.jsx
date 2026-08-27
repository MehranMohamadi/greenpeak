"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, ChevronDown, Database } from "lucide-react"

import { endpoints } from "@/api/api"
import AnalysisListCard from "@/components/analytics/analysis-list-card"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const configs = {
  "monetary-policy:ten-year-treasury": ["us_10y_treasury_yield", "DGS10", endpoints.monetaryPolicy.tenYear],
  "monetary-policy:fed-funds-rate": ["federal_funds_rate", "DFF", endpoints.monetaryPolicy.dff],
  "monetary-policy:fed-balance-sheet": ["fed_balance_sheet", "WALCL", endpoints.monetaryPolicy.fedBalanceSheet],
  "monetary-policy:sofr-rate": ["sofr_rate", "SOFR", endpoints.monetaryPolicy.sofr],
  "monetary-policy:real-interest-rate": ["real_interest_rate_10y", "REAINTRATREARAT10Y", endpoints.monetaryPolicy.realInterestRate],
  "macroeconomic:gdp-growth": ["real_gdp", "GDPC1", endpoints.macroeco.gdp],
  "macroeconomic:unemployment-rate": ["unemployment_rate", "UNRATE", endpoints.macroeco.unemployment],
  "macroeconomic:nonfarm-payrolls": ["nonfarm_payrolls", "PAYEMS", endpoints.macroeco.payroll],
  "macroeconomic:consumer-confidence": ["consumer_confidence", "UMCSENT", endpoints.macroeco.confidence],
  "macroeconomic:cpi-inflation": ["cpi_index", "CPIAUCSL", endpoints.macroeco.cpi],
  "macroeconomic:retail-sales": ["retail_sales", "RSXFS", endpoints.macroeco.retailSales],
  "systemic-risk:vix": ["vix", "VIXCLS", endpoints.systemicRisk.vix],
  "systemic-risk:credit-spreads": ["high_yield_credit_spread", "BAMLH0A0HYM2", endpoints.systemicRisk.credit],
  "systemic-risk:yield-curve": ["treasury_2y10y_spread", "T10Y2Y", endpoints.systemicRisk.twoyteny],
  "systemic-risk:cds-spreads": ["bbb_credit_spread", "BAMLC0A4CBBB", endpoints.systemicRisk.cds],
  "systemic-risk:financial-stress": ["financial_stress_index", "STLFSI4", endpoints.systemicRisk.stress],
  "liquidity-flows:money-supply-m2": ["money_supply_m2", "M2SL", endpoints.liquidity.m2],
  "liquidity-flows:reverse-repo": ["reverse_repo_operations", "RRPONTSYD", endpoints.liquidity.reverseRepo],
  "corporate-earnings:sp500-eps": ["sp500_eps", "SPASTT01USQ661N", endpoints.corporate.epsSp500],
  "corporate-earnings:revenue-growth": ["revenue_growth", "MULTIPLE_REVENUE_GROWTH", endpoints.corporate.revenueGrowth],
  "corporate-earnings:profit-margins": ["profit_margins", "MULTIPLE_PROFIT_MARGINS", endpoints.corporate.profitMargins],
  "corporate-earnings:pe-ratio": ["corporate_pe_ratio", "GSPC_PE_CALCULATED", endpoints.corporate.peRatio],
  "corporate-earnings:dividend-yield": ["corporate_dividend_yield", "SPY_DIVIDEND_YIELD", endpoints.corporate.dividendYield],
  "corporate-earnings:return-on-investment": ["return_on_assets", "MULTIPLE_RETURN_ON_ASSETS", endpoints.corporate.returnOnAssets],
  "valuation:pe-ratio": ["valuation_pe_ratio", "GSPC_PE", endpoints.valuation.peRatio],
  "valuation:forward-pe": ["forward_pe_ratio", "MULTIPLE_FORWARD_PE", endpoints.valuation.forwardPe],
  "valuation:price-to-book": ["price_to_book_ratio", "MULTIPLE_PRICE_TO_BOOK", endpoints.valuation.priceToBook],
  "valuation:price-to-sales": ["price_to_sales_ratio", "MULTIPLE_PRICE_TO_SALES", endpoints.valuation.priceToSales],
  "valuation:peg-ratio": ["peg_ratio", "MULTIPLE_PEG", endpoints.valuation.pegRatio],
  "valuation:dividend-yield": ["valuation_dividend_yield", "SPY_DIVIDEND_YIELD", endpoints.valuation.dividendYield],
}

export const indicatorFeatureConfigs = Object.entries(configs).map(([key, [id, series, rawUrl]]) => ({
  key, id, series, rawUrl, label: `${id} (${series})`,
}))

const formatNumber = (value, suffix = "") => value == null ? "—" : `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}${suffix}`

async function loadPreview(config, signal) {
  const start = new Date()
  start.setUTCFullYear(start.getUTCFullYear() - 11)
  const separator = config.rawUrl.includes("?") ? "&" : "?"
  const response = await fetch(`${config.rawUrl}${separator}start_date=${start.toISOString().slice(0, 10)}`, { cache: "no-store", signal })
  const body = await response.json()
  if (!response.ok) throw new Error(body?.detail || "Source observations are unavailable.")
  const observations = (body.data || []).map(item => ({ date: item.date, value: item.value ?? item.rate })).filter(item => item.date && item.value != null)
  if (!observations.length) throw new Error("No real observations are available for this indicator.")
  const result = await fetch(endpoints.indicatorFeatures.pipelinePreview, {
    method: "POST", headers: { "Content-Type": "application/json" }, signal,
    body: JSON.stringify({ indicator_id: config.id, source_series_id: config.seriesId, source_provider: body.metadata?.source || "GreenPeak API", observations }),
  })
  const resultBody = await result.json()
  if (!result.ok) throw new Error(resultBody?.detail?.message || "Feature preview is unavailable.")
  return resultBody.data?.stages?.validated_snapshot?.snapshot
}

export default function IndicatorFeatureCard({ page, factorId }) {
  const config = useMemo(() => {
    const item = configs[`${page}:${factorId}`]
    return item ? { id: item[0], seriesId: item[1], rawUrl: item[2] } : null
  }, [page, factorId])
  const [snapshot, setSnapshot] = useState(null)
  const [narrative, setNarrative] = useState(null)
  const [sourceMode, setSourceMode] = useState("")
  const [error, setError] = useState("")
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!config) return
    const controller = new AbortController()
    setSnapshot(null); setNarrative(null); setError(""); setExpanded(false)
    Promise.all([
      fetch(endpoints.indicatorFeatures.latest(config.id), { cache: "no-store", signal: controller.signal }),
      fetch(endpoints.analysis.indicatorLatest(config.id), { cache: "no-store", signal: controller.signal }),
    ]).then(async ([featureResponse, narrativeResponse]) => {
      const featureBody = await featureResponse.json()
      const narrativeBody = await narrativeResponse.json()
      const nextSnapshot = featureResponse.ok ? featureBody.data : await loadPreview(config, controller.signal)
      if (!nextSnapshot) throw new Error("A validated feature snapshot was not returned.")
      if (!controller.signal.aborted) {
        setSnapshot(nextSnapshot); setNarrative(narrativeResponse.ok ? narrativeBody.data : null)
        setSourceMode(featureResponse.ok ? "stored snapshot" : "live API preview")
      }
    }).catch(reason => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Indicator analysis is unavailable.")
    })
    return () => controller.abort()
  }, [config])

  if (!config) return null
  if (error) return <Card className="border-amber-500/30"><CardContent className="flex gap-3 p-5 text-sm text-amber-700"><AlertTriangle className="h-5 w-5" /><div><div className="font-medium">Analysis is temporarily unavailable</div><div className="text-xs opacity-80">{error}</div></div></CardContent></Card>
  if (!snapshot) return <Card><CardContent className="p-5 text-sm text-muted-foreground">Loading deterministic features…</CardContent></Card>

  const features = snapshot.features || {}
  const metrics = features.current_value_pct != null ? [
    ["Current", snapshot.current.value ?? snapshot.current.value_pct, snapshot.current.unit === "percent" ? "%" : ""],
    ["30-day change", features.delta_30d_bp, " bp"], ["90-day change", features.delta_90d_bp, " bp"],
    ["1-year z-score", features.zscore_365d, ""], ["5-year percentile", features.percentile_5y, "%"],
  ] : [
    ["Current", snapshot.current.value, ""], ["90-day change", features.delta_90d, ""],
    ["90-day change %", features.delta_90d_pct, "%"], ["Window z-score", features.zscore_window, ""],
    ["Historical percentile", features.percentile_window, "%"],
  ]

  return <Card className="border-violet-500/20">
    <CardHeader>
      <div className="flex flex-wrap items-center justify-between gap-2"><CardTitle className="flex items-center gap-2 text-lg"><Database className="h-5 w-5 text-violet-500" />Deterministic indicator analysis</CardTitle><div className="flex gap-2"><Badge variant="outline">{sourceMode}</Badge><Badge variant="outline">{snapshot.quality.status}</Badge></div></div>
      <CardDescription>{snapshot.source.series_id} · data through {snapshot.source.latest_observation_date} · calculated in Python</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">{metrics.map(([label, value, suffix]) => <div key={label} className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 font-mono font-semibold">{formatNumber(value, suffix)}</div></div>)}</div>
      <div className="rounded-lg bg-muted/50 p-4 text-sm leading-6">{snapshot.llm_context.summary_template_fa}</div>
      <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-4">
        <div className="flex items-center justify-between"><span className="font-semibold">Persisted AI interpretation</span>{narrative && <Badge variant="outline">confidence {narrative.llm_confidence}%</Badge>}</div>
        {narrative ? <><p className="mt-2 leading-7" dir="rtl">{narrative.current_state_fa} {narrative.what_changed_fa}</p><button className="mt-2 inline-flex items-center gap-1 text-xs text-violet-700" onClick={() => setExpanded(value => !value)}><ChevronDown className={`h-4 w-4 ${expanded ? "rotate-180" : ""}`} />{expanded ? "Less" : "More"}</button>{expanded && <div className="mt-4 grid gap-3 border-t pt-4 md:grid-cols-2" dir="rtl"><AnalysisListCard title="Key facts" items={narrative.key_facts} tone="info" /><AnalysisListCard title="Ambiguities" items={narrative.ambiguities_fa} tone="warning" /><AnalysisListCard title="Interpretation risks" items={narrative.risks_to_interpretation_fa} tone="negative" /><AnalysisListCard title="Watch next" items={narrative.watch_next_fa} tone="violet" /></div>}</> : <p className="mt-2 text-sm text-muted-foreground">The deterministic snapshot is ready; no persisted LLM narrative exists for this date yet.</p>}
      </div>
    </CardContent>
  </Card>
}
