"use client"
import PremiumAnalysisGate from "@/components/analytics/premium-analysis-gate"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleHelp,
  ClipboardCheck,
  Gauge,
  Info,
  ListChecks,
  Link2,
  Loader2,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  Triangle,
  WifiOff,
  XCircle,
} from "lucide-react"
import { useAuth } from "@/components/auth/auth-context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { accountKey, money, number } from "@/components/kokonutui/mt5-data-view"
import { MT5_BROKER_DELETED_EVENT, withoutBroker } from "@/lib/mt5-account-changes"
import { createRiskDemoSnapshot } from "@/lib/mt5-demo-snapshot"
import { buildTradeLifecycles } from "@/lib/mt5-trade-lifecycles"
import {
  aggregateRiskOverview,
  aggregateScenarioEstimate,
  aggregateScenarioSymbolOptions,
  analyzeOpenRisk,
  analyzeTradeHistory,
  assessAllocatedTrade,
  availableSymbols,
  brokerContractSize,
  brokerSpecFor,
  buildBehaviorAnalysis,
  buildTradeReview,
  confirmTradePlanTicket,
  createTradePlan,
  EMPTY_RISK_RULES,
  EMPTY_TRADE_DRAFT,
  finiteNumber,
  latestSiteQuote,
  leverageReason,
  normalizePositionIdentifier,
  orderIdentifier,
  parseTradePlans,
  positionIdentifier,
  positiveRule,
  scenarioEstimate,
  scenarioSymbolOptions,
  stepTradePrice,
  tradeAssetVolume,
  tradeInputErrors,
  tradeMarketRequest,
  tradePriceStep,
} from "@/lib/risk-management"

const surfaceClass = "border-gray-200 bg-white shadow-sm dark:border-[#2B2B30] dark:bg-[#1F1F23]"
const insetClass = "rounded-lg border border-gray-200 bg-gray-50 dark:border-[#2B2B30] dark:bg-[#0F0F12]"
const ALL_ACCOUNTS = "all-accounts"

function responseError(body, status) {
  if (typeof body?.detail === "string") return body.detail
  return status === 503 ? "سرویس حساب‌های معاملاتی در دسترس نیست" : `دریافت اطلاعات ریسک ممکن نشد (${status})`
}

function accountName(snapshot) {
  const source = snapshot?.source || {}
  return [source.broker_company, source.trade_server, source.account_identifier].filter(Boolean).join(" · ") || "حساب معاملاتی"
}

function RiskAccountSelect({ id, snapshots, snapshot, onAccountChange }) {
  return <Select required dir="rtl" value={accountKey(snapshot)} onValueChange={onAccountChange}>
    <SelectTrigger id={id} aria-required="true" className="h-9 min-w-0 px-2 text-xs [&>span]:min-w-0 [&>span]:truncate">
      <SelectValue><span className="block truncate">{accountName(snapshot)}</span></SelectValue>
    </SelectTrigger>
    <SelectContent dir="rtl" className="w-[min(90vw,32rem)] max-w-[calc(100vw-2rem)]">
      {snapshots.map((item) => <SelectItem key={accountKey(item)} value={accountKey(item)}><span className="whitespace-normal break-words">{accountName(item)}</span></SelectItem>)}
    </SelectContent>
  </Select>
}

function formatTehranTimestamp(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return ""
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value)
  const part = (type) => parts.find((item) => item.type === type)?.value || ""
  return `${part("year")}-${part("month")}-${part("day")} · ${part("hour")}:${part("minute")}`
}

function toneClass(tone) {
  if (tone === "danger") return "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
  if (tone === "warning") return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
  if (tone === "success") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
  return "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300"
}

function formatLeverage(value) {
  return value == null ? "داده کافی نیست" : value > 0 && value < 0.01 ? "<0.01×" : `${number(value, 2, 2)}×`
}

function symbolMoveText(row) {
  if (row.target_reason === "already_at_target") return "اکنون ۱۰ یا بیشتر است"
  if (row.target_reason === "net_zero") return "خالص معاملات صفر است"
  if (row.target_reason === "no_positive_price_solution") return "با افت قیمت به ۱۰ نمی‌رسد"
  if (row.adverse_move_pct == null) return leverageReason(row.target_reason || row.reason)
  const percent = row.adverse_move_pct > 0 && row.adverse_move_pct < 0.01 ? "کمتر از ۰٫۰۱" : number(row.adverse_move_pct, 2, 2)
  return `${row.adverse_direction === "rise" ? "افزایش" : "افت"} ${percent}٪`
}

function RiskOverviewTable({ columns, symbols, allAccounts }) {
  const [expanded, setExpanded] = useState(false)
  return <Collapsible open={expanded} onOpenChange={setExpanded} className="w-full min-w-0 overflow-hidden rounded-lg border">
      <Table className="w-full min-w-[800px] text-right text-xs" aria-label="خلاصه مدیریت ریسک">
        <TableHeader><TableRow className="bg-muted/40">{columns.map(({ key, label }) => <TableHead key={key} scope="col" className="h-10 whitespace-nowrap px-2 text-right text-xs">{label}</TableHead>)}<TableHead scope="col" className="w-8 px-1"><span className="sr-only">جزئیات</span></TableHead></TableRow></TableHeader>
        <TableBody><TableRow>{columns.map(({ key, value, detail, tone }) => <TableCell key={key} className={`px-2 py-4 text-right align-top ${tone === "danger" ? "text-rose-600 dark:text-rose-400" : tone === "warning" ? "text-amber-600 dark:text-amber-400" : ""}`}>
          <bdi className="whitespace-nowrap font-semibold tabular-nums">{value}</bdi>
          {detail && <p className="mt-1 text-[10px] leading-5 text-muted-foreground">{detail}</p>}
        </TableCell>)}<TableCell className="w-8 px-1 py-3">
          <CollapsibleTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label={expanded ? "بستن جزئیات اکسپوژر و اهرم نمادها" : "نمایش جزئیات اکسپوژر و اهرم نمادها"}>
              <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
            </Button>
          </CollapsibleTrigger>
        </TableCell></TableRow></TableBody>
      </Table>
      <CollapsibleContent className="space-y-3 border-t p-3">
        <p className="text-xs leading-6 text-muted-foreground">{allAccounts ? "خرید و فروش هر نماد در کل حساب‌ها خالص می‌شود؛ اکسپوژر کل، جمع قدر مطلق خالص نمادهاست." : "خرید و فروش هر نماد خالص می‌شود؛ اکسپوژر کل، جمع قدر مطلق خالص نمادهاست."}</p>
        <Table className="min-w-[580px] text-right text-xs" aria-label="ریسک هر نماد">
          <TableHeader><TableRow>{["نماد", "اکسپوژر خالص (دلار)", "اهرم نماد", "حرکت قیمت تا اهرم ۱۰ نماد"].map((label) => <TableHead key={label} scope="col" className="px-2 text-right text-xs">{label}</TableHead>)}</TableRow></TableHeader>
          <TableBody>{symbols.length ? symbols.map((row) => <TableRow key={row.symbol_id}>
            <TableCell className="px-2 py-3 font-medium">{{ gold: "طلا", sp500: "S&P 500", bitcoin: "بیت‌کوین", ethereum: "اتریوم" }[row.symbol_id] || row.label}<p className="mt-1 text-[10px] text-muted-foreground" dir="ltr">{row.symbols.join(" / ")}</p></TableCell>
            <TableCell className="px-2 py-3 tabular-nums"><bdi>{row.net_exposure_usd == null ? "داده کافی نیست" : money(row.net_exposure_usd, "USD")}</bdi></TableCell>
            <TableCell className="px-2 py-3 tabular-nums"><bdi>{formatLeverage(row.leverage)}</bdi></TableCell>
            <TableCell className="px-2 py-3 leading-6">{symbolMoveText(row)}</TableCell>
          </TableRow>) : <TableRow><TableCell colSpan={4} className="p-3 text-right text-muted-foreground">نماد بازی برای نمایش وجود ندارد.</TableCell></TableRow>}</TableBody>
        </Table>
        <p className="text-[10px] leading-6 text-muted-foreground">برآورد با تغییر خطی قیمت همین نماد و ثابت‌بودن سایر نمادها، حجم و نرخ ارز محاسبه می‌شود؛ هزینه‌ها و تغییر مارجین لحاظ نشده‌اند. برای خالص فروش، افزایش قیمت حرکت نامطلوب است.</p>
      </CollapsibleContent>
  </Collapsible>
}

