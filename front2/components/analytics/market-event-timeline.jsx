"use client"

import { useEffect, useImperativeHandle, useMemo, useRef, useState } from "react"
import { CalendarDays } from "lucide-react"
import { marketEventTimeline } from "@/lib/market-event-timeline.mjs"
import { GREGORIAN_PERSIAN_LOCALE, TEHRAN_TIME_ZONE } from "@/lib/date-format"

export default function MarketEventTimeline({ events, loading, renderEvent, navigationRef }) {
  const [now, setNow] = useState(() => new Date())
  const viewport = useRef(null)
  const marker = useRef(null)
  const centeredDay = useRef(null)
  const groups = useMemo(() => marketEventTimeline(events, now), [events, now])
  const today = groups.find(group => group.today)?.date

  const centerNow = () => {
    if (!marker.current || !viewport.current) return
    const panel = viewport.current
    const offset = marker.current.getBoundingClientRect().top - panel.getBoundingClientRect().top
    panel.scrollTop += offset - panel.clientHeight * 0.4
  }

  useImperativeHandle(navigationRef, () => ({ centerNow }), [])

  useEffect(() => {
    const update = () => setNow(new Date())
    const timer = window.setInterval(update, 60000)
    const visible = () => { if (!document.hidden) update() }
    document.addEventListener("visibilitychange", visible)
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", visible) }
  }, [])

  useEffect(() => {
    if (loading || !today || centeredDay.current === today) return
    const frame = window.requestAnimationFrame(() => {
      centerNow()
      centeredDay.current = today
    })
    return () => window.cancelAnimationFrame(frame)
  }, [loading, today])

  const rows = items => items.map(item => <div key={`${item.event_id || item.title_fa}-${item.release_at}`}>{renderEvent(item)}</div>)
  return <div className="flex min-h-0 flex-1 flex-col">
    <div ref={viewport} aria-label="رویدادهای هفت روز گذشته و هفت روز آینده" tabIndex={0} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4 [overflow-anchor:none]">
      {groups.filter(group => group.items.length || group.today).map(group => <section key={group.date} aria-label={group.items.length ? group.date : undefined} className="mb-4 last:mb-0">
        {group.items.length > 0 && <h3 className={`sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-card py-2 text-xs font-medium ${group.today ? "text-primary" : "text-muted-foreground"}`}>
          <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
          {new Intl.DateTimeFormat(GREGORIAN_PERSIAN_LOCALE, { weekday: "long", month: "short", day: "numeric", timeZone: TEHRAN_TIME_ZONE }).format(new Date(`${group.date}T12:00:00Z`))}
          {group.today && <span>· امروز</span>}
        </h3>}
        {group.today ? <>
          {rows(group.before)}
          <div ref={marker} role="separator" aria-label="اکنون؛ مرز زمان رویدادهای گذشته و آینده" className="my-3 h-1 rounded-full bg-primary" />
          {rows(group.after)}
          {group.untimed.length > 0 && <div><p className="pt-3 text-xs text-muted-foreground">رویدادهای امروز بدون ساعت دقیق</p>{rows(group.untimed)}</div>}
        </> : rows(group.items)}
      </section>)}
      {!events?.length && <p className="py-3 text-xs text-muted-foreground">رویداد مهمی در داده‌های دریافت‌شدهٔ این بازه ثبت نشده است.</p>}
    </div>
  </div>
}
