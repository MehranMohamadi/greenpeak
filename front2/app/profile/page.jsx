"use client"

import { useEffect, useMemo, useState } from "react"
import Layout from "@/components/kokonutui/layout"
import MT5Pairing from "@/components/dashboard/mt5-pairing"
import { useAuth } from "@/components/auth/auth-context"
import { endpoints } from "@/api/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Bell, Crown, LockKeyhole, Plus, Trash2, UserRound } from "lucide-react"

const DEFAULT_NOTIFICATIONS = {
  newsAlerts: true,
  economicEvents: true,
  earningsAlerts: true,
  volatilityAlerts: false,
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
    ["newsAlerts", "News alerts"],
    ["economicEvents", "Economic events"],
    ["earningsAlerts", "Earnings alerts"],
    ["volatilityAlerts", "Volatility alerts"],
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" />Notifications & Alerts</CardTitle>
        <CardDescription>Choose which updates you want to follow and manage your price alerts.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
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
            <h3 className="font-medium">Price alerts</h3>
            <p className="text-sm text-muted-foreground">Add thresholds to keep with this account's profile.</p>
          </div>
          <form onSubmit={addPriceAlert} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
            <Input value={symbol} onChange={(event) => setSymbol(event.target.value.toUpperCase())} maxLength={16} placeholder="Symbol (e.g. AAPL)" aria-label="Symbol" />
            <select value={condition} onChange={(event) => setCondition(event.target.value)} aria-label="Alert condition" className="h-10 rounded-md border border-input bg-background px-3 text-sm">
              <option value="above">Above</option>
              <option value="below">Below</option>
              <option value="change">Percent change</option>
            </select>
            <Input type="number" step="any" value={value} onChange={(event) => setValue(event.target.value)} placeholder={condition === "change" ? "Percent" : "Price"} aria-label="Alert value" />
            <Button type="submit" disabled={!symbol.trim() || value === ""} className="gap-2"><Plus className="h-4 w-4" />Add</Button>
          </form>

          {settings.priceAlerts.length > 0 ? (
            <ul className="space-y-2">
              {settings.priceAlerts.map((alert) => (
                <li key={alert.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <span className="text-sm" dir="ltr">
                    {alert.symbol} {alert.condition === "above" ? "above" : alert.condition === "below" ? "below" : "changes by"} {alert.value}{alert.condition === "change" ? "%" : ""}
                  </span>
                  <Button type="button" variant="ghost" size="icon" onClick={() => removePriceAlert(alert.id)} aria-label={`Remove ${alert.symbol} alert`}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No price alerts yet.</p>
          )}
        </div>
        <p className="text-xs text-muted-foreground">Notification preferences are saved in this browser for this account.</p>
      </CardContent>
    </Card>
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
      setFeedback({ type: "error", text: "New password and confirmation do not match." })
      return
    }
    if (newPassword.length < 8) {
      setFeedback({ type: "error", text: "New password must be at least 8 characters." })
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
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.detail || "Could not update the password.")
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setFeedback({ type: "success", text: body.message || "Password updated successfully." })
    } catch (error) {
      setFeedback({ type: "error", text: error instanceof Error ? error.message : "Could not update the password." })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><LockKeyhole className="h-5 w-5" />Change password</CardTitle>
        <CardDescription>Confirm your current password before setting a new one.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">Current password</Label>
            <Input id="current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input id="new-password" type="password" autoComplete="new-password" minLength={8} maxLength={128} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input id="confirm-password" type="password" autoComplete="new-password" minLength={8} maxLength={128} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
            </div>
          </div>
          {feedback && <p role="status" className={`text-sm ${feedback.type === "error" ? "text-red-600" : "text-emerald-600"}`}>{feedback.text}</p>}
          <Button type="submit" disabled={isSaving || !accessToken}>{isSaving ? "Updating..." : "Update password"}</Button>
        </form>
      </CardContent>
    </Card>
  )
}

export default function ProfilePage() {
  const { user } = useAuth()
  const userKey = String(user?.id || user?.username || "account")
  const isPremium = user?.is_premium === true || ["premium", "pro"].includes(String(user?.subscription ?? user?.plan ?? "").toLowerCase())

  return (
    <Layout>
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
        <header className="flex flex-wrap items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary"><UserRound className="h-6 w-6" /></div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Profile</h1>
            <p className="text-muted-foreground">Manage your account, alerts, and connected services.</p>
          </div>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Account details</CardTitle>
            <CardDescription>Your profile is tied to the signed-in GreenPeak account.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Username</p>
              <p className="font-medium">{user?.username || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Account type</p>
              <p className="font-medium">{user?.role === "admin" ? "Administrator" : "User"}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="mb-1 text-sm text-muted-foreground">Subscription</p>
              <div className="flex items-center gap-2">
                {isPremium ? <Crown className="h-4 w-4 text-amber-500" /> : null}
                <Badge variant={isPremium ? "default" : "secondary"}>{isPremium ? "Premium" : "Free"}</Badge>
                <span className="text-sm text-muted-foreground">{isPremium ? "Premium access is active." : "Premium access is not active for this account."}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <ProfileNotifications key={userKey} userKey={userKey} />

        <div className="grid gap-6 lg:grid-cols-2">
          <ChangePassword />
          <MT5Pairing />
        </div>
      </div>
    </Layout>
  )
}
