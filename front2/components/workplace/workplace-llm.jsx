"use client"

import { useEffect, useRef, useState } from "react"
import { RefreshCw } from "lucide-react"
import { endpoints } from "@/api/api"
import { useAuth } from "@/components/auth/auth-context"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import LLMModelCard, { llmDate } from "@/components/workplace/llm-model-card"

const number = value => value == null ? "نامشخص" : new Intl.NumberFormat("fa-IR").format(value)
const preferences = rows => rows.map(row => ({ id: row.id, daily_token_limit: row.budget === "" ? null : Number(row.budget), enabled: row.enabled !== false }))

const providerAccents = {
  groq: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  cloudflare: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  gemini: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
}

function RemainingTokens({ row }) {
  const known = Number.isFinite(row.estimated_remaining_tokens) && Number.isFinite(row.daily_token_limit) && row.daily_token_limit > 0
  const percentage = known ? Math.min(100, Math.max(0, row.estimated_remaining_tokens / row.daily_token_limit * 100)) : null
  return <div className="min-w-0 space-y-2">
    <div className="flex items-center justify-between gap-2 text-[11px]">
      <span className="text-muted-foreground">باقی‌ماندهٔ تخمینی</span>
      <span className="font-medium tabular-nums">{known ? `${number(Math.round(percentage))}٪` : "نامشخص"}</span>
    </div>
    {known ? <Progress dir="ltr" value={percentage} aria-label={`توکن باقی‌ماندهٔ ${row.provider}`} aria-valuetext={`${number(row.estimated_remaining_tokens)} توکن، ${number(Math.round(percentage))} درصد باقی‌مانده`} className={`h-1.5 bg-muted ${percentage <= 20 ? "[&>div]:bg-rose-500" : percentage <= 50 ? "[&>div]:bg-amber-500" : "[&>div]:bg-emerald-500"}`} />
      : <div aria-hidden="true" className="h-1.5 rounded-full border border-dashed border-muted-foreground/25 bg-muted/60" />}
    <p className="truncate text-[10px] text-muted-foreground tabular-nums">{known ? `${number(row.estimated_remaining_tokens)} از ${number(row.daily_token_limit)} توکن` : row.daily_token_limit == null ? "سقف روزانه را در جزئیات ثبت کنید" : "مصرف کامل گزارش نشده است"}</p>
  </div>
}

export default function WorkplaceLLM() {
  const { isAdmin, accessToken } = useAuth()
  const [report, setReport] = useState(null)
  const [draft, setDraft] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [togglingId, setTogglingId] = useState(null)
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
    if (!isAdmin || !accessToken || row.enabled === false || loading || testLock.current || saveLock.current) return
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

  const toggleModel = async row => {
    if (!isAdmin || !accessToken || !report || loading || saveLock.current || testLock.current) return
    saveLock.current = true
    setSaving(true)
    setTogglingId(row.id)
    setFeedback(null)
    const controller = new AbortController()
    saveController.current = controller
    const enabled = row.enabled === false
    try {
      // Change only the saved enabled flag. Keep pending priority/budget edits
      // in the draft until the administrator explicitly saves those changes.
      const response = await fetch(endpoints.llmAdmin, {
        method: "PUT", cache: "no-store", signal: controller.signal,
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ expected_revision: report.revision, models: report.models.map(model => ({
          id: model.id, daily_token_limit: model.daily_token_limit,
          enabled: model.id === row.id ? enabled : model.enabled !== false,
        })) }),
      })
      if (!response.ok) throw new Error(response.status === 409 ? "تنظیمات هم‌زمان تغییر کرده؛ تازه‌سازی کنید و دوباره تلاش کنید." : "تغییر وضعیت مدل ممکن نشد.")
      const data = await response.json()
      if (!controller.signal.aborted) {
        setReport(data)
        setDraft(current => current.map(item => ({ ...item, ...data.models.find(model => model.id === item.id), budget: item.budget })))
        setFeedback({ ok: true, text: `مدل ${row.model} ${enabled ? "فعال" : "غیرفعال"} شد؛ این وضعیت از درخواست بعدی اعمال می‌شود.` })
      }
    } catch (error) {
      if (!controller.signal.aborted) setFeedback({ ok: false, text: error.message })
    } finally {
      saveLock.current = false
      if (!controller.signal.aborted) { setSaving(false); setTogglingId(null) }
    }
  }

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
      if (!controller.signal.aborted) { accept(data); setFeedback({ ok: true, text: "تنظیمات ذخیره شد؛ اولویت جدید از درخواست بعدی اعمال می‌شود." }) }
    } catch (error) {
      if (!controller.signal.aborted) setFeedback({ ok: false, text: error.message })
    } finally {
      saveLock.current = false
      if (!controller.signal.aborted) setSaving(false)
    }
  }

  if (!isAdmin) return null
  const dirty = report && JSON.stringify(preferences(draft)) !== JSON.stringify(report.models.map(row => ({ id: row.id, daily_token_limit: row.daily_token_limit, enabled: row.enabled !== false })))
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
        <p>بازه مصرف امروز بر اساس UTC است: <span dir="ltr">{report.day}</span>. ثبت مصرف از {llmDate(report.tracking_since)} به وقت تهران شروع شده است.</p>
        <p>فقط مصرف ثبت‌شده در GreenPeak نمایش داده می‌شود؛ مصرف گذشته و برنامه‌های دیگر در این اعداد نیست. هر پیام چت معمولاً دو درخواست مدل دارد.</p>
        <p>برای محاسبهٔ باقی‌ماندهٔ تخمینی در روز UTC، سقف توکن را وارد کنید. این سقف فقط برای نمایش است و سهمیهٔ سرویس را تغییر نمی‌دهد. سهمیه‌های نامعلوم به‌صورت «نامشخص» نمایش داده می‌شوند.</p>
        <p>تست اتصال یک درخواست کوتاه فقط به مدل انتخابی می‌فرستد؛ مدل جایگزین امتحان نمی‌شود و مصرف تست در همین آمار ثبت می‌شود.</p>
        <p>دکمهٔ فعال‌سازی یا غیرفعال‌سازی بلافاصله ذخیره می‌شود؛ مدل غیرفعال در درخواست‌های جدید استفاده نمی‌شود. تغییر اولویت و سقف توکن با «ذخیره تغییرات» اعمال می‌شود.</p>
      </div>
      {!draft.length && <p className="text-sm text-muted-foreground">مدلی در تنظیمات سرور فعال نیست.</p>}
      {draft.length > 0 && draft.every(row => row.enabled === false) && <p role="status" className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">همهٔ مدل‌ها غیرفعال‌اند؛ برای تولید تحلیل یا پاسخ چت، حداقل یک مدل را فعال کنید.</p>}
      {draft.map((row, index) => <LLMModelCard key={row.id} row={row} index={index} total={draft.length}
        saving={saving} togglingId={togglingId} testingId={testingId} result={testResults[row.id]} onTest={testConnection} onToggle={toggleModel} onMove={move}
        onBudgetChange={(id, value) => setDraft(rows => rows.map(item => item.id === id ? { ...item, budget: value } : item))} />)}
    </>}
  </section>
}
