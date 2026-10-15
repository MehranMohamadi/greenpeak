"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Database, FileJson2, RefreshCw, ShieldCheck } from "lucide-react"
import Layout from "@/components/kokonutui/layout"
import { useAuth } from "@/components/auth/auth-context"
import { endpoints } from "@/api/api"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function AdminSettingsPage() {
  const { isAdmin, accessToken, user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [revision, setRevision] = useState(0)
  const [promotingId, setPromotingId] = useState(null)
  const [promotionMessage, setPromotionMessage] = useState("")
  const [promotionError, setPromotionError] = useState("")
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteConfirmation, setDeleteConfirmation] = useState("")

  const setAnalysisAccess = async (target, enabled) => {
    if (!isAdmin || !accessToken || promotingId) return
    setPromotingId(target.id)
    setPromotionError("")
    setPromotionMessage("")
    try {
      const response = await fetch(endpoints.auth.analysisAccess(target.id), {
        method: "PUT", cache: "no-store",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      })
      if (!response.ok) throw new Error("تغییر دسترسی تحلیل‌ها ممکن نشد؛ دوباره تلاش کنید.")
      const updated = await response.json()
      setUsers(current => current.map(item => item.id === target.id ? { ...item, ...updated } : item))
      setPromotionMessage(`دسترسی تحلیل‌های پرمیوم ${target.username} ${enabled ? "فعال" : "غیرفعال"} شد.`)
    } catch (reason) {
      setPromotionError(reason instanceof Error ? reason.message : "تغییر دسترسی ممکن نشد.")
    } finally { setPromotingId(null) }
  }

  useEffect(() => {
    if (!isAdmin || !accessToken) return
    const controller = new AbortController()
    setLoading(true)
    setError("")
    fetch(endpoints.auth.users, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store", signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error("دریافت فهرست حساب‌ها ممکن نشد.")
        const body = await response.json()
        if (!controller.signal.aborted) setUsers(body.users)
      }).catch(reason => { if (!controller.signal.aborted) setError(reason.message) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [isAdmin, accessToken, revision])

  const promoteUser = async (user) => {
    if (!isAdmin || !accessToken || promotingId) return
    setPromotingId(user.id)
    setPromotionMessage("")
    setPromotionError("")
    try {
      const response = await fetch(endpoints.auth.promoteUser(user.id), {
        method: "POST", headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store",
      })
      if (!response.ok) throw new Error(response.status === 403 ? "دسترسی مدیریت لازم است." : response.status === 404 ? "این کاربر پیدا نشد؛ فهرست را تازه‌سازی کنید." : "ارتقای کاربر ممکن نشد؛ دوباره تلاش کنید.")
      const updated = await response.json()
      setUsers(current => current.map(item => item.id === updated.id ? { ...item, role: updated.role } : item))
      setPromotionMessage(`${user.username} به ادمین ارتقا یافت.`)
    } catch (reason) {
      setPromotionError(reason instanceof Error ? reason.message : "ارتقای کاربر ممکن نشد.")
    } finally {
      setPromotingId(null)
    }
  }

  const manageUser = async (target, action) => {
    if (!isAdmin || !accessToken || promotingId) return
    setPromotingId(target.id)
    setPromotionMessage("")
    setPromotionError("")
    try {
      const response = await fetch(action === "delete" ? endpoints.auth.deleteUser(target.id) : endpoints.auth.demoteUser(target.id), {
        method: action === "delete" ? "DELETE" : "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        ...(action === "delete" ? { body: JSON.stringify({ confirmation_username: deleteConfirmation }) } : {}),
        cache: "no-store",
      })
      if (!response.ok) throw new Error(response.status === 409 ? "حذف یا تنزل حساب خودتان و آخرین ادمین فعال مجاز نیست؛ تغییر هم‌زمان را نیز دوباره امتحان کنید." : response.status === 403 ? "دسترسی مدیریت لازم است." : response.status === 400 ? "نام کاربری را دقیق وارد کنید." : "تغییر حساب ممکن نشد؛ فهرست را تازه‌سازی کنید.")
      if (action === "delete") {
        setUsers(current => current.filter(item => item.id !== target.id))
        setDeleteTarget(null)
        setDeleteConfirmation("")
        setPromotionMessage(`${target.username} حذف شد و دسترسی ورودش قطع شد.`)
      } else {
        const updated = await response.json()
        setUsers(current => current.map(item => item.id === updated.id ? { ...item, role: updated.role } : item))
        setPromotionMessage(`${target.username} به کاربر تبدیل شد.`)
      }
    } catch (reason) {
      setPromotionError(reason instanceof Error ? reason.message : "تغییر حساب ممکن نشد.")
    } finally {
      setPromotingId(null)
    }
  }

  if (!isAdmin) return null
  const admins = users.filter(user => user.role === "admin")
  return <Layout><div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6" dir="rtl">
    <header><h1 className="flex items-center gap-2 text-2xl font-semibold"><ShieldCheck className="h-6 w-6 text-primary" />Admin Panel Settings</h1><p className="mt-2 text-sm text-muted-foreground">مدیران سایت و ابزارهای بررسی فنی</p></header>
    <Card><CardHeader><div className="flex items-center justify-between gap-3"><CardTitle>مدیران سایت</CardTitle><Button variant="outline" size="sm" disabled={loading} onClick={() => setRevision(value => value + 1)}><RefreshCw className="me-2 h-4 w-4" />تازه‌سازی</Button></div><CardDescription>حساب‌های موجود در زمان مهاجرت مدیر شده‌اند؛ ثبت‌نام‌های جدید نقش کاربر دارند.</CardDescription></CardHeader><CardContent>
      {loading ? <p role="status" className="text-sm text-muted-foreground">در حال دریافت فهرست…</p> : error ? <p role="alert" className="text-sm text-destructive">{error}</p> : !admins.length ? <p className="text-sm text-muted-foreground">مدیری ثبت نشده است.</p> : <div className="overflow-x-auto"><table className="w-full text-right text-sm"><thead><tr className="border-b text-muted-foreground"><th className="p-3">نام کاربری</th><th className="p-3">نقش</th><th className="p-3">وضعیت</th><th className="p-3">تاریخ ثبت‌نام</th></tr></thead><tbody>{admins.map(admin => <tr key={admin.id} className="border-b last:border-0"><td className="p-3" dir="auto">{admin.username}</td><td className="p-3"><Badge>ادمین</Badge></td><td className="p-3">{admin.is_active ? "فعال" : "غیرفعال"}</td><td className="p-3">{admin.created_at && !Number.isNaN(Date.parse(admin.created_at)) ? new Date(admin.created_at).toLocaleDateString("fa-IR", { timeZone: "Asia/Tehran" }) : "نامشخص"}</td></tr>)}</tbody></table></div>}
    </CardContent></Card>
    <Card><CardHeader><CardTitle>کاربران سایت</CardTitle><CardDescription>فهرست حساب‌ها، نقش و وضعیت آن‌ها</CardDescription></CardHeader><CardContent>
      {promotionMessage && <p role="status" className="mb-4 text-sm text-primary">{promotionMessage}</p>}
      {promotionError && <p role="alert" className="mb-4 text-sm text-destructive">{promotionError}</p>}
      {loading ? <p role="status" className="text-sm text-muted-foreground">در حال دریافت فهرست…</p> : error ? <p role="alert" className="text-sm text-destructive">{error}</p> : !users.length ? <p className="text-sm text-muted-foreground">کاربری ثبت نشده است.</p> : <div className="overflow-x-auto">
        <table className="w-full text-right text-sm"><thead><tr className="border-b text-muted-foreground"><th className="p-3">نام کاربری</th><th className="p-3">نقش</th><th className="p-3">وضعیت</th><th className="p-3">تاریخ ثبت‌نام</th><th className="p-3">عملیات</th></tr></thead><tbody>
          {users.map(user => <tr key={user.id} className="border-b last:border-0"><td className="p-3" dir="auto">{user.username}</td><td className="p-3"><Badge variant={user.role === "admin" ? "default" : "secondary"}>{user.role === "admin" ? "Admin" : "User"}</Badge></td><td className="p-3">{user.is_active ? "فعال" : "غیرفعال"}</td><td className="p-3">{user.created_at && !Number.isNaN(Date.parse(user.created_at)) ? new Date(user.created_at).toLocaleDateString("fa-IR", { timeZone: "Asia/Tehran" }) : "نامشخص"}</td><td className="p-3"><div className="flex flex-wrap gap-2">
            {user.role === "user" ? <Button size="sm" variant="outline" disabled={loading || Boolean(promotingId)} onClick={() => promoteUser(user)}>ارتقا به ادمین</Button> : <Button size="sm" variant="outline" disabled={loading || Boolean(promotingId) || user.id === currentUser?.id} onClick={() => manageUser(user, "demote")}>تبدیل به کاربر</Button>}
            <Button size="sm" variant="destructive" disabled={loading || Boolean(promotingId) || user.id === currentUser?.id} onClick={() => { setDeleteTarget(user); setDeleteConfirmation(""); setPromotionError("") }}>حذف کاربر</Button>
            <label className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs">
              <Switch aria-label={`دسترسی تحلیل‌های پرمیوم ${user.username}`} checked={user.role === "admin" || user.can_view_premium_analysis === true} disabled={loading || Boolean(promotingId) || user.role === "admin"} onCheckedChange={enabled => setAnalysisAccess(user, enabled)} />
              {user.role === "admin" ? "تحلیل‌های پرمیوم: دسترسی مدیر" : "تحلیل‌های پرمیوم"}
            </label>
            {promotingId === user.id && <span role="status" className="text-xs text-muted-foreground">در حال ذخیره…</span>}
          </div></td></tr>)}
        </tbody></table>
      </div>}
    </CardContent></Card>
    <div className="grid gap-4 md:grid-cols-3">{[
      { href: "/analytics/feature-pipeline-debug", title: "پایپ‌لاین شاخص‌ها", description: "ورودی خام و مراحل تبدیل داده", icon: Database },
      { href: "/analytics/mt5-snapshots", title: "JSON متاتریدر", description: "خروجی فنی حساب‌های متصل خودتان", icon: FileJson2 },
      { href: "/architecture/ai-market-analysis", title: "معماری تحلیل", description: "مستندات داخلی سیستم تحلیل", icon: ShieldCheck },
    ].map(({ href, title, description, icon: Icon }) => <Card key={href}><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Icon className="h-4 w-4 text-primary" />{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader><CardContent><Button asChild variant="outline"><Link href={href}>مشاهده</Link></Button></CardContent></Card>)}</div>
    <Dialog open={Boolean(deleteTarget)} onOpenChange={open => { if (!open && !promotingId) { setDeleteTarget(null); setDeleteConfirmation("") } }}><DialogContent dir="rtl"><DialogHeader><DialogTitle>حذف کاربر</DialogTitle><DialogDescription>حساب از فهرست حذف می‌شود و ورود، نشست‌ها و اتصال متاتریدر آن قطع می‌شوند. سوابق مالی و مکالمات نگهداری می‌شوند. برای تأیید، نام کاربری {deleteTarget?.username} را دقیق وارد کنید.</DialogDescription></DialogHeader><Input aria-label="نام کاربری برای تأیید حذف" dir="ltr" autoComplete="off" value={deleteConfirmation} onChange={event => setDeleteConfirmation(event.target.value)} disabled={Boolean(promotingId)} />{promotionError && <p role="alert" className="text-sm text-destructive">{promotionError}</p>}<DialogFooter><Button variant="outline" disabled={Boolean(promotingId)} onClick={() => setDeleteTarget(null)}>انصراف</Button><Button variant="destructive" disabled={Boolean(promotingId) || !deleteTarget || deleteConfirmation !== deleteTarget.username} onClick={() => manageUser(deleteTarget, "delete")}>{promotingId ? "در حال حذف…" : "تأیید حذف کاربر"}</Button></DialogFooter></DialogContent></Dialog>
  </div></Layout>
}
