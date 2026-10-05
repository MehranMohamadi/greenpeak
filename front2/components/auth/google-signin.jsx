"use client"

import { useEffect, useRef, useState } from "react"
import Script from "next/script"
import { useRouter } from "next/navigation"
import { endpoints } from "@/api/api"
import { authRequest, useAuth } from "@/components/auth/auth-context"

export default function GoogleSignin({ linkAccount = false, compact = false }) {
  const { googleLogin, accessToken } = useAuth()
  const router = useRouter()
  const container = useRef(null)
  const callback = useRef(null)
  const inProgress = useRef(false)
  const [config, setConfig] = useState(null)
  const [ready, setReady] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")

  useEffect(() => {
    const controller = new AbortController()
    fetch(endpoints.auth.googleChallenge, { credentials: "include", cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Google sign-in is temporarily unavailable.")
        return response.json()
      })
      .then(setConfig)
      .catch((error) => {
        if (error.name !== "AbortError") {
          setConfig({ enabled: false })
          setMessage(error.message)
        }
      })
    return () => controller.abort()
  }, [attempt])

  callback.current = async ({ credential }) => {
    if (inProgress.current || !config?.nonce) return
    inProgress.current = true
    setBusy(true)
    const result = linkAccount
      ? await authRequest(endpoints.auth.googleLink, { credential, nonce: config.nonce }, accessToken)
      : await googleLogin(credential, config.nonce)
    if (result.success && result.user) router.push("/")
    else setMessage(result.success ? result.message : result.error)
    setBusy(false)
    inProgress.current = false
    setConfig(null)
    setAttempt((value) => value + 1)
  }

  useEffect(() => {
    if (!container.current) return
    container.current.replaceChildren()
    if (!ready || !config?.enabled) return
    window.google.accounts.id.initialize({
      client_id: config.client_id, nonce: config.nonce,
      callback: (response) => callback.current(response), auto_select: false,
    })
    window.google.accounts.id.renderButton(container.current, { theme: "outline", size: "large", text: "continue_with", width: 300 })
  }, [config, ready])

  const statusMessage = busy ? "Connecting to Google..." : message || (config?.enabled === false ? "Google sign-in is currently unavailable." : !config?.enabled || !ready ? "Loading Google sign-in..." : "")

  return (
    <div className={compact ? "space-y-1.5" : "space-y-3"}>
      {config?.enabled && <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onReady={() => setReady(true)} onError={() => {
        setConfig({ enabled: false })
        setMessage("Google could not load. Use email sign-in or try again later.")
      }} />}
      {linkAccount && <p className="text-sm text-slate-400">Connect your Google account to sign in without a password.</p>}
      {(!config?.enabled || !ready) && (
        <div className="flex justify-center">
          <button type="button" disabled aria-describedby="google-signin-status" className="flex h-10 w-[300px] max-w-full items-center justify-center gap-3 rounded border border-slate-300 bg-white px-4 text-sm font-medium text-slate-600 disabled:cursor-not-allowed">
            <span aria-hidden="true" className="text-lg font-bold text-blue-600">G</span>
            Continue with Google
          </button>
        </div>
      )}
      <div ref={container} className={`${config?.enabled && ready ? "flex" : "hidden"} justify-center ${busy ? "pointer-events-none opacity-50" : ""}`} />
      {statusMessage && <p id="google-signin-status" role="status" className={compact ? "text-center text-xs text-slate-400" : "text-sm text-slate-400"}>{statusMessage}</p>}
    </div>
  )
}
