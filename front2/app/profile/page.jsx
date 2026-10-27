"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import Layout from "@/components/kokonutui/layout"
import MT5Pairing from "@/components/dashboard/mt5-pairing"
import ProfileSettings from "@/components/dashboard/profile-settings"
import { useAuth } from "@/components/auth/auth-context"
import { endpoints } from "@/api/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Crown, Plus, Trash2, UserRound } from "lucide-react"

const DEFAULT_NOTIFICATIONS = {
  newsAlerts: true,
  economicEvents: true,
  earningsAlerts: true,
  volatilityAlerts: false,
  generalMessages: true,
  forYou: true,
  priceAlerts: [],
}

function ProfileNotifications({ userKey }) {
  const storageKey = useMemo(() => `greenpeak:profile-notifications:v1:${encodeURIComponent(userKey)}`, [userKey])
  const [settings, setSettings] = useState(DEFAULT_NOTIFICATIONS)
  const [isLoaded, setIsLoaded] = useState(false)
  const [symbol, setSymbol] = useState("")
  const [condition, setCondition] = useState("above")
  const [value, setValue] = useState("")

  useEffect(() => {
    setIsLoaded(false)
    try {
      const saved = window.localStorage.getItem(storageKey)
      const parsed = saved ? JSON.parse(saved) : {}
      setSettings({
        ...DEFAULT_NOTIFICATIONS,
        ...parsed,
        priceAlerts: Array.isArray(parsed.priceAlerts) ? parsed.priceAlerts : [],
      })
    } catch {
      setSettings(DEFAULT_NOTIFICATIONS)
    } finally {
      setIsLoaded(true)
    }
  }, [storageKey])

  useEffect(() => {
    if (!isLoaded) return
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(settings))
    } catch {
      // Keep this page usable if the browser blocks local storage.
    }
  }, [isLoaded, settings, storageKey])

  const updateSetting = (key, checked) => setSettings((current) => ({ ...current, [key]: checked }))

  const addPriceAlert = (event) => {
    event.preventDefault()
    const parsedValue = Number(value)
    if (!symbol.trim() || value === "" || !Number.isFinite(parsedValue)) return
    setSettings((current) => ({
      ...current,
      priceAlerts: [...current.priceAlerts, {
        id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
        symbol: symbol.trim().toUpperCase(),
        condition,
        value: parsedValue,
      }],
    }))
    setSymbol("")
    setValue("")
  }

  const removePriceAlert = (id) => setSettings((current) => ({
    ...current,
    priceAlerts: current.priceAlerts.filter((alert) => alert.id !== id),
  }))

  const toggles = [
    ["newsAlerts", "اخبار"],
    ["economicEvents", "رویدادهای اقتصادی"],
    ["earningsAlerts", "گزارش‌های درآمد شرکت‌ها"],
    ["volatilityAlerts", "نوسانات بازار"],
    ["generalMessages", "پیام‌های عمومی"],
    ["forYou", "برای شما"],
  ]

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {toggles.map(([key, label]) => (
          <div key={key} className="flex items-center justify-between gap-4">
            <Label htmlFor={`profile-${key}`}>{label}</Label>
            <Switch id={`profile-${key}`} checked={Boolean(settings[key])} onCheckedChange={(checked) => updateSetting(key, checked)} />
          </div>
        ))}
      </div>

      <div className="space-y-3 border-t pt-5">
        <div>
          <h3 className="font-medium">آلارم‌های قیمت</h3>
        </div>
        <form onSubmit={addPriceAlert} className="grid grid-cols-1 gap-2 sm:grid-cols-2 [&>*]:min-w-0">
          <Input value={symbol} onChange={(event) => setSymbol(event.target.value.toUpperCase())} maxLength={16} placeholder="نماد (مثلاً AAPL)" aria-label="نماد" />
          <select value={condition} onChange={(event) => setCondition(event.target.value)} aria-label="شرط آلارم" className="h-10 rounded-md border border-input bg-background px-3 text-sm">
            <option value="above">بالاتر از</option>
            <option value="below">پایین‌تر از</option>
            <option value="change">درصد تغییر</option>
          </select>
          <Input type="number" step="any" value={value} onChange={(event) => setValue(event.target.value)} placeholder={condition === "change" ? "درصد" : "قیمت"} aria-label="مقدار آلارم" />
          <Button type="submit" disabled={!symbol.trim() || value === ""} className="gap-2"><Plus className="h-4 w-4" />افزودن</Button>
        </form>

        {settings.priceAlerts.length > 0 ? (
          <ul className="space-y-2">
            {settings.priceAlerts.map((alert) => (
              <li key={alert.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <span className="text-sm" dir="auto">
                  {alert.symbol} {alert.condition === "above" ? "بالاتر از" : alert.condition === "below" ? "پایین‌تر از" : "تغییر به میزان"} {alert.value}{alert.condition === "change" ? "%" : ""}
                </span>
                <Button type="button" variant="ghost" size="icon" onClick={() => removePriceAlert(alert.id)} aria-label={`حذف آلارم ${alert.symbol}`}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">هنوز آلارم قیمتی ثبت نشده است.</p>
        )}
      </div>
      <p className="text-xs text-muted-foreground">تنظیمات اعلان این حساب در همین مرورگر ذخیره می‌شود.</p>
    </div>
  )
}

function ChangePassword() {
  const { accessToken } = useAuth()
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState(null)

  const submit = async (event) => {
    event.preventDefault()
    setFeedback(null)
    if (newPassword !== confirmPassword) {
      setFeedback({ type: "error", text: "رمز عبور جدید و تکرار آن یکسان نیستند." })
      return
    }
    if (newPassword.length < 8) {
      setFeedback({ type: "error", text: "رمز عبور جدید باید حداقل ۸ نویسه داشته باشد." })
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch(endpoints.auth.changePassword, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      })
      if (!response.ok) throw new Error(response.status === 401 ? "رمز عبور فعلی نادرست است یا نشست شما منقضی شده است." : "تغییر رمز عبور ممکن نشد؛ دوباره تلاش کنید.")
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setFeedback({ type: "success", text: "رمز عبور با موفقیت تغییر کرد." })
    } catch (error) {
      setFeedback({ type: "error", text: error instanceof Error && error.message.startsWith("رمز عبور") ? error.message : "تغییر رمز عبور ممکن نشد؛ دوباره تلاش کنید." })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="current-password">رمز عبور فعلی</Label>
        <Input id="current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="new-password">رمز عبور جدید</Label>
          <Input id="new-password" type="password" autoComplete="new-password" minLength={8} maxLength={128} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm-password">تکرار رمز عبور جدید</Label>
          <Input id="confirm-password" type="password" autoComplete="new-password" minLength={8} maxLength={128} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
        </div>
      </div>
      {feedback && <p role="status" className={`text-sm ${feedback.type === "error" ? "text-red-600" : "text-emerald-600"}`}>{feedback.text}</p>}
      <Button type="submit" disabled={isSaving || !accessToken}>{isSaving ? "در حال ذخیره…" : "ذخیره رمز عبور"}</Button>
    </form>
  )
}

export default function ProfilePage() {
  const { user, canViewPremiumAnalysis } = useAuth()
  const userKey = String(user?.id || user?.username || "account")
  const isPremium = canViewPremiumAnalysis

  useEffect(() => {
    let frame
    const scrollToSection = () => {
      const section = window.location.hash.slice(1)
      if (!["broker-connection", "dashboard-settings"].includes(section)) return
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => document.getElementById(section)?.scrollIntoView({ block: "start" }))
    }
    // The protected profile mounts after authentication has finished, which
    // can be later than Next.js's initial attempt to scroll to the hash.
    scrollToSection()
    window.addEventListener("hashchange", scrollToSection)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("hashchange", scrollToSection)
    }
  }, [userKey])

  return (
    <Layout>
      <div className="w-full space-y-4 py-4 md:py-6" dir="rtl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary"><UserRound className="h-6 w-6" /></div>
            <h1 className="text-3xl font-bold text-foreground" dir="rtl">پروفایل</h1>
          </div>
          <div className="ms-auto flex flex-wrap items-center gap-2">
            <ProfileSettings key={userKey} notifications={<ProfileNotifications userKey={userKey} />} password={<ChangePassword />} />
            {["staff", "admin"].includes(user?.role) && <nav aria-label="دسترسی‌های کاری و مدیریت" className="flex flex-wrap items-center gap-2">
              <Button asChild size="sm" className="h-9"><Link href="/workplace">میز کار من</Link></Button>
            </nav>}
          </div>
        </header>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">مشخصات حساب</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 pb-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_2fr] [&>*]:min-w-0">
            <div>
              <p className="text-sm text-muted-foreground">نام کاربری</p>
              <p className="break-words font-medium" dir="auto">{user?.username || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">نوع حساب</p>
              <p className="font-medium">{user?.role === "admin" ? "مدیر" : user?.role === "staff" ? "کارمند" : "کاربر"}</p>
            </div>
            <div className="sm:col-span-2 lg:col-span-1">
              <p className="mb-1 text-sm text-muted-foreground">دسترسی تحلیل‌ها</p>
              <div className="flex flex-wrap items-center gap-2">
                {isPremium ? <Crown className="h-4 w-4 text-amber-500" /> : null}
                <Badge variant={isPremium ? "default" : "secondary"}>{isPremium ? "پرمیوم" : "رایگان"}</Badge>
                <span className="text-sm text-muted-foreground">{isPremium ? "دسترسی پرمیوم فعال است." : "دسترسی پرمیوم برای این حساب فعال نیست."}</span>
              </div>
            </div>
          </CardContent>
        </Card>
        <MT5Pairing key={`broker-${userKey}`} />
      </div>
    </Layout>
  )
}
