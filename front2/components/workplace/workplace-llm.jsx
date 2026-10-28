"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowDown, ArrowUp, RefreshCw, PlugZap } from "lucide-react"
import { endpoints } from "@/api/api"
import { useAuth } from "@/components/auth/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const number = value => value == null ? "نامشخص" : new Intl.NumberFormat("fa-IR").format(value)
const date = value => new Date(value).toLocaleString("fa-IR", { timeZone: "Asia/Tehran" })
const preferences = rows => rows.map(row => ({ id: row.id, daily_token_limit: row.budget === "" ? null : Number(row.budget) }))
const testErrors = {
  timeout: "مهلت پاسخ مدل تمام شد.", access_denied: "کلید یا دسترسی به مدل رد شد.",
  quota_exhausted: "اعتبار سرویس کافی نیست.", rate_limited: "محدودیت تعداد درخواست یا سهمیه فعال است.",
  provider_unavailable: "سرویس مدل در دسترس نیست.", connection_failed: "ارتباط با سرویس برقرار نشد.",
  invalid_response: "ارتباط برقرار شد، اما پاسخ JSON معتبر برای تست دریافت نشد.",
}

function Metric({ label, value }) {
  return <div className="rounded-md bg-muted/50 p-3"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-2 font-semibold tabular-nums">{number(value)}</dd></div>
}

