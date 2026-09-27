"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  ClipboardCheck,
  Gauge,
  Landmark,
  ListChecks,
  Loader2,
  PieChart,
  RefreshCw,
  Save,
  ShieldAlert,
  ShieldCheck,
  Target,
  Wifi,
  WifiOff,
  XCircle,
} from "lucide-react"
import { useAuth } from "@/components/auth/auth-context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Slider } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"
import { accountKey, money, number } from "@/components/kokonutui/mt5-data-view"
import {
  analyzeOpenRisk,
  analyzeTradeHistory,
  availableSymbols,
  brokerSpecFor,
  concentrationSummary,
  EMPTY_RISK_RULES,
  EMPTY_TRADE_DRAFT,
  finiteNumber,
  freshnessSummary,
  positiveRule,
  previewTrade,
  scenarioEstimate,
} from "@/lib/risk-management"

const surfaceClass = "border-gray-200 bg-white shadow-sm dark:border-[#2B2B30] dark:bg-[#1F1F23]"
const insetClass = "rounded-lg border border-gray-200 bg-gray-50 dark:border-[#2B2B30] dark:bg-[#0F0F12]"

function responseError(body, status) {
  if (typeof body?.detail === "string") return body.detail
  return status === 503 ? "سرویس حساب‌های معاملاتی در دسترس نیست" : `دریافت اطلاعات ریسک ممکن نشد (${status})`
}

function accountName(snapshot) {
  const source = snapshot?.source || {}
  return [source.broker_company, source.trade_server, source.account_identifier].filter(Boolean).join(" · ") || "حساب معاملاتی"
}

function toneClass(tone) {
  if (tone === "danger") return "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
  if (tone === "warning") return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
  if (tone === "success") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
  return "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300"
}

