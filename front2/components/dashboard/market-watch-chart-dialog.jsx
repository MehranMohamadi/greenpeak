"use client"

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export const watchIntervalLabel = item => item.interval === "5min" ? "۵ دقیقه" : "ماهانه"
const dateLabel = (timestamp, intraday, full = false) => new Intl.DateTimeFormat("fa-IR-u-ca-gregory", {
  timeZone: "Asia/Tehran", month: "2-digit", day: "2-digit",
  ...(full ? { year: "numeric" } : {}),
  ...(intraday ? { hour: "2-digit", minute: "2-digit" } : {}),
}).format(new Date(timestamp))
const numberLabel = (value, item) => `${item.prefix || ""}${new Intl.NumberFormat("en-US", { maximumFractionDigits: item.decimals ?? 2 }).format(value)}${item.suffix || ""}`

export default function MarketWatchChartDialog({ item, onClose, triggerRef }) {
  const intraday = item?.interval === "5min"
  return <Dialog open={Boolean(item)} onOpenChange={open => { if (!open) onClose() }}>
    <DialogContent dir="rtl" className="flex h-[min(80dvh,42rem)] w-[calc(100vw-2rem)] max-w-5xl flex-col overflow-hidden rounded-xl"
      onCloseAutoFocus={event => { event.preventDefault(); triggerRef.current?.focus() }}>
      {item && <>
        <DialogHeader className="shrink-0 !text-right">
          <DialogTitle><bdi>{item.symbol}</bdi> · چارت دیده‌بان</DialogTitle>
          <DialogDescription>فاصله نقاط داده: {watchIntervalLabel(item)} · زمان‌ها به وقت تهران</DialogDescription>
        </DialogHeader>
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 text-sm">
          <span dir="ltr" className="font-semibold tabular-nums">{item.price}</span>
          <span className="text-xs text-muted-foreground">تغییر در بازهٔ نمایش: <bdi>{item.change} ({item.changePercent})</bdi></span>
        </div>
        {item.chartPoints?.length ? <div dir="ltr" role="img" aria-label={`نمودار ${item.symbol} با فاصله ${watchIntervalLabel(item)}`} className="min-h-0 flex-1 text-muted-foreground">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
            <LineChart data={item.chartPoints} margin={{ top: 12, right: 12, bottom: 8, left: 4 }}>
              <CartesianGrid stroke="currentColor" strokeOpacity={0.12} strokeDasharray="3 3" />
              <XAxis dataKey="timestamp" type="number" scale="time" domain={["dataMin", "dataMax"]} tickFormatter={value => dateLabel(value, intraday)} tick={{ fontSize: 11, fill: "currentColor" }} tickLine={false} minTickGap={40} />
              <YAxis domain={["auto", "auto"]} width={72} tick={{ fontSize: 11, fill: "currentColor" }} tickLine={false} tickFormatter={value => numberLabel(value, item)} />
              <Tooltip labelFormatter={value => dateLabel(Number(value), intraday, true)} formatter={value => [numberLabel(value, item), item.symbol]} contentStyle={{ background: "hsl(var(--popover))", color: "hsl(var(--popover-foreground))", borderColor: "hsl(var(--border))", borderRadius: 8 }} />
              <Line type="linear" dataKey="value" stroke={item.trend === "down" ? "#ef4444" : "#06b6d4"} strokeWidth={2} dot={item.chartPoints.length === 1} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div> : <p role="status" className="flex min-h-0 flex-1 items-center justify-center text-center text-sm text-muted-foreground">{item.error || "داده‌ای برای نمایش موجود نیست."}</p>}
        <div className="shrink-0 space-y-1 text-xs leading-6 text-muted-foreground">
          <p>منبع: <bdi>{item.source || (item.id === "gold" ? "Twelve Data · XAU/USD" : "—")}</bdi></p>
          {item.observationTimestamp && <p>آخرین مشاهده: <bdi>{dateLabel(item.observationTimestamp, intraday, true)}</bdi></p>}
          {item.id === "pe-ratio" && <p>منبع P/E دادهٔ ماهانه منتشر می‌کند؛ دادهٔ ۵ دقیقه‌ای برای آن ساخته نمی‌شود.</p>}
          {item.id === "treasury-10y" && <p>بازده ده‌سالهٔ Cboe با واحد درصد؛ متفاوت از سری روزانهٔ DGS10.</p>}
          {intraday && <p>قیمت‌ها ممکن است با تأخیر منبع منتشر شوند؛ بیرون از ساعات بازار آخرین دادهٔ موجود نمایش داده می‌شود.</p>}
        </div>
      </>}
    </DialogContent>
  </Dialog>
}