export default function WorkplaceLLM() {
  const { isAdmin, accessToken } = useAuth()
  const [report, setReport] = useState(null)
  const [draft, setDraft] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [revision, setRevision] = useState(0)
  const [feedback, setFeedback] = useState(null)
  const saveLock = useRef(false)
  const saveController = useRef(null)
  const [testingId, setTestingId] = useState(null)
  const [testResults, setTestResults] = useState({})
  const testLock = useRef(false)
  const testController = useRef(null)

  const accept = data => {
    setReport(data)
    setDraft(data.models.map(row => ({ ...row, budget: row.daily_token_limit == null ? "" : String(row.daily_token_limit) })))
  }

  useEffect(() => {
    if (!isAdmin || !accessToken) { setReport(null); setDraft([]); return }
    const controller = new AbortController()
    setLoading(true)
    setFeedback(null)
    fetch(endpoints.llmAdmin, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store", signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error(response.status === 403 ? "دسترسی مدیریت لازم است." : "دریافت وضعیت مدل‌ها ممکن نشد.")
        const data = await response.json()
        if (!controller.signal.aborted) accept(data)
      })
      .catch(error => { if (!controller.signal.aborted) { setReport(null); setDraft([]); setFeedback({ ok: false, text: error.message }) } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [isAdmin, accessToken, revision])

  useEffect(() => () => { saveController.current?.abort(); testController.current?.abort() }, [])

  const testConnection = async row => {
    if (!isAdmin || !accessToken || loading || testLock.current || saveLock.current) return
    testLock.current = true
    setTestingId(row.id)
    const controller = new AbortController()
    testController.current = controller
    try {
      const response = await fetch(endpoints.llmConnectionTest(row.id), {
        method: "POST", cache: "no-store", signal: controller.signal,
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!response.ok) throw new Error(response.status === 403 ? "دسترسی مدیریت لازم است." : response.status === 404 ? "این مدل دیگر در تنظیمات سرور موجود نیست؛ تازه‌سازی کنید." : "اجرای تست اتصال ممکن نشد.")
      const result = await response.json()
      if (controller.signal.aborted) return
      setTestResults(current => ({ ...current, [row.id]: { ...result, testedAt: new Date().toISOString() } }))
      // Refresh usage without discarding unsaved order/budget edits or accepting
      // another admin's configuration revision on behalf of an old draft.
      try {
        const usageResponse = await fetch(endpoints.llmAdmin, {
          headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store", signal: controller.signal,
        })
        if (!usageResponse.ok) throw new Error("usage_refresh_failed")
        const data = await usageResponse.json()
        if (!controller.signal.aborted && data.revision === report.revision) {
          setReport(data)
          setDraft(current => current.map(item => ({ ...item, ...data.models.find(model => model.id === item.id), budget: item.budget })))
        }
      } catch {
        if (!controller.signal.aborted) setFeedback({ ok: false, text: "نتیجهٔ تست ثبت شد؛ برای آمار مصرف جدید، تازه‌سازی کنید." })
      }
    } catch (error) {
      if (!controller.signal.aborted) setTestResults(current => ({ ...current, [row.id]: { status: "failed", message: error.message } }))
    } finally {
      testLock.current = false
      if (!controller.signal.aborted) setTestingId(null)
    }
  }

  const move = (index, direction) => setDraft(rows => {
    const next = [...rows]
    const other = index + direction
    if (other < 0 || other >= next.length) return rows
    ;[next[index], next[other]] = [next[other], next[index]]
    return next
  })

  const save = async () => {
    if (!isAdmin || !accessToken || !report || saveLock.current || testLock.current) return
    if (draft.some(row => row.budget !== "" && (!/^\d+$/.test(row.budget) || !Number.isSafeInteger(Number(row.budget)) || Number(row.budget) < 1 || Number(row.budget) > 1e12))) {
      setFeedback({ ok: false, text: "سقف روزانه باید عدد صحیح مثبت باشد؛ برای سهمیه نامشخص، فیلد را خالی بگذارید." })
      return
    }
    saveLock.current = true
    setSaving(true)
    setFeedback(null)
    const controller = new AbortController()
    saveController.current = controller
    try {
      const response = await fetch(endpoints.llmAdmin, {
        method: "PUT", cache: "no-store", signal: controller.signal,
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ expected_revision: report.revision, models: preferences(draft) }),
      })
      if (!response.ok) throw new Error(response.status === 409 ? "تنظیمات هم‌زمان تغییر کرده؛ تازه‌سازی کنید و دوباره ترتیب را انتخاب کنید." : "ذخیره تنظیمات مدل‌ها ممکن نشد.")
      const data = await response.json()
      if (!controller.signal.aborted) { accept(data); setFeedback({ ok: true, text: "تنظیمات ذخیره شد؛ ترتیب جدید از درخواست بعدی اعمال می‌شود." }) }
    } catch (error) {
      if (!controller.signal.aborted) setFeedback({ ok: false, text: error.message })
    } finally {
      saveLock.current = false
      if (!controller.signal.aborted) setSaving(false)
    }
  }

  if (!isAdmin) return null
  const dirty = report && JSON.stringify(preferences(draft)) !== JSON.stringify(report.models.map(row => ({ id: row.id, daily_token_limit: row.daily_token_limit })))
  return <section className="space-y-4" aria-label="مدیریت مدل‌های هوش مصنوعی">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-xl font-semibold">مدل‌های هوش مصنوعی</h2><p className="mt-1 text-sm text-muted-foreground">مصرف درخواست‌ها و ترتیب جایگزینی مدل‌ها</p></div>
      <div className="flex gap-2">
        {dirty && <Button size="sm" variant="ghost" disabled={saving} onClick={() => { accept(report); setFeedback(null) }}>لغو تغییرات</Button>}
        <Button size="sm" variant="outline" disabled={loading || saving || Boolean(testingId) || Boolean(dirty)} onClick={() => setRevision(value => value + 1)}><RefreshCw className="me-2 h-4 w-4" />تازه‌سازی</Button>
        <Button size="sm" disabled={loading || saving || Boolean(testingId) || !dirty} onClick={save}>{saving ? "در حال ذخیره…" : "ذخیره تغییرات"}</Button>
      </div>
    </div>
    {feedback && <p role={feedback.ok ? "status" : "alert"} className={`text-sm ${feedback.ok ? "text-primary" : "text-destructive"}`}>{feedback.text}</p>}
    {loading ? <p role="status" className="text-sm text-muted-foreground">در حال دریافت وضعیت…</p> : report && <>
      <div className="space-y-2 rounded-lg border p-4 text-sm text-muted-foreground">
        <p>بازه مصرف امروز بر اساس UTC است: <span dir="ltr">{report.day}</span>. ثبت مصرف از {date(report.tracking_since)} به وقت تهران شروع شده است.</p>
        <p>فقط مصرف ثبت‌شده در GreenPeak نمایش داده می‌شود؛ مصرف گذشته و برنامه‌های دیگر در این اعداد نیست. هر پیام چت معمولاً دو درخواست مدل دارد.</p>
        <p>برای محاسبهٔ باقی‌ماندهٔ تخمینی در روز UTC، سقف توکن را وارد کنید. این سقف فقط برای نمایش است و سهمیهٔ سرویس را تغییر نمی‌دهد. سهمیه‌های نامعلوم به‌صورت «نامشخص» نمایش داده می‌شوند.</p>
        <p>تست اتصال یک درخواست کوتاه فقط به مدل انتخابی می‌فرستد؛ مدل جایگزین امتحان نمی‌شود و مصرف تست در همین آمار ثبت می‌شود.</p>
      </div>
      {!draft.length && <p className="text-sm text-muted-foreground">مدلی در تنظیمات سرور فعال نیست.</p>}
      {draft.map((row, index) => <Card key={row.id}>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-2"><CardTitle className="flex items-center gap-2 text-base"><Badge variant="outline">اولویت {number(index + 1)}</Badge><span dir="ltr">{row.provider}</span></CardTitle><CardDescription className="break-all" dir="ltr">{row.model}</CardDescription></div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={saving || Boolean(testingId)} aria-label={`تست اتصال ${row.provider} ${row.model}`} onClick={() => testConnection(row)}><PlugZap className="me-2 h-4 w-4" />{testingId === row.id ? "در حال تست…" : "تست اتصال"}</Button>
              <Button size="icon" variant="outline" disabled={saving || index === 0} aria-label={`بالا بردن اولویت ${row.provider} ${row.model}`} onClick={() => move(index, -1)}><ArrowUp className="h-4 w-4" /></Button>
              <Button size="icon" variant="outline" disabled={saving || index === draft.length - 1} aria-label={`پایین بردن اولویت ${row.provider} ${row.model}`} onClick={() => move(index, 1)}><ArrowDown className="h-4 w-4" /></Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {testResults[row.id] && <div role="status" className={`rounded-md border p-3 text-sm ${testResults[row.id].status === "succeeded" ? "text-primary" : "text-destructive"}`}>
            <p>{testResults[row.id].status === "succeeded" ? "اتصال برقرار است و پاسخ معتبر دریافت شد." : testResults[row.id].message || testErrors[testResults[row.id].error_code] || "تست ناموفق بود."}</p>
            {testResults[row.id].elapsed_ms != null && <p className="mt-1 text-xs">زمان پاسخ: {number(testResults[row.id].elapsed_ms)} میلی‌ثانیه{testResults[row.id].http_status != null && <span dir="ltr"> · HTTP {testResults[row.id].http_status}</span>}</p>}
            {testResults[row.id].testedAt && <p className="mt-1 text-xs text-muted-foreground">آخرین تست: {date(testResults[row.id].testedAt)} تهران</p>}
          </div>}
          <dl className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Metric label="درخواست‌های امروز" value={row.requests} /><Metric label="خطاهای اتصال یا HTTP" value={row.failed_requests} />
            <Metric label="توکن مصرف‌شدهٔ ثبت‌شده" value={row.total_tokens} /><Metric label="توکن ورودی ثبت‌شده" value={row.input_tokens} /><Metric label="توکن خروجی ثبت‌شده" value={row.output_tokens} />
            <Metric label="توکن باقی‌ماندهٔ روزانه (تخمینی)" value={row.estimated_remaining_tokens} />
          </dl>
          {row.unmetered_requests > 0 && <p className="text-xs text-amber-600 dark:text-amber-400">برای {number(row.unmetered_requests)} درخواست، تعداد توکن اعلام نشده؛ مصرف واقعی می‌تواند بیشتر باشد.</p>}
          <label className="block max-w-sm space-y-2 text-sm"><span>سقف توکن برای روز UTC (اختیاری)</span><Input type="number" dir="ltr" min="1" max="1000000000000" step="1" inputMode="numeric" placeholder="نامشخص" value={row.budget} disabled={saving} onChange={event => setDraft(rows => rows.map(item => item.id === row.id ? { ...item, budget: event.target.value } : item))} /></label>
          {row.reported_quota && <div className="space-y-2 border-t pt-3 text-xs text-muted-foreground">
            <p>آخرین سهمیهٔ اعلام‌شده توسط Groq در {date(row.reported_quota.observed_at)} تهران؛ این اعداد لحظهٔ آخرین پاسخ‌اند و ممکن است تغییر کرده باشند.</p>
            <p>توکن باقی‌مانده در دقیقه: {number(row.reported_quota.remaining_tokens)} از {number(row.reported_quota.limit_tokens)}؛ درخواست باقی‌مانده در روز: {number(row.reported_quota.remaining_requests)} از {number(row.reported_quota.limit_requests)}</p>
          </div>}
        </CardContent>
      </Card>)}
    </>}
  </section>
}
