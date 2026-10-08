"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"
import { accountKey, money, number } from "@/components/kokonutui/mt5-data-view"
import { createRiskDemoSnapshot } from "@/lib/mt5-demo-snapshot"
import {
  analyzeOpenRisk,
  analyzeTradeHistory,
  availableSymbols,
  brokerSpecFor,
  buildTradeReview,
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

function RiskOverviewGrid({ metrics }) {
  return <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3" aria-label="شش شاخص نمای کلی ریسک">
    {metrics.map(({ key, label, icon: Icon, tone, value, detail, note }) => <div key={key} className="min-w-0 rounded-md border bg-background/70 p-3 dark:border-[#2B2B30]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-medium leading-4 text-muted-foreground">{label}</p>
        <span className={`shrink-0 rounded-md border p-1.5 ${toneClass(tone)}`}><Icon className="h-3.5 w-3.5" /></span>
      </div>
      <p className="mt-2 text-base font-semibold tabular-nums text-foreground" dir="ltr">{value}</p>
      <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{detail}</p>
      {note && <p className="mt-2 border-t pt-2 text-[10px] leading-4 text-muted-foreground dark:border-[#2B2B30]">{note}</p>}
    </div>)}
  </div>
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
        <Button asChild size="sm" variant="outline"><Link href="/settings">تنظیمات اتصال</Link></Button>
        <Button size="sm" variant="outline" onClick={onRefresh}><RefreshCw className="ml-2 h-4 w-4" />تلاش دوباره</Button>
        {demoAvailable && <Button size="sm" onClick={onUseDemo}><ClipboardCheck className="ml-2 h-4 w-4" />نمایش با داده نمونه</Button>}
      </div>}
  </div>
}

