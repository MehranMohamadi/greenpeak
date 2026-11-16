"use client"

import { formatGregorianTehranDateTime } from "@/lib/date-format"

export const fieldClass = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
export const boxClass = "space-y-4 rounded-xl border border-border bg-card p-4"
export const dateLabel = value => value ? formatGregorianTehranDateTime(value) : "—"
export const kindLabel = kind => ({ weekly: "هفتگی", daily: "روزانه", session: "نبض جلسه", weekend: "تعطیلات" }[kind] || "گزارش")
export const stateLabel = state => ({ queued: "در صف", running: "در حال اجرا", cancelled: "لغوشده", completed: "پایان‌یافته", failed: "ناموفق", draft: "پیشنویس", promoted: "اعمال‌شده", active: "فعال", strengthened: "تقویت‌شده", weakened: "تضعیف‌شده", realized: "محقق‌شده", invalidated: "باطل‌شده", inconclusive: "نامشخص", valid: "معتبر", pass: "قبول", review: "نیازمند بررسی", warn: "نیازمند بررسی" }[state] || state)
export const localInput = value => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "" : new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

export function Field({ label, children }) {
  return <label className="block space-y-1 text-sm"><span className="text-muted-foreground">{label}</span>{children}</label>
}

export function ReportText({ report }) {
  if (!report) return null
  return <div className="space-y-3 text-sm leading-7">
    <p className="font-medium">{report.current_market_move_fa}</p>
    <p className="whitespace-pre-line">{report.current_analysis_fa || report.narrative_fa}</p>
    {report.weekly_focus_fa && <p><strong>موضوع هفته: </strong>{report.weekly_focus_fa}</p>}
    {report.weekly_events_fa?.length > 0 && <ul className="list-inside list-disc">{report.weekly_events_fa.map((text, index) => <li key={index}>{text}</li>)}</ul>}
    {report.watch_next_fa?.map((text, index) => <p key={index}><strong>زیر نظر: </strong>{text}</p>)}
    {["short", "medium"].map(horizon => {
      const view = report[`${horizon}_term_view`]
      const prose = report[`${horizon}_term_outlook_fa`]
      if (!view && !prose) return null
      return <section key={horizon} className="space-y-2 border-t border-border pt-3">
        <h4 className="font-medium">{horizon === "short" ? "کوتاه‌مدت" : "میان‌مدت"}</h4>
        <p>{view?.summary_fa}</p><p className="whitespace-pre-line">{view?.detail_fa || prose}</p>
        {view?.change_condition_fa && <p>شرط تغییر: {view.change_condition_fa}</p>}
        {view?.change_summary_fa && <p>بازبینی: {view.change_summary_fa}</p>}
      </section>
    })}
  </div>
}
