"use client"

import { useEffect, useRef, useState } from "react"
import { Bell, Plus, RefreshCw, Search } from "lucide-react"
import { useAuth } from "@/components/auth/auth-context"
import { endpoints } from "@/api/api"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { formatInstant, parsePersianDate } from "@/lib/workplace-time.mjs"
import { workEvents, workStates } from "@/lib/work-tasks.mjs"
import WorkTaskDetail, { WorkStateBadges, workDueLabel } from "@/components/workplace/work-task-detail"
import { WorkDateInput, WorkTaskEditor, workSelectClass } from "@/components/workplace/work-task-forms"

async function workRequest(url, token, options = {}) {
  let response
  try {
    response = await fetch(url, { ...options, cache: "no-store", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } })
  } catch {
    throw new Error("ارتباط با سرور برقرار نشد؛ پیش از تلاش دوباره فهرست را تازه‌سازی کنید.")
  }
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(response.status === 401 ? "نشست شما منقضی شده است؛ دوباره وارد شوید." : typeof data.detail === "string" ? data.detail : "اطلاعات واردشده معتبر نیست؛ عنوان، تاریخ و لینک نتیجه را بررسی کنید.")
    error.status = response.status
    throw error
  }
  return data
}

const emptyFilters = { search: "", status: "active", deadline: "any", assignee_id: "", due_from: "", due_to: "" }
const emptyList = { items: [], total: 0, counts: { mine: 0, team: 0, all: 0, pending: 0 } }
const pageSize = 30

