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

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [accessToken, setAccessToken] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const restoreSession = async () => {
      const token = window.localStorage.getItem(TOKEN_KEY)
      if (!token) {
        setIsLoading(false)
        return
      }
      try {
        setAccessToken(token)
        const response = await fetch(endpoints.auth.me, { headers: { Authorization: `Bearer ${token}` } })
        if (!response.ok) throw new Error("Invalid session")
        setUser(await response.json())
      } catch {
        window.localStorage.removeItem(TOKEN_KEY)
        setAccessToken(null)
      } finally {
        setIsLoading(false)
      }
    }
    restoreSession()
  }, [])

  const authenticate = async (url, username, password) => {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      })
      if (!response.ok) return { success: false, error: await readError(response) }
      const data = await response.json()
      window.localStorage.setItem(TOKEN_KEY, data.access_token)
      setAccessToken(data.access_token)
      setUser(data.user)
      return { success: true, user: data.user }
    } catch {
      return { success: false, error: "Cannot connect to the authentication service." }
    }
  }

  const login = (username, password) => authenticate(endpoints.auth.login, username, password)
  const signup = (username, password) => authenticate(endpoints.auth.signup, username, password)

  const logout = () => {
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
