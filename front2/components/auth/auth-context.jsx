"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { endpoints } from "@/api/api"

const AuthContext = createContext(undefined)
const TOKEN_KEY = "sp500_access_token"

async function readError(response) {
  try {
    const body = await response.json()
    return typeof body.detail === "string" ? body.detail : "Authentication failed."
  } catch {
    return "Authentication service is unavailable."
  }
}

export async function authRequest(url, body, token) {
  try {
    const response = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    })
    if (!response.ok) return { success: false, error: await readError(response) }
    return { success: true, ...await response.json() }
  } catch {
    return { success: false, error: "Cannot connect to the authentication service." }
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [accessToken, setAccessToken] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const restoreSession = async () => {
      // Migrate existing browser sessions once; all new persistent sessions
      // live in an HttpOnly cookie. Bearer tokens remain only in React memory
      // for existing authenticated dashboard consumers.
      const legacyToken = window.localStorage.getItem(TOKEN_KEY)
      window.localStorage.removeItem(TOKEN_KEY)
      try {
        const response = await fetch(endpoints.auth.session, { credentials: "include", cache: "no-store" })
        if (response.ok) {
          const session = await response.json()
          setAccessToken(session.access_token)
          setUser(session.user)
        } else if (legacyToken) {
          const previous = await authRequest(endpoints.auth.migrateSession, {}, legacyToken)
          if (!previous.success) throw new Error("Invalid session")
          setAccessToken(previous.access_token)
          setUser(previous.user)
        }
      } catch {
        window.localStorage.removeItem(TOKEN_KEY)
        setAccessToken(null)
      } finally {
        setIsLoading(false)
      }
    }
    restoreSession()
  }, [])

  const authenticate = async (url, body) => {
    const data = await authRequest(url, body)
    if (!data.success || !data.access_token) return data
    setAccessToken(data.access_token)
    setUser(data.user)
    return { success: true, user: data.user }
  }

  const login = (username, password) => authenticate(endpoints.auth.login, { username, password })
  const signup = (username, email, password) => authRequest(endpoints.auth.signup, { username, email, password })

  const logout = async () => {
    const result = await authRequest(endpoints.auth.logout, {})
    if (!result.success) {
      window.alert(result.error)
      return
    }
    window.localStorage.removeItem(TOKEN_KEY)
    setAccessToken(null)
    setUser(null)
    window.location.href = "/login"
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated: Boolean(user), user, accessToken, isLoading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) throw new Error("useAuth must be used within an AuthProvider")
  return context
}
