"use client"

import { useEffect, useState } from "react"
import { endpoints } from "@/api/api"
import { NEWS_ACCESS_LABELS } from "@/lib/news-sources"

export default function NewsAccessReview({ source }) {
  const [report, setReport] = useState(null)
  const [error, setError] = useState(false)
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setError(false)
    fetch(endpoints.news.accessReview, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Review unavailable")
        const payload = await response.json()
        setReport(payload.data)
      })
      .catch((reason) => { if (reason.name !== "AbortError") setError(true) })
    const timer = setInterval(() => setRefresh((value) => value + 1), 60_000)
    return () => { controller.abort(); clearInterval(timer) }
  }, [refresh])

  const result = report?.sources?.find((item) => item.source === source)
  return <details className="mb-3 shrink-0 rounded-lg border bg-muted/20 px-3 py-2 text-right text-xs" dir="rtl">
    <summary className="cursor-pointer font-medium">بررسی ۱۰روزهٔ خواندن متن خبر
      {result && <span className="ms-2 font-normal text-muted-foreground">{result.page_text_available} موفق از {result.attempts} آزمون</span>}
    </summary>
    <div className="mt-2 max-h-40 space-y-2 overflow-y-auto leading-6 text-muted-foreground">
      <p>هر روز حداکثر ۳ لینک تازه از هر منبع با شناسهٔ GreenPeak خوانده می‌شود. دریافت RSS و خلاصهٔ آن، موفقیت خواندن متن صفحه محسوب نمی‌شود. این آزمون دسترسی فنی را می‌سنجد؛ کامل‌بودن متن و مجوز استفادهٔ AI را تأیید نمی‌کند.</p>
      {error ? <p role="status">گزارش فعلاً در دسترس نیست.</p> : !report ? <p>در حال دریافت گزارش…</p> : report.status === "pending" ? <p>آزمون با اولین اجرای دریافت اخبار آغاز می‌شود.</p> : <>
        <p>شروع: <bdi>{report.start_date}</bdi> · پایان بازه (غیرشامل): <bdi>{report.end_date_exclusive}</bdi> · {report.status === "completed" ? "بازه پایان یافته" : "در حال بررسی"}</p>
        <p>روزهای ثبت‌شده برای این منبع: {result?.sampled_days || 0} از ۱۰ · روزهای خطای RSS: {result?.feed_error_days || 0}</p>
        {Object.entries(result?.status_counts || {}).map(([status, count]) => <p key={status}>{NEWS_ACCESS_LABELS[status] || status}: {count}</p>)}
        {result?.days?.map((day) => <div key={day.date} className="border-t pt-1">
          <p><bdi>{day.date}</bdi> · {day.feed_status === "error" ? "خطای RSS" : day.feed_status === "empty" ? "فید خالی" : "RSS دریافت شد"}</p>
          {day.samples.map((sample) => <a key={sample.item_id} href={sample.url} target="_blank" rel="noopener noreferrer" className="block text-primary hover:underline">{NEWS_ACCESS_LABELS[sample.status] || sample.status}{sample.http_status ? ` · HTTP ${sample.http_status}` : ""} · {sample.character_count} نویسه</a>)}
        </div>)}
      </>}
      <button type="button" className="text-primary hover:underline" onClick={() => setRefresh((value) => value + 1)}>به‌روزرسانی گزارش</button>
    </div>
  </details>
}
