"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Lock, TrendingUp, User } from "lucide-react"
import { useAuth } from "./auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function SignupForm() {
  const { signup } = useAuth()
  const router = useRouter()
  const [form, setForm] = useState({ username: "", password: "", confirmPassword: "" })
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError("")
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.")
      return
    }
    setIsLoading(true)
    const result = await signup(form.username, form.password)
    if (result.success) router.push("/")
    else setError(result.error)
    setIsLoading(false)
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-gray-900 to-slate-900 px-4">
      <Card className="w-full max-w-md border-slate-700/50 bg-slate-900/80 shadow-2xl">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-cyan-600"><TrendingUp className="h-8 w-8 text-white" /></div>
          <CardTitle className="text-3xl text-white">Create account</CardTitle>
          <CardDescription className="text-slate-300">Choose a username and password for GreenPeak.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && <div className="rounded-lg border border-red-400/30 bg-red-500/20 p-3 text-sm text-red-200">{error}</div>}
            <div className="space-y-2">
              <Label htmlFor="signup-username" className="flex items-center gap-2 text-slate-200"><User className="h-4 w-4" />Username</Label>
              <Input id="signup-username" minLength={3} maxLength={32} required autoComplete="username" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} className="border-slate-600/50 bg-slate-800/50 text-white" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-password" className="flex items-center gap-2 text-slate-200"><Lock className="h-4 w-4" />Password</Label>
              <div className="relative">
                <Input id="signup-password" type={showPassword ? "text" : "password"} minLength={6} maxLength={128} required autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} className="border-slate-600/50 bg-slate-800/50 pr-10 text-white" />
                <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200" aria-label={showPassword ? "Hide password" : "Show password"}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password" className="text-slate-200">Confirm password</Label>
              <div className="relative">
                <Input id="confirm-password" type={showConfirmPassword ? "text" : "password"} minLength={6} required autoComplete="new-password" value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} className="border-slate-600/50 bg-slate-800/50 pr-10 text-white" />
                <button type="button" onClick={() => setShowConfirmPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200" aria-label={showConfirmPassword ? "Hide password" : "Show password"}>
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" disabled={isLoading} className="h-12 w-full bg-gradient-to-r from-cyan-500 to-cyan-600 text-white hover:from-cyan-600 hover:to-cyan-700">{isLoading ? "Creating account..." : "Create account"}</Button>
          </form>
          <p className="mt-6 text-center text-sm text-slate-400">Already registered? <Link href="/login" className="font-semibold text-cyan-400 hover:text-cyan-300">Sign in</Link></p>
        </CardContent>
      </Card>
    </main>
  )
}
