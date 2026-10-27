"use client"

import { useEffect, useRef, useState } from "react"
import { RefreshCw } from "lucide-react"
import { useAuth } from "@/components/auth/auth-context"
import { endpoints } from "@/api/api"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDate } from "@/lib/workplace-time.mjs"

const roleLabels = { user: "کاربر", staff: "کارمند", admin: "مدیر" }

export default function WorkplaceUsers({ onUsersChanged }) {
  const { isAdmin, accessToken, user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [revision, setRevision] = useState(0)
  const [busyId, setBusyId] = useState(null)
  const mutationLock = useRef(false)
  const [feedback, setFeedback] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteConfirmation, setDeleteConfirmation] = useState("")

  useEffect(() => {
    if (!isAdmin || !accessToken) { setUsers([]); return }
    const controller = new AbortController()
    setLoading(true)
    setError("")
    fetch(endpoints.auth.users, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store", signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error("دریافت فهرست حساب‌ها ممکن نشد.")
        const body = await response.json()
        if (!controller.signal.aborted) setUsers(body.users)
      }).catch(reason => { if (!controller.signal.aborted) { setUsers([]); setError(reason.message) } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [isAdmin, accessToken, revision])

  const changeUser = async (target, action, value) => {
    if (!isAdmin || !accessToken || loading || mutationLock.current) return
    if (action === "delete" && deleteConfirmation !== target.username) return
    mutationLock.current = true
    setBusyId(target.id)
    setFeedback(null)
    const operation = {
      staff: { url: endpoints.auth.staffRole(target.id), method: "PUT", body: { role: value }, message: `نقش ${target.username} به ${roleLabels[value]} تغییر کرد.` },
      analysis: { url: endpoints.auth.analysisAccess(target.id), method: "PUT", body: { enabled: value }, message: `دسترسی تحلیل‌های پرمیوم ${target.username} ${value ? "فعال" : "غیرفعال"} شد.` },
      promote: { url: endpoints.auth.promoteUser(target.id), method: "POST", message: `${target.username} به مدیر ارتقا یافت.` },
      demote: { url: endpoints.auth.demoteUser(target.id), method: "POST", message: `${target.username} به کاربر تبدیل شد.` },
      delete: { url: endpoints.auth.deleteUser(target.id), method: "DELETE", body: { confirmation_username: deleteConfirmation }, message: `${target.username} حذف شد و دسترسی ورودش قطع شد.` },
    }[action]
    try {
      const response = await fetch(operation.url, {
        method: operation.method, cache: "no-store",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        ...(operation.body ? { body: JSON.stringify(operation.body) } : {}),
      })
      if (!response.ok) throw new Error(response.status === 409 ? "حذف یا تنزل حساب خودتان و آخرین مدیر فعال مجاز نیست؛ تغییر هم‌زمان را نیز دوباره بررسی کنید." : response.status === 403 ? "دسترسی مدیریت لازم است." : response.status === 400 ? "نام کاربری را دقیق وارد کنید." : "تغییر حساب ممکن نشد؛ فهرست را تازه‌سازی کنید.")
      const updated = await response.json()
      setUsers(current => action === "delete" ? current.filter(item => item.id !== target.id) : current.map(item => item.id === target.id ? { ...item, ...updated } : item))
      if (action === "delete") { setDeleteTarget(null); setDeleteConfirmation("") }
      setFeedback({ ok: true, text: operation.message })
      onUsersChanged?.()
    } catch (reason) {
      setFeedback({ ok: false, text: reason instanceof Error ? reason.message : "تغییر حساب ممکن نشد." })
    } finally {
      mutationLock.current = false
      setBusyId(null)
    }
  }

  if (!isAdmin) return null
  const busy = Boolean(busyId)
  return <Card>
    <CardHeader>
      <div className="flex flex-wrap items-center justify-between gap-3"><CardTitle>کاربران و دسترسی‌ها</CardTitle><Button variant="outline" size="sm" disabled={loading || busy} onClick={() => setRevision(value => value + 1)}><RefreshCw className="me-2 h-4 w-4" />تازه‌سازی</Button></div>
      <CardDescription>نقش کاربران و کارکنان، دسترسی تحلیل‌های پرمیوم و مدیریت حساب‌ها</CardDescription>
    </CardHeader>
    <CardContent>
      {feedback && <p role={feedback.ok ? "status" : "alert"} className={`mb-4 text-sm ${feedback.ok ? "text-primary" : "text-destructive"}`}>{feedback.text}</p>}
      {loading ? <p role="status" className="text-sm text-muted-foreground">در حال دریافت فهرست…</p> : error ? <p role="alert" className="text-sm text-destructive">{error}</p> : !users.length ? <p className="text-sm text-muted-foreground">کاربری ثبت نشده است.</p> : <div className="overflow-x-auto">
        <table className="w-full text-right text-sm"><thead><tr className="border-b text-muted-foreground"><th className="p-3">نام کاربری</th><th className="p-3">نقش</th><th className="p-3">وضعیت</th><th className="p-3">تاریخ ثبت‌نام</th><th className="p-3">تحلیل‌های پرمیوم</th><th className="p-3">عملیات حساب</th></tr></thead><tbody>
          {users.map(account => <tr key={account.id} className="border-b last:border-0">
            <td className="p-3" dir="auto">{account.username}</td>
            <td className="p-3">{account.role === "admin" ? <Badge>مدیر</Badge> : <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" aria-label={`نقش ${account.username}`} value={account.role} disabled={busy || !account.is_active} onChange={event => changeUser(account, "staff", event.target.value)}><option value="user">کاربر</option><option value="staff">کارمند</option></select>}</td>
            <td className="whitespace-nowrap p-3">{account.is_active ? "فعال" : "غیرفعال"}</td>
            <td className="whitespace-nowrap p-3">{account.created_at && !Number.isNaN(Date.parse(account.created_at)) ? formatDate(account.created_at) : "نامشخص"}</td>
            <td className="p-3"><label className="flex items-center gap-2 whitespace-nowrap text-xs"><Switch aria-label={`دسترسی تحلیل‌های پرمیوم ${account.username}`} checked={account.role === "admin" || account.can_view_premium_analysis === true} disabled={busy || account.role === "admin"} onCheckedChange={enabled => changeUser(account, "analysis", enabled)} />{account.role === "admin" ? "دسترسی مدیر" : account.can_view_premium_analysis ? "فعال" : "غیرفعال"}</label></td>
            <td className="p-3"><div className="flex flex-wrap gap-2">
              {account.role !== "admin" ? <Button size="sm" variant="outline" disabled={busy} onClick={() => changeUser(account, "promote")}>ارتقا به مدیر</Button> : <Button size="sm" variant="outline" disabled={busy || account.id === currentUser?.id} onClick={() => changeUser(account, "demote")}>تبدیل به کاربر</Button>}
              <Button size="sm" variant="destructive" disabled={busy || account.id === currentUser?.id} onClick={() => { setDeleteTarget(account); setDeleteConfirmation(""); setFeedback(null) }}>حذف کاربر</Button>
              {busyId === account.id && <span role="status" className="text-xs text-muted-foreground">در حال ذخیره…</span>}
            </div></td>
          </tr>)}
        </tbody></table>
      </div>}
      <Dialog open={Boolean(deleteTarget)} onOpenChange={open => { if (!open && !busy) { setDeleteTarget(null); setDeleteConfirmation("") } }}><DialogContent dir="rtl"><DialogHeader><DialogTitle>حذف کاربر</DialogTitle><DialogDescription>حساب از فهرست حذف می‌شود و ورود، نشست‌ها و اتصال متاتریدر آن قطع می‌شوند. سوابق مالی و مکالمات نگهداری می‌شوند. برای تأیید، نام کاربری {deleteTarget?.username} را دقیق وارد کنید.</DialogDescription></DialogHeader><Input aria-label="نام کاربری برای تأیید حذف" dir="ltr" autoComplete="off" value={deleteConfirmation} onChange={event => setDeleteConfirmation(event.target.value)} disabled={busy} />{feedback && !feedback.ok && <p role="alert" className="text-sm text-destructive">{feedback.text}</p>}<DialogFooter><Button variant="outline" disabled={busy} onClick={() => setDeleteTarget(null)}>انصراف</Button><Button variant="destructive" disabled={busy || !deleteTarget || deleteConfirmation !== deleteTarget.username} onClick={() => changeUser(deleteTarget, "delete")}>{busy ? "در حال حذف…" : "تأیید حذف کاربر"}</Button></DialogFooter></DialogContent></Dialog>
    </CardContent>
  </Card>
}
