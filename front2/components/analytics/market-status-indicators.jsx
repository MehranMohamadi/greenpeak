"use client"

import { useEffect, useState } from "react"
import { Info } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { formatGregorianDate, formatGregorianTehranDateTime } from "@/lib/date-format"

const CARDS = [
  { key: "risk_level", label: "ریسک بازار" },
  { key: "change_intensity", label: "شدت حرکت روز" },
  { key: "confidence_level", label: "اعتماد به تحلیل" },
]
const LABELS = {
  favorable: "مساعد", mixed: "ترکیبی", challenging: "پرچالش", unknown: "نامشخص",
  low: "کم", medium: "متوسط", high: "زیاد", risk_on: "مثبت", neutral: "خنثی", risk_off: "منفی",
}
const TONES = {
  positive: "border-primary/30 bg-primary/10 text-primary",
  middle: "border-border bg-accent text-accent-foreground",
  negative: "border-destructive/30 bg-destructive/10 text-destructive",
  unknown: "border-border bg-muted text-muted-foreground",
}

function tone(key, value) {
  if (!value || value === "unknown") return TONES.unknown
  if (value === "medium" || value === "neutral" || value === "mixed") return TONES.middle
  const positive = key === "confidence_level" ? value === "high"
    : ["favorable", "risk_on", "low"].includes(value)
  return positive ? TONES.positive : TONES.negative
}

function observedTime(value) {
  if (!value) return "زمان مشاهده در دسترس نیست"
  return String(value).length === 10 ? formatGregorianDate(value) : formatGregorianTehranDateTime(value)
}

export function useMarketStatus() {
  const [data, setData] = useState(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let stopped = false
    let active = null
    async function load() {
      if (active) return
      const controller = new AbortController()
      active = controller
      const timeout = setTimeout(() => controller.abort(), 20000)
      try {
        const response = await fetch("/analytics-data/market/status-summary", { cache: "no-store", signal: controller.signal })
        const payload = await response.json()
        if (!response.ok || !payload?.data?.summary || !payload.data.details) throw new Error("Unavailable status cards")
        if (!stopped) { setData(payload.data); setError("") }
      } catch {
        // Never present a failed refresh or yesterday's AI label as fresh data.
        if (!stopped) { setData(null); setError("دریافت داده تازه وضعیت بازار ممکن نشد؛ به‌روزرسانی خودکار دوباره تلاش می‌کند.") }
      } finally {
        clearTimeout(timeout)
        if (active === controller) active = null
        if (!stopped) setLoading(false)
      }
    }
    void load()
    const timer = window.setInterval(() => { if (!document.hidden) void load() }, 60000)
    const onVisible = () => { if (!document.hidden) void load() }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      stopped = true
      active?.abort()
      window.clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [])

  return { data, error, loading }
}

export default function MarketStatusIndicators({ status, keys = ["risk_level", "confidence_level"] }) {
  const { data, error, loading } = status || {}
  return <div aria-label="وضعیت داده و ریسک بازار" className="flex flex-wrap items-center gap-x-3 gap-y-1" dir="rtl" aria-busy={loading}>
      {CARDS.filter(card => keys.includes(card.key)).map(({ key, label }) => {
        const value = data?.summary?.[key] || "unknown"
        const detail = data?.details?.[key]
        return <Dialog key={key}>
          <DialogTrigger asChild>
            <button type="button" aria-label={`منطق و منابع ${label}`} className="inline-flex min-h-7 items-center gap-1.5 rounded text-right text-[11px] text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${tone(key, value)}`} />
              <span>{label}: <span className="font-medium text-foreground">{loading ? "در حال بررسی" : LABELS[value] || "نامشخص"}</span></span>
              <Info className="h-3 w-3 shrink-0" aria-hidden="true" />
            </button>
          </DialogTrigger>
          <DialogContent dir="rtl" className="max-h-[85vh] overflow-y-auto">
            <DialogHeader className="text-right"><DialogTitle>{label}: {LABELS[value] || "نامشخص"}</DialogTitle><DialogDescription>{detail?.explanation_fa || error || "داده این نشانگر هنوز دریافت نشده است."}</DialogDescription></DialogHeader>
            {detail && <div className="space-y-4 text-sm leading-7">
              <div className="rounded-lg border bg-muted/25 p-3"><h3 className="font-medium text-primary">منطق تعیین وضعیت</h3><p>{detail.method_fa}</p></div>
              {key === "change_intensity" && detail.measurements?.true_range_pct != null && <p>دامنه واقعی امروز: {new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 2 }).format(detail.measurements.true_range_pct)}٪؛ مقایسه با {detail.measurements.reference_count} جلسهٔ کامل قبلی. {detail.measurements.provisional ? "این مقدار تا پایان جلسه موقت است." : ""}</p>}
              <div><h3 className="font-medium text-primary">منابع و زمان مشاهده</h3><ul className="mt-2 space-y-2">{detail.sources.map((source, index) => <li key={`${index}-${source.name}`} className="rounded-lg border p-3">
                {/^https?:\/\//.test(source.url || "") ? <a href={source.url} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">{source.name}</a> : <span className="font-medium">{source.name}</span>}
                <p className="text-xs text-muted-foreground">{observedTime(source.observed_at)}{source.quality === "stale" ? " · منبع کش‌شده با محدودیت تازگی" : source.quality === "unavailable" ? " · داده در دسترس نیست" : ""}</p>
              </li>)}</ul></div>
            </div>}
          </DialogContent>
        </Dialog>
      })}
  </div>
}
