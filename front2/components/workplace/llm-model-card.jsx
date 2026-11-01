"use client"

import { ArrowDown, ArrowUp, PlugZap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const number = value => value == null ? "نامشخص" : new Intl.NumberFormat("fa-IR").format(value)
export const llmDate = value => new Date(value).toLocaleString("fa-IR", { timeZone: "Asia/Tehran" })
const testErrors = {
  timeout: "مهلت پاسخ مدل تمام شد.", access_denied: "کلید یا دسترسی به مدل رد شد.",
  quota_exhausted: "اعتبار سرویس کافی نیست.", rate_limited: "محدودیت تعداد درخواست یا سهمیه فعال است.",
  provider_unavailable: "سرویس مدل در دسترس نیست.", connection_failed: "ارتباط با سرویس برقرار نشد.",
  invalid_response: "ارتباط برقرار شد، اما پاسخ JSON معتبر برای تست دریافت نشد.",
}

function Metric({ label, value }) {
  return <div className="rounded-md bg-muted/50 p-3"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-2 font-semibold tabular-nums">{number(value)}</dd></div>
}

export default function LLMModelCard({ row, index, total, saving, testingId, result, onTest, onMove, onBudgetChange }) {
  return <Card>
    <CardHeader>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-2"><CardTitle className="flex items-center gap-2 text-base"><Badge variant="outline">اولویت {number(index + 1)}</Badge><span dir="ltr">{row.provider}</span></CardTitle><CardDescription className="break-all" dir="ltr">{row.model}</CardDescription></div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={saving || Boolean(testingId)} aria-label={`تست اتصال ${row.provider} ${row.model}`} onClick={() => onTest(row)}><PlugZap className="me-2 h-4 w-4" />{testingId === row.id ? "در حال تست…" : "تست اتصال"}</Button>
          <Button size="icon" variant="outline" disabled={saving || index === 0} aria-label={`بالا بردن اولویت ${row.provider} ${row.model}`} onClick={() => onMove(index, -1)}><ArrowUp className="h-4 w-4" /></Button>
          <Button size="icon" variant="outline" disabled={saving || index === total - 1} aria-label={`پایین بردن اولویت ${row.provider} ${row.model}`} onClick={() => onMove(index, 1)}><ArrowDown className="h-4 w-4" /></Button>
        </div>
      </div>
    </CardHeader>
    <CardContent className="space-y-4">
      {result && <div role="status" className={`rounded-md border p-3 text-sm ${result.status === "succeeded" ? "text-primary" : "text-destructive"}`}>
        <p>{result.status === "succeeded" ? "اتصال برقرار است و پاسخ معتبر دریافت شد." : result.message || testErrors[result.error_code] || "تست ناموفق بود."}</p>
        {result.elapsed_ms != null && <p className="mt-1 text-xs">زمان پاسخ: {number(result.elapsed_ms)} میلی‌ثانیه{result.http_status != null && <span dir="ltr"> · HTTP {result.http_status}</span>}</p>}
        {result.testedAt && <p className="mt-1 text-xs text-muted-foreground">آخرین تست: {llmDate(result.testedAt)} تهران</p>}
      </div>}
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Metric label="درخواست‌های امروز" value={row.requests} /><Metric label="خطاهای اتصال یا HTTP" value={row.failed_requests} />
        <Metric label="توکن مصرف‌شدهٔ ثبت‌شده" value={row.total_tokens} /><Metric label="توکن ورودی ثبت‌شده" value={row.input_tokens} /><Metric label="توکن خروجی ثبت‌شده" value={row.output_tokens} />
        <Metric label="توکن باقی‌ماندهٔ روزانه (تخمینی)" value={row.estimated_remaining_tokens} />
      </dl>
      {row.unmetered_requests > 0 && <p className="text-xs text-amber-600 dark:text-amber-400">برای {number(row.unmetered_requests)} درخواست، تعداد توکن اعلام نشده؛ مصرف واقعی می‌تواند بیشتر باشد.</p>}
      <label className="block max-w-sm space-y-2 text-sm"><span>سقف توکن برای روز UTC (اختیاری)</span><Input type="number" dir="ltr" min="1" max="1000000000000" step="1" inputMode="numeric" placeholder="نامشخص" value={row.budget} disabled={saving} onChange={event => onBudgetChange(row.id, event.target.value)} /></label>
      {row.reported_quota && <div className="space-y-2 border-t pt-3 text-xs text-muted-foreground">
        <p>آخرین سهمیهٔ اعلام‌شده توسط Groq در {llmDate(row.reported_quota.observed_at)} تهران؛ این اعداد لحظهٔ آخرین پاسخ‌اند و ممکن است تغییر کرده باشند.</p>
        <p>توکن باقی‌مانده در دقیقه: {number(row.reported_quota.remaining_tokens)} از {number(row.reported_quota.limit_tokens)}؛ درخواست باقی‌مانده در روز: {number(row.reported_quota.remaining_requests)} از {number(row.reported_quota.limit_requests)}</p>
      </div>}
    </CardContent>
  </Card>
}
