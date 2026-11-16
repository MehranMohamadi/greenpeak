"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { endpoints } from "@/api/api"
import { useAuth } from "@/components/auth/auth-context"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import QualityReports from "@/components/workplace/quality-reports"
import QualitySources from "@/components/workplace/quality-sources"
import QualityExperiments from "@/components/workplace/quality-experiments"
import { dateLabel, stateLabel } from "@/components/workplace/quality-shared"

export default function AnalysisQuality() {
  const { isAdmin, accessToken } = useAuth()
  const [data, setData] = useState(null)
  const [notice, setNotice] = useState(null)
  const [busy, setBusy] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const lock = useRef(false)
  const api = useCallback(async (path = "", method = "GET", body) => {
    const response = await fetch(`${endpoints.analysisQuality}${path}`, {
      method, cache: "no-store", headers: { Authorization: `Bearer ${accessToken}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    const value = await response.json().catch(() => null)
    if (!response.ok) {
      const message = response.status === 409 ? "اطلاعات تغییر کرده یا مدل غیرفعال است؛ تازه‌سازی کنید."
        : response.status === 403 ? "دسترسی مدیریت لازم است."
          : response.status === 503 ? "دسترسی به مخزن اطلاعات برقرار نیست؛ دوباره تلاش کنید."
            : response.status === 502 ? "دریافت منبع ممکن نشد؛ می‌توانید متن را وارد کنید."
              : "عملیات انجام نشد؛ شرایط و ورودی‌ها را بررسی کنید."
      throw new Error(`${message}${typeof value?.detail === "string" ? ` ${value.detail}` : ""}`)
    }
    return value
  }, [accessToken])
  const reload = () => setRefresh(value => value + 1)
  const action = async (work, message = "ذخیره شد.") => {
    if (lock.current) return null
    lock.current = true; setBusy(true); setNotice(null)
    try { const result = await work(); setNotice({ ok: true, text: message }); reload(); return result }
    catch (error) { setNotice({ ok: false, text: error.message }); return null }
    finally { lock.current = false; setBusy(false) }
  }
  useEffect(() => {
    if (!isAdmin || !accessToken) { setData(null); return }
    let active = true
    api().then(value => { if (active) setData(value) }).catch(error => { if (active) setNotice({ ok: false, text: error.message }) })
    return () => { active = false }
  }, [api, isAdmin, accessToken, refresh])
  const pending = data && [...data.evaluations, ...data.critiques, ...data.suggestions].some(row => ["queued", "running"].includes(row.status))
  useEffect(() => {
    if (!pending) return
    const timer = setInterval(() => setRefresh(value => value + 1), 10000)
    return () => clearInterval(timer)
  }, [pending])
  if (!isAdmin) return null
  return <div className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-xl font-semibold">کیفیت و بهبود تحلیل‌ها</h2><p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">بازخورد، شواهد و نتیجهٔ سناریوها را ثبت کنید؛ نسخه‌های جدید را با ورودی ثابت مقایسه کنید. آزمون و منتقد با مدل‌های فعال اجرا می‌شوند، مصرف دارند و خروجی آن‌ها در سایت یا تلگرام منتشر نمی‌شود.</p></div>
      <Button variant="outline" disabled={busy} onClick={reload}>تازه‌سازی</Button>
    </div>
    {notice && <p role={notice.ok ? "status" : "alert"} className={`rounded-lg p-3 text-sm leading-7 ${notice.ok ? "bg-emerald-500/10" : "bg-amber-500/10"}`}>{notice.text}</p>}
    {!data ? <p role="status" className="text-sm text-muted-foreground">در حال دریافت اطلاعات…</p> : <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[["گزارش ذخیره‌شده", data.counts.report || 0], ["بازخورد", data.counts.feedback || 0], ["نمونهٔ توسعه / آزمون مستقل", `${data.counts.development} / ${data.counts.holdout}`], ["فرضیهٔ سررسیدشده", data.counts.overdue_hypotheses]].map(([label, value]) => <div key={label} className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-xl font-semibold">{value}</p></div>)}</div>
      <details className="rounded-xl border border-border p-4"><summary className="cursor-pointer text-sm">میانگین بازخورد و مصرف مدل‌ها</summary><div className="mt-3 space-y-3 text-xs leading-7"><p>میانگین امتیاز مدیر از ۵؛ این امتیاز معیار سودآوری یا دقت پیش‌بینی نیست.</p><div className="flex flex-wrap gap-4">{Object.entries({ accuracy: "صحت", evidence: "شواهد", clarity: "وضوح", uncertainty: "عدم قطعیت", usefulness: "فایده" }).map(([key, label]) => <span key={key}>{label}: {data.metrics[key] == null ? "—" : data.metrics[key].toFixed(1)}</span>)}</div>{data.models.map(model => <p key={model.id}>{model.model} · {model.enabled ? "فعال" : "غیرفعال"} · درخواست امروز: {model.requests} · ناموفق: {model.failed_requests} · توکن گزارش‌شده: {model.total_tokens ?? "نامشخص"}</p>)}<p className="text-muted-foreground">مصرف، مجموع درخواست‌های ثبت‌شدهٔ امروز به وقت UTC است؛ جزئیات ورودی، خروجی و مصرف نامشخص در مدیریت مدل‌ها دیده می‌شود.</p></div></details>
      {pending && <section className="space-y-2 rounded-xl border border-border p-4"><h3 className="text-sm font-medium">عملیات فعال</h3><p className="text-xs leading-6 text-muted-foreground">لغو، درخواست جاری مدل را پس نمی‌گیرد؛ ادامهٔ آزمون و ثبت نتیجه متوقف می‌شود. اجرای متوقف‌شده در راه‌اندازی مجدد را می‌توانید لغو و سپس دوباره آغاز کنید.</p>{[["evaluation", data.evaluations], ["critique", data.critiques], ["suggestion", data.suggestions]].flatMap(([kind, rows]) => rows.filter(row => ["queued", "running"].includes(row.status)).map(row => <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 text-xs"><span>{kind === "evaluation" ? "آزمون" : kind === "critique" ? "منتقد" : "پیشنهاد پرامپت"} · {stateLabel(row.status)} · {dateLabel(row.created_at)}</span><Button size="sm" variant="outline" disabled={busy} onClick={() => action(() => api(`/jobs/${kind}/${row.id}/cancel`, "POST"), "ادامهٔ عملیات لغو شد.")}>لغو ادامه</Button></div>))}</section>}
      <Tabs defaultValue="reports" dir="rtl" className="space-y-4">
        <TabsList className="h-auto flex-wrap justify-start"><TabsTrigger value="reports">گزارش‌ها و بازخورد</TabsTrigger><TabsTrigger value="hypotheses">فرضیه‌ها و نتیجه‌ها</TabsTrigger><TabsTrigger value="sources">منابع پژوهش</TabsTrigger><TabsTrigger value="experiments">آزمون و مقایسه</TabsTrigger><TabsTrigger value="prompts">بهبود پرامپت</TabsTrigger></TabsList>
        <TabsContent value="reports"><QualityReports data={data} api={api} action={action} busy={busy} /></TabsContent>
        <TabsContent value="hypotheses"><QualityReports hypothesesOnly data={data} api={api} action={action} busy={busy} /></TabsContent>
        <TabsContent value="sources"><QualitySources data={data} api={api} action={action} busy={busy} /></TabsContent>
        <TabsContent value="experiments"><QualityExperiments data={data} api={api} action={action} busy={busy} /></TabsContent>
        <TabsContent value="prompts"><QualityExperiments promptsOnly data={data} api={api} action={action} busy={busy} /></TabsContent>
      </Tabs>
      <p className="text-xs leading-6 text-muted-foreground">گزارش‌های جدید همراه ورودی اصلی ثبت می‌شوند. گزارش‌های قدیمی بدون ورودی اصلی فقط قابل بازبینی انسانی‌اند. کنترل مدل‌ها در <Link className="text-primary underline" href="/workplace?tab=llm">مدل‌های هوش مصنوعی</Link> و متن فعال دستورها در <Link className="text-primary underline" href="/admin/prompts">مدیریت پرامپت‌ها</Link> در دسترس است.</p>
    </>}
  </div>
}