export default function WorkTasks({ initialTaskId = null }) {
  const { user, accessToken, isAdmin } = useAuth()
  const [view, setView] = useState("mine")
  const [draftFilters, setDraftFilters] = useState(emptyFilters)
  const [filters, setFilters] = useState(emptyFilters)
  const [offset, setOffset] = useState(0)
  const [listing, setListing] = useState(emptyList)
  const [notifications, setNotifications] = useState({ items: [], unread_count: 0 })
  const [people, setPeople] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [actionError, setActionError] = useState("")
  const [revision, setRevision] = useState(0)
  const [busy, setBusy] = useState(false)
  const mutationLock = useRef(false)
  const [creating, setCreating] = useState(false)
  const [selectedId, setSelectedId] = useState(initialTaskId)
  useEffect(() => { if (initialTaskId) setSelectedId(initialTaskId) }, [initialTaskId])
  const [detail, setDetail] = useState(null)
  const [detailError, setDetailError] = useState("")
  const query = new URLSearchParams({ view, status: filters.status, deadline: filters.deadline, search: filters.search,
    offset: String(offset), limit: String(pageSize), ...(isAdmin && filters.assignee_id ? { assignee_id: filters.assignee_id } : {}),
    ...(filters.due_from ? { due_from: filters.due_from } : {}), ...(filters.due_to ? { due_to: filters.due_to } : {}) }).toString()

  useEffect(() => {
    if (!accessToken) return
    const controller = new AbortController()
    const read = url => workRequest(url, accessToken, { signal: controller.signal })
    setLoading(true)
    setError("")
    Promise.all([read(`${endpoints.workplace.tasks}?${query}`), read(endpoints.workplace.taskNotifications),
      isAdmin ? read(endpoints.workplace.taskPeople) : null])
      .then(([works, notices, accounts]) => {
        if (controller.signal.aborted) return
        setListing(works)
        setNotifications(notices)
        setPeople(accounts?.people || [])
        if (offset && offset >= works.total) setOffset(0)
      }).catch(failure => {
        if (!controller.signal.aborted) {
          setError(failure.message)
          if ([401, 403].includes(failure.status)) { setListing(emptyList); setNotifications({ items: [], unread_count: 0 }) }
        }
      }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [accessToken, isAdmin, query, revision, offset])

  useEffect(() => {
    if (!selectedId || !accessToken) { setDetail(null); setDetailError(""); return }
    const controller = new AbortController()
    setDetailError("")
    workRequest(endpoints.workplace.task(selectedId), accessToken, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setDetail(data) })
      .catch(failure => { if (!controller.signal.aborted) { setDetail(null); setDetailError(failure.message) } })
    return () => controller.abort()
  }, [selectedId, accessToken, revision])

  useEffect(() => {
    if (!isAdmin && ["all", "pending"].includes(view)) { setView("mine"); setOffset(0) }
  }, [isAdmin, view])

  useEffect(() => {
    const refresh = () => setRevision(value => value + 1)
    const visible = () => { if (!document.hidden) refresh() }
    const timer = window.setInterval(refresh, 60000)
    document.addEventListener("visibilitychange", visible)
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", visible) }
  }, [])

  const mutate = async (url, method, body) => {
    if (mutationLock.current) return null
    mutationLock.current = true
    setBusy(true)
    setActionError("")
    try {
      const data = await workRequest(url, accessToken, { method, ...(body ? { body: JSON.stringify(body) } : {}) })
      if (data.id) setDetail(current => current?.id === data.id ? data : current)
      setRevision(value => value + 1)
      return data
    } catch (failure) {
      setActionError(failure.message)
      if (failure.status === 404) setSelectedId(null)
      setRevision(value => value + 1)
      return null
    } finally { mutationLock.current = false; setBusy(false) }
  }
  const open = id => { setActionError(""); setDetailError(""); setSelectedId(id) }
  const changeView = next => {
    setView(next)
    setOffset(0)
    if (next === "pending") { setFilters(value => ({ ...value, status: "active" })); setDraftFilters(value => ({ ...value, status: "active" })) }
  }
  const applyFilters = event => {
    event.preventDefault()
    try {
      const from = parsePersianDate(draftFilters.due_from)
      const to = parsePersianDate(draftFilters.due_to)
      if (from && to && from > to) throw new Error("ابتدای بازه مهلت باید قبل از پایان آن باشد.")
      setFilters({ ...draftFilters, search: draftFilters.search.trim(), due_from: from || "", due_to: to || "" })
      setOffset(0)
      setError("")
    } catch (failure) { setError(failure.message) }
  }
  const create = async payload => {
    const data = await mutate(endpoints.workplace.tasks, "POST", payload)
    if (data) { setCreating(false); setDetail(data); open(data.id) }
  }
  const openNotice = async notice => {
    if (await mutate(endpoints.workplace.readTaskNotification(notice.task_id, notice.id), "POST")) open(notice.task_id)
  }
  const currentDetail = detail?.id === selectedId ? detail : null
  const views = [["mine", "کارهای من"], ["team", "کارهای تیم"], ...(isAdmin ? [["all", "همه کارها"], ["pending", "منتظر تأیید"]] : [])]
  return <div className="space-y-5" dir="rtl">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">کارها</h2><p className="mt-1 text-sm text-muted-foreground">ثبت، انجام و بررسی کارهای کارکنان داخلی</p></div><div className="flex gap-2"><Button variant="outline" size="sm" disabled={loading || busy} onClick={() => setRevision(value => value + 1)}><RefreshCw className="me-2 h-4 w-4" />تازه‌سازی</Button><Button size="sm" disabled={busy || (isAdmin && !people.length)} onClick={() => { setActionError(""); setCreating(true) }}><Plus className="me-2 h-4 w-4" />کار جدید</Button></div></div>
    {error && <p role="alert" className="rounded-lg border p-3 text-sm text-destructive">{error}</p>}
    {actionError && !selectedId && !creating && <p role="alert" className="rounded-lg border p-3 text-sm text-destructive">{actionError}</p>}
    <Card><CardContent className="pt-5"><details><summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 text-sm font-medium"><Bell className="h-4 w-4" />اعلان‌های کارها<Badge variant={notifications.unread_count ? "default" : "secondary"}>{notifications.unread_count.toLocaleString("fa-IR")} خوانده‌نشده</Badge></summary><div className="mt-4 max-h-80 space-y-2 overflow-y-auto">{notifications.items.length ? notifications.items.map(notice => <button key={notice.id} type="button" disabled={busy} onClick={() => openNotice(notice)} className={`block w-full space-y-1 rounded-lg border p-3 text-right text-sm transition-colors hover:bg-accent ${notice.read ? "text-muted-foreground" : "bg-primary/5"}`}><span className="block break-words font-medium">{workEvents[notice.kind] || "تغییر کار"}: {notice.task_title}</span><span className="block text-xs">{notice.actor.username} · {formatInstant(notice.created_at)}{notice.read ? " · خوانده‌شده" : ""}</span></button>) : <p className="text-sm text-muted-foreground">اعلانی برای شما ثبت نشده است.</p>}</div></details></CardContent></Card>
    <div className="flex flex-wrap gap-2" role="group" aria-label="نمای کارها">{views.map(([key, label]) => <Button key={key} size="sm" variant={view === key ? "default" : "outline"} aria-pressed={view === key} disabled={busy} onClick={() => changeView(key)}>{label}<span className="ms-2 tabular-nums">{(listing.counts[key] || 0).toLocaleString("fa-IR")}</span></Button>)}</div>
    <Card><CardHeader><CardTitle className="text-base">جست‌وجو و فیلتر کارها</CardTitle><CardDescription>تکمیل‌شده‌ها و لغوشده‌ها از فهرست فعال کنار گذاشته شده‌اند.</CardDescription></CardHeader><CardContent><form onSubmit={applyFilters} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><label className="block space-y-2 text-sm"><span>جست‌وجوی عنوان</span><Input type="search" value={draftFilters.search} maxLength={180} onChange={event => setDraftFilters({ ...draftFilters, search: event.target.value })} /></label><label className="block space-y-2 text-sm"><span>وضعیت</span><select className={workSelectClass} value={draftFilters.status} onChange={event => setDraftFilters({ ...draftFilters, status: event.target.value })}><option value="active">کارهای فعال</option><option value="all">همه وضعیت‌ها</option>{Object.entries(workStates).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label className="block space-y-2 text-sm"><span>مهلت</span><select className={workSelectClass} value={draftFilters.deadline} onChange={event => setDraftFilters({ ...draftFilters, deadline: event.target.value })}><option value="any">همه مهلت‌ها</option><option value="overdue">گذشته از مهلت</option><option value="today">مهلت امروز</option><option value="no_due">بدون مهلت</option></select></label>
        {isAdmin && <label className="block space-y-2 text-sm"><span>مسئول انجام</span><select className={workSelectClass} value={draftFilters.assignee_id} onChange={event => setDraftFilters({ ...draftFilters, assignee_id: event.target.value })}><option value="">همه کارکنان</option>{people.map(person => <option key={person.id} value={person.id}>{person.username}</option>)}</select></label>}
        <WorkDateInput label="مهلت از تاریخ (شمسی)" value={draftFilters.due_from} onChange={value => setDraftFilters({ ...draftFilters, due_from: value })} /><WorkDateInput label="مهلت تا تاریخ (شمسی)" value={draftFilters.due_to} onChange={value => setDraftFilters({ ...draftFilters, due_to: value })} />
      </div><div className="flex flex-wrap gap-2"><Button type="submit" disabled={loading || busy} size="sm"><Search className="me-2 h-4 w-4" />اعمال فیلتر</Button><Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => { setDraftFilters(emptyFilters); setFilters(emptyFilters); setOffset(0); setError("") }}>پاک‌کردن فیلترها</Button></div>
    </form></CardContent></Card>
    {loading && <p role="status" className="text-sm text-muted-foreground">در حال دریافت کارها…</p>}
    {!loading && !error && !listing.items.length && <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">کاری با این فیلترها پیدا نشد.</p>}
    <ul className="space-y-3" aria-label="فهرست کارها">{listing.items.map(task => <li key={task.id} className="space-y-4 rounded-xl border bg-card p-4"><div className="flex flex-wrap items-start justify-between gap-3"><button type="button" onClick={() => open(task.id)} className="min-w-0 break-words text-right font-semibold text-primary underline-offset-4 hover:underline">{task.title}</button><Badge variant="outline">{task.visibility === "team" ? "قابل مشاهده برای تیم" : "محدود"}</Badge></div><WorkStateBadges task={task} /><dl className="grid gap-3 text-sm sm:grid-cols-3"><div><dt className="text-xs text-muted-foreground">مسئول انجام</dt><dd dir="auto">{task.assignee.username}</dd></div><div><dt className="text-xs text-muted-foreground">ایجادکننده</dt><dd dir="auto">{task.created_by.username}</dd></div><div><dt className="text-xs text-muted-foreground">مهلت</dt><dd>{workDueLabel(task.due_date)}</dd></div></dl></li>)}</ul>
    {listing.total > 0 && <div className="flex flex-wrap items-center justify-between gap-3 text-sm"><p>{listing.total.toLocaleString("fa-IR")} کار · صفحه {(Math.floor(offset / pageSize) + 1).toLocaleString("fa-IR")}</p><div className="flex gap-2"><Button variant="outline" size="sm" disabled={loading || busy || offset === 0} onClick={() => setOffset(value => Math.max(0, value - pageSize))}>قبلی</Button><Button variant="outline" size="sm" disabled={loading || busy || offset + pageSize >= listing.total} onClick={() => setOffset(value => value + pageSize)}>بعدی</Button></div></div>}
    <Dialog open={creating} onOpenChange={value => { if (!busy) { setCreating(value); setActionError("") } }}><DialogContent dir="rtl" className="flex max-h-[90dvh] w-[calc(100vw-2rem)] max-w-2xl flex-col overflow-hidden"><DialogHeader className="shrink-0 pr-7 !text-right"><DialogTitle>کار جدید</DialogTitle><DialogDescription>{isAdmin ? "برای یکی از کارکنان داخلی کار ایجاد کنید." : "کاری را که مسئول انجامش هستید، برای خودتان ثبت کنید."}</DialogDescription></DialogHeader><div className="min-h-0 space-y-3 overflow-y-auto">{actionError && <p role="alert" className="text-sm text-destructive">{actionError}</p>}<WorkTaskEditor user={user} isAdmin={isAdmin} people={people} busy={busy} onSave={create} onCancel={() => setCreating(false)} /></div></DialogContent></Dialog>
    <Dialog open={Boolean(selectedId)} onOpenChange={value => { if (!value && !busy) { setSelectedId(null); setActionError("") } }}><DialogContent dir="rtl" className="flex max-h-[90dvh] w-[calc(100vw-2rem)] max-w-3xl flex-col overflow-hidden"><DialogHeader className="shrink-0 pr-7 !text-right"><DialogTitle className="break-words leading-7">{currentDetail?.title || "جزئیات کار"}</DialogTitle><DialogDescription>مشخصات، نتیجه‌ها، گفت‌وگو و سابقه کار</DialogDescription></DialogHeader><div className="min-h-0 space-y-4 overflow-y-auto">{actionError && <p role="alert" className="text-sm text-destructive">{actionError}</p>}{detailError ? <div className="space-y-3"><p role="alert" className="text-sm text-destructive">{detailError}</p><Button variant="outline" size="sm" onClick={() => setRevision(value => value + 1)}>تلاش دوباره</Button></div> : currentDetail ? <WorkTaskDetail key={currentDetail.id} task={currentDetail} user={user} isAdmin={isAdmin} people={people} busy={busy} mutate={mutate} /> : <p role="status" className="text-sm text-muted-foreground">در حال دریافت کار…</p>}</div></DialogContent></Dialog>
  </div>
}