function RuleField({ label, value, suffix, onChange }) {
  return <div className="space-y-1.5">
    <Label className="text-xs text-muted-foreground">{label}</Label>
    <div className="relative">
      <Input
        type="number"
        min="0"
        step="0.1"
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="تعیین نشده"
        className="pl-12 tabular-nums"
        dir="ltr"
      />
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{suffix}</span>
    </div>
  </div>
}

function CheckBadge({ status }) {
  if (status === "pass") return <Badge variant="outline" className={toneClass("success")}><CheckCircle2 className="ml-1 h-3 w-3" />مجاز</Badge>
  if (status === "fail") return <Badge variant="outline" className={toneClass("danger")}><XCircle className="ml-1 h-3 w-3" />ناسازگار</Badge>
  return <Badge variant="outline" className={toneClass("warning")}><CircleHelp className="ml-1 h-3 w-3" />نیازمند داده</Badge>
}

function EmptyState({ loading, error, onRefresh, demoAvailable, onUseDemo }) {
  return <div className={`${insetClass} flex flex-col items-center justify-center gap-3 border-dashed px-4 py-10 text-center`}>
      {loading ? <Loader2 className="h-7 w-7 animate-spin text-primary" /> : <WifiOff className="h-7 w-7 text-amber-500" />}
      <div>
        <p className="text-sm font-medium text-foreground">{loading ? "در حال دریافت Snapshot حساب…" : "Snapshot حساب معاملاتی موجود نیست"}</p>
        <p className="mt-1 max-w-xl text-xs leading-5 text-muted-foreground">{error || "پس از اتصال افزونه MT5 و ارسال Snapshot، محاسبات این بخش با داده واقعی حساب فعال می‌شوند."}</p>
      </div>
      {!loading && <div className="flex flex-wrap justify-center gap-2">
        <Button asChild size="sm" variant="outline"><Link href="/profile#broker-connection">تنظیمات اتصال</Link></Button>
        <Button size="sm" variant="outline" onClick={onRefresh}><RefreshCw className="ml-2 h-4 w-4" />تلاش دوباره</Button>
        {demoAvailable && <Button size="sm" onClick={onUseDemo}><ClipboardCheck className="ml-2 h-4 w-4" />نمایش با داده نمونه</Button>}
      </div>}
  </div>
}


