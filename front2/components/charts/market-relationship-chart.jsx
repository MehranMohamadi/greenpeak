"use client"

import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts"
import { useTheme } from "next-themes"

const format = (value) => new Intl.NumberFormat("en-US", { maximumSignificantDigits: 6 }).format(value)
const axisDescription = (axis) => `${axis.label} · ${axis.unit}${axis.currency ? ` · ${axis.currency}` : ""}`

function ObservationTooltip({ active, payload, plot }) {
  const point = payload?.[0]?.payload
  if (!active || !point) return null
  return <div dir="rtl" className="max-w-72 space-y-2 rounded-lg border border-border bg-popover p-3 text-xs text-popover-foreground shadow-md">
    <p dir="ltr" className="text-muted-foreground">{point.date}</p>
    <p>{plot.y_axis.label}: <span dir="ltr" className="font-semibold tabular-nums">{format(point.y)}</span><span className="ms-1 text-muted-foreground">{plot.y_axis.unit}</span></p>
    <p>{plot.x_axis.label}: <span dir="ltr" className="font-semibold tabular-nums">{format(point.x)}</span><span className="ms-1 text-muted-foreground">{plot.x_axis.unit}</span></p>
  </div>
}

export default function MarketRelationshipChart({ plot, height = 400 }) {
  const { resolvedTheme } = useTheme()
  const color = resolvedTheme === "light" ? "#475569" : "#cbd5e1"
  const latest = plot.points.at(-1)
  return <div className="space-y-3" data-testid="relationship-xy-chart">
    <p className="text-xs leading-6 text-muted-foreground">محور عمودی · نماد اول: <span className="font-medium text-foreground">{axisDescription(plot.y_axis)}</span></p>
    <div dir="ltr" role="img" aria-label={`${plot.y_axis.label} بر اساس ${plot.x_axis.label}؛ هر نقطه یک تاریخ مشترک`} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
        <ScatterChart margin={{ top: 12, right: 12, bottom: 12, left: 4 }}>
          <CartesianGrid stroke={color} strokeOpacity={0.1} strokeDasharray="3 3" />
          <XAxis type="number" dataKey="x" name={plot.x_axis.label} domain={["auto", "auto"]} tickFormatter={format} tick={{ fill: color, fontSize: 11 }} axisLine={{ stroke: color, strokeOpacity: 0.3 }} tickLine={false} />
          <YAxis type="number" dataKey="y" name={plot.y_axis.label} domain={["auto", "auto"]} width={75} tickFormatter={format} tick={{ fill: color, fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ strokeDasharray: "3 3" }} content={<ObservationTooltip plot={plot} />} />
          <Scatter name="تاریخ‌های مشترک" data={plot.points} fill="#06b6d4" fillOpacity={0.55} isAnimationActive={false} />
          {latest && <Scatter name="آخرین مشاهده" data={[latest]} fill="#d7a33d" isAnimationActive={false} />}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
    <p className="text-center text-xs leading-6 text-muted-foreground">محور افقی · نماد دوم: <span className="font-medium text-foreground">{axisDescription(plot.x_axis)}</span></p>
    <p className="flex flex-wrap items-center justify-between gap-2 text-[11px] leading-6 text-muted-foreground"><span>هر نقطه: مقادیر دو نماد در یک تاریخ مشترک</span>{latest && <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#d7a33d]" />آخرین مشاهده: <span dir="ltr">{latest.date}</span></span>}</p>
  </div>
}
