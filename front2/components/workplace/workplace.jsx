"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { BriefcaseBusiness, RefreshCw } from "lucide-react"
import Layout from "@/components/kokonutui/layout"
import { useAuth } from "@/components/auth/auth-context"
import { endpoints } from "@/api/api"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { editableInstant, formatDate, formatDuration, formatInstant, monthRange, parseTehranInstant, persianDateParts, persianMonths } from "@/lib/workplace-time.mjs"

const statusLabels = { pending: "در انتظار بررسی", approved: "تأیید شده", rejected: "رد شده" }
const auditLabels = { clock_in: "ثبت ورود", clock_out: "ثبت خروج", activities_updated: "ویرایش کارهای انجام‌شده", correction_requested: "درخواست اصلاح", admin_time_correction: "اصلاح ساعت توسط مدیر", admin_session_created: "افزودن بازه توسط مدیر", correction_approved: "تأیید اصلاح", correction_rejected: "رد اصلاح" }
const roleLabels = { user: "کاربر", staff: "کارمند", admin: "مدیر" }
const selectClass = "h-10 min-w-0 rounded-md border border-input bg-background px-3 text-sm"

async function request(url, token, options = {}) {
  const response = await fetch(url, { ...options, cache: "no-store", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(response.status === 401 ? "نشست شما منقضی شده است؛ دوباره وارد شوید." : response.status === 403 ? "دسترسی لازم برای این بخش را ندارید." : typeof body.detail === "string" ? body.detail : "اطلاعات معتبر نیست یا ارتباط با سرور برقرار نشد؛ دوباره بررسی کنید.")
  return body
}

function MonthPicker({ month, setMonth, disabled }) {
  const [yearText, setYearText] = useState(String(month.year))
  useEffect(() => setYearText(String(month.year)), [month.year])
  const commitYear = () => {
    const year = Number(yearText)
    if (Number.isInteger(year) && year >= 1201 && year <= 1598) setMonth({ ...month, year })
    else setYearText(String(month.year))
  }
  const move = amount => {
    const index = month.year * 12 + month.month - 1 + amount
    setMonth({ year: Math.floor(index / 12), month: index % 12 + 1 })
  }
  return <div className="flex flex-wrap items-center gap-2">
    <Button variant="outline" size="sm" disabled={disabled || month.year <= 1201} onClick={() => move(-1)}>ماه قبل</Button>
    <select aria-label="ماه گزارش" className={selectClass} value={month.month} disabled={disabled} onChange={event => setMonth({ ...month, month: Number(event.target.value) })}>{persianMonths.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}</select>
    <Input aria-label="سال شمسی گزارش" className="w-24" type="number" min={1201} max={1598} value={yearText} disabled={disabled} onChange={event => setYearText(event.target.value)} onBlur={commitYear} onKeyDown={event => { if (event.key === "Enter") commitYear() }} />
    <Button variant="outline" size="sm" disabled={disabled || month.year >= 1598} onClick={() => move(1)}>ماه بعد</Button>
  </div>
}

function TimeForm({ session, admin, busy, onSave, onCancel }) {
  const [baseRevision] = useState(session?.revision)
  const [entry, setEntry] = useState(() => editableInstant(session?.check_in))
  const [exit, setExit] = useState(() => editableInstant(session?.check_out))
  const [open, setOpen] = useState(Boolean(session && !session.check_out))
  const [reason, setReason] = useState("")
  const [activities, setActivities] = useState("")
  const [error, setError] = useState("")
  const stale = session && session.revision !== baseRevision
  const submit = async event => {
    event.preventDefault()
    setError("")
    try {
      const body = { check_in: parseTehranInstant(entry.date, entry.time), check_out: open ? null : parseTehranInstant(exit.date, exit.time), reason: reason.trim(), ...(session ? { revision: baseRevision } : { activities }) }
      if (await onSave(body)) onCancel()
    } catch (failure) { setError(failure.message) }
  }
  return <form onSubmit={submit} className="space-y-4 rounded-lg border bg-muted/20 p-4">
    <p className="text-sm font-medium">{session ? admin ? "اصلاح ساعت توسط مدیر" : "درخواست اصلاح ساعت" : "افزودن بازه فراموش‌شده"}</p>
    <p className="text-xs text-muted-foreground">تاریخ‌ها شمسی و ساعت‌ها به وقت تهران هستند.</p>
    <div className="grid gap-4 sm:grid-cols-2">
      <fieldset className="space-y-2"><legend className="text-sm">ورود</legend><Input aria-label="تاریخ شمسی ورود" dir="ltr" placeholder="1405/08/03" value={entry.date} onChange={event => setEntry({ ...entry, date: event.target.value })} required disabled={busy} /><Input aria-label="ساعت ورود به وقت تهران" dir="ltr" placeholder="09:30" value={entry.time} onChange={event => setEntry({ ...entry, time: event.target.value })} required disabled={busy} /></fieldset>
      <fieldset className="space-y-2"><legend className="text-sm">خروج</legend><Input aria-label="تاریخ شمسی خروج" dir="ltr" placeholder="1405/08/03" value={exit.date} onChange={event => setExit({ ...exit, date: event.target.value })} required={!open} disabled={busy || open} /><Input aria-label="ساعت خروج به وقت تهران" dir="ltr" placeholder="17:30" value={exit.time} onChange={event => setExit({ ...exit, time: event.target.value })} required={!open} disabled={busy || open} /></fieldset>
    </div>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={open} disabled={busy} onChange={event => setOpen(event.target.checked)} />بازه باز است و هنوز خروج ندارد</label>
    <label className="block space-y-2 text-sm"><span>دلیل اصلاح (الزامی)</span><Textarea value={reason} minLength={3} maxLength={2000} required disabled={busy} onChange={event => setReason(event.target.value)} /></label>
    {!session && <label className="block space-y-2 text-sm"><span>کارهای انجام‌شده</span><Textarea value={activities} maxLength={10000} disabled={busy} onChange={event => setActivities(event.target.value)} /></label>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {stale && <p role="alert" className="text-sm text-destructive">اطلاعات این بازه تغییر کرده است؛ فرم را ببندید و دوباره باز کنید.</p>}
    <div className="flex flex-wrap gap-2"><Button disabled={busy || stale || reason.trim().length < 3} type="submit">{admin ? "ذخیره اصلاح" : "ارسال درخواست"}</Button><Button type="button" variant="outline" disabled={busy} onClick={onCancel}>انصراف</Button></div>
  </form>
}

function SessionCard({ session, editable, admin, busy, perform, current = false }) {
  const [draft, setDraft] = useState({ text: session.activities, revision: session.revision, dirty: false })
  useEffect(() => {
    setDraft(value => value.dirty ? value : { text: session.activities, revision: session.revision, dirty: false })
  }, [session.activities, session.revision])
  const activities = draft.text
  const stale = draft.revision !== session.revision
  const save = async checkout => {
    const ok = await perform(checkout ? endpoints.workplace.clockOut : endpoints.workplace.activities(session.id), checkout ? "POST" : "PUT", { activities, revision: draft.revision, ...(checkout ? { session_id: session.id } : {}) })
    if (ok) setDraft({ text: activities, revision: draft.revision + 1, dirty: false })
  }
  const [correction, setCorrection] = useState(false)
  const pending = session.requests.some(item => item.status === "pending")
  return <article className="min-w-0 space-y-4 rounded-xl border p-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><div className="space-y-1 text-sm"><p>ورود: {formatInstant(session.check_in)}</p><p>خروج: {formatInstant(session.check_out)}</p></div><Badge variant={session.check_out ? "secondary" : "default"}>{session.check_out ? "پایان‌یافته" : "حاضر"}</Badge></div>
    {editable ? <div className="space-y-2">
      <label className="block space-y-2 text-sm"><span>کارهای انجام‌شده</span><Textarea aria-label="کارهای انجام‌شده در این بازه" rows={4} maxLength={10000} value={activities} onChange={event => setDraft({ ...draft, text: event.target.value, dirty: true })} disabled={busy} placeholder="کارها را به صورت متن آزاد یا هر مورد در یک خط بنویسید…" /></label>
      {stale && draft.dirty && <div className="space-y-2 text-sm"><p role="alert">اطلاعات این بازه تغییر کرده است. متن ذخیره‌نشده شما حفظ شده؛ پیش از ادامه آن را کپی و اطلاعات تازه را دریافت کنید.</p><Button size="sm" variant="outline" disabled={busy} onClick={() => setDraft({ text: session.activities, revision: session.revision, dirty: false })}>دریافت متن ذخیره‌شده</Button></div>}
      <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy || stale || activities === session.activities} onClick={() => save(false)}>ذخیره کارها</Button>
        {current && !session.check_out && <Button disabled={busy || stale} onClick={() => save(true)}>ثبت خروج و ذخیره کارها</Button>}
      </div>
    </div> : <div><p className="mb-2 text-sm font-medium">کارهای انجام‌شده</p><p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{session.activities || "فعالیتی ثبت نشده است."}</p></div>}
    {(admin || editable) && <Button variant="outline" size="sm" disabled={busy || (!admin && pending)} onClick={() => setCorrection(value => !value)}>{admin ? "اصلاح ساعت" : pending ? "درخواست در انتظار بررسی" : "درخواست اصلاح ساعت"}</Button>}
    {correction && <TimeForm session={session} admin={admin} busy={busy} onCancel={() => setCorrection(false)} onSave={body => perform(admin ? endpoints.workplace.correctTimes(session.id) : endpoints.workplace.correction(session.id), admin ? "PUT" : "POST", body)} />}
    {session.requests.length > 0 && <details className="text-sm"><summary className="cursor-pointer">درخواست‌های اصلاح ({session.requests.length.toLocaleString("fa-IR")})</summary><ul className="mt-3 space-y-3">{session.requests.map(item => <li key={item.id} className="space-y-1 rounded border p-3"><Badge variant="secondary">{statusLabels[item.status]}</Badge><p>پیشنهاد: {formatInstant(item.check_in)} تا {formatInstant(item.check_out)}</p><p className="whitespace-pre-wrap break-words">{item.reason}</p>{item.reviewed_by && <p className="text-muted-foreground">بررسی توسط {item.reviewed_by.username} در {formatInstant(item.reviewed_at)}{item.review_note ? ` — ${item.review_note}` : ""}</p>}</li>)}</ul></details>}
    <details className="text-sm"><summary className="cursor-pointer">سابقه تغییرات</summary><ol className="mt-3 space-y-3">{session.audit.map((item, index) => <li key={index} className="space-y-1 border-s-2 ps-3"><p>{auditLabels[item.action] || item.action} — <b dir="auto">{item.actor.username}</b></p><p className="text-xs text-muted-foreground">{formatInstant(item.at)}</p>{item.reason && <p className="whitespace-pre-wrap break-words">{item.reason}</p>}{["before", "after"].map(key => item[key] && <div key={key} className="break-words text-xs text-muted-foreground"><span>{key === "before" ? "قبل: " : "بعد: "}</span>{"check_in" in item[key] && <span>{formatInstant(item[key].check_in)} تا {formatInstant(item[key].check_out)}</span>}{"activities" in item[key] && <p className="whitespace-pre-wrap">{item[key].activities || "بدون توضیح"}</p>}</div>)}</li>)}</ol></details>
  </article>
}

function ReviewCard({ item, busy, perform }) {
  const [note, setNote] = useState("")
  return <article className="space-y-3 rounded-lg border p-4 text-sm"><p className="font-medium" dir="auto">{item.username}</p><p>قبلی: {formatInstant(item.request.original.check_in)} تا {formatInstant(item.request.original.check_out)}</p><p>پیشنهادی: {formatInstant(item.request.check_in)} تا {formatInstant(item.request.check_out)}</p><p className="whitespace-pre-wrap break-words">{item.request.reason}</p><Textarea aria-label={`توضیح بررسی درخواست ${item.username}`} maxLength={2000} value={note} onChange={event => setNote(event.target.value)} disabled={busy} placeholder="توضیح مدیر (اختیاری)" /><div className="flex gap-2">{["approved", "rejected"].map(decision => <Button key={decision} size="sm" variant={decision === "approved" ? "default" : "outline"} disabled={busy} onClick={() => perform(endpoints.workplace.review(item.session_id, item.request.id), "POST", { decision, note })}>{decision === "approved" ? "تأیید اصلاح" : "رد درخواست"}</Button>)}</div></article>
}

export default function Workplace({ admin = false }) {
  const { user, accessToken, isLoading, isAdmin } = useAuth()
  const allowed = admin ? isAdmin : ["staff", "admin"].includes(user?.role)
  const [month, setMonth] = useState(() => persianDateParts())
  const [revision, setRevision] = useState(0)
  const [report, setReport] = useState(null)
  const [employees, setEmployees] = useState([])
  const [users, setUsers] = useState([])
  const [pending, setPending] = useState([])
  const [selectedId, setSelectedId] = useState("")
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [error, setError] = useState("")
  const [manual, setManual] = useState(false)
  const range = monthRange(month.year, month.month)
  const query = new URLSearchParams(range).toString()
  const targetId = admin ? selectedId : user?.id

  useEffect(() => {
    if (!allowed || !accessToken) return
    const controller = new AbortController()
    setLoading(true)
    setError("")
    const read = url => request(url, accessToken, { signal: controller.signal })
    const load = async () => {
      try {
        const [summary, accounts, corrections, nextReport] = await Promise.all([
          admin ? read(`${endpoints.workplace.employees}?${query}`) : null,
          admin ? read(endpoints.auth.users) : null,
          admin ? read(endpoints.workplace.corrections) : null,
          targetId ? read(`${admin ? endpoints.workplace.employeeReport(targetId) : endpoints.workplace.myReport}?${query}`) : null,
        ])
        if (controller.signal.aborted) return
        if (admin) { setEmployees(summary.employees); setUsers(accounts.users); setPending(corrections.requests) }
        setReport(nextReport)
      } catch (failure) { if (!controller.signal.aborted) setError(failure.message || "ارتباط با سرور برقرار نشد.") }
      finally { if (!controller.signal.aborted) setLoading(false) }
    }
    load()
    return () => controller.abort()
  }, [allowed, accessToken, admin, targetId, query, revision])

  useEffect(() => {
    if (!allowed) return
    const refresh = () => setRevision(value => value + 1)
    const timer = window.setInterval(refresh, 60000)
    const visible = () => { if (!document.hidden) refresh() }
    document.addEventListener("visibilitychange", visible)
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", visible) }
  }, [allowed])

  const perform = async (url, method, body) => {
    if (busy) return false
    setBusy(true)
    setFeedback(null)
    try {
      await request(url, accessToken, { method, ...(body ? { body: JSON.stringify(body) } : {}) })
      setFeedback({ ok: true, text: "تغییر با موفقیت ثبت شد." })
      setRevision(value => value + 1)
      return true
    } catch (failure) {
      setFeedback({ ok: false, text: failure.message || "ثبت تغییر ممکن نشد؛ تازه‌سازی و دوباره بررسی کنید." })
      return false
    } finally { setBusy(false) }
  }

  if (isLoading) return <p className="p-6" role="status" dir="rtl">در حال بررسی دسترسی…</p>
  if (!allowed) return <p className="p-6" dir="rtl">دسترسی لازم برای این بخش را ندارید.</p>
  const currentReport = report?.user_id === targetId && report?.start_date === range.start_date && report?.end_date === range.end_date ? report : null
  const active = currentReport?.active_session
  const sessions = Object.fromEntries((currentReport?.sessions || []).map(session => [session.id, session]))
  const employee = employees.find(item => item.id === selectedId)
  const today = currentReport?.generated_at ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(currentReport.generated_at)) : ""
  const todayWork = currentReport?.days.find(day => day.date === today)?.seconds || 0

  return <Layout><div dir="rtl" className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="flex items-center gap-2 text-2xl font-bold"><BriefcaseBusiness className="h-6 w-6 text-primary" />{admin ? "مدیریت کارکنان" : "میز کار من"}</h1><p className="mt-2 text-sm text-muted-foreground">حضور و غیاب و کارهای انجام‌شده · ساعت تهران</p></div><Button asChild variant="outline"><Link href="/profile">بازگشت به پروفایل</Link></Button></header>
    <div className="flex flex-wrap items-center justify-between gap-3"><MonthPicker month={month} setMonth={setMonth} disabled={busy} /><Button size="sm" variant="outline" disabled={loading || busy} onClick={() => setRevision(value => value + 1)}><RefreshCw className="me-2 h-4 w-4" />تازه‌سازی</Button></div>
    {feedback && <p role={feedback.ok ? "status" : "alert"} className={`rounded-lg border p-3 text-sm ${feedback.ok ? "text-primary" : "text-destructive"}`}>{feedback.text}</p>}
    {error && <p role="alert" className="rounded-lg border p-3 text-sm text-destructive">{error}</p>}
    {loading && <p role="status" className="text-sm text-muted-foreground">در حال دریافت اطلاعات…</p>}

    {!admin && <Card><CardHeader><CardTitle>حضور فعلی</CardTitle><CardDescription>زمان ورود و خروج به‌صورت خودکار از سرور ثبت می‌شود. کارکرد بازه باز تا آخرین تازه‌سازی محاسبه شده است.</CardDescription></CardHeader><CardContent className="space-y-4">
      {currentReport && <><div className="flex flex-wrap gap-4 text-sm"><Badge variant={active ? "default" : "secondary"}>{active ? "حاضر" : "خارج از محل کار"}</Badge>{today >= range.start_date && today <= range.end_date && <span>کارکرد امروز: {formatDuration(todayWork)}</span>}</div>{active ? <SessionCard key={active.id} session={active} editable busy={busy} perform={perform} current /> : <Button disabled={busy || loading} onClick={() => perform(endpoints.workplace.clockIn, "POST")}>ثبت ورود</Button>}</>}
    </CardContent></Card>}

    {admin && <>
      <Card><CardHeader><CardTitle>حضور و کارکرد کارکنان</CardTitle><CardDescription>کارکرد مربوط به ماه انتخابی است؛ وضعیت حضور، وضعیت فعلی را نشان می‌دهد.</CardDescription></CardHeader><CardContent>{!employees.length ? <p className="text-sm text-muted-foreground">کارمندی ثبت نشده است.</p> : <div className="overflow-x-auto"><table className="w-full text-right text-sm"><thead><tr className="border-b"><th className="p-3">کارمند</th><th className="p-3">وضعیت فعلی</th><th className="p-3">آخرین ورود باز</th><th className="p-3">کارکرد ماه</th><th className="p-3">گزارش</th></tr></thead><tbody>{employees.map(item => <tr key={item.id} className="border-b"><td className="p-3"><span dir="auto">{item.username}</span><p className="text-xs text-muted-foreground">{roleLabels[item.role]}{!item.is_active ? " · غیرفعال" : ""}</p></td><td className="p-3">{item.present ? "حاضر" : "خارج"}{item.pending_requests > 0 && <p className="text-xs text-muted-foreground">{item.pending_requests.toLocaleString("fa-IR")} درخواست اصلاح</p>}</td><td className="p-3">{item.check_in ? formatInstant(item.check_in) : "—"}</td><td className="p-3 whitespace-nowrap">{formatDuration(item.total_seconds)}</td><td className="p-3"><Button size="sm" variant={selectedId === item.id ? "default" : "outline"} disabled={busy} onClick={() => { setSelectedId(item.id); setManual(false) }}>مشاهده</Button></td></tr>)}</tbody></table></div>}</CardContent></Card>
      <Card><CardHeader><CardTitle>درخواست‌های اصلاح در انتظار بررسی</CardTitle><CardDescription>درخواست‌های همه ماه‌ها نمایش داده می‌شوند.</CardDescription></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">{pending.length ? pending.map(item => <ReviewCard key={item.request.id} item={item} busy={busy} perform={perform} />) : <p className="text-sm text-muted-foreground">درخواست بررسی‌نشده‌ای وجود ندارد.</p>}</CardContent></Card>
    </>}

    {(currentReport || (admin && selectedId)) && <Card><CardHeader><CardTitle>گزارش ماهانه {admin ? employee?.username : "من"}</CardTitle><CardDescription>{persianMonths[month.month - 1]} {month.year.toLocaleString("fa-IR", { useGrouping: false })} · مجموع: {currentReport ? formatDuration(currentReport.total_seconds) : "در حال دریافت…"}</CardDescription></CardHeader><CardContent className="space-y-5">
      {admin && employee?.is_active && ["staff", "admin"].includes(employee.role) && <Button size="sm" variant="outline" disabled={busy} onClick={() => setManual(value => !value)}>افزودن بازه فراموش‌شده</Button>}
      {manual && admin && <TimeForm key={selectedId} admin busy={busy} onCancel={() => setManual(false)} onSave={body => perform(endpoints.workplace.manualSession(selectedId), "POST", body)} />}
      {currentReport?.days.length === 0 && <p className="text-sm text-muted-foreground">برای این ماه سابقه‌ای ثبت نشده است.</p>}
      {currentReport?.days.map(day => <section key={day.date} className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted p-3 text-sm"><h2 className="font-semibold">{formatDate(`${day.date}T12:00:00Z`)}</h2><p>کارکرد روز: {formatDuration(day.seconds)}</p></div><div className="grid gap-4 md:grid-cols-2">{day.entries.map(entry => { const session = sessions[entry.session_id]; return <div key={session.id} className="min-w-0 space-y-2"><p className="text-xs text-muted-foreground">کارکرد این بازه در این روز: {formatDuration(entry.seconds)}</p><SessionCard key={session.id} session={session} editable={!admin && session.id !== active?.id} admin={admin} busy={busy} perform={perform} /></div> })}</div></section>)}
      {currentReport && <p className="text-xs text-muted-foreground">آخرین محاسبه: {formatInstant(currentReport.generated_at)} · بازه‌های عبوری از نیمه‌شب بین روزها تقسیم شده‌اند.</p>}
    </CardContent></Card>}

    {admin && <Card><CardHeader><CardTitle>تعیین نقش کارکنان</CardTitle><CardDescription>کارمندان و برنامه‌نویسان نقش «کارمند» دارند. دسترسی مدیران از این قسمت تغییر نمی‌کند.</CardDescription></CardHeader><CardContent className="space-y-3">{users.map(account => <div key={account.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"><span dir="auto" className="text-sm">{account.username}</span>{account.role === "admin" ? <Badge>مدیر</Badge> : <select className={selectClass} aria-label={`نقش ${account.username}`} value={account.role} disabled={busy || loading || !account.is_active} onChange={event => perform(endpoints.auth.staffRole(account.id), "PUT", { role: event.target.value })}><option value="user">کاربر</option><option value="staff">کارمند</option></select>}</div>)}</CardContent></Card>}
  </div></Layout>
}
