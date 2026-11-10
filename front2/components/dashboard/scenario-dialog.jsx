"use client"

import { useEffect, useMemo, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { money, number } from "@/components/kokonutui/mt5-data-view"
import { latestSiteQuote, scenarioBrokerUnitQuote, scenarioRiskRow, tradeMarketRequest, volumeScenarioEstimate } from "@/lib/risk-management"
import { formatGregorianTehranDateTime } from "@/lib/date-format"

const insetClass = "rounded-lg border border-gray-200 bg-gray-50 dark:border-[#2B2B30] dark:bg-[#0F0F12]"
const leverageText = (value) => value == null ? "—" : `${number(value, 3, 3)}×`

function ScenarioControl({ id, label, value, onChange, min, max, dollarValue, dollarLabel, percent = false, help }) {
  const numeric = value === "" ? null : Number(value)
  const sliderValue = Number.isFinite(numeric) ? Math.max(min, Math.min(max, numeric)) : 0
  const updateInput = (next) => {
    if (next === "") { onChange(""); return }
    const parsed = Number(next)
    if (Number.isFinite(parsed)) onChange(String(Math.max(min, Math.min(max, parsed))))
  }
  return <div className="space-y-2">
    <Label htmlFor={id}>{label}</Label>
    <div className="grid grid-cols-[minmax(0,1fr)_4.5rem_5.5rem] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_6rem_7rem] sm:gap-3">
      <Slider aria-label={label} dir="ltr" min={min} max={max} step={1} value={[sliderValue]} onValueChange={([next]) => onChange(String(next))} />
      <div className="relative" dir="ltr">
        <Input id={id} aria-describedby={`${id}-help`} className={percent ? "pr-7" : ""} type="number" min={min} max={max} step="any" value={value} onChange={(event) => updateInput(event.target.value)} onBlur={() => { if (value === "") onChange("0") }} />
        {percent && <span aria-hidden="true" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>}
      </div>
      <div className="min-w-0 text-left">
        <p className="text-[9px] leading-4 text-muted-foreground">{dollarLabel}</p>
        <output htmlFor={id} aria-label={dollarLabel} dir="ltr" className="block break-words text-xs font-medium tabular-nums">{dollarValue == null ? "—" : money(dollarValue, "USD")}</output>
      </div>
    </div>
    <p id={`${id}-help`} className="text-[10px] leading-5 text-muted-foreground">{help}</p>
  </div>
}

export default function ScenarioDialog({ open, onOpenChange, scenarioSymbols, selectedScenarioSymbol, onSymbolChange, snapshots, leverage, symbolRisks, allAccounts }) {
  const [addedUnits, setAddedUnits] = useState("0")
  const [shockPct, setShockPct] = useState("0")
  const [quoteResult, setQuoteResult] = useState(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const row = scenarioRiskRow(symbolRisks, selectedScenarioSymbol)
  const market = tradeMarketRequest(row?.symbol_id || selectedScenarioSymbol)
  const brokerQuote = useMemo(() => scenarioBrokerUnitQuote(snapshots, selectedScenarioSymbol, symbolRisks), [snapshots, selectedScenarioSymbol, symbolRisks])
  const quote = quoteResult?.symbol === selectedScenarioSymbol ? quoteResult.quote : brokerQuote
  const unitName = market?.responseType === "series" ? "اونس" : market?.responseType === "ohlc" ? "واحد شاخص" : "واحد دارایی"
  const scenario = volumeScenarioEstimate(leverage, symbolRisks, selectedScenarioSymbol, shockPct, addedUnits, quote?.price)

  useEffect(() => {
    if (open) { setAddedUnits("0"); setShockPct("0") }
  }, [open])

  useEffect(() => {
    if (!open) return
    let controller
    const loadQuote = async () => {
      controller?.abort()
      const request = new AbortController()
      controller = request
      setQuoteResult((current) => current?.symbol === selectedScenarioSymbol && current.quote
        && (!brokerQuote || Date.parse(current.quote.observedAt) > Date.parse(brokerQuote.observedAt))
        ? current : { symbol: selectedScenarioSymbol, quote: brokerQuote })
      if (!market?.url) { setQuoteLoading(false); return }
      setQuoteLoading(true)
      try {
        const response = await fetch(market.url, { cache: "no-store", signal: request.signal })
        if (!response.ok) throw new Error("Quote unavailable")
        const latest = latestSiteQuote(await response.json(), market.responseType)
        const time = Date.parse(latest?.observedAt)
        const selected = latest && Number.isFinite(time) && time <= Date.now() && (!brokerQuote || time >= Date.parse(brokerQuote.observedAt)) ? latest : brokerQuote
        if (!request.signal.aborted) setQuoteResult({ symbol: selectedScenarioSymbol, quote: selected })
      } catch {
        if (!request.signal.aborted) setQuoteResult({ symbol: selectedScenarioSymbol, quote: brokerQuote })
      } finally {
        if (!request.signal.aborted) setQuoteLoading(false)
      }
    }
    void loadQuote()
    const timer = window.setInterval(() => { if (!document.hidden) void loadQuote() }, 60_000)
    return () => { controller?.abort(); window.clearInterval(timer) }
  }, [open, selectedScenarioSymbol, brokerQuote, market?.url, market?.responseType])

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent dir="rtl" className="max-h-[90dvh] w-[calc(100vw-2rem)] max-w-xl overflow-y-auto">
      <DialogHeader className="pl-8 text-right sm:text-right">
        <DialogTitle>سناریو</DialogTitle>
        <DialogDescription>{allAccounts ? "اثر تغییر حجم و قیمت نماد بر اکوییتی و اهرم کل همه بروکرها" : "اثر تغییر حجم و قیمت نماد بر اکوییتی و اهرم کل حساب"}</DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor="scenario-symbol">نماد</Label>
          <Select dir="rtl" value={selectedScenarioSymbol || undefined} onValueChange={onSymbolChange}><SelectTrigger id="scenario-symbol"><SelectValue placeholder="نماد سناریو" /></SelectTrigger><SelectContent>{scenarioSymbols.map(({ symbol, label }) => <SelectItem key={symbol} value={symbol}>{label}</SelectItem>)}</SelectContent></Select>
        </div>
        <p className="text-xs leading-6 text-muted-foreground">با افزودن هر واحد از نماد انتخاب‌شده، اثر آن بر مقادیر پایین نمایش داده می‌شود. برای طلا، هر واحد یک اونس و برای S&amp;P 500، یک واحد به ارزش دلاری قیمت شاخص است.</p>
        <ScenarioControl id="scenario-units" label={`افزایش حجم (${unitName})`} value={addedUnits} onChange={setAddedUnits} min={-100} max={100}
          dollarValue={scenario.addedNotionalUsd} dollarLabel="ارزش دلاری حجم"
          help="پیش‌فرض صفر است؛ عدد مثبت یعنی افزودن معامله لانگ و عدد منفی یعنی افزودن معامله شورت. ارزش دلاری = تعداد واحد × قیمت دلاری هر واحد؛ تعداد لات = تعداد واحد ÷ اندازه قرارداد بروکر." />
        <ScenarioControl id="scenario-shock" label="تغییر قیمت (درصد)" value={shockPct} onChange={setShockPct} min={-20} max={20} percent
          dollarValue={scenario.priceChangeUsd} dollarLabel="تغییر دلاری هر واحد"
          help="پیش‌فرض صفر است؛ عدد منفی یعنی افت قیمت و عدد مثبت یعنی رشد قیمت. تغییر دلاری هر واحد = درصد تغییر × قیمت فعلی هر واحد؛ اثر حجم جدید هم در سناریوی قیمت لحاظ می‌شود." />
        <p className="text-[10px] leading-5 text-muted-foreground">{quote ? <>{`قیمت مبنا: ${money(quote.price, "USD")} برای هر ${unitName}`}<br />{quote.source} · <bdi>{formatGregorianTehranDateTime(quote.observedAt)}</bdi></> : quoteLoading ? "در حال دریافت قیمت دلاری هر واحد…" : "قیمت دلاری معتبر هر واحد در دسترس نیست؛ محاسبات نیازمند قیمت با — نمایش داده می‌شوند."}</p>
      </div>
      <dl className="grid grid-cols-2 gap-2" aria-live="polite">
        <div className={`${insetClass} p-4`}><dt className="text-[10px] text-muted-foreground">اهرم کل پس از تغییر حجم</dt><dd className="mt-2 text-base font-semibold tabular-nums" dir="ltr">{scenario.available ? leverageText(scenario.leverageAfterVolume) : "—"}</dd>{scenario.available && <dd className="mt-1 text-xs text-muted-foreground">اهرم فعلی: <bdi>{leverageText(scenario.leverageBefore)}</bdi></dd>}</div>
        <div className={`${insetClass} p-4`}><dt className="text-[10px] text-muted-foreground">اهرم کل پس از تغییر حجم و قیمت</dt><dd className="mt-2 text-base font-semibold tabular-nums" dir="ltr">{scenario.available ? leverageText(scenario.leverageAfter) : "—"}</dd>{scenario.available && scenario.equityAfter <= 0 && <dd className="mt-1 text-xs text-muted-foreground">اکوییتی برآوردی مثبت نیست؛ اهرم تعریف نمی‌شود.</dd>}</div>
        <div className={`${insetClass} p-4`}><dt className="text-[10px] text-muted-foreground">{allAccounts ? "اثر تقریبی بر اکوییتی کل" : "اثر تقریبی بر Equity"}</dt><dd className={`mt-2 text-base font-semibold tabular-nums ${scenario.pnl < 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`} dir="ltr">{scenario.available ? money(scenario.pnl, "USD") : "—"}</dd>{scenario.available && scenario.impactPct != null && <dd className="mt-1 text-xs text-muted-foreground"><bdi>{number(scenario.impactPct, 2, 2)}٪</bdi> از {allAccounts ? "اکوییتی کل" : "اکوییتی حساب"}</dd>}</div>
        <div className={`${insetClass} p-4`}><dt className="text-[10px] text-muted-foreground">{allAccounts ? "اکوییتی کل برآوردی" : "Equity برآوردی"}</dt><dd className="mt-2 text-base font-semibold tabular-nums" dir="ltr">{scenario.available ? money(scenario.equityAfter, "USD") : "—"}</dd>{scenario.available && <dd className="mt-1 text-xs text-muted-foreground">اکوییتی فعلی: <bdi>{money(scenario.equityBefore, "USD")}</bdi></dd>}</div>
      </dl>
      <div className={`${insetClass} p-4 text-xs leading-6 text-muted-foreground`}>{scenario.available ? "ابتدا حجم جدید در قیمت مبنا اضافه و با معاملات موجود خالص می‌شود، سپس تغییر قیمت اعمال می‌شود. حجم انتخابی در حالت همه بروکرها یک‌بار به کل پرتفوی افزوده می‌شود. سایر نمادها ثابت‌اند؛ مارجین، گپ، لغزش و هزینه اجرای معامله در این برآورد خطی لحاظ نمی‌شوند." : scenario.reason}</div>
    </DialogContent>
  </Dialog>
}