function TradePriceInput({ value, basePrice, priceStep, onValueChange, className = "", ...props }) {
  const adjust = (direction) => {
    const price = stepTradePrice(value, basePrice, priceStep, direction)
    if (price != null) onValueChange(String(price))
  }
  return <div className="relative">
    <Input {...props} dir="ltr" type="number" inputMode="decimal" min="0" step={priceStep}
      value={value} onChange={(event) => onValueChange(event.target.value)}
      onKeyDown={(event) => {
        if (["ArrowUp", "ArrowDown"].includes(event.key)) {
          event.preventDefault()
          adjust(event.key === "ArrowUp" ? 1 : -1)
        }
      }}
      placeholder={positiveRule(basePrice)?.toString() || "قیمت"}
      className={`${className} pr-7 [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`} />
    <div className="absolute inset-y-1 right-1 flex w-5 flex-col border-l border-border">
      {[1, -1].map((direction) => <button key={direction} type="button"
        aria-label={`${direction === 1 ? "افزایش" : "کاهش"} ${props["aria-label"]}`}
        onClick={() => adjust(direction)} disabled={stepTradePrice(value, basePrice, priceStep, direction) == null}
        className="flex flex-1 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-30">
        {direction === 1 ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>)}
    </div>
  </div>
}

function TradeReviewField({ id, label, required = false, info, error, children }) {
  return <div className="min-w-0 space-y-1.5">
    <div className="flex min-h-8 flex-wrap items-center gap-1 sm:min-h-5">
      <Label htmlFor={id} className="text-[11px] leading-4 sm:text-xs">
        {label}{required && <><span className="mr-1 text-rose-600 dark:text-rose-400" aria-hidden="true">*</span><span className="sr-only"> (الزامی)</span></>}
      </Label>
      {info && <Popover>
        <PopoverTrigger asChild>
          <button type="button" aria-label={`راهنمای ${label}`} className="rounded-sm text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Info className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </PopoverTrigger>
        <PopoverContent dir="rtl" align="start" className="w-64 max-w-[calc(100vw-2rem)] text-xs leading-6">
          <p className="mb-1 font-medium">{label}</p><p className="text-muted-foreground">{info}</p>
        </PopoverContent>
      </Popover>}
    </div>
    {children}
    {error && <p id={`${id}-error`} role="alert" className="text-[10px] leading-4 text-rose-600 dark:text-rose-400">{error}</p>}
  </div>
}

function TradeTextAnalysis({ analysis }) {
  if (typeof analysis?.summary !== "string") {
    return <p className={`${insetClass} p-4 text-xs leading-6 text-muted-foreground`}>تحلیل متنی هنگام ذخیرهٔ این برنامه ثبت نشده است.</p>
  }
  const groups = [
    { key: "risks", label: "نکات ریسکی تکمیلی", tone: "text-rose-700 dark:text-rose-300" },
    { key: "strengths", label: "نقاط ثبت‌شده مناسب", tone: "text-emerald-700 dark:text-emerald-300" },
    { key: "limitations", label: "محدودیت‌ها و داده‌های بررسی‌نشده", tone: "text-amber-700 dark:text-amber-300" },
  ]
  return <div className={`${insetClass} space-y-3 p-4`}>
    <div className="flex items-center gap-2"><BrainCircuit className="h-4 w-4 text-primary" /><p className="text-sm font-semibold">تحلیل متنی معامله</p></div>
    <p className="text-xs leading-6 text-foreground">{analysis.summary}</p>
    {groups.map(({ key, label, tone }) => {
      const items = Array.isArray(analysis[key]) ? analysis[key].filter((item) => typeof item === "string") : []
      return items.length > 0 && <div key={key}><p className={`text-[11px] font-medium ${tone}`}>{label}</p><ul className="mt-1 list-disc space-y-1 pr-4 text-[11px] leading-5 text-muted-foreground">{items.map((item, index) => <li key={index}>{item}</li>)}</ul></div>
    })}
    <p className="border-t pt-2 text-[10px] leading-5 text-muted-foreground">تحلیل متنی قاعده‌محور است و کیفیت واقعی تحلیل بازار یا احتمال موفقیت معامله را تضمین نمی‌کند.</p>
  </div>
}

function TradeReviewPanel({ open, onOpenChange, snapshots, onAccountChange, snapshot, rules, openRisk, draft, setDraft, onSavePlan, saved, storageError }) {
  const symbols = availableSymbols(snapshot)
  const [review, setReview] = useState(null)
  const [inputErrors, setInputErrors] = useState({})
  const [quote, setQuote] = useState(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const formRef = useRef(null)
  const assetVolume = tradeAssetVolume(draft)
  const priceStep = tradePriceStep(brokerSpecFor(snapshot, draft.symbol))
  const protectionBase = positiveRule(draft.entryPrice) ?? positiveRule(quote?.price)
  const currency = snapshot?.account?.currency || "USD"
  const update = (key, value) => {
    setReview(null)
    setInputErrors((current) => {
      const next = { ...current }
      delete next[key]
      if (key === "volume") delete next.contractSize
      return next
    })
    setDraft((current) => ({ ...current, [key]: value }))
  }
  const selectSymbol = (symbol) => {
    if (symbol === draft.symbol) return
    const contractSize = brokerContractSize(snapshot, symbol)
    setReview(null)
    setInputErrors({})
    setQuote(null)
    setDraft((current) => current.symbol === symbol ? current : ({
      ...current, symbol, entryPrice: "", stopLoss: "", takeProfit: "",
      contractSize: contractSize?.toString() || "",
    }))
  }

  useEffect(() => {
    if (!open) { setReview(null); setInputErrors({}) }
  }, [open])

  useEffect(() => {
    setReview(null)
  }, [snapshot])

  useEffect(() => {
    setQuote(null)
    if (!open || !draft.symbol) { setQuoteLoading(false); return undefined }
    const market = tradeMarketRequest(draft.symbol)
    const spec = brokerSpecFor(snapshot, draft.symbol)
    const price = positiveRule(draft.direction === "SELL" ? spec?.bid : spec?.ask)
    const brokerQuote = price == null ? null : {
      price, observedAt: snapshot?.timestamp_utc, source: "Snapshot حساب معاملاتی",
    }
    let controller
    const loadQuote = async () => {
      controller?.abort()
      const request = new AbortController()
      controller = request
      setQuoteLoading(true)
      try {
        if (!market) { setQuote(brokerQuote); return }
        const response = await fetch(market.url, { cache: "no-store", signal: request.signal })
        if (!response.ok) throw new Error("Market quote unavailable")
        const latest = latestSiteQuote(await response.json(), market.responseType)
        if (!latest) throw new Error("No valid market quote")
        if (!request.signal.aborted) setQuote(latest)
      } catch {
        if (!request.signal.aborted) setQuote(brokerQuote)
      } finally {
        if (!request.signal.aborted) setQuoteLoading(false)
      }
    }
    loadQuote()
    const timer = window.setInterval(loadQuote, 60_000)
    return () => { controller?.abort(); window.clearInterval(timer) }
  }, [open, draft.symbol, draft.direction, snapshot])

  const runReview = (event) => {
    event.preventDefault()
    const errors = tradeInputErrors(draft)
    setInputErrors(errors)
    if (Object.keys(errors).length) {
      setReview(null)
      document.getElementById(`trade-${Object.keys(errors)[0]}`)?.focus()
      return
    }
    setReview(buildTradeReview(snapshot, draft, rules, openRisk))
  }
  const fieldProps = (key) => ({
    id: `trade-${key}`, "aria-required": true, "aria-invalid": Boolean(inputErrors[key]),
    "aria-describedby": inputErrors[key] ? `trade-${key}-error` : undefined,
    className: "h-9 min-w-0 px-2 text-xs tabular-nums",
  })

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent dir="rtl" className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-2xl overflow-y-auto">
      <DialogHeader className="pl-8 text-right sm:text-right">
        <DialogTitle>بررسی معامله جدید</DialogTitle>
        <DialogDescription>اطلاعات را ثبت و سپس بررسی را اجرا کنید. این فرایند فقط خواندنی است و هیچ سفارشی به بروکر ارسال نمی‌کند.</DialogDescription>
      </DialogHeader>

      <div className="mt-5 space-y-5">
        <form ref={formRef} onSubmit={runReview} noValidate className="space-y-4">
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <TradeReviewField id="trade-broker" label="بروکر" required>
            <RiskAccountSelect id="trade-broker" snapshots={snapshots} snapshot={snapshot} onAccountChange={onAccountChange} />
          </TradeReviewField>
          <TradeReviewField id="trade-symbol" label="نماد" required error={inputErrors.symbol}>
            <Select required value={draft.symbol || undefined} onValueChange={selectSymbol}>
              <SelectTrigger {...fieldProps("symbol")}><SelectValue placeholder="انتخاب نماد" /></SelectTrigger>
              <SelectContent>{symbols.map((symbol) => <SelectItem key={symbol} value={symbol}>{symbol}</SelectItem>)}</SelectContent>
            </Select>
          </TradeReviewField>
          <TradeReviewField id="trade-direction" label="جهت" required error={inputErrors.direction}>
            <Select required value={draft.direction} onValueChange={(value) => update("direction", value)}>
              <SelectTrigger {...fieldProps("direction")}><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="BUY">خرید</SelectItem><SelectItem value="SELL">فروش</SelectItem></SelectContent>
            </Select>
          </TradeReviewField>
          <TradeReviewField id="trade-orderType" label="نوع سفارش" required error={inputErrors.orderType} info="بازار: ورود با قیمت موجود بازار. در انتظار: ورود در قیمت تعیین‌شده، پس از رسیدن بازار به شرایط سفارش.">
            <Select required value={draft.orderType} onValueChange={(value) => update("orderType", value)}>
              <SelectTrigger {...fieldProps("orderType")}><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="MARKET">بازار</SelectItem><SelectItem value="PENDING">در انتظار</SelectItem></SelectContent>
            </Select>
          </TradeReviewField>
          <TradeReviewField id="trade-currentPrice" label="قیمت فعلی">
            <Input id="trade-currentPrice" dir="ltr" type="number" step="any" readOnly value={quote?.price ?? ""} placeholder={!draft.symbol ? "انتخاب نماد" : quoteLoading ? "در حال دریافت…" : "در دسترس نیست"} className="h-9 min-w-0 bg-muted/40 px-2 text-xs tabular-nums" />
          </TradeReviewField>
          <TradeReviewField id="trade-entryPrice" label="قیمت ورود" required error={inputErrors.entryPrice}>
            <TradePriceInput required {...fieldProps("entryPrice")} aria-label="قیمت ورود" value={draft.entryPrice} basePrice={quote?.price} priceStep={priceStep} onValueChange={(value) => update("entryPrice", value)} />
          </TradeReviewField>
          <TradeReviewField id="trade-stopLoss" label="حد ضرر SL" required error={inputErrors.stopLoss}>
            <TradePriceInput required {...fieldProps("stopLoss")} aria-label="قیمت حد ضرر" value={draft.stopLoss} basePrice={protectionBase} priceStep={priceStep} onValueChange={(value) => update("stopLoss", value)} />
          </TradeReviewField>
          <TradeReviewField id="trade-takeProfit" label="حد سود TP" required error={inputErrors.takeProfit}>
            <TradePriceInput required {...fieldProps("takeProfit")} aria-label="قیمت حد سود" value={draft.takeProfit} basePrice={protectionBase} priceStep={priceStep} onValueChange={(value) => update("takeProfit", value)} />
          </TradeReviewField>
          <div aria-hidden="true" />
          <TradeReviewField id="trade-volume" label="حجم (Lot)" required error={inputErrors.volume} info="حجم سفارش بر حسب لات است. هر لات به اندازهٔ قرارداد همان نماد در بروکر انتخاب‌شده وابسته است.">
            <Input required {...fieldProps("volume")} dir="ltr" type="number" inputMode="decimal" min="0" step="any" value={draft.volume} onChange={(event) => update("volume", event.target.value)} />
          </TradeReviewField>
          <TradeReviewField id="trade-contractSize" label="اندازه قرارداد" required error={inputErrors.contractSize} info="تعداد واحد دارایی در یک لات؛ به‌صورت خودکار از مشخصات نماد در متاتریدر بروکر انتخاب‌شده خوانده می‌شود و میان نمادها و بروکرها متفاوت است.">
            <Input required {...fieldProps("contractSize")} dir="ltr" type="number" step="any" readOnly value={draft.contractSize} placeholder="دریافت خودکار" className="h-9 min-w-0 bg-muted/40 px-2 text-xs tabular-nums" />
            {draft.symbol && <p className="text-[10px] leading-4 text-muted-foreground">{draft.contractSize ? `متاتریدر · ${brokerSpecFor(snapshot, draft.symbol)?.symbol || draft.symbol}` : "اندازه قرارداد در دیتای متاتریدر این حساب موجود نیست."}</p>}
          </TradeReviewField>
          <TradeReviewField id="trade-assetVolume" label="حجم معادل (واحد)" info="حجم لات × اندازهٔ قرارداد. این عدد مقدار دارایی معامله را نشان می‌دهد؛ ارزش پولی معامله نیست و به‌صورت خودکار محاسبه می‌شود.">
            <Input id="trade-assetVolume" dir="ltr" readOnly value={assetVolume == null ? "" : number(assetVolume, 8)} placeholder="محاسبه خودکار" className="h-9 min-w-0 bg-muted/40 px-2 text-xs tabular-nums" />
          </TradeReviewField>
        </div>
        <div className="min-w-0 space-y-1 text-[10px] leading-5 text-muted-foreground" aria-live="polite">
          {quote ? <><p dir="auto">{quote.source}</p><p>آخرین مشاهده: <span dir="ltr">{formatTehranTimestamp(new Date(quote.observedAt)) || "زمان موجود نیست"}</span></p><p>قیمت مرجع سایت ممکن است با قیمت اجرای بروکر متفاوت باشد.</p></>
            : <p>{!draft.symbol ? "پس از انتخاب نماد، آخرین قیمت موجود به‌صورت خودکار وارد می‌شود." : quoteLoading ? "در حال دریافت آخرین قیمت موجود در سایت…" : "قیمت معتبر در منابع موجود یافت نشد."}</p>}
        </div>
        <p className="text-[10px] leading-5 text-muted-foreground">ورود، SL و TP قیمت کامل نماد هستند. کلیدهای بالا و پایین از قیمت ورود یا قیمت فعلی شروع می‌کنند.</p>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>منطق ورود</Label><Textarea value={draft.rationale} onChange={(event) => update("rationale", event.target.value)} placeholder="چه شواهدی ورود را توجیه می‌کند؟" /></div>
          <div className="space-y-1.5"><Label>شرط ابطال سناریو</Label><Textarea value={draft.invalidation} onChange={(event) => update("invalidation", event.target.value)} placeholder="چه اتفاقی تحلیل را باطل می‌کند؟" /></div>
          <div className="space-y-1.5"><Label>وضعیت ذهنی (اختیاری)</Label><Input value={draft.mentalState} onChange={(event) => update("mentalState", event.target.value)} placeholder="آرام، عجول، پس از زیان…" /></div>
        </div>

        <div className="space-y-2">
          <Button type="submit" className="w-full" size="lg" disabled={!snapshot}>
            <ClipboardCheck className="ml-2 h-4 w-4" />تأیید اطلاعات و بررسی معامله
          </Button>
          <p className="text-center text-[10px] leading-5 text-muted-foreground">با تغییر هر فیلد، نتیجه قبلی پاک می‌شود و باید بررسی را دوباره اجرا کنید.</p>
        </div>
        </form>

        <Card className={surfaceClass}>
          <CardHeader><CardTitle className="flex items-center justify-between gap-3 text-base"><span>نتیجه بررسی معامله</span>{review
            ? <Badge variant="outline" className={review.status === "compatible" ? toneClass("success") : review.status === "incompatible" ? toneClass("danger") : toneClass("warning")}>{review.status === "compatible" ? "سازگار" : review.status === "incompatible" ? "ناسازگار" : "نیازمند بررسی"}</Badge>
            : <Badge variant="outline" className={toneClass("warning")}>بررسی نشده</Badge>}
          </CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {!review ? <div className={`${insetClass} border-dashed p-5 text-center text-xs leading-6 text-muted-foreground`}>
              پس از تکمیل اطلاعات، دکمه «تأیید اطلاعات و بررسی معامله» را بزنید تا محاسبات و تحلیل متنی نمایش داده شوند.
            </div> : <>
              <dl className="grid grid-cols-2 gap-2">
                <div className={`${insetClass} p-3`}><dt className="text-[10px] text-muted-foreground">ریسک معامله</dt><dd className="mt-1 font-semibold tabular-nums" dir="ltr">{review.risk.amount == null ? "—" : money(review.risk.amount, currency)}</dd><p className="text-[10px] text-muted-foreground">{review.riskPct == null ? review.risk.reason : `${number(review.riskPct, 2, 2)}٪ Equity`}</p></div>
                <div className={`${insetClass} p-3`}><dt className="text-[10px] text-muted-foreground">نسبت سود به زیان</dt><dd className="mt-1 font-semibold tabular-nums" dir="ltr">{review.rewardRisk == null ? "—" : `1 : ${number(review.rewardRisk, 2, 2)}`}</dd><p className="text-[10px] text-muted-foreground">بر اساس قیمت ورود، SL و TP</p></div>
              </dl>
              <div className="space-y-2">{review.checks.map((check) => <div key={check.key} className="flex items-start justify-between gap-3 rounded-md border p-2.5"><div><p className="text-xs font-medium">{check.label}</p><p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">{check.detail}</p></div><CheckBadge status={check.status} /></div>)}</div>

              <PremiumAnalysisGate><TradeTextAnalysis analysis={review.analysis} /></PremiumAnalysisGate>

              <p className="text-[10px] leading-5 text-muted-foreground">برآورد ریسک بر پایه Tick Value فعلی بروکر است؛ لغزش، گپ و کمیسیون ناشناخته می‌تواند نتیجه واقعی را تغییر دهد.</p>
            </>}
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-2">
          <Button className="min-w-0 px-2 text-xs sm:text-sm" onClick={() => onSavePlan(review)} disabled={!draft.symbol || !review || saved}><Save className="ml-1.5 h-3.5 w-3.5" />ذخیره برنامه</Button>
          <Button className="min-w-0 px-2 text-xs sm:text-sm" variant="outline" disabled={!review} onClick={() => {
            setReview(null)
            setInputErrors({})
            formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
            document.getElementById("trade-entryPrice")?.focus({ preventScroll: true })
          }}><ArrowRight className="ml-1.5 h-3.5 w-3.5" />بازگشت و ویرایش</Button>
        </div>
        {saved && <p className="text-center text-xs text-emerald-600 dark:text-emerald-400">برنامه در همین مرورگر ذخیره شد؛ سفارشی ارسال نشد.</p>}
        {storageError && <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">{storageError}</p>}
      </div>
    </DialogContent>
  </Dialog>
}

function tradeLine(draft) {
  return `${String(draft?.symbol || "—")} · ${draft?.direction === "BUY" ? "خرید" : draft?.direction === "SELL" ? "فروش" : "—"} · ${number(draft?.volume)} Lot · ورود ${number(draft?.entryPrice)} · SL ${positiveRule(draft?.stopLoss) == null ? "—" : number(draft.stopLoss)} · TP ${positiveRule(draft?.takeProfit) == null ? "—" : number(draft.takeProfit)}`
}

function ConformanceSummary({ assessment }) {
  const tone = assessment.status === "matched" ? "text-emerald-600 dark:text-emerald-400"
    : assessment.status === "mismatch" ? "text-rose-600 dark:text-rose-400" : "text-amber-700 dark:text-amber-300"
  return <p className={`whitespace-nowrap text-[11px] ${tone}`}><span className="font-medium">انطباق با برنامه: </span>{assessment.summary}</p>
}

function PlannedTradeRow({ plan, onConfirmTicket, onDeletePlan }) {
  const [ticketInput, setTicketInput] = useState(plan.ticketId ?? plan.positionId ?? "")
  const [ticketEdited, setTicketEdited] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const detailsId = `trade-plan-details-${plan.id}`
  const assessment = !ticketEdited && typeof plan.ticketAssessment?.summary === "string" ? plan.ticketAssessment : null

  useEffect(() => {
    setTicketInput(plan.ticketId ?? plan.positionId ?? "")
    setTicketEdited(false)
  }, [plan.ticketId, plan.positionId, plan.ticketAssessment])

  return <div className="space-y-2 p-3">
    <form className="flex items-center justify-between gap-3 whitespace-nowrap" onSubmit={(event) => {
      event.preventDefault()
      if (normalizePositionIdentifier(ticketInput)) onConfirmTicket(plan.id, ticketInput)
    }}>
      <p className="text-[11px] tabular-nums" dir="auto">{tradeLine(plan.draft)}</p>
      <div className="flex shrink-0 items-center gap-1.5">
        <Input dir="ltr" type="text" inputMode="numeric" value={ticketInput}
          onChange={(event) => { setTicketInput(event.target.value); setTicketEdited(true) }} placeholder="شماره تیکت"
          aria-label={`شماره تیکت برنامه ${plan.id}`} className="h-8 w-36 px-2 text-xs tabular-nums" />
        <Button type="submit" size="sm" className="h-8 px-3 text-xs" disabled={!normalizePositionIdentifier(ticketInput)}>تأیید</Button>
        <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-rose-600 hover:text-rose-700 dark:text-rose-400"
          title="حذف برنامه" aria-label={`حذف برنامه ${plan.draft?.symbol || plan.id}`} onClick={() => onDeletePlan(plan.id)}>
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
        <Button type="button" size="icon" variant="ghost" className="h-8 w-8" aria-expanded={detailsOpen} aria-controls={detailsId}
          title={detailsOpen ? "بستن جزئیات" : "نمایش جزئیات"} aria-label={`جزئیات برنامه ${plan.draft?.symbol || plan.id}`}
          onClick={() => setDetailsOpen((current) => !current)}>
          <Triangle className={`h-3 w-3 fill-current transition-transform ${detailsOpen ? "" : "rotate-180"}`} aria-hidden="true" />
        </Button>
      </div>
    </form>
    <div className="min-h-5" aria-live="polite">{assessment && <ConformanceSummary assessment={assessment} />}</div>
    <p className="text-[10px] text-muted-foreground">ذخیره: <span dir="ltr">{formatTehranTimestamp(new Date(plan.createdAt)) || "زمان موجود نیست"}</span>{plan.ticketConfirmedAt && <> · آخرین تأیید: <span dir="ltr">{formatTehranTimestamp(new Date(plan.ticketConfirmedAt)) || "زمان موجود نیست"}</span></>}</p>
    <div id={detailsId} hidden={!detailsOpen} className="max-w-[calc(100vw-5rem)] whitespace-normal sm:max-w-2xl">
      {detailsOpen && <PremiumAnalysisGate><TradeTextAnalysis analysis={plan.analysis} /></PremiumAnalysisGate>}
    </div>
  </div>
}

function TradeAllocationDialog({ open, onOpenChange, snapshots, onAccountChange, snapshot, plans, openRisk, onConfirmTicket, onDeletePlan, analysis, focusSection, storageError }) {
  const currency = snapshot?.account?.currency || "USD"
  const liveTrades = [
    ...openRisk.positions.map((trade) => ({ trade, kind: "position" })),
    ...openRisk.pendingOrders.map((trade) => ({ trade, kind: "order" })),
  ]
  useEffect(() => {
    if (!open || !focusSection) return undefined
    const frame = window.requestAnimationFrame(() => {
      const section = document.getElementById(focusSection === "behavior" ? "allocation-behavior" : "allocation-live-trades")
      section?.focus({ preventScroll: true })
      section?.scrollIntoView({ behavior: "smooth", block: "start" })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [open, focusSection])

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent dir="rtl" className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-4xl overflow-y-auto">
      <DialogHeader className="pl-8 text-right sm:text-right">
        <DialogTitle>تخصیص و ارزیابی</DialogTitle>
        <DialogDescription>شمارهٔ تیکت را از معاملات باز یا سفارش‌های در انتظار کپی و مقابل برنامه وارد کنید؛ سپس «تأیید» را بزنید تا تخصیص و انطباق ثبت شود. برنامه‌ها و تخصیص‌ها در همین مرورگر برای حساب انتخاب‌شده ذخیره می‌شوند.</DialogDescription>
      </DialogHeader>
      <div className="min-w-0 space-y-1.5">
        <Label htmlFor="allocation-broker">بروکر و حساب</Label>
        <RiskAccountSelect id="allocation-broker" snapshots={snapshots} snapshot={snapshot} onAccountChange={onAccountChange} />
      </div>
      <section className="min-w-0 space-y-2" aria-labelledby="planned-trades-title">
        <div className="flex items-center justify-between gap-2"><h3 id="planned-trades-title" className="text-sm font-semibold">معاملات برنامه‌ریزی‌شده</h3><Badge variant="secondary">{plans.length} برنامه</Badge></div>
        <ScrollArea dir="rtl" className="h-60 w-full min-w-0 rounded-lg border">
          {!plans.length ? <p className="p-6 text-center text-xs leading-6 text-muted-foreground">هنوز برنامه‌ای برای این حساب ذخیره نشده است. در «بررسی معامله جدید» برنامه را بررسی و ذخیره کنید.</p>
            : <div className="min-w-max divide-y">{plans.map((plan) => <PlannedTradeRow key={`${accountKey(snapshot)}:${plan.id}`} plan={plan} onConfirmTicket={onConfirmTicket} onDeletePlan={onDeletePlan} />)}</div>}
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
        <p className="text-[10px] leading-5 text-muted-foreground">مقایسهٔ نماد، جهت، لات، قیمت ورود یا قیمت سفارش، SL و TP؛ تلورانس قیمت یک Tick بروکر است. معیار فاقد داده در درصد انطباق محاسبه نمی‌شود. تیکت معامله، شناسهٔ پوزیشن و تیکت سفارش در انتظار، شمارهٔ سفارش است.</p>
      </section>
      <section id="allocation-live-trades" tabIndex={-1} className="min-w-0 space-y-2 scroll-mt-4 focus:outline-none" aria-labelledby="allocation-open-trades-title">
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 id="allocation-open-trades-title" className="text-sm font-semibold">معاملات باز و سفارش های در انتظار</h3><Badge variant="secondary">{openRisk.positions.length} معامله · {openRisk.pendingOrders.length} سفارش</Badge></div>
        <ScrollArea dir="rtl" className="h-52 w-full min-w-0 rounded-lg border">
          {!liveTrades.length ? <p className="p-6 text-center text-xs text-muted-foreground">در آخرین دادهٔ حساب، معاملهٔ باز یا سفارش در انتظاری گزارش نشده است.</p>
            : <div className="min-w-max divide-y">{liveTrades.map(({ trade, kind }, index) => {
              const pending = kind === "order"
              const ticket = pending ? orderIdentifier(trade) : positionIdentifier(trade)
              const spec = brokerSpecFor(snapshot, trade.symbol)
              const currentPrice = pending ? positiveRule(trade.current_price) ?? positiveRule(trade.direction === "BUY" ? spec?.ask : spec?.bid) : trade.current_valuation_price
              return <div key={`${kind}:${ticket || index}`} className="space-y-2 p-3">
                <div className="flex items-center gap-4 whitespace-nowrap text-[11px] tabular-nums">
                  <span className="select-all font-semibold" dir="ltr" aria-label="شماره تیکت">{ticket || "—"}</span>
                  <Badge variant="outline" className="text-[10px]">{pending ? "سفارش در انتظار" : "معامله باز"}</Badge>
                  <span dir="auto">{tradeLine({ symbol: trade.symbol, direction: trade.direction, volume: trade.volume, entryPrice: pending ? trade.requested_price : trade.open_price, stopLoss: trade.stop_loss, takeProfit: trade.take_profit })}</span>
                  <span>فعلی: {number(currentPrice)}</span>
                  {!pending && <span>سود/زیان: {money(trade.current_profit_loss, currency)}</span>}
                  <span>ریسک تا SL: {money(trade.risk.amount, currency)}</span>
                </div>
                <ConformanceSummary assessment={assessAllocatedTrade(plans, snapshot, trade, kind)} />
              </div>
            })}</div>}
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </section>
      <section id="allocation-behavior" tabIndex={-1} className="min-w-0 space-y-2 scroll-mt-4 focus:outline-none" aria-labelledby="allocation-behavior-title">
        <h3 id="allocation-behavior-title" className="flex items-center gap-2 text-sm font-semibold"><BrainCircuit className="h-4 w-4 text-primary" />تحلیل رفتار (معاملات بسته شده)</h3>
        <div className="rounded-lg border bg-muted/20 p-4">
          <PremiumAnalysisGate><ul className="list-disc space-y-3 pr-4 text-xs leading-6" aria-label="خلاصه تحلیل رفتار معاملاتی">
            {analysis.lines.map((line) => <li key={line.key} className={line.tone === "danger" ? "text-rose-700 dark:text-rose-300" : line.tone === "warning" ? "text-amber-700 dark:text-amber-300" : line.tone === "success" ? "text-emerald-700 dark:text-emerald-300" : "text-foreground"}>{line.text}</li>)}
          </ul></PremiumAnalysisGate>
        </div>
      </section>
      {storageError && <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">{storageError}</p>}
      <Button variant="outline" onClick={() => onOpenChange(false)}>بستن</Button>
    </DialogContent>
  </Dialog>
}

function DailyPlanDialog({ open, onOpenChange, snapshots, onAccountChange, snapshot, rules, setRules, rulesSaved, onSaveRules, history, maxTrades }) {
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent dir="rtl" className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-xl overflow-y-auto">
      <DialogHeader className="pl-8 text-right sm:text-right">
        <DialogTitle>برنامه</DialogTitle>
        <DialogDescription>حدهای شخصی روی همین مرورگر و برای حساب انتخاب‌شده ذخیره می‌شوند.</DialogDescription>
      </DialogHeader>
      <div className="min-w-0 space-y-1.5">
        <Label htmlFor="daily-plan-broker">بروکر و حساب</Label>
        <RiskAccountSelect id="daily-plan-broker" snapshots={snapshots} snapshot={snapshot} onAccountChange={onAccountChange} />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <RuleField label="حداکثر ریسک هر معامله" suffix="٪" value={rules.maxTradeRiskPct} onChange={(value) => setRules((current) => ({ ...current, maxTradeRiskPct: value }))} />
        <RuleField label="حداکثر ریسک باز" suffix="٪" value={rules.maxOpenRiskPct} onChange={(value) => setRules((current) => ({ ...current, maxOpenRiskPct: value }))} />
        <RuleField label="سقف زیان روزانه" suffix="٪" value={rules.dailyLossLimitPct} onChange={(value) => setRules((current) => ({ ...current, dailyLossLimitPct: value }))} />
        <RuleField label="حداکثر اهرم کل" suffix="×" value={rules.maxGrossLeverage} onChange={(value) => setRules((current) => ({ ...current, maxGrossLeverage: value }))} />
        <RuleField label="حداکثر ورود روزانه" suffix="عدد" value={rules.maxTradesPerDay} onChange={(value) => setRules((current) => ({ ...current, maxTradesPerDay: value }))} />
        <RuleField label="حداقل Margin Level" suffix="٪" value={rules.minMarginLevelPct} onChange={(value) => setRules((current) => ({ ...current, minMarginLevelPct: value }))} />
      </div>
      <div className={`rounded-lg border p-3 text-xs ${maxTrades != null && history.todayEntryCount >= maxTrades ? toneClass("warning") : "border-border text-muted-foreground"}`}>ورودهای امروز: <span className="font-semibold tabular-nums">{history.todayEntryCount}</span>{maxTrades == null ? "؛ سقف روزانه تعیین نشده" : ` از سقف ${maxTrades}`}</div>
      <Button onClick={onSaveRules}><Save className="ml-2 h-4 w-4" />{rulesSaved ? "ذخیره شد" : "ذخیره قواعد"}</Button>
    </DialogContent>
  </Dialog>
}

function ScenarioDialog({ open, onOpenChange, scenarioSymbols, selectedScenarioSymbol, onSymbolChange, shockPct, onShockChange, scenario, allAccounts }) {
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent dir="rtl" className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-xl overflow-y-auto">
      <DialogHeader className="pl-8 text-right sm:text-right">
        <DialogTitle>سناریو</DialogTitle>
        <DialogDescription>{allAccounts ? "اثر تغییر قیمت نماد بر اکوییتی کل همه بروکرها؛ خرید و فروش نماد در تمام حساب‌ها خالص می‌شود و اندازه قرارداد هر بروکر در اکسپوژر لحاظ شده است." : "اثر خطی یک شوک قیمتی روی Exposure خالص نماد انتخاب‌شده را بررسی کنید."}</DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="grid grid-cols-[minmax(0,1fr)_130px] gap-3">
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="scenario-symbol">نماد</Label>
            <Select dir="rtl" value={selectedScenarioSymbol || undefined} onValueChange={onSymbolChange}><SelectTrigger id="scenario-symbol"><SelectValue placeholder="نماد سناریو" /></SelectTrigger><SelectContent>{scenarioSymbols.map(({ symbol, label }) => <SelectItem key={symbol} value={symbol}>{label}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="scenario-shock">تغییر قیمت (درصد)</Label>
            <div className="relative" dir="ltr">
              <Input id="scenario-shock" aria-describedby="scenario-shock-help" className="pr-7" type="number" min="-20" max="20" step="1" value={shockPct} onChange={(event) => onShockChange(Number(event.target.value))} />
              <span aria-hidden="true" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
            </div>
          </div>
        </div>
        <Slider aria-label="درصد تغییر قیمت نماد" dir="ltr" min={-20} max={20} step={1} value={[shockPct]} onValueChange={([value]) => onShockChange(value)} />
        <p id="scenario-shock-help" className="text-[10px] leading-5 text-muted-foreground">عدد منفی یعنی افت قیمت و عدد مثبت یعنی رشد قیمت؛ بازه از <bdi>-20%</bdi> تا <bdi>+20%</bdi> است. نتیجه بر اساس اکسپوژر ثبت‌شده در آخرین داده محاسبه می‌شود.</p>
      </div>
      <dl className="grid grid-cols-2 gap-2">
        <div className={`${insetClass} p-4`}><dt className="text-[10px] text-muted-foreground">{allAccounts ? "اثر تقریبی بر اکوییتی کل" : "اثر تقریبی بر Equity"}</dt><dd className={`mt-2 text-base font-semibold tabular-nums ${scenario.pnl < 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`} dir="ltr">{scenario.available ? money(scenario.pnl, "USD") : "—"}</dd>{scenario.available && scenario.impactPct != null && <dd className="mt-1 text-xs text-muted-foreground"><bdi>{number(scenario.impactPct, 2, 2)}٪</bdi> از {allAccounts ? "اکوییتی کل" : "اکوییتی حساب"}</dd>}</div>
        <div className={`${insetClass} p-4`}><dt className="text-[10px] text-muted-foreground">{allAccounts ? "اکوییتی کل برآوردی" : "Equity برآوردی"}</dt><dd className="mt-2 text-base font-semibold tabular-nums" dir="ltr">{scenario.available ? money(scenario.equityAfter, "USD") : "—"}</dd>{scenario.available && <dd className="mt-1 text-xs text-muted-foreground">اکوییتی فعلی: <bdi>{money(scenario.equityBefore, "USD")}</bdi></dd>}</div>
      </dl>
      <div className={`${insetClass} p-4 text-xs leading-6 text-muted-foreground`}>{scenario.available ? "این برآورد تغییر خطی P/L را فرض می‌کند. تغییر Margin Level، گپ، لغزش، هم‌بستگی و واکنش سایر نمادها در آن محاسبه نشده است." : scenario.reason}</div>
    </DialogContent>
  </Dialog>
}

export default function RiskManagementCenter() {
  const { accessToken, isLoading: authLoading } = useAuth()
  const [snapshots, setSnapshots] = useState([])
  const [serverLeverage, setServerLeverage] = useState(null)
  const [serverSymbols, setServerSymbols] = useState([])
  const [selectedAccount, setSelectedAccount] = useState(ALL_ACCOUNTS)
  const [selectedToolAccount, setSelectedToolAccount] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [reviewOpen, setReviewOpen] = useState(false)
  const [allocationOpen, setAllocationOpen] = useState(false)
  const [allocationFocus, setAllocationFocus] = useState("")
  const [planCollection, setPlanCollection] = useState({ accountKey: "", plans: [] })
  const [planStorageError, setPlanStorageError] = useState("")
  const [rules, setRules] = useState(EMPTY_RISK_RULES)
  const [accountRules, setAccountRules] = useState({})
  const [draft, setDraft] = useState(EMPTY_TRADE_DRAFT)
  const [savedPlan, setSavedPlan] = useState(false)
  const [rulesSaved, setRulesSaved] = useState(false)
  const [scenarioSymbol, setScenarioSymbol] = useState("")
  const [shockPct, setShockPct] = useState(-5)
  const [demoAvailable, setDemoAvailable] = useState(false)
  const [dailyPlanOpen, setDailyPlanOpen] = useState(false)
  const [scenarioOpen, setScenarioOpen] = useState(false)
  const requestController = useRef(null)

  useEffect(() => {
    setDemoAvailable(["localhost", "127.0.0.1", "::1"].includes(window.location.hostname))
  }, [])

  useEffect(() => {
    const focusSection = (event) => {
      if (event.detail === "rules") {
        setDailyPlanOpen(true)
        return
      }
      if (event.detail === "scenario") {
        setScenarioOpen(true)
        return
      }
      if (["analysis-behavior", "warnings"].includes(event.detail)) {
        setAllocationFocus("behavior")
        setAllocationOpen(true)
        return
      }
      if (event.detail === "positions") {
        setAllocationFocus("trades")
        setAllocationOpen(true)
        return
      }
      const targetId = {
        "overview-structure": "risk-overview",
      }[event.detail]
      if (targetId) document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" })
    }
    window.addEventListener("greenpeak:risk-focus", focusSection)
    return () => window.removeEventListener("greenpeak:risk-focus", focusSection)
  }, [])

  const load = useCallback(async () => {
    if (authLoading) return
    requestController.current?.abort()
    if (!accessToken) {
      setSnapshots([])
      setServerLeverage(null)
      setServerSymbols([])
      setSelectedAccount(ALL_ACCOUNTS)
      setSelectedToolAccount("")
      setError("برای مشاهده مدیریت ریسک ابتدا وارد حساب کاربری شوید")
      setLoading(false)
      return
    }
    const controller = new AbortController()
    requestController.current = controller
    setLoading(true)
    try {
      const response = await fetch("/dashboard-data/mt5/risk-overview", {
        cache: "no-store",
        signal: controller.signal,
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(responseError(body, response.status))
      if (!Array.isArray(body?.accounts) || !body?.leverage) throw new Error("پاسخ محاسبات ریسک معتبر نیست")
      if (controller.signal.aborted) return
      setSnapshots(body.accounts)
      setServerLeverage(body.leverage)
      setServerSymbols(Array.isArray(body.symbol_risks) ? body.symbol_risks : [])
      setSelectedAccount((current) => current === ALL_ACCOUNTS || (current && body.accounts.some((item) => accountKey(item) === current)) ? current : ALL_ACCOUNTS)
      setError("")
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "دریافت اطلاعات ریسک ممکن نشد")
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [accessToken, authLoading])

  useEffect(() => {
    load()
    const timer = window.setInterval(load, 60000)
    return () => { window.clearInterval(timer); requestController.current?.abort() }
  }, [load])

  const allAccounts = selectedAccount === ALL_ACCOUNTS
  const snapshot = useMemo(() => snapshots.find((item) => accountKey(item) === (allAccounts ? selectedToolAccount : selectedAccount)) || snapshots[0] || null, [snapshots, selectedAccount, selectedToolAccount, allAccounts])
  const onToolAccountChange = allAccounts ? setSelectedToolAccount : setSelectedAccount
  const storageKey = snapshot ? accountKey(snapshot) : ""
  const tradePlans = planCollection.accountKey === storageKey ? planCollection.plans : []

  useEffect(() => {
    const readRules = () => {
      const saved = {}
      for (const item of snapshots) {
        const key = accountKey(item)
        try { saved[key] = JSON.parse(window.localStorage.getItem(`greenpeak:risk-rules:${key}`) || "null") || {} }
        catch { saved[key] = {} }
      }
      setAccountRules(saved)
    }
    readRules()
    window.addEventListener("storage", readRules)
    window.addEventListener("greenpeak:risk-rules-updated", readRules)
    return () => {
      window.removeEventListener("storage", readRules)
      window.removeEventListener("greenpeak:risk-rules-updated", readRules)
    }
  }, [snapshots])

  const aggregate = useMemo(() => allAccounts ? aggregateRiskOverview(snapshots.map((item) => ({
    snapshot: item, rules: accountRules[accountKey(item)] || {},
  })), new Date(), serverLeverage) : null, [allAccounts, snapshots, accountRules, serverLeverage])

  useEffect(() => {
    const handleDelete = (event) => {
      const broker = event.detail.broker_company
      setServerLeverage(null)
      setServerSymbols([])
      setSnapshots((current) => withoutBroker(current, broker))
      if (snapshot?.source?.broker_company === broker) {
        if (!allAccounts) setSelectedAccount(ALL_ACCOUNTS)
        setSelectedToolAccount("")
        setReviewOpen(false)
        setAllocationOpen(false)
        setDailyPlanOpen(false)
        setScenarioOpen(false)
        setScenarioSymbol("")
        setShockPct(-5)
      }
      load()
    }
    window.addEventListener(MT5_BROKER_DELETED_EVENT, handleDelete)
    return () => window.removeEventListener(MT5_BROKER_DELETED_EVENT, handleDelete)
  }, [load, snapshot, allAccounts])

  useEffect(() => {
    try {
      const storedRules = storageKey ? JSON.parse(window.localStorage.getItem(`greenpeak:risk-rules:${storageKey}`) || "null") : null
      const storedDraft = storageKey ? JSON.parse(window.localStorage.getItem(`greenpeak:trade-draft:${storageKey}`) || "null") : null
      setRules(storedRules ? { ...EMPTY_RISK_RULES, ...storedRules } : EMPTY_RISK_RULES)
      setDraft(storedDraft ? { ...EMPTY_TRADE_DRAFT, ...storedDraft } : EMPTY_TRADE_DRAFT)
    } catch {
      setRules(EMPTY_RISK_RULES)
      setDraft(EMPTY_TRADE_DRAFT)
    }
    setSavedPlan(false)
    setRulesSaved(false)
  }, [storageKey])

  useEffect(() => {
    setPlanStorageError("")
    try {
      setPlanCollection({ accountKey: storageKey, plans: storageKey ? parseTradePlans(window.localStorage.getItem(`greenpeak:risk-plans:${storageKey}`)) : [] })
    } catch { setPlanCollection({ accountKey: storageKey, plans: [] }) }
    const syncPlans = (event) => {
      if (storageKey && event.key === `greenpeak:risk-plans:${storageKey}`) setPlanCollection({ accountKey: storageKey, plans: parseTradePlans(event.newValue) })
    }
    window.addEventListener("storage", syncPlans)
    return () => window.removeEventListener("storage", syncPlans)
  }, [storageKey])

  const openRisk = useMemo(() => analyzeOpenRisk(snapshot), [snapshot])
  const currentDraft = useMemo(() => ({ ...draft, contractSize: brokerContractSize(snapshot, draft.symbol)?.toString() || "" }), [draft, snapshot])
  const history = useMemo(() => analyzeTradeHistory(snapshot), [snapshot])
  const lifecycles = useMemo(() => buildTradeLifecycles(snapshot ? [snapshot] : []), [snapshot])
  const behaviorAnalysis = useMemo(() => buildBehaviorAnalysis({ snapshot, rules, plans: tradePlans, lifecycles }), [snapshot, rules, tradePlans, lifecycles, allocationOpen, loading])
  const currency = allAccounts ? aggregate.currency || "USD" : snapshot?.account?.currency || "USD"
  const equity = allAccounts ? aggregate.equity : finiteNumber(snapshot?.account?.equity)
  const balance = allAccounts ? aggregate.balance : finiteNumber(snapshot?.account?.balance)
  const usedMargin = allAccounts ? aggregate.usedMargin : finiteNumber(snapshot?.account?.used_margin)
  const leverage = allAccounts ? serverLeverage : snapshot?.leverage
  const grossLeverage = finiteNumber(leverage?.value)
  const marginLevel = allAccounts ? aggregate.marginLevel : finiteNumber(snapshot?.account?.margin_level_pct)
  const maxOpenRiskPct = positiveRule(rules.maxOpenRiskPct)
  const maxLeverage = positiveRule(rules.maxGrossLeverage)
  const minMargin = positiveRule(rules.minMarginLevelPct)
  const maxTrades = positiveRule(rules.maxTradesPerDay)
  const scenarioSymbols = allAccounts ? aggregateScenarioSymbolOptions(serverSymbols) : scenarioSymbolOptions(snapshot)
  const selectedScenarioSymbol = scenarioSymbols.some(({ symbol }) => symbol === scenarioSymbol) ? scenarioSymbol : scenarioSymbols[0]?.symbol || ""
  const scenario = allAccounts ? aggregateScenarioEstimate(serverLeverage, serverSymbols, selectedScenarioSymbol, shockPct) : scenarioEstimate(snapshot, selectedScenarioSymbol, shockPct)
  const overviewOpenRisk = allAccounts ? aggregate.openRisk : openRisk
  const symbolRisks = allAccounts ? serverSymbols : snapshot?.symbol_risks || []
  const overviewColumns = [
    { key: "balance", label: "بالانس", value: balance == null ? "داده کافی نیست" : money(balance, currency) },
    { key: "equity", label: "اکوییتی", value: equity == null ? "داده کافی نیست" : money(equity, currency) },
    { key: "exposure", label: "اکسپوژر کل", value: leverage?.gross_exposure_usd == null ? "داده کافی نیست" : money(leverage.gross_exposure_usd, "USD") },
    {
      key: "leverage", label: "اهرم کل", value: formatLeverage(grossLeverage),
      tone: grossLeverage == null ? "warning" : !allAccounts && maxLeverage != null && grossLeverage > maxLeverage ? "danger" : "neutral",
    },
    {
      key: "margin", label: "مارجین", value: usedMargin == null ? "داده کافی نیست" : money(usedMargin, currency),
      detail: marginLevel == null ? "سطح مارجین نامشخص" : `سطح: ${number(marginLevel, 1)}٪`,
      tone: !allAccounts && minMargin != null && marginLevel != null && marginLevel < minMargin ? "danger" : "neutral",
    },
    {
      key: "open-risk", label: "ریسک پوزیشن‌های باز",
      value: overviewOpenRisk.total == null ? "محاسبه ناقص" : money(overviewOpenRisk.total, currency),
      detail: overviewOpenRisk.riskPct == null ? "نسبت ریسک نامشخص" : `${number(overviewOpenRisk.riskPct, 2, 2)}٪ از اکوییتی`,
      tone: !overviewOpenRisk.complete ? "warning" : !allAccounts && maxOpenRiskPct != null && overviewOpenRisk.riskPct > maxOpenRiskPct ? "danger" : "neutral",
    },
    {
      key: "stop-coverage", label: "داشتن حد ضرر",
      value: overviewOpenRisk.positions.length ? `${overviewOpenRisk.positions.length - overviewOpenRisk.missingStopCount} از ${overviewOpenRisk.positions.length}` : "بدون پوزیشن",
      detail: overviewOpenRisk.pendingMissingStopCount ? `${overviewOpenRisk.pendingMissingStopCount} سفارش بدون حد ضرر` : "",
      tone: overviewOpenRisk.missingStopCount ? "danger" : "neutral",
    },
  ]
  const saveRules = () => {
    if (!storageKey) return
    window.localStorage.setItem(`greenpeak:risk-rules:${storageKey}`, JSON.stringify(rules))
    window.dispatchEvent(new CustomEvent("greenpeak:risk-rules-updated"))
    setRulesSaved(true)
    window.setTimeout(() => setRulesSaved(false), 2500)
  }

  const useDemoSnapshot = () => {
    const demoSnapshot = createRiskDemoSnapshot()
    setServerLeverage(null)
    setServerSymbols([])
    setSnapshots([demoSnapshot])
    setSelectedAccount(accountKey(demoSnapshot))
    setError("")
    setLoading(false)
  }

  const storeTradePlans = (plans) => {
    if (!storageKey) return false
    setPlanCollection({ accountKey: storageKey, plans })
    try {
      window.localStorage.setItem(`greenpeak:risk-plans:${storageKey}`, JSON.stringify(plans))
      setPlanStorageError("")
      return true
    } catch {
      setPlanStorageError("ذخیره در مرورگر انجام نشد؛ فضای ذخیره‌سازی یا دسترسی مرورگر را بررسی کنید.")
      return false
    }
  }

  const savePlan = (review) => {
    if (!storageKey || !review?.analysis || Object.keys(tradeInputErrors(currentDraft)).length) return
    const planId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const plan = createTradePlan({ id: planId, createdAt: new Date().toISOString(), draft: currentDraft, review })
    setSavedPlan(storeTradePlans([plan, ...tradePlans]))
  }

  const confirmTicket = (planId, ticketInput) => {
    const plan = tradePlans.find((item) => item.id === planId)
    if (!plan) return
    const confirmed = confirmTradePlanTicket(plan, ticketInput, snapshot, new Date().toISOString())
    if (confirmed) storeTradePlans(tradePlans.map((item) => item.id === planId ? confirmed : item))
  }

  const deletePlan = (planId) => storeTradePlans(tradePlans.filter((plan) => plan.id !== planId))

  const updateDraft = (updater) => {
    setDraft((current) => {
      const next = typeof updater === "function" ? updater(current) : updater
      const brokerDraft = { ...next, contractSize: brokerContractSize(snapshot, next.symbol)?.toString() || "" }
      if (storageKey) window.localStorage.setItem(`greenpeak:trade-draft:${storageKey}`, JSON.stringify(brokerDraft))
      return brokerDraft
    })
    setSavedPlan(false)
  }

  return <>
    <Card className="relative overflow-hidden border-cyan-500/20 bg-white shadow-sm ring-1 ring-black/[0.02] dark:border-cyan-400/15 dark:bg-[#1F1F23] dark:ring-white/[0.025]" aria-labelledby="risk-management-title" dir="rtl">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-cyan-500/70 to-transparent" />
      <CardHeader className="border-b p-4 md:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <CardTitle id="risk-management-title" className="text-lg">مدیریت ریسک</CardTitle>
            </div>
          </div>
          <div className="grid gap-2 lg:justify-items-end">
            <div className={`grid w-full items-center gap-2 lg:w-auto ${snapshots.length > 0 ? "grid-cols-[auto_minmax(0,1fr)_auto]" : "grid-cols-[auto_auto]"}`}>
              <Button variant="outline" size="sm" className="h-9 w-auto" onClick={() => setScenarioOpen(true)} disabled={!snapshot}><Gauge className="ml-2 h-4 w-4" />سناریو</Button>
              {snapshots.length > 0 && <Select value={selectedAccount || accountKey(snapshots[0])} onValueChange={setSelectedAccount}>
                <SelectTrigger aria-label="انتخاب حساب یا همه بروکرها" className="h-9 w-56 min-w-0 max-w-full [&>span]:min-w-0 [&>span]:truncate"><SelectValue><span className="block truncate">{allAccounts ? `همه بروکرها (${snapshots.length} حساب)` : accountName(snapshot || snapshots[0])}</span></SelectValue></SelectTrigger>
                <SelectContent dir="rtl" className="w-[min(90vw,32rem)] max-w-[calc(100vw-2rem)]">
                  <SelectItem value={ALL_ACCOUNTS}>همه بروکرها ({snapshots.length} حساب)</SelectItem>
                  {snapshots.map((item) => <SelectItem key={accountKey(item)} value={accountKey(item)}><span className="whitespace-normal break-words">{accountName(item)}</span></SelectItem>)}
                </SelectContent>
              </Select>}
              <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={load} disabled={loading} aria-label="به‌روزرسانی داده" title="به‌روزرسانی داده"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></Button>
            </div>
            <div className="flex flex-wrap items-stretch gap-2 lg:justify-end">
              <Button variant="outline" size="sm" className="h-9 w-auto" onClick={() => setDailyPlanOpen(true)} disabled={!snapshot}><ListChecks className="ml-2 h-4 w-4" />برنامه</Button>
              <Button size="sm" className="h-9 w-auto" onClick={() => setReviewOpen(true)} disabled={!snapshot}><ClipboardCheck className="ml-2 h-4 w-4" />بررسی معامله جدید</Button>
              <Button variant="outline" size="sm" className="h-9 w-auto" onClick={() => { setAllocationFocus(""); setAllocationOpen(true) }} disabled={!snapshot}><Link2 className="ml-2 h-4 w-4" />تخصیص و ارزیابی</Button>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {!snapshot ? <div className="p-4 md:p-6"><EmptyState loading={loading} error={error} onRefresh={load} demoAvailable={demoAvailable} onUseDemo={useDemoSnapshot} /></div> : <>
          {(snapshot.preview_mode || error) && <div className="space-y-2 border-b p-4 md:px-6">
            {snapshot.preview_mode && <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-3 text-xs leading-5 text-cyan-800 dark:text-cyan-200">حالت پیش‌نمایش محلی فعال است. همه اعداد این بخش نمونه‌اند، به متاتریدر تعلق ندارند و در سرور ذخیره نمی‌شوند.</div>}
            {error && <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">به‌روزرسانی داده انجام نشد؛ آخرین داده سالم نمایش داده می‌شود. {error}</div>}
          </div>}

          <div id="risk-analysis" className="scroll-mt-16 space-y-7 p-4 md:p-6">
              <section id="risk-overview" className="scroll-mt-16 space-y-3" aria-label="نمای کلی ریسک">
                {allAccounts && aggregate.notices.map((notice) => <p key={notice} role="status" className={`rounded-lg border p-3 text-xs leading-6 ${toneClass("warning")}`}>{notice}</p>)}
                <RiskOverviewTable columns={overviewColumns} symbols={symbolRisks} allAccounts={allAccounts} />
                {allAccounts && aggregate.accountWarnings.length > 0 && <div className="space-y-2 border-t pt-3" aria-label="هشدار مستقل حساب‌ها">
                  <p className="text-xs font-semibold">هشدار حساب‌ها؛ موجودی سایر حساب‌ها مارجین این حساب را پوشش نمی‌دهد</p>
                  {aggregate.accountWarnings.map(({ snapshot: account, warnings }) => <div key={accountKey(account)} className={`rounded-lg border p-3 ${toneClass("warning")}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold">{accountName(account)}</p>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setSelectedAccount(accountKey(account))}>بررسی حساب</Button>
                    </div>
                    <ul className="mt-2 list-disc space-y-1 pr-4 text-xs leading-6">{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
                  </div>)}
                  <p className="text-xs leading-6 text-muted-foreground">پایش مارجین بر اساس حداقل شخصی یا ۱۰۰٪، هرکدام بزرگ‌تر باشد، انجام می‌شود؛ آستانه واقعی کال مارجین و استاپ‌اوت را بروکر تعیین می‌کند.</p>
                </div>}
              </section>

          </div>
        </>}
      </CardContent>
    </Card>

    {snapshot && <>
      <DailyPlanDialog open={dailyPlanOpen} onOpenChange={setDailyPlanOpen} snapshots={snapshots} onAccountChange={onToolAccountChange} snapshot={snapshot} rules={rules} setRules={setRules} rulesSaved={rulesSaved} onSaveRules={saveRules} history={history} maxTrades={maxTrades} />
      <ScenarioDialog open={scenarioOpen} onOpenChange={setScenarioOpen} scenarioSymbols={scenarioSymbols} selectedScenarioSymbol={selectedScenarioSymbol} onSymbolChange={setScenarioSymbol} shockPct={shockPct} onShockChange={setShockPct} scenario={scenario} allAccounts={allAccounts} />
      <TradeReviewPanel key={storageKey} open={reviewOpen} onOpenChange={setReviewOpen} snapshots={snapshots} onAccountChange={onToolAccountChange} snapshot={snapshot} rules={rules} openRisk={openRisk} draft={currentDraft} setDraft={updateDraft} onSavePlan={savePlan} saved={savedPlan} storageError={planStorageError} />
      <TradeAllocationDialog open={allocationOpen} onOpenChange={setAllocationOpen} snapshots={snapshots} onAccountChange={onToolAccountChange} snapshot={snapshot} plans={tradePlans} openRisk={openRisk} onConfirmTicket={confirmTicket} onDeletePlan={deletePlan} analysis={behaviorAnalysis} focusSection={allocationFocus} storageError={planStorageError} />
    </>}
  </>
}