function MetricCard({ icon: Icon, label, value, detail, note, tone = "neutral" }) {
  return <Card className={`${surfaceClass} min-h-[10.5rem]`}>
    <CardContent className="flex h-full flex-col p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <span className={`rounded-lg border p-2 ${toneClass(tone)}`}><Icon className="h-4 w-4" /></span>
      </div>
      <p className="mt-4 text-lg font-semibold tabular-nums text-gray-900 dark:text-white" dir="ltr">{value}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
      {note && <p className="mt-auto pt-2 text-[10px] leading-4 text-muted-foreground">{note}</p>}
    </CardContent>
  </Card>
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

function EmptyState({ loading, error, onRefresh }) {
  return <Card className={surfaceClass}>
    <CardContent className="flex flex-col items-center justify-center gap-3 py-10 text-center">
      {loading ? <Loader2 className="h-7 w-7 animate-spin text-primary" /> : <WifiOff className="h-7 w-7 text-amber-500" />}
      <div>
        <p className="text-sm font-medium text-foreground">{loading ? "در حال دریافت Snapshot حساب…" : "Snapshot حساب معاملاتی موجود نیست"}</p>
        <p className="mt-1 max-w-xl text-xs leading-5 text-muted-foreground">{error || "پس از اتصال افزونه MT5 و ارسال Snapshot، محاسبات این بخش با داده واقعی حساب فعال می‌شوند."}</p>
      </div>
      {!loading && <div className="flex gap-2">
        <Button asChild size="sm" variant="outline"><Link href="/settings">تنظیمات اتصال</Link></Button>
        <Button size="sm" variant="outline" onClick={onRefresh}><RefreshCw className="ml-2 h-4 w-4" />تلاش دوباره</Button>
      </div>}
    </CardContent>
  </Card>
}

function PositionRiskTable({ analysis, snapshot, maxTradeRiskPct }) {
  const currency = snapshot?.account?.currency || "USD"
  const equity = finiteNumber(snapshot?.account?.equity)
  if (!analysis.positions.length) {
    return <div className={`${insetClass} border-dashed p-5 text-center text-sm text-muted-foreground`}>در Snapshot فعلی پوزیشن بازی گزارش نشده است.</div>
  }

  return <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-[#2B2B30]">
    <div className="min-w-[850px]">
      <div className="grid grid-cols-[1fr_.7fr_.65fr_1fr_1fr_1.1fr_1fr_.5fr] gap-3 border-b bg-muted/30 px-3 py-2 text-[10px] font-medium text-muted-foreground">
        <span>نماد</span><span>جهت</span><span>حجم</span><span>سود/زیان شناور</span><span>حد ضرر</span><span>ریسک تا حد ضرر</span><span>انطباق با برنامه</span><span>جزئیات</span>
      </div>
      {analysis.positions.map((position) => {
        const riskPct = position.risk.amount != null && equity != null && equity > 0 ? position.risk.amount / equity * 100 : null
        const compliant = maxTradeRiskPct == null || riskPct == null ? "unknown" : riskPct <= maxTradeRiskPct ? "pass" : "fail"
        return <div key={position.position_identifier || `${position.symbol}-${position.open_time_utc}`} className="grid grid-cols-[1fr_.7fr_.65fr_1fr_1fr_1.1fr_1fr_.5fr] items-center gap-3 border-b px-3 py-3 text-xs last:border-b-0">
          <div><p className="font-semibold text-foreground">{position.symbol || "—"}</p><p className="mt-0.5 text-[10px] text-muted-foreground">#{position.position_identifier || "—"}</p></div>
          <Badge variant="outline" className={position.direction === "BUY" ? toneClass("success") : toneClass("danger")}>{position.direction === "BUY" ? "خرید" : "فروش"}</Badge>
          <span className="tabular-nums" dir="ltr">{number(position.volume, 2, 2)}</span>
          <span className={`font-medium tabular-nums ${Number(position.current_profit_loss) < 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`} dir="ltr">{money(position.current_profit_loss, currency)}</span>
          <span className="tabular-nums" dir="ltr">{finiteNumber(position.stop_loss) > 0 ? number(position.stop_loss) : "ثبت نشده"}</span>
          <div><p className="font-medium tabular-nums" dir="ltr">{position.risk.amount == null ? "قابل محاسبه نیست" : money(position.risk.amount, currency)}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{riskPct == null ? position.risk.reason : `${number(riskPct, 2, 2)}٪ Equity`}</p></div>
          <CheckBadge status={compliant} />
          <details className="group relative">
            <summary className="cursor-pointer list-none rounded-md p-2 hover:bg-muted [&::-webkit-details-marker]:hidden" title="جزئیات محاسبه"><ChevronDown className="h-4 w-4 transition group-open:rotate-180" /></summary>
            <div className="absolute left-0 top-9 z-20 w-64 rounded-lg border bg-popover p-3 text-popover-foreground shadow-lg">
              <p className="font-medium">مبنای محاسبه</p>
              <p className="mt-1 leading-5 text-muted-foreground">فاصله قیمت ارزش‌گذاری تا Stop × ارزش Tick × حجم. کمیسیون خروج و لغزش آتی در این برآورد نیست.</p>
            </div>
          </details>
        </div>
      })}
    </div>
  </div>
}

function TradeReviewPanel({ open, onOpenChange, snapshot, rules, openRisk, draft, setDraft, onSavePlan, saved }) {
  const symbols = availableSymbols(snapshot)
  const preview = previewTrade(snapshot, draft, rules, openRisk)
  const currency = snapshot?.account?.currency || "USD"
  const update = (key, value) => setDraft((current) => ({ ...current, [key]: value }))
  const selectSymbol = (symbol) => {
    const spec = brokerSpecFor(snapshot, symbol)
    const marketPrice = draft.direction === "SELL" ? spec?.bid : spec?.ask
    setDraft((current) => ({ ...current, symbol, entryPrice: current.entryPrice || (finiteNumber(marketPrice)?.toString() || "") }))
  }

  return <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent side="left" dir="rtl" className="w-full overflow-y-auto sm:max-w-xl">
      <SheetHeader className="pr-1 text-right">
        <SheetTitle>بررسی معامله جدید</SheetTitle>
        <SheetDescription>پیش‌نمایش فقط خواندنی است و هیچ سفارشی به بروکر ارسال نمی‌کند.</SheetDescription>
      </SheetHeader>

      <div className="mt-5 space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>نماد</Label>
            <Select value={draft.symbol || undefined} onValueChange={selectSymbol}>
              <SelectTrigger><SelectValue placeholder="انتخاب نماد" /></SelectTrigger>
              <SelectContent>{symbols.map((symbol) => <SelectItem key={symbol} value={symbol}>{symbol}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>جهت</Label>
            <Select value={draft.direction} onValueChange={(value) => update("direction", value)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="BUY">خرید</SelectItem><SelectItem value="SELL">فروش</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>نوع سفارش</Label>
            <Select value={draft.orderType} onValueChange={(value) => update("orderType", value)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="MARKET">بازار</SelectItem><SelectItem value="PENDING">در انتظار</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>حجم (Lot)</Label><Input dir="ltr" type="number" min="0" step="0.01" value={draft.volume} onChange={(event) => update("volume", event.target.value)} /></div>
          <div className="space-y-1.5"><Label>قیمت ورود / فعلی</Label><Input dir="ltr" type="number" step="any" value={draft.entryPrice} onChange={(event) => update("entryPrice", event.target.value)} /></div>
          <div className="space-y-1.5"><Label>حد ضرر</Label><Input dir="ltr" type="number" step="any" value={draft.stopLoss} onChange={(event) => update("stopLoss", event.target.value)} /></div>
          <div className="space-y-1.5"><Label>هدف</Label><Input dir="ltr" type="number" step="any" value={draft.takeProfit} onChange={(event) => update("takeProfit", event.target.value)} /></div>
          <div className="space-y-1.5"><Label>ستاپ</Label><Input value={draft.setup} onChange={(event) => update("setup", event.target.value)} placeholder="مثلاً شکست و پولبک" /></div>
        </div>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>منطق ورود</Label><Textarea value={draft.rationale} onChange={(event) => update("rationale", event.target.value)} placeholder="چه شواهدی ورود را توجیه می‌کند؟" /></div>
          <div className="space-y-1.5"><Label>شرط ابطال سناریو</Label><Textarea value={draft.invalidation} onChange={(event) => update("invalidation", event.target.value)} placeholder="چه اتفاقی تحلیل را باطل می‌کند؟" /></div>
          <div className="space-y-1.5"><Label>وضعیت ذهنی (اختیاری)</Label><Input value={draft.mentalState} onChange={(event) => update("mentalState", event.target.value)} placeholder="آرام، عجول، پس از زیان…" /></div>
        </div>

        <Card className={surfaceClass}>
          <CardHeader><CardTitle className="flex items-center justify-between text-base"><span>پیش‌نمایش فوری</span><Badge variant="outline" className={preview.status === "compatible" ? toneClass("success") : preview.status === "incompatible" ? toneClass("danger") : toneClass("warning")}>{preview.status === "compatible" ? "سازگار" : preview.status === "incompatible" ? "ناسازگار" : "نیازمند بررسی"}</Badge></CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <dl className="grid grid-cols-2 gap-2">
              <div className={`${insetClass} p-3`}><dt className="text-[10px] text-muted-foreground">ریسک معامله</dt><dd className="mt-1 font-semibold tabular-nums" dir="ltr">{preview.risk.amount == null ? "—" : money(preview.risk.amount, currency)}</dd><p className="text-[10px] text-muted-foreground">{preview.riskPct == null ? preview.risk.reason : `${number(preview.riskPct, 2, 2)}٪ Equity`}</p></div>
              <div className={`${insetClass} p-3`}><dt className="text-[10px] text-muted-foreground">نسبت سود به زیان</dt><dd className="mt-1 font-semibold tabular-nums" dir="ltr">{preview.rewardRisk == null ? "—" : `1 : ${number(preview.rewardRisk, 2, 2)}`}</dd><p className="text-[10px] text-muted-foreground">بر اساس ورود، Stop و Target</p></div>
            </dl>
            <div className="space-y-2">{preview.checks.map((check) => <div key={check.key} className="flex items-start justify-between gap-3 rounded-md border p-2.5"><div><p className="text-xs font-medium">{check.label}</p><p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">{check.detail}</p></div><CheckBadge status={check.status} /></div>)}</div>
            <p className="text-[10px] leading-5 text-muted-foreground">برآورد ریسک بر پایه Tick Value فعلی بروکر است؛ لغزش، گپ و کمیسیون ناشناخته می‌تواند نتیجه واقعی را تغییر دهد.</p>
          </CardContent>
        </Card>

        <Button className="w-full" onClick={onSavePlan} disabled={!draft.symbol}><Save className="ml-2 h-4 w-4" />ثبت برنامه معامله</Button>
        {saved && <p className="text-center text-xs text-emerald-600 dark:text-emerald-400">برنامه در همین مرورگر ذخیره شد؛ سفارشی ارسال نشد.</p>}
      </div>
    </SheetContent>
  </Sheet>
}

export default function RiskManagementCenter() {
  const { accessToken, isLoading: authLoading } = useAuth()
  const [snapshots, setSnapshots] = useState([])
  const [selectedAccount, setSelectedAccount] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [reviewOpen, setReviewOpen] = useState(false)
  const [rules, setRules] = useState(EMPTY_RISK_RULES)
  const [draft, setDraft] = useState(EMPTY_TRADE_DRAFT)
  const [savedPlan, setSavedPlan] = useState(false)
  const [rulesSaved, setRulesSaved] = useState(false)
  const [scenarioSymbol, setScenarioSymbol] = useState("")
  const [shockPct, setShockPct] = useState(-5)

  const load = useCallback(async () => {
    if (authLoading) return
    if (!accessToken) {
      setError("برای مشاهده مرکز ریسک ابتدا وارد حساب کاربری شوید")
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const response = await fetch("/dashboard-data/mt5/accounts", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(responseError(body, response.status))
      if (!Array.isArray(body)) throw new Error("پاسخ حساب‌های معاملاتی معتبر نیست")
      setSnapshots(body)
      setSelectedAccount((current) => current && body.some((item) => accountKey(item) === current) ? current : accountKey(body[0]) || "")
      setError("")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "دریافت اطلاعات ریسک ممکن نشد")
    } finally {
      setLoading(false)
    }
  }, [accessToken, authLoading])

  useEffect(() => {
    load()
    const timer = window.setInterval(load, 60000)
    return () => window.clearInterval(timer)
  }, [load])

  const snapshot = useMemo(() => snapshots.find((item) => accountKey(item) === selectedAccount) || snapshots[0] || null, [snapshots, selectedAccount])
  const storageKey = snapshot ? accountKey(snapshot) : ""

  useEffect(() => {
    if (!storageKey) return
    try {
      const storedRules = JSON.parse(window.localStorage.getItem(`greenpeak:risk-rules:${storageKey}`) || "null")
      const storedDraft = JSON.parse(window.localStorage.getItem(`greenpeak:trade-draft:${storageKey}`) || "null")
      setRules(storedRules ? { ...EMPTY_RISK_RULES, ...storedRules } : EMPTY_RISK_RULES)
      setDraft(storedDraft ? { ...EMPTY_TRADE_DRAFT, ...storedDraft } : EMPTY_TRADE_DRAFT)
    } catch {
      setRules(EMPTY_RISK_RULES)
      setDraft(EMPTY_TRADE_DRAFT)
    }
    setSavedPlan(false)
    setRulesSaved(false)
  }, [storageKey])

  const openRisk = useMemo(() => analyzeOpenRisk(snapshot), [snapshot])
  const history = useMemo(() => analyzeTradeHistory(snapshot), [snapshot])
  const concentration = useMemo(() => concentrationSummary(snapshot), [snapshot])
  const freshness = useMemo(() => freshnessSummary(snapshot), [snapshot])
  const currency = snapshot?.account?.currency || "USD"
  const equity = finiteNumber(snapshot?.account?.equity)
  const grossLeverage = finiteNumber(snapshot?.portfolio_metrics?.gross_portfolio_leverage)
  const marginLevel = finiteNumber(snapshot?.account?.margin_level_pct)
  const floating = finiteNumber(snapshot?.account?.floating_profit_loss)
  const dailyLimitPct = positiveRule(rules.dailyLossLimitPct)
  const dailyLimitAmount = dailyLimitPct != null && equity != null ? equity * dailyLimitPct / 100 : null
  const dailyRemaining = dailyLimitAmount != null ? dailyLimitAmount - history.realizedLossUsed : null
  const maxTradeRiskPct = positiveRule(rules.maxTradeRiskPct)
  const maxOpenRiskPct = positiveRule(rules.maxOpenRiskPct)
  const maxLeverage = positiveRule(rules.maxGrossLeverage)
  const minMargin = positiveRule(rules.minMarginLevelPct)
  const maxTrades = positiveRule(rules.maxTradesPerDay)
  const scenarioSymbols = (snapshot?.symbol_metrics || []).map((item) => item?.symbol).filter(Boolean)
  const selectedScenarioSymbol = scenarioSymbols.includes(scenarioSymbol) ? scenarioSymbol : scenarioSymbols[0] || ""
  const scenario = scenarioEstimate(snapshot, selectedScenarioSymbol, shockPct)

  const warnings = useMemo(() => {
    const items = []
    if (freshness.stale) items.push({ title: "داده حساب تازه نیست", detail: freshness.ageMinutes == null ? "زمان Snapshot معتبر نیست." : `از آخرین Snapshot حدود ${number(freshness.ageMinutes, 0)} دقیقه گذشته است.`, tone: "danger" })
    if (openRisk.missingStopCount > 0) items.push({ title: `${openRisk.missingStopCount} پوزیشن بدون حد ضرر`, detail: "ریسک کل باز تا ثبت Stop کامل قابل اتکا نیست.", tone: "danger" })
    if (openRisk.unavailableCount > openRisk.missingStopCount) items.push({ title: "محاسبه ریسک بعضی پوزیشن‌ها ناقص است", detail: "مشخصات نماد یا قیمت معتبر در Snapshot موجود نیست.", tone: "warning" })
    if (dailyLimitAmount != null && history.realizedLossUsed > dailyLimitAmount) items.push({ title: "سقف زیان روزانه عبور کرده است", detail: "زیان تحقق‌یافته امروز از سقف ثبت‌شده بیشتر است.", tone: "danger" })
    if (maxOpenRiskPct != null && openRisk.riskPct != null && openRisk.riskPct > maxOpenRiskPct) items.push({ title: "ریسک باز بالاتر از برنامه است", detail: `${number(openRisk.riskPct, 2, 2)}٪ در برابر سقف ${maxOpenRiskPct}٪`, tone: "danger" })
    if (maxLeverage != null && grossLeverage != null && grossLeverage > maxLeverage) items.push({ title: "لورج کل بالاتر از برنامه است", detail: `${number(grossLeverage, 2, 2)}× در برابر سقف ${maxLeverage}×`, tone: "warning" })
    if (maxTrades != null && history.todayEntryCount >= maxTrades) items.push({ title: "سقف تعداد معاملات امروز پر شده است", detail: `${history.todayEntryCount} ورود در برابر سقف ${maxTrades}`, tone: "warning" })
    if (!items.length) items.push({ title: "هشدار فوری ثبت نشده است", detail: "این نتیجه فقط بر اساس Snapshot و قواعد فعلی است.", tone: "success" })
    return items
  }, [dailyLimitAmount, freshness, grossLeverage, history, maxLeverage, maxOpenRiskPct, maxTrades, openRisk])

  const saveRules = () => {
    if (!storageKey) return
    window.localStorage.setItem(`greenpeak:risk-rules:${storageKey}`, JSON.stringify(rules))
    setRulesSaved(true)
    window.setTimeout(() => setRulesSaved(false), 2500)
  }

  const savePlan = () => {
    if (!storageKey || !draft.symbol) return
    const key = `greenpeak:risk-plans:${storageKey}`
    let plans = []
    try { plans = JSON.parse(window.localStorage.getItem(key) || "[]") } catch { plans = [] }
    const preview = previewTrade(snapshot, draft, rules, openRisk)
    const planId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
    plans.unshift({ id: planId, createdAt: new Date().toISOString(), draft, previewStatus: preview.status })
    window.localStorage.setItem(key, JSON.stringify(plans.slice(0, 20)))
    setSavedPlan(true)
  }

  const updateDraft = (updater) => {
    setDraft((current) => {
      const next = typeof updater === "function" ? updater(current) : updater
      if (storageKey) window.localStorage.setItem(`greenpeak:trade-draft:${storageKey}`, JSON.stringify(next))
      return next
    })
    setSavedPlan(false)
  }

  return <section className="space-y-4" aria-labelledby="risk-management-title" dir="rtl">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h2 id="risk-management-title" className="text-lg font-semibold text-gray-900 dark:text-white">مرکز مدیریت ریسک</h2>
        </div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">کنترل ریسک حساب، قواعد روزانه و بررسی معامله پیش از اجرا</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {snapshots.length > 0 && <Select value={selectedAccount || accountKey(snapshots[0])} onValueChange={setSelectedAccount}>
          <SelectTrigger className="w-full sm:w-[280px]"><SelectValue /></SelectTrigger>
          <SelectContent>{snapshots.map((item) => <SelectItem key={accountKey(item)} value={accountKey(item)}>{accountName(item)}</SelectItem>)}</SelectContent>
        </Select>}
        <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${snapshot && !freshness.stale ? toneClass("success") : toneClass("warning")}`}>
          {snapshot && !freshness.stale ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
          <span>{snapshot ? freshness.stale ? "Snapshot قدیمی" : "Snapshot متصل" : "بدون Snapshot"}</span>
          {freshness.timestamp && <time className="tabular-nums opacity-80">{freshness.timestamp.toLocaleString("fa-IR", { hour12: false })}</time>}
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw className={`ml-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />تازه‌سازی</Button>
        <Button size="sm" onClick={() => setReviewOpen(true)} disabled={!snapshot}><ClipboardCheck className="ml-2 h-4 w-4" />بررسی معامله جدید</Button>
      </div>
    </div>

    {!snapshot ? <EmptyState loading={loading} error={error} onRefresh={load} /> : <>
      {error && <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">تازه‌سازی انجام نشد؛ آخرین Snapshot سالم نمایش داده می‌شود. {error}</div>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <MetricCard
          icon={ShieldAlert}
          label="ریسک پوزیشن‌های باز"
          value={openRisk.total == null ? "محاسبه ناقص" : money(openRisk.total, currency)}
          detail={openRisk.riskPct == null ? `${openRisk.unavailableCount} مورد نیازمند داده` : `${number(openRisk.riskPct, 2, 2)}٪ از Equity`}
          note="زیان افزوده از قیمت فعلی تا Stop؛ بدون لغزش و کمیسیون خروج"
          tone={openRisk.complete ? maxOpenRiskPct != null && openRisk.riskPct > maxOpenRiskPct ? "danger" : "neutral" : "warning"}
        />
        <MetricCard
          icon={Target}
          label="پوشش حد ضرر"
          value={openRisk.positions.length ? `${openRisk.positions.length - openRisk.missingStopCount} از ${openRisk.positions.length}` : "بدون پوزیشن"}
          detail={openRisk.missingStopCount ? `${openRisk.missingStopCount} پوزیشن بدون Stop` : "همه پوزیشن‌های باز Stop دارند"}
          note={openRisk.pendingOrders.length ? `${openRisk.pendingMissingStopCount} سفارش در انتظار بدون Stop` : "سفارش در انتظاری گزارش نشده"}
          tone={openRisk.missingStopCount ? "danger" : "success"}
        />
        <MetricCard
          icon={ListChecks}
          label="بودجه زیان روزانه"
          value={dailyLimitAmount == null ? "سقف تعیین نشده" : money(dailyRemaining, currency)}
          detail={`تحقق‌یافته امروز: ${money(history.realizedToday, currency)} · شناور فعلی: ${money(floating, currency)}`}
          note="شناور فعلی تغییر روزانه نیست و با زیان تحقق‌یافته جمع نشده است"
          tone={dailyRemaining != null && dailyRemaining < 0 ? "danger" : "warning"}
        />
        <MetricCard
          icon={Gauge}
          label="لورج کل مؤثر"
          value={grossLeverage == null ? "داده کافی نیست" : `${number(grossLeverage, 2, 2)}×`}
          detail={maxLeverage == null ? "سقف شخصی تعیین نشده" : `سقف برنامه: ${maxLeverage}×`}
          note="Gross exposure ÷ Equity؛ مقدار گزارش‌شده توسط Snapshot"
          tone={maxLeverage != null && grossLeverage > maxLeverage ? "danger" : "neutral"}
        />
        <MetricCard
          icon={Landmark}
          label="وضعیت مارجین"
          value={marginLevel == null ? "داده کافی نیست" : `${number(marginLevel, 0)}٪`}
          detail={`Free Margin: ${money(snapshot.account?.free_margin, currency)}`}
          note={minMargin == null ? "آستانه شخصی تعیین نشده؛ آستانه بروکر در Snapshot نیست" : `حداقل شخصی: ${minMargin}٪`}
          tone={minMargin != null && marginLevel != null && marginLevel < minMargin ? "danger" : "neutral"}
        />
        <MetricCard
          icon={PieChart}
          label="تمرکز Exposure"
          value={concentration.available ? concentration.symbol : "داده کافی نیست"}
          detail={concentration.available ? `${money(concentration.exposure, "USD")}${concentration.sharePct == null ? "" : ` · ${number(concentration.sharePct, 1, 1)}٪ Gross`}` : "Symbol metrics در Snapshot موجود نیست"}
          note="بزرگ‌ترین Exposure خالص میان نمادهای گزارش‌شده"
          tone={concentration.sharePct != null && concentration.sharePct > 50 ? "warning" : "neutral"}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1.4fr]">
        <Card className={surfaceClass}>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-5 w-5 text-amber-500" />نیازمند توجه<Badge variant="secondary">{warnings.length}</Badge></CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {warnings.slice(0, 3).map((warning, index) => <div key={`${warning.title}-${index}`} className={`rounded-lg border p-3 ${toneClass(warning.tone)}`}><p className="text-sm font-medium">{warning.title}</p><p className="mt-1 text-xs leading-5 opacity-85">{warning.detail}</p></div>)}
            {warnings.length > 3 && <details><summary className="cursor-pointer text-xs text-primary">مشاهده {warnings.length - 3} هشدار دیگر</summary><div className="mt-2 space-y-2">{warnings.slice(3).map((warning, index) => <div key={`${warning.title}-${index}`} className={`rounded-lg border p-3 ${toneClass(warning.tone)}`}><p className="text-sm font-medium">{warning.title}</p><p className="mt-1 text-xs">{warning.detail}</p></div>)}</div></details>}
          </CardContent>
        </Card>

        <Card className={surfaceClass}>
          <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle className="flex items-center gap-2 text-base"><Target className="h-5 w-5 text-primary" />برنامه امروز</CardTitle><p className="mt-1 text-xs text-muted-foreground">قواعد روی این مرورگر و برای همین حساب ذخیره می‌شوند.</p></div><Button size="sm" variant="outline" onClick={saveRules}><Save className="ml-2 h-4 w-4" />{rulesSaved ? "ذخیره شد" : "ذخیره قواعد"}</Button></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <RuleField label="حداکثر ریسک هر معامله" suffix="٪" value={rules.maxTradeRiskPct} onChange={(value) => setRules((current) => ({ ...current, maxTradeRiskPct: value }))} />
            <RuleField label="حداکثر ریسک باز" suffix="٪" value={rules.maxOpenRiskPct} onChange={(value) => setRules((current) => ({ ...current, maxOpenRiskPct: value }))} />
            <RuleField label="سقف زیان روزانه" suffix="٪" value={rules.dailyLossLimitPct} onChange={(value) => setRules((current) => ({ ...current, dailyLossLimitPct: value }))} />
            <RuleField label="حداکثر لورج کل" suffix="×" value={rules.maxGrossLeverage} onChange={(value) => setRules((current) => ({ ...current, maxGrossLeverage: value }))} />
            <RuleField label="حداکثر ورود روزانه" suffix="عدد" value={rules.maxTradesPerDay} onChange={(value) => setRules((current) => ({ ...current, maxTradesPerDay: value }))} />
            <RuleField label="حداقل Margin Level" suffix="٪" value={rules.minMarginLevelPct} onChange={(value) => setRules((current) => ({ ...current, minMarginLevelPct: value }))} />
          </CardContent>
        </Card>
      </div>

      <Card className={surfaceClass}>
        <CardHeader className="gap-2 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle className="flex items-center gap-2 text-base"><Activity className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />ریسک پوزیشن‌های باز</CardTitle><p className="mt-1 text-xs text-muted-foreground">ستون‌ها و جزئیات با الگوی باکس «چرخه معاملات» نمایش داده می‌شوند.</p></div><div className="flex flex-wrap gap-2"><Badge variant="secondary">{openRisk.positions.length} پوزیشن</Badge><Badge variant="outline">Pending risk: {openRisk.pendingTotal == null ? "ناقص" : money(openRisk.pendingTotal, currency)}</Badge></div></CardHeader>
        <CardContent><PositionRiskTable analysis={openRisk} snapshot={snapshot} maxTradeRiskPct={maxTradeRiskPct} /></CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className={surfaceClass}>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><BarChart3 className="h-5 w-5 text-primary" />الگوهای رفتاری</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2">
              <div className={`${insetClass} p-3`}><p className="text-[10px] text-muted-foreground">ورودهای امروز</p><p className="mt-1 text-lg font-semibold tabular-nums">{history.todayEntryCount}</p></div>
              <div className={`${insetClass} p-3`}><p className="text-[10px] text-muted-foreground">خروج‌های نمونه</p><p className="mt-1 text-lg font-semibold tabular-nums">{history.closedSampleCount}</p></div>
              <div className={`${insetClass} p-3`}><p className="text-[10px] text-muted-foreground">خروج زیان‌ده</p><p className="mt-1 text-lg font-semibold tabular-nums">{history.losingSampleCount}</p></div>
            </div>
            <div className={`mt-3 rounded-lg border p-3 ${history.behaviorSampleSufficient ? toneClass(history.raisedVolumeAfterLoss ? "warning" : "success") : toneClass("warning")}`}>
              <p className="text-sm font-medium">{history.behaviorSampleSufficient ? history.raisedVolumeAfterLoss ? "نشانه احتمالی افزایش حجم پس از زیان" : "الگوی پرریسک مشخصی در نمونه دیده نشد" : "داده کافی برای نتیجه‌گیری رفتاری نیست"}</p>
              <p className="mt-1 text-xs leading-5 opacity-85">{history.behaviorSampleSufficient ? `${history.raisedVolumeAfterLoss} بار ورود با حجم بیشتر تا ۳۰ دقیقه پس از خروج زیان‌ده دیده شد. این یک نشانه آماری است، نه تشخیص قطعی.` : `حداقل ۱۰ خروج لازم است؛ نمونه فعلی ${history.closedSampleCount} خروج در بازه ${history.historyWindowDays || 7} روزه دارد.`}</p>
            </div>
          </CardContent>
        </Card>

        <Card className={surfaceClass}>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Gauge className="h-5 w-5 text-primary" />اگر این اتفاق بیفتد…</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-[1fr_110px] gap-3">
              <Select value={selectedScenarioSymbol || undefined} onValueChange={setScenarioSymbol}><SelectTrigger><SelectValue placeholder="نماد سناریو" /></SelectTrigger><SelectContent>{scenarioSymbols.map((symbol) => <SelectItem key={symbol} value={symbol}>{symbol}</SelectItem>)}</SelectContent></Select>
              <Input dir="ltr" type="number" min="-20" max="20" step="1" value={shockPct} onChange={(event) => setShockPct(Number(event.target.value))} />
            </div>
            <Slider dir="ltr" min={-20} max={20} step={1} value={[shockPct]} onValueChange={([value]) => setShockPct(value)} />
            <div className="grid grid-cols-2 gap-2">
              <div className={`${insetClass} p-3`}><p className="text-[10px] text-muted-foreground">اثر تقریبی بر Equity</p><p className={`mt-1 font-semibold tabular-nums ${scenario.pnl < 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`} dir="ltr">{scenario.available ? money(scenario.pnl, "USD") : "—"}</p></div>
              <div className={`${insetClass} p-3`}><p className="text-[10px] text-muted-foreground">Equity برآوردی</p><p className="mt-1 font-semibold tabular-nums" dir="ltr">{scenario.available ? money(scenario.equityAfter, "USD") : "—"}</p></div>
            </div>
            <p className="text-[10px] leading-5 text-muted-foreground">{scenario.available ? "فرض ساده: تغییر خطی P/L با Exposure خالص گزارش‌شده و ثابت‌ماندن سایر نمادها. Margin Level و هم‌بستگی‌ها با داده فعلی قابل بازسازی معتبر نیستند." : scenario.reason}</p>
          </CardContent>
        </Card>
      </div>

      <Card className={surfaceClass}>
        <CardHeader className="gap-2 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle className="flex items-center gap-2 text-base"><BrainCircuit className="h-5 w-5 text-primary" />شورای تحلیل ریسک</CardTitle><p className="mt-1 text-xs text-muted-foreground">نسخه فعلی قاعده‌محور است؛ سرویس هوش مصنوعی حساب متصل نیست و عددی تولید نمی‌کند.</p></div><Badge variant="outline">مشاهده · شاهد · اقدام</Badge></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className={`${insetClass} p-4`}><p className="font-medium">مدیر ریسک</p><p className="mt-2 text-xs leading-5"><b>مشاهده:</b> {warnings[0]?.title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground"><b>شاهد:</b> Snapshot {snapshot.snapshot_id || "فعلی"}</p><p className="mt-1 text-xs leading-5 text-primary"><b>اقدام:</b> پیش از معامله جدید، هشدارهای قرمز و قواعد روز را بررسی کنید.</p></div>
          <div className={`${insetClass} p-4`}><p className="font-medium">منتقد سناریو</p><p className="mt-2 text-xs leading-5"><b>مشاهده:</b> {scenario.available ? `شوک ${shockPct}٪ روی ${selectedScenarioSymbol} حدود ${money(scenario.pnl, "USD")} اثر خطی دارد.` : "سناریوی معتبر هنوز قابل محاسبه نیست."}</p><p className="mt-1 text-xs leading-5 text-muted-foreground"><b>شاهد:</b> Exposure خالص گزارش‌شده در Snapshot</p><p className="mt-1 text-xs leading-5 text-primary"><b>اقدام:</b> نتیجه را با گپ، لغزش و اثر متقابل سایر پوزیشن‌ها تنش‌سنجی کنید.</p></div>
          <div className={`${insetClass} p-4`}><p className="font-medium">مربی رفتار</p><p className="mt-2 text-xs leading-5"><b>مشاهده:</b> {history.behaviorSampleSufficient ? history.raisedVolumeAfterLoss ? `${history.raisedVolumeAfterLoss} نشانه افزایش حجم پس از زیان دیده شد.` : "در نمونه فعلی افزایش حجم پس از زیان دیده نشد." : "نمونه برای نتیجه‌گیری کافی نیست."}</p><p className="mt-1 text-xs leading-5 text-muted-foreground"><b>شاهد:</b> {history.closedSampleCount} خروج ثبت‌شده</p><p className="mt-1 text-xs leading-5 text-primary"><b>اقدام:</b> منطق ورود و شرط ابطال را پیش از اجرا ثبت کنید.</p></div>
        </CardContent>
      </Card>

      <TradeReviewPanel open={reviewOpen} onOpenChange={setReviewOpen} snapshot={snapshot} rules={rules} openRisk={openRisk} draft={draft} setDraft={updateDraft} onSavePlan={savePlan} saved={savedPlan} />
    </>}
  </section>
}
