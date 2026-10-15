"use client"

import { useCallback, useEffect, useState } from "react"
import { Check, Copy, Link2, Loader2, Trash2 } from "lucide-react"
import { endpoints } from "@/api/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/components/auth/auth-context"

export default function MT5Pairing() {
  const { accessToken } = useAuth()
  const [connections, setConnections] = useState([])
  const [label, setLabel] = useState("حساب متاتریدر من")
  const [pairingToken, setPairingToken] = useState("")
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const headers = useCallback((json = false) => ({
    Authorization: `Bearer ${accessToken}`,
    ...(json ? { "Content-Type": "application/json" } : {}),
  }), [accessToken])

  const loadConnections = useCallback(async () => {
    if (!accessToken) return
    try {
      const response = await fetch(endpoints.mt5.connections, { headers: headers(), cache: "no-store" })
      const body = await response.json()
      if (!response.ok) throw new Error(body.detail || "دریافت فهرست اتصال‌ها ممکن نشد.")
      setConnections(body)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "دریافت فهرست اتصال‌ها ممکن نشد.")
    }
  }, [accessToken, headers])

  useEffect(() => { loadConnections() }, [loadConnections])

  const createConnection = async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch(endpoints.mt5.connections, {
        method: "POST",
        headers: headers(true),
        body: JSON.stringify({ label }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.detail || "ساخت توکن اتصال ممکن نشد.")
      setPairingToken(body.pairing_token)
      setConnections((current) => [body.connection, ...current])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "ساخت توکن اتصال ممکن نشد.")
    } finally {
      setLoading(false)
    }
  }

  const revoke = async (id) => {
    const response = await fetch(`${endpoints.mt5.connections}/${id}`, { method: "DELETE", headers: headers() })
    if (response.ok) setConnections((current) => current.filter((item) => item.id !== id))
    else setError("لغو این اتصال ممکن نشد.")
  }

  const copyToken = async () => {
    await navigator.clipboard.writeText(pairingToken)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return <Card className="border-primary/20">
    <CardHeader>
      <CardTitle className="flex items-center gap-2"><Link2 className="h-5 w-5 text-primary" />توکن اتصال متاتریدر ۵</CardTitle>
      <CardDescription>برای حساب خود توکن بسازید و آن را در ورودی <span dir="ltr">GreenPeakApiToken</span> تنظیمات اکسپرت گرین‌پیک وارد کنید.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      <Label htmlFor="mt5-connection-label">نام اتصال</Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input id="mt5-connection-label" value={label} maxLength={80} onChange={(event) => setLabel(event.target.value)} placeholder="مثلاً حساب اصلی من" />
        <Button
          onClick={createConnection}
          disabled={loading || !accessToken || !label.trim()}
          className="shrink-0 border border-zinc-950 bg-zinc-950 text-white hover:bg-zinc-800 hover:text-white focus-visible:ring-zinc-950 dark:border-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 dark:hover:text-zinc-950 dark:focus-visible:ring-white"
        >
          {loading ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Link2 className="ml-2 h-4 w-4" />}ساخت توکن اتصال
        </Button>
      </div>

      {pairingToken && <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
        <p className="font-medium">این توکن را اکنون ذخیره کنید؛ فقط همین یک‌بار نمایش داده می‌شود.</p>
        <div className="flex gap-2">
          <code className="min-w-0 flex-1 overflow-x-auto rounded bg-slate-950 p-3 text-xs text-cyan-300" dir="ltr">{pairingToken}</code>
          <Button variant="outline" size="icon" onClick={copyToken} aria-label="کپی توکن اتصال">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</Button>
        </div>
        <ol className="list-decimal space-y-1 ps-5 text-sm leading-7 text-muted-foreground">
          <li>تنظیمات اکسپرت گرین‌پیک را در متاتریدر ۵ باز کنید.</li>
          <li>توکن را در قسمت <span dir="ltr">GreenPeakApiToken</span> وارد کنید.</li>
          <li>دسترسی <span dir="ltr">WebRequest</span> را برای آدرس API گرین‌پیک فعال کنید و اولین اطلاعات حساب را ارسال کنید.</li>
        </ol>
      </div>}

      {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
      {connections.length > 0 && <div className="space-y-2">
        {connections.map((connection) => <div key={connection.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
          <div>
            <div className="flex items-center gap-2"><span className="font-medium">{connection.label}</span><Badge variant={connection.status === "connected" ? "default" : "secondary"}>{connection.status === "connected" ? "متصل" : "در انتظار اولین اطلاعات حساب"}</Badge></div>
            {connection.account_identity && <p className="mt-1 text-xs text-muted-foreground" dir="ltr">{connection.account_identity.broker_company} · {connection.account_identity.trade_server} · {connection.account_identity.account_identifier}</p>}
          </div>
          <Button variant="ghost" size="icon" onClick={() => revoke(connection.id)} aria-label="لغو اتصال"><Trash2 className="h-4 w-4 text-red-500" /></Button>
        </div>)}
      </div>}
    </CardContent>
  </Card>
}