function buildRiskSummary({
  concentration,
  dailyLimitPct,
  dailyRemaining,
  equity,
  freshness,
  grossLeverage,
  history,
  marginLevel,
  maxLeverage,
  maxOpenRiskPct,
  maxTradeRiskPct,
  maxTrades,
  minMargin,
  openRisk,
}) {
  const attention = []
  const actions = []
  const addAction = (text) => {
    if (!actions.includes(text)) actions.push(text)
  }

  if (freshness.stale) {
    attention.push(freshness.ageMinutes == null ? "زمان Snapshot معتبر نیست." : `Snapshot حدود ${number(freshness.ageMinutes, 0)} دقیقه قدیمی است و تصمیم جدید باید با داده تازه کنترل شود.`)
    addAction("پیش از معامله جدید، Snapshot تازه دریافت کنید.")
  }
  if (!openRisk.complete) {
    attention.push(openRisk.missingStopCount
      ? `${openRisk.missingStopCount} پوزیشن بدون حد ضرر، محاسبه ریسک کل باز را ناقص کرده است.`
      : `${openRisk.unavailableCount} پوزیشن به دلیل نبود قیمت یا مشخصات Tick ریسک قابل محاسبه ندارد.`)
    addAction("داده ناقص پوزیشن‌ها را تکمیل کنید و سپس ریسک کل را دوباره بسنجید.")
  }
  if (maxOpenRiskPct != null && openRisk.riskPct != null && openRisk.riskPct > maxOpenRiskPct) {
    attention.push(`ریسک باز ${number(openRisk.riskPct, 2, 2)}٪ است و از سقف ${maxOpenRiskPct}٪ عبور کرده است.`)
    addAction("پیش از افزودن ریسک جدید، حجم یا تعداد پوزیشن‌های باز را کاهش دهید.")
  }
  if (maxTradeRiskPct != null && equity != null && equity > 0) {
    const oversizedPositions = openRisk.positions.filter((position) => position.risk.amount != null && position.risk.amount / equity * 100 > maxTradeRiskPct)
    if (oversizedPositions.length) {
      attention.push(`${oversizedPositions.length} پوزیشن از سقف ریسک هر معامله عبور کرده‌اند.`)
      addAction("حد ضرر و حجم پوزیشن‌های ناسازگار با برنامه را بازبینی کنید.")
    }
  }
  if (dailyRemaining != null && dailyRemaining < 0) {
    attention.push("بودجه زیان روزانه مصرف شده و از سقف ثبت‌شده عبور کرده است.")
    addAction("ورود جدید را متوقف کنید و نتیجه معاملات امروز را مرور کنید.")
  }
  if (maxLeverage != null && grossLeverage != null && grossLeverage > maxLeverage) {
    attention.push(`لورج کل ${number(grossLeverage, 2, 2)}× است و از سقف ${maxLeverage}× بالاتر است.`)
    addAction("Exposure ناخالص را تا محدوده برنامه کاهش دهید.")
  }
  if (minMargin != null && marginLevel != null && marginLevel < minMargin) {
    attention.push(`Margin Level به ${number(marginLevel, 0)}٪ رسیده و از حداقل شخصی ${minMargin}٪ پایین‌تر است.`)
    addAction("حاشیه آزاد و ریسک لیکوییدشدن را پیش از هر اقدام جدید بررسی کنید.")
  }
  if (maxTrades != null && history.todayEntryCount >= maxTrades) {
    attention.push(`تعداد ورودهای امروز (${history.todayEntryCount}) به سقف ${maxTrades} رسیده است.`)
    addAction("تا جلسه معاملاتی بعدی ورود تازه ثبت نکنید.")
  }
  if (history.behaviorSampleSufficient && history.raisedVolumeAfterLoss > 0) {
    attention.push(`${history.raisedVolumeAfterLoss} نشانه افزایش حجم تا ۳۰ دقیقه پس از خروج زیان‌ده دیده شده است.`)
    addAction("ورودهای پس از زیان را جداگانه مرور و علت افزایش حجم را ثبت کنید.")
  }
  if (concentration.sharePct != null && concentration.sharePct > 50) {
    attention.push(`${number(concentration.sharePct, 1, 1)}٪ از Gross Exposure روی ${concentration.symbol} متمرکز است.`)
    addAction("اثر هم‌جهتی پوزیشن‌ها و تمرکز روی نماد غالب را بررسی کنید.")
  }

  const missingRules = [
    [maxTradeRiskPct, "ریسک هر معامله"],
    [maxOpenRiskPct, "ریسک کل باز"],
    [dailyLimitPct, "زیان روزانه"],
    [maxLeverage, "لورج کل"],
    [maxTrades, "تعداد ورود روزانه"],
    [minMargin, "Margin Level"],
  ].filter(([value]) => value == null).map(([, label]) => label)
  if (missingRules.length) {
    attention.push(`برای ${missingRules.join("، ")} هنوز حد شخصی تعیین نشده است.`)
    addAction("حدهای ناقص را در بخش برنامه تعیین و ذخیره کنید.")
  }

  const hasAttention = attention.length > 0
  if (!hasAttention) attention.push("بر اساس داده و قواعد فعلی، مورد فوری تازه‌ای شناسایی نشد.")
  if (!actions.length) actions.push("پیش از ورود بعدی، منطق معامله و شرط ابطال را در «بررسی معامله جدید» ثبت کنید.")

  return { attention, actions, hasAttention }
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
  const [review, setReview] = useState(null)
  const currency = snapshot?.account?.currency || "USD"
  const update = (key, value) => {
    setReview(null)
    setDraft((current) => ({ ...current, [key]: value }))
  }
  const selectSymbol = (symbol) => {
    const spec = brokerSpecFor(snapshot, symbol)
    const marketPrice = draft.direction === "SELL" ? spec?.bid : spec?.ask
    setReview(null)
    setDraft((current) => ({ ...current, symbol, entryPrice: current.entryPrice || (finiteNumber(marketPrice)?.toString() || "") }))
  }

  useEffect(() => {
    if (!open) setReview(null)
  }, [open])

  useEffect(() => {
    setReview(null)
  }, [snapshot])

  const runReview = () => setReview(buildTradeReview(snapshot, draft, rules, openRisk))

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent dir="rtl" className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-2xl overflow-y-auto">
      <DialogHeader className="pl-8 text-right sm:text-right">
        <DialogTitle>بررسی معامله جدید</DialogTitle>
        <DialogDescription>اطلاعات را ثبت و سپس بررسی را اجرا کنید. این فرایند فقط خواندنی است و هیچ سفارشی به بروکر ارسال نمی‌کند.</DialogDescription>
      </DialogHeader>

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

        <div className="space-y-2">
          <Button type="button" className="w-full" size="lg" onClick={runReview} disabled={!snapshot}>
            <ClipboardCheck className="ml-2 h-4 w-4" />تأیید اطلاعات و بررسی معامله
          </Button>
          <p className="text-center text-[10px] leading-5 text-muted-foreground">با تغییر هر فیلد، نتیجه قبلی پاک می‌شود و باید بررسی را دوباره اجرا کنید.</p>
        </div>

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
                <div className={`${insetClass} p-3`}><dt className="text-[10px] text-muted-foreground">نسبت سود به زیان</dt><dd className="mt-1 font-semibold tabular-nums" dir="ltr">{review.rewardRisk == null ? "—" : `1 : ${number(review.rewardRisk, 2, 2)}`}</dd><p className="text-[10px] text-muted-foreground">بر اساس ورود، Stop و Target</p></div>
              </dl>
              <div className="space-y-2">{review.checks.map((check) => <div key={check.key} className="flex items-start justify-between gap-3 rounded-md border p-2.5"><div><p className="text-xs font-medium">{check.label}</p><p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">{check.detail}</p></div><CheckBadge status={check.status} /></div>)}</div>

              <div className={`${insetClass} space-y-3 p-4`}>
                <div className="flex items-center gap-2"><BrainCircuit className="h-4 w-4 text-primary" /><p className="text-sm font-semibold">تحلیل متنی معامله</p></div>
                <p className="text-xs leading-6 text-foreground">{review.analysis.summary}</p>
                {review.analysis.risks.length > 0 && <div><p className="text-[11px] font-medium text-rose-700 dark:text-rose-300">نکات ریسکی تکمیلی</p><ul className="mt-1 list-disc space-y-1 pr-4 text-[11px] leading-5 text-muted-foreground">{review.analysis.risks.map((item) => <li key={item}>{item}</li>)}</ul></div>}
                {review.analysis.strengths.length > 0 && <div><p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">نقاط ثبت‌شده مناسب</p><ul className="mt-1 list-disc space-y-1 pr-4 text-[11px] leading-5 text-muted-foreground">{review.analysis.strengths.map((item) => <li key={item}>{item}</li>)}</ul></div>}
                {review.analysis.limitations.length > 0 && <div><p className="text-[11px] font-medium text-amber-700 dark:text-amber-300">محدودیت‌ها و داده‌های بررسی‌نشده</p><ul className="mt-1 list-disc space-y-1 pr-4 text-[11px] leading-5 text-muted-foreground">{review.analysis.limitations.map((item) => <li key={item}>{item}</li>)}</ul></div>}
                <p className="border-t pt-2 text-[10px] leading-5 text-muted-foreground">تحلیل متنی قاعده‌محور است و کیفیت واقعی تحلیل بازار یا احتمال موفقیت معامله را تضمین نمی‌کند.</p>
              </div>

              <p className="text-[10px] leading-5 text-muted-foreground">برآورد ریسک بر پایه Tick Value فعلی بروکر است؛ لغزش، گپ و کمیسیون ناشناخته می‌تواند نتیجه واقعی را تغییر دهد.</p>
            </>}
          </CardContent>
        </Card>

        <Button className="w-full" onClick={onSavePlan} disabled={!draft.symbol || !review}><Save className="ml-2 h-4 w-4" />ثبت برنامه معامله</Button>
        {saved && <p className="text-center text-xs text-emerald-600 dark:text-emerald-400">برنامه در همین مرورگر ذخیره شد؛ سفارشی ارسال نشد.</p>}
      </div>
    </DialogContent>
  </Dialog>
}

function DailyPlanDialog({ open, onOpenChange, rules, setRules, rulesSaved, onSaveRules, history, maxTrades }) {
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent dir="rtl" className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-xl overflow-y-auto">
      <DialogHeader className="pl-8 text-right sm:text-right">
        <DialogTitle>برنامه</DialogTitle>
        <DialogDescription>حدهای شخصی روی همین مرورگر و برای حساب انتخاب‌شده ذخیره می‌شوند.</DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <RuleField label="حداکثر ریسک هر معامله" suffix="٪" value={rules.maxTradeRiskPct} onChange={(value) => setRules((current) => ({ ...current, maxTradeRiskPct: value }))} />
        <RuleField label="حداکثر ریسک باز" suffix="٪" value={rules.maxOpenRiskPct} onChange={(value) => setRules((current) => ({ ...current, maxOpenRiskPct: value }))} />
        <RuleField label="سقف زیان روزانه" suffix="٪" value={rules.dailyLossLimitPct} onChange={(value) => setRules((current) => ({ ...current, dailyLossLimitPct: value }))} />
        <RuleField label="حداکثر لورج کل" suffix="×" value={rules.maxGrossLeverage} onChange={(value) => setRules((current) => ({ ...current, maxGrossLeverage: value }))} />
        <RuleField label="حداکثر ورود روزانه" suffix="عدد" value={rules.maxTradesPerDay} onChange={(value) => setRules((current) => ({ ...current, maxTradesPerDay: value }))} />
        <RuleField label="حداقل Margin Level" suffix="٪" value={rules.minMarginLevelPct} onChange={(value) => setRules((current) => ({ ...current, minMarginLevelPct: value }))} />
      </div>
      <div className={`rounded-lg border p-3 text-xs ${maxTrades != null && history.todayEntryCount >= maxTrades ? toneClass("warning") : "border-border text-muted-foreground"}`}>ورودهای امروز: <span className="font-semibold tabular-nums">{history.todayEntryCount}</span>{maxTrades == null ? "؛ سقف روزانه تعیین نشده" : ` از سقف ${maxTrades}`}</div>
      <Button onClick={onSaveRules}><Save className="ml-2 h-4 w-4" />{rulesSaved ? "ذخیره شد" : "ذخیره قواعد"}</Button>
    </DialogContent>
  </Dialog>
}

function ScenarioDialog({ open, onOpenChange, scenarioSymbols, selectedScenarioSymbol, onSymbolChange, shockPct, onShockChange, scenario }) {
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent dir="rtl" className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-xl overflow-y-auto">
      <DialogHeader className="pl-8 text-right sm:text-right">
        <DialogTitle>سناریو</DialogTitle>
        <DialogDescription>اثر خطی یک شوک قیمتی روی Exposure خالص نماد انتخاب‌شده را بررسی کنید.</DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="grid grid-cols-[1fr_110px] gap-3">
          <Select value={selectedScenarioSymbol || undefined} onValueChange={onSymbolChange}><SelectTrigger><SelectValue placeholder="نماد سناریو" /></SelectTrigger><SelectContent>{scenarioSymbols.map((symbol) => <SelectItem key={symbol} value={symbol}>{symbol}</SelectItem>)}</SelectContent></Select>
          <Input dir="ltr" type="number" min="-20" max="20" step="1" value={shockPct} onChange={(event) => onShockChange(Number(event.target.value))} />
        </div>
        <Slider dir="ltr" min={-20} max={20} step={1} value={[shockPct]} onValueChange={([value]) => onShockChange(value)} />
        <p className="text-[10px] leading-5 text-muted-foreground">بازه شوک از ۲۰٪- تا ۲۰٪+ است. نتیجه بر اساس Exposure ثبت‌شده در آخرین داده محاسبه می‌شود.</p>
      </div>
      <dl className="grid grid-cols-2 gap-2">
        <div className={`${insetClass} p-4`}><dt className="text-[10px] text-muted-foreground">اثر تقریبی بر Equity</dt><dd className={`mt-2 text-base font-semibold tabular-nums ${scenario.pnl < 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`} dir="ltr">{scenario.available ? money(scenario.pnl, "USD") : "—"}</dd></div>
        <div className={`${insetClass} p-4`}><dt className="text-[10px] text-muted-foreground">Equity برآوردی</dt><dd className="mt-2 text-base font-semibold tabular-nums" dir="ltr">{scenario.available ? money(scenario.equityAfter, "USD") : "—"}</dd></div>
      </dl>
      <div className={`${insetClass} p-4 text-xs leading-6 text-muted-foreground`}>{scenario.available ? "این برآورد تغییر خطی P/L را فرض می‌کند. تغییر Margin Level، گپ، لغزش، هم‌بستگی و واکنش سایر نمادها در آن محاسبه نشده است." : scenario.reason}</div>
    </DialogContent>
  </Dialog>
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
  const [demoAvailable, setDemoAvailable] = useState(false)
  const [dailyPlanOpen, setDailyPlanOpen] = useState(false)
  const [scenarioOpen, setScenarioOpen] = useState(false)

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
      const targetId = {
        positions: "risk-open-positions",
        warnings: "risk-summary",
        "overview-structure": "risk-overview",
        "analysis-behavior": "risk-summary",
      }[event.detail]
      if (targetId) document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" })
    }
    window.addEventListener("greenpeak:risk-focus", focusSection)
    return () => window.removeEventListener("greenpeak:risk-focus", focusSection)
  }, [])

  const load = useCallback(async () => {
    if (authLoading) return
    if (!accessToken) {
      setError("برای مشاهده مدیریت ریسک ابتدا وارد حساب کاربری شوید")
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
  const overviewMetrics = [
    {
      key: "open-risk",
      icon: ShieldAlert,
      label: "ریسک پوزیشن‌های باز",
      value: openRisk.total == null ? "محاسبه ناقص" : money(openRisk.total, currency),
      detail: openRisk.riskPct == null ? `${openRisk.unavailableCount} مورد نیازمند داده` : `${number(openRisk.riskPct, 2, 2)}٪ از Equity`,
      note: maxOpenRiskPct == null ? "سقف شخصی تعیین نشده" : `سقف برنامه: ${maxOpenRiskPct}٪`,
      tone: openRisk.complete ? maxOpenRiskPct != null && openRisk.riskPct > maxOpenRiskPct ? "danger" : "neutral" : "warning",
    },
    {
      key: "stop-coverage",
      icon: Target,
      label: "پوشش حد ضرر",
      value: openRisk.positions.length ? `${openRisk.positions.length - openRisk.missingStopCount}/${openRisk.positions.length}` : "بدون پوزیشن",
      detail: openRisk.missingStopCount ? `${openRisk.missingStopCount} پوزیشن بدون Stop` : "پوزیشن‌های باز Stop دارند",
      note: openRisk.pendingOrders.length ? `${openRisk.pendingMissingStopCount} سفارش در انتظار بدون Stop` : "سفارش در انتظاری گزارش نشده",
      tone: openRisk.missingStopCount ? "danger" : "success",
    },
    {
      key: "daily-loss",
      icon: ListChecks,
      label: "بودجه زیان روزانه",
      value: dailyLimitAmount == null ? "سقف تعیین نشده" : money(dailyRemaining, currency),
      detail: `تحقق‌یافته امروز: ${money(history.realizedToday, currency)}`,
      note: `شناور فعلی: ${money(floating, currency)}؛ در بودجه روزانه جمع نشده`,
      tone: dailyRemaining != null && dailyRemaining < 0 ? "danger" : "warning",
    },
    {
      key: "leverage",
      icon: Gauge,
      label: "لورج کل مؤثر",
      value: grossLeverage == null ? "داده کافی نیست" : `${number(grossLeverage, 2, 2)}×`,
      detail: maxLeverage == null ? "سقف شخصی تعیین نشده" : `سقف برنامه: ${maxLeverage}×`,
      note: "Gross exposure ÷ Equity در Snapshot",
      tone: maxLeverage != null && grossLeverage > maxLeverage ? "danger" : "neutral",
    },
    {
      key: "margin",
      icon: Landmark,
      label: "وضعیت مارجین",
      value: marginLevel == null ? "داده کافی نیست" : `${number(marginLevel, 0)}٪`,
      detail: `Free Margin: ${money(snapshot?.account?.free_margin, currency)}`,
      note: minMargin == null ? "حداقل شخصی تعیین نشده" : `حداقل شخصی: ${minMargin}٪`,
      tone: minMargin != null && marginLevel != null && marginLevel < minMargin ? "danger" : "neutral",
    },
    {
      key: "concentration",
      icon: PieChart,
      label: "تمرکز Exposure",
      value: concentration.available ? concentration.symbol : "داده کافی نیست",
      detail: concentration.available ? money(concentration.exposure, "USD") : "Symbol metrics موجود نیست",
      note: concentration.sharePct == null ? "سهم از Gross قابل محاسبه نیست" : `${number(concentration.sharePct, 1, 1)}٪ از Gross`,
      tone: concentration.sharePct != null && concentration.sharePct > 50 ? "warning" : "neutral",
    },
  ]
  const riskSummary = buildRiskSummary({
    concentration,
    dailyLimitPct,
    dailyRemaining,
    equity,
    freshness,
    grossLeverage,
    history,
    marginLevel,
    maxLeverage,
    maxOpenRiskPct,
    maxTradeRiskPct,
    maxTrades,
    minMargin,
    openRisk,
  })

  const saveRules = () => {
    if (!storageKey) return
    window.localStorage.setItem(`greenpeak:risk-rules:${storageKey}`, JSON.stringify(rules))
    window.dispatchEvent(new CustomEvent("greenpeak:risk-rules-updated"))
    setRulesSaved(true)
    window.setTimeout(() => setRulesSaved(false), 2500)
  }

  const useDemoSnapshot = () => {
    const demoSnapshot = createRiskDemoSnapshot()
    setSnapshots([demoSnapshot])
    setSelectedAccount(accountKey(demoSnapshot))
    setError("")
    setLoading(false)
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
            <p className="mt-1 text-xs leading-5 text-muted-foreground">برنامه روزانه، تنش‌سنجی و تحلیل یکپارچه ریسک حساب</p>
          </div>
          <div className="grid gap-2 lg:justify-items-end">
            <div className="flex flex-wrap items-stretch gap-2 lg:justify-end">
              {snapshots.length > 0 && <Select value={selectedAccount || accountKey(snapshots[0])} onValueChange={setSelectedAccount}>
                <SelectTrigger className="h-9 w-auto min-w-[220px] max-w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{snapshots.map((item) => <SelectItem key={accountKey(item)} value={accountKey(item)}>{accountName(item)}</SelectItem>)}</SelectContent>
              </Select>}
              <div className={`flex h-9 w-auto items-center gap-2 whitespace-nowrap rounded-lg border px-3 text-xs ${snapshot && !freshness.stale ? toneClass("success") : toneClass("warning")}`}>
                {snapshot && !freshness.stale ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
                <span>{snapshot ? freshness.stale ? "نیازمند بروزرسانی" : "داده متصل" : "بدون داده"}</span>
                {freshness.timestamp && <time className="tabular-nums opacity-80" title="آخرین بروزرسانی به وقت تهران" dir="ltr">{formatTehranTimestamp(freshness.timestamp)}</time>}
              </div>
              <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={load} disabled={loading} aria-label="به‌روزرسانی داده" title="به‌روزرسانی داده"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></Button>
            </div>
            <div className="flex flex-wrap items-stretch gap-2 lg:justify-end">
              <Button variant="outline" size="sm" className="h-9 w-auto" onClick={() => setDailyPlanOpen(true)} disabled={!snapshot}><ListChecks className="ml-2 h-4 w-4" />برنامه</Button>
              <Button variant="outline" size="sm" className="h-9 w-auto" onClick={() => setScenarioOpen(true)} disabled={!snapshot}><Gauge className="ml-2 h-4 w-4" />سناریو</Button>
              <Button size="sm" className="h-9 w-auto" onClick={() => setReviewOpen(true)} disabled={!snapshot}><ClipboardCheck className="ml-2 h-4 w-4" />بررسی معامله جدید</Button>
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
              <section id="risk-overview" className="scroll-mt-16 space-y-3" aria-labelledby="risk-overview-title">
                <div><h3 id="risk-overview-title" className="flex items-center gap-2 text-sm font-semibold"><ShieldAlert className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />نمای کلی ریسک</h3><p className="mt-1 text-xs text-muted-foreground">شش شاخص اصلی حساب در باکس‌های جداگانه</p></div>
                <RiskOverviewGrid metrics={overviewMetrics} />
              </section>

              <section id="risk-open-positions" className="scroll-mt-16 space-y-3 border-t pt-6" aria-labelledby="risk-open-positions-title">
                <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 id="risk-open-positions-title" className="text-sm font-semibold">پوزیشن‌های باز</h3><p className="mt-1 text-xs text-muted-foreground">ریسک هر پوزیشن تا حد ضرر و انطباق آن با برنامه</p></div><div className="flex flex-wrap gap-2"><Badge variant="secondary">{openRisk.positions.length} پوزیشن</Badge><Badge variant="outline">Pending risk: {openRisk.pendingTotal == null ? "ناقص" : money(openRisk.pendingTotal, currency)}</Badge></div></div>
                <PositionRiskTable analysis={openRisk} snapshot={snapshot} maxTradeRiskPct={maxTradeRiskPct} />
              </section>

              <section id="risk-summary" className="scroll-mt-16 space-y-3 border-t pt-6" aria-labelledby="risk-summary-title">
                <div><h3 id="risk-summary-title" className="text-sm font-semibold">جمع‌بندی ریسک</h3><p className="mt-1 text-xs text-muted-foreground">مهم‌ترین نتیجه قابل اقدام از داده و قواعد فعلی</p></div>
                <div className={`rounded-lg border p-4 ${toneClass(riskSummary.hasAttention ? "warning" : "success")}`}>
                  <p className="text-sm font-medium">{riskSummary.hasAttention ? "جمع‌بندی فعلی نیازمند توجه است" : "ریسک فوری تازه‌ای دیده نشد"}</p>
                  <p className="mt-2 text-xs leading-6"><span className="font-semibold">نیازمند توجه:</span> {riskSummary.attention.slice(0, 3).join(" ")}{riskSummary.attention.length > 3 ? ` و ${riskSummary.attention.length - 3} مورد دیگر.` : ""}</p>
                  <p className="mt-2 border-t pt-2 text-xs leading-6"><span className="font-semibold">اقدام:</span> {riskSummary.actions.slice(0, 3).join(" ")}{riskSummary.actions.length > 3 ? ` و ${riskSummary.actions.length - 3} اقدام دیگر.` : ""}</p>
                </div>
                <p className="text-[10px] leading-5 text-muted-foreground">جمع‌بندی قاعده‌محور است و به کامل‌بودن داده و حدود ثبت‌شده وابسته است.</p>
              </section>
          </div>
        </>}
      </CardContent>
    </Card>

    {snapshot && <>
      <DailyPlanDialog open={dailyPlanOpen} onOpenChange={setDailyPlanOpen} rules={rules} setRules={setRules} rulesSaved={rulesSaved} onSaveRules={saveRules} history={history} maxTrades={maxTrades} />
      <ScenarioDialog open={scenarioOpen} onOpenChange={setScenarioOpen} scenarioSymbols={scenarioSymbols} selectedScenarioSymbol={selectedScenarioSymbol} onSymbolChange={setScenarioSymbol} shockPct={shockPct} onShockChange={setShockPct} scenario={scenario} />
      <TradeReviewPanel open={reviewOpen} onOpenChange={setReviewOpen} snapshot={snapshot} rules={rules} openRisk={openRisk} draft={draft} setDraft={updateDraft} onSavePlan={savePlan} saved={savedPlan} />
    </>}
  </>
}
