"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import BrokerAccountOverview from "@/components/kokonutui/broker-account-overview"
import LastTrades from "@/components/kokonutui/last-trades"
import { useAuth } from "@/components/auth/auth-context"
import { MT5_BROKER_DELETED_EVENT, notifyBrokerDeleted, withoutBroker } from "@/lib/mt5-account-changes"

function responseError(body, status) {
  if (typeof body?.detail === "string") return body.detail
  return status === 503 ? "سرویس حساب‌های معاملاتی در دسترس نیست" : `دریافت حساب‌های معاملاتی ممکن نشد (${status})`
}

export default function MT5AccountSnapshot() {
  const { accessToken, isLoading: authLoading } = useAuth()
  const [snapshots, setSnapshots] = useState([])
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const requestController = useRef(null)

  const load = useCallback(async () => {
    if (authLoading) return
    requestController.current?.abort()
    if (!accessToken) {
      setSnapshots([])
      setError("برای مشاهده حساب‌های معاملاتی ابتدا وارد حساب کاربری شوید")
      setLoading(false)
      return
    }
    const controller = new AbortController()
    requestController.current = controller
    setLoading(true)
    try {
      const response = await fetch("/dashboard-data/mt5/accounts", {
        cache: "no-store",
        signal: controller.signal,
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(responseError(body, response.status))
      if (!Array.isArray(body)) throw new Error("پاسخ حساب‌های معاملاتی معتبر نیست")
      if (controller.signal.aborted) return
      setSnapshots(body)
      setError("")
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "دریافت حساب‌های معاملاتی ممکن نشد")
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [accessToken, authLoading])

  useEffect(() => {
    load()
    const timer = window.setInterval(load, 60000)
    const handleDelete = (event) => {
      setSnapshots((current) => withoutBroker(current, event.detail.broker_company))
      load()
    }
    window.addEventListener(MT5_BROKER_DELETED_EVENT, handleDelete)
    return () => {
      window.clearInterval(timer)
      requestController.current?.abort()
      window.removeEventListener(MT5_BROKER_DELETED_EVENT, handleDelete)
    }
  }, [load])

  const deleteBroker = async (brokerCompany) => {
    if (!accessToken) throw new Error("برای حذف بروکر وارد حساب کاربری شوید.")
    const response = await fetch("/dashboard-data/mt5/brokers", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ broker_company: brokerCompany }),
    })
    const body = await response.json().catch(() => null)
    if (!response.ok) throw new Error(typeof body?.detail === "string" ? body.detail : "حذف بروکر انجام نشد؛ دوباره تلاش کنید.")
    if (body?.broker_company !== brokerCompany || !Array.isArray(body?.deleted_accounts)) {
      throw new Error("پاسخ حذف بروکر معتبر نیست؛ دوباره تلاش کنید.")
    }
    notifyBrokerDeleted(body, snapshots)
  }

  if (loading && snapshots.length === 0) {
    return <Card className="border-gray-200 bg-white dark:border-[#2B2B30] dark:bg-[#1F1F23]">
      <CardContent className="flex items-center gap-3 p-4 text-sm text-muted-foreground" dir="rtl">
        <RefreshCw className="h-4 w-4 animate-spin" />در حال دریافت حساب‌های معاملاتی…
      </CardContent>
    </Card>
  }

  return <section id="trading-accounts-title" className="space-y-3" aria-label="حساب‌ها، معاملات و سفارش‌ها" dir="rtl">
    <BrokerAccountOverview snapshots={snapshots} accessToken={accessToken} onDeleteBroker={deleteBroker} onRefresh={load} loading={loading} error={error} />
    {snapshots.length === 0 && <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-amber-800 dark:text-amber-200">
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 shrink-0" />
        <div><p className="text-sm font-medium">هنوز Snapshot حساب معاملاتی دریافت نشده است</p><p className="mt-0.5 text-xs opacity-80">{error || "اتصال MT5 را بررسی کنید و یک Snapshot جدید بفرستید؛ باکس‌ها در ادامه قابل مشاهده‌اند."}</p></div>
      </div>
      <div className="flex items-center gap-2">
        <Button asChild variant="outline" size="sm"><Link href="/profile#broker-connection">تنظیمات اتصال</Link></Button>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw className={`ml-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />تلاش دوباره</Button>
      </div>
    </div>}
    {error && snapshots.length > 0 && <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">به‌روزرسانی انجام نشد؛ آخرین Snapshot سالم نمایش داده می‌شود. {error}</p>}
    <LastTrades snapshots={snapshots} />
  </section>
}
