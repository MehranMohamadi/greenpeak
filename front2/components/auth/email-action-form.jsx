"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { endpoints } from "@/api/api"
import { authRequest } from "@/components/auth/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const actions = {
  verify: { title: "Verify your email", endpoint: endpoints.auth.verifyEmail, button: "Verify email", token: true },
  resend: { title: "Resend verification email", endpoint: endpoints.auth.resendVerification, button: "Send verification email" },
  forgot: { title: "Forgot password", endpoint: endpoints.auth.forgotPassword, button: "Send reset link" },
  reset: { title: "Reset your password", endpoint: endpoints.auth.resetPassword, button: "Reset password", token: true },
}

export default function EmailActionForm({ mode }) {
  const action = actions[mode]
  const [token, setToken] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [complete, setComplete] = useState(false)
  const initialized = useRef(false)

  useEffect(() => {
    // Fragments are excluded from server logs and Referrer headers. Explicit
    // submission avoids mail scanners consuming the single-use link.
    if (action.token) {
      if (initialized.current) return
      initialized.current = true
      setToken(new URLSearchParams(window.location.hash.slice(1)).get("token") || "")
      window.history.replaceState(null, "", window.location.pathname)
    }
  }, [action.token])

  async function submit(event) {
    event.preventDefault()
    setError("")
    if (mode === "reset" && password !== confirm) {
      setError("Passwords do not match.")
      return
    }
    setBusy(true)
    const body = action.token ? { token, ...(mode === "reset" ? { password } : {}) } : { email }
    const result = await authRequest(action.endpoint, body)
    if (result.success) {
      setMessage(result.message)
      setComplete(true)
    } else setError(result.error)
    setBusy(false)
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <Card className="w-full max-w-md border-slate-700 bg-slate-900 text-white">
        <CardHeader><CardTitle>{action.title}</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
          {message && <p role="status" className="text-sm text-cyan-300">{message}</p>}
          {!complete && <form onSubmit={submit} className="space-y-4">
            {!action.token && <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} /></div>}
            {mode === "reset" && <>
              <div className="space-y-2"><Label htmlFor="password">New password</Label><Input id="password" type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="confirm">Confirm password</Label><Input id="confirm" type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} /></div>
            </>}
            {action.token && !token && <p className="text-sm text-slate-300">Open the link from your email, or request a new one below.</p>}
            <Button type="submit" disabled={busy || (action.token && !token)} className="w-full">{busy ? "Please wait..." : action.button}</Button>
          </form>}
          <div className="flex justify-between text-sm text-cyan-400">
            <Link href="/login">Back to sign in</Link>
            {action.token && <Link href={mode === "verify" ? "/resend-verification" : "/forgot-password"}>Request a new link</Link>}
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
