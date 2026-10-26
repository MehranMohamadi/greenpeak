"use client"

import { useCallback, useEffect, useState } from "react"
import { Check, Copy, Eye, EyeOff, Link2, Loader2, Trash2 } from "lucide-react"
import { endpoints } from "@/api/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/components/auth/auth-context"
import BrokerConnectionSetup from "@/components/dashboard/broker-connection-setup"

export default function MT5Pairing() {
  const { accessToken } = useAuth()
  return <MT5PairingContent key={accessToken || "signed-out"} accessToken={accessToken} />
}

function MT5PairingContent({ accessToken }) {
  const [connections, setConnections] = useState([])
  const [label, setLabel] = useState("حساب متاتریدر من")
  const [visibleKeys, setVisibleKeys] = useState({})
  const [revealingId, setRevealingId] = useState("")
  const [copied, setCopied] = useState("")
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
      if (!response.ok) throw new Error("ساخت کلید اتصال ممکن نشد. دوباره تلاش کنید.")
      setVisibleKeys((current) => ({ ...current, [body.connection.id]: body.pairing_token }))
      setConnections((current) => [body.connection, ...current])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "ساخت کلید اتصال ممکن نشد.")
    } finally {
      setLoading(false)
    }
  }

  const revoke = async (id) => {
    setError("")
    try {
      const response = await fetch(`${endpoints.mt5.connections}/${id}`, { method: "DELETE", headers: headers() })
      if (!response.ok) throw new Error("لغو این اتصال ممکن نشد.")
      hideKey(id)
      setConnections((current) => current.filter((item) => item.id !== id))
    } catch {
      setError("لغو این اتصال ممکن نشد.")
    }
  }

  const hideKey = (id) => {
    setVisibleKeys((current) => {
      const next = { ...current }
      delete next[id]
      return next
    })
    setCopied("")
  }

  const revealKey = async (id) => {
    setRevealingId(id)
    setError("")
    try {
      const response = await fetch(endpoints.mt5.connectionKey(id), { method: "POST", headers: headers(), cache: "no-store" })
      const body = await response.json()
      if (response.status === 409) throw new Error("برای نمایش دوباره کلید قبلی این اتصال، یک‌بار از متاتریدر اطلاعات حساب را ارسال کنید؛ سپس دوباره «نمایش کلید» را بزنید. نیازی به ساخت کلید جدید نیست.")
      if (!response.ok || !body.pairing_token) throw new Error("نمایش کلید اتصال ممکن نشد. دوباره تلاش کنید.")
      setVisibleKeys((current) => ({ ...current, [id]: body.pairing_token }))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "نمایش کلید اتصال ممکن نشد.")
    } finally {
      setRevealingId("")
    }
  }

  const copyKey = async (id) => {
    try {
      await navigator.clipboard.writeText(visibleKeys[id])
      setCopied(id)
      window.setTimeout(() => setCopied(""), 1500)
    } catch {
      setError("کپی خودکار ممکن نشد؛ کلید را انتخاب و کپی کنید.")
    }
  }

  return <Card id="broker-connection" className="scroll-mt-20 border-primary/20">
    <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
      <CardTitle className="flex items-center gap-2 text-base"><Link2 className="h-5 w-5 text-primary" />اتصال متاتریدر ۵</CardTitle>
      <BrokerConnectionSetup />
    </CardHeader>
    <CardContent className="space-y-3 pb-4">
      <p className="text-xs leading-6 text-muted-foreground">اکسپرت را دانلود کنید و کلید اتصال را در تنظیمات آن وارد کنید.</p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Label htmlFor="mt5-connection-label" className="shrink-0">نام اتصال</Label>
        <Input id="mt5-connection-label" value={label} maxLength={80} onChange={(event) => setLabel(event.target.value)} placeholder="مثلاً حساب اصلی من" />
        <Button
          onClick={createConnection}
          disabled={loading || !accessToken || !label.trim()}
          className="shrink-0 border border-zinc-950 bg-zinc-950 text-white hover:bg-zinc-800 hover:text-white focus-visible:ring-zinc-950 dark:border-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 dark:hover:text-zinc-950 dark:focus-visible:ring-white"
        >
          {loading ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Link2 className="ml-2 h-4 w-4" />}ساخت کلید اتصال
        </Button>
      </div>

      {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
      {connections.length > 0 && <div className="space-y-2">
        {connections.map((connection) => <div key={connection.id} className="space-y-3 rounded-lg border p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><span className="break-words font-medium">{connection.label}</span><Badge variant={connection.status === "connected" ? "default" : "secondary"}>{connection.status === "connected" ? "متصل" : "در انتظار اولین اطلاعات حساب"}</Badge></div>
              {connection.account_identity && <p className="mt-1 break-words text-xs text-muted-foreground" dir="ltr">{connection.account_identity.broker_company} · {connection.account_identity.trade_server} · {connection.account_identity.account_identifier}</p>}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={Boolean(revealingId)} aria-expanded={Boolean(visibleKeys[connection.id])} aria-controls={`connection-key-${connection.id}`} onClick={() => visibleKeys[connection.id] ? hideKey(connection.id) : revealKey(connection.id)}>
                {revealingId === connection.id ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : visibleKeys[connection.id] ? <EyeOff className="ml-2 h-4 w-4" /> : <Eye className="ml-2 h-4 w-4" />}
                {visibleKeys[connection.id] ? "پنهان‌کردن کلید" : "نمایش کلید"}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => revoke(connection.id)} aria-label={`لغو اتصال ${connection.label}`}><Trash2 className="h-4 w-4 text-red-500" /></Button>
            </div>
          </div>
          <div id={`connection-key-${connection.id}`} hidden={!visibleKeys[connection.id]}>
            {visibleKeys[connection.id] && <div className="flex items-start gap-2">
              <code className="min-w-0 flex-1 select-all break-all rounded bg-slate-950 p-3 text-left text-xs leading-6 text-cyan-300" dir="ltr">{visibleKeys[connection.id]}</code>
              <Button variant="outline" size="icon" className="shrink-0" onClick={() => copyKey(connection.id)} aria-label={`کپی کلید اتصال ${connection.label}`}>{copied === connection.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</Button>
            </div>}
          </div>
        </div>)}
      </div>}
    </CardContent>
  </Card>
}
