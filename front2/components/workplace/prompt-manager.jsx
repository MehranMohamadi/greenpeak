"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { ArrowRight, Clock3, FilePenLine, RefreshCw, RotateCcw, Save } from "lucide-react"
import { endpoints } from "@/api/api"
import { useAuth } from "@/components/auth/auth-context"
import Layout from "@/components/kokonutui/layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { mergePromptCatalog } from "@/lib/prompt-editor.mjs"

const date = value => new Date(value).toLocaleString("fa-IR", { timeZone: "Asia/Tehran" })

export default function PromptManager() {
  const { isAdmin, accessToken, isLoading: authLoading } = useAuth()
  const [documents, setDocuments] = useState([])
  const [drafts, setDrafts] = useState({})
  const [selectedId, setSelectedId] = useState("market")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const [feedback, setFeedback] = useState(null)
  const saveController = useRef(null)
  const saveLock = useRef(false)
  const editorState = useRef({ documents, drafts })
  editorState.current = { documents, drafts }

  const accept = (data, savedId = null) => {
    // Keep each unsaved editor's original revision, so another admin's newer
    // revision cannot silently authorize overwriting their changes.
    const next = mergePromptCatalog(editorState.current, data.prompts, savedId)
    editorState.current = next
    setDocuments(next.documents)
    setDrafts(next.drafts)
  }

  useEffect(() => {
    if (authLoading) return
    if (!isAdmin || !accessToken) { setDocuments([]); setDrafts({}); setLoading(false); return }
    const controller = new AbortController()
    setLoading(true)
    setFeedback(null)
    fetch(endpoints.llmPrompts, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store", signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error(response.status === 403 ? "دسترسی مدیریت لازم است." : "دریافت پرامپت‌ها ممکن نشد.")
        const data = await response.json()
        if (!controller.signal.aborted) accept(data)
      })
      .catch(error => { if (!controller.signal.aborted) setFeedback({ ok: false, text: error.message }) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [isAdmin, accessToken, authLoading, refresh])

  useEffect(() => () => saveController.current?.abort(), [])

  const selected = documents.find(item => item.id === selectedId)
  const draft = drafts[selectedId] ?? ""
  const dirty = selected && draft !== selected.content
  const busy = saving || loading
  const edit = value => setDrafts(current => ({ ...current, [selectedId]: value }))
  const save = async () => {
    if (!selected || !dirty || !draft.trim() || !accessToken || !isAdmin || busy || saveLock.current) return
    saveLock.current = true
    const controller = new AbortController()
    saveController.current = controller
    setSaving(true)
    setFeedback(null)
    try {
      const response = await fetch(endpoints.llmPrompt(selected.id), {
        method: "PUT", cache: "no-store", signal: controller.signal,
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ content: draft, expected_revision: selected.revision }),
      })
      if (!response.ok) throw new Error(response.status === 409
        ? "این پرامپت هم‌زمان تغییر کرده است. متن ویرایش‌شدهٔ شما حفظ شد؛ برای دریافت نسخهٔ جدید، ویرایش را لغو و اطلاعات را تازه‌سازی کنید."
        : response.status === 422 ? "متن پرامپت باید غیرخالی و حداکثر ۱۰۰ هزار نویسه باشد." : "ذخیرهٔ پرامپت ممکن نشد.")
      const data = await response.json()
      if (!controller.signal.aborted) {
        accept(data, selected.id)
        setFeedback({ ok: true, text: "پرامپت ذخیره شد و از درخواست بعدی استفاده می‌شود؛ تحلیل‌های قبلی دوباره اجرا نمی‌شوند." })
      }
    } catch (error) {
      if (!controller.signal.aborted) setFeedback({ ok: false, text: error.message })
    } finally {
      saveLock.current = false
      if (!controller.signal.aborted) setSaving(false)
    }
  }

  if (authLoading) return <p role="status" className="p-6" dir="rtl">در حال بررسی دسترسی…</p>
  if (!isAdmin) return null
  return <Layout><div className="mx-auto max-w-[1440px] space-y-5 p-4 md:p-6" dir="rtl">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="flex items-center gap-2 text-2xl font-bold"><FilePenLine className="h-6 w-6 text-primary" />پرامپت‌های تحلیل</h1><p className="mt-2 text-sm text-muted-foreground">دستورهای فعال ارسالی به هوش مصنوعی را مشاهده و ویرایش کنید.</p></div>
      <Button asChild variant="outline"><Link href="/workplace?tab=tools"><ArrowRight className="me-2 h-4 w-4" />تنظیمات و ابزارها</Link></Button>
    </header>
    <p className="rounded-lg border bg-muted/30 p-4 text-sm leading-7 text-muted-foreground">این متن‌ها دستور تحلیل‌اند؛ داده‌های روز، سؤال کاربر و قالب پاسخ هنگام اجرا به آن‌ها افزوده می‌شوند. تغییر متن از درخواست بعدی اعمال می‌شود و نسخه‌های ذخیره‌شده برای پیگیری تغییرات نگه داشته می‌شوند. زمان‌های زیر مربوط به تولید خروجی تحلیل‌اند؛ متن پرامپت فقط با ذخیرهٔ مدیر تغییر می‌کند.</p>
    {feedback && <p role={feedback.ok ? "status" : "alert"} className={`text-sm ${feedback.ok ? "text-primary" : "text-destructive"}`}>{feedback.text}</p>}
    <div className="grid items-start gap-4 lg:grid-cols-[17rem_minmax(0,1fr)]">
      <nav aria-label="انواع پرامپت" className="space-y-2">
        <Button variant="outline" className="w-full" disabled={busy} onClick={() => setRefresh(value => value + 1)}><RefreshCw className={`me-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />تازه‌سازی</Button>
        {documents.map(item => <button key={item.id} type="button" disabled={busy} aria-pressed={selectedId === item.id} onClick={() => setSelectedId(item.id)}
          className={`w-full rounded-lg border p-3 text-right transition disabled:opacity-60 ${selectedId === item.id ? "border-primary/40 bg-primary/10" : "bg-card hover:bg-muted/50"}`}>
          <span className="flex items-center justify-between gap-2 text-sm font-medium">{item.title}{drafts[item.id] !== item.content && <span className="h-2 w-2 rounded-full bg-amber-500" title="ویرایش ذخیره‌نشده"><span className="sr-only">ویرایش ذخیره‌نشده</span></span>}</span>
          <span className="mt-1 block text-xs leading-5 text-muted-foreground">{item.description}</span>
          {item.update_schedule && <span className="mt-2 block border-t pt-2 text-xs leading-6 text-muted-foreground">
            <span className="block"><Clock3 aria-hidden="true" className="me-1 inline h-3.5 w-3.5" />پیش‌فرض: {item.update_schedule.default_summary_fa}</span>
            {item.update_schedule.configured_summary_fa !== item.update_schedule.default_summary_fa && <span className="block font-medium text-foreground">تنظیم فعلی: {item.update_schedule.configured_summary_fa}</span>}
          </span>}
        </button>)}
      </nav>
      {loading && !selected ? <p role="status" className="p-4 text-sm">در حال دریافت پرامپت‌ها…</p> : selected && <Card className="min-w-0">
        <CardHeader className="space-y-3">
          <CardTitle className="text-lg">{selected.title}</CardTitle>
          <CardDescription>{selected.description}</CardDescription>
          {selected.update_schedule && <div className="rounded-lg border bg-muted/30 p-3 text-sm leading-7">
            <p className="flex items-center gap-2 font-medium"><Clock3 aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" />زمان‌بندی به‌روزرسانی تحلیل</p>
            <dl className="mt-2 space-y-1 text-muted-foreground">
              <div><dt className="inline font-medium">پیش‌فرض: </dt><dd className="inline">{selected.update_schedule.default_summary_fa}</dd></div>
              {selected.update_schedule.configured_summary_fa !== selected.update_schedule.default_summary_fa && <div><dt className="inline font-medium text-foreground">تنظیم فعلی سرور: </dt><dd className="inline text-foreground">{selected.update_schedule.configured_summary_fa}</dd></div>}
              <div><dt className="sr-only">نحوهٔ اجرا</dt><dd>{selected.update_schedule.details_fa}</dd></div>
            </dl>
          </div>}
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><Badge variant="outline"><span dir="ltr">{selected.version}</span></Badge><Badge variant="secondary">{selected.customized ? "ویرایش مدیریتی" : "متن پیش‌فرض"}</Badge>{selected.updated_at && <span>آخرین ذخیره: {date(selected.updated_at)} تهران</span>}</div>
        </CardHeader>
        <CardContent className="space-y-4">
          <label htmlFor="prompt-content" className="block text-sm font-medium">متن قابل ویرایش</label>
          <Textarea id="prompt-content" dir="auto" value={draft} maxLength={100000} disabled={busy} onChange={event => edit(event.target.value)} spellCheck={false} className="min-h-[28rem] resize-y font-mono text-sm leading-7" />
          <div className="flex flex-wrap items-center gap-2">
            <Button disabled={busy || !dirty || !draft.trim()} onClick={save}><Save className="me-2 h-4 w-4" />{saving ? "در حال ذخیره…" : "ذخیره پرامپت"}</Button>
            <Button variant="outline" disabled={busy || !dirty} onClick={() => edit(selected.content)}>لغو ویرایش</Button>
            <Button variant="ghost" disabled={busy || draft === selected.default_content} onClick={() => edit(selected.default_content)}><RotateCcw className="me-2 h-4 w-4" />متن پیش‌فرض</Button>
          </div>
          <details className="rounded-lg border p-3"><summary className="cursor-pointer text-sm font-medium">متن کامل فعال ارسالی</summary><p className="my-3 text-xs leading-6 text-muted-foreground">برای تحلیل شاخص، گروه و بازار، دستور مشترک هم در این متن آمده است. پیش‌نمایش، متن فعال ذخیره‌شده را نشان می‌دهد.</p><Textarea readOnly aria-label="متن کامل فعال ارسالی" dir="auto" value={selected.effective_content} className="min-h-[24rem] font-mono text-xs leading-6" /></details>
        </CardContent>
      </Card>}
    </div>
  </div></Layout>
}
