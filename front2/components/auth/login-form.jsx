"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "./auth-context"
import { TrendingUp, Lock, User, Eye, EyeOff, Shield, ChevronRight } from "lucide-react"
import { motion } from "framer-motion"

export default function LoginForm() {
  const { login } = useAuth()
  const router = useRouter()
  const [credentials, setCredentials] = useState({ username: "", password: "" })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      const result = await login(credentials.username, credentials.password)

      if (result.success) {
        // Redirect to dashboard after successful login
        setTimeout(() => {
          console.log('🔄 Redirecting to dashboard')
          router.push('/')
          setIsLoading(false)
        }, 1000)
      } else {
        console.log('❌ Login failed:', result.error)
        setError(result.error)
        setIsLoading(false)
      }
    } catch (err) {
      console.error('🚨 Login exception:', err)
      setError("An unexpected error occurred. Please try again.")
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-slate-950 via-gray-900 to-slate-900">
      {/* Minimal Starfield Background */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Gentle blinking stars */}
        <div className="absolute inset-0">
          {[...Array(15)].map((_, i) => (
            <motion.div
              key={`star-${i}`}
              className="absolute w-1 h-1 bg-green-400/60 rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              animate={{
                opacity: [0.2, 0.8, 0.2],
                scale: [0.8, 1.2, 0.8],
              }}
              transition={{
                duration: 3 + Math.random() * 2,
                repeat: Infinity,
                ease: "easeInOut",
                delay: Math.random() * 4,
              }}
            />
          ))}
        </div>

        {/* Subtle shooting stars */}
        <div className="absolute inset-0">
          {[...Array(3)].map((_, i) => (
            <motion.div
              key={`shooting-star-${i}`}
              className="absolute w-20 h-px bg-gradient-to-r from-transparent via-green-400/40 to-transparent"
              style={{
                top: `${20 + Math.random() * 60}%`,
                left: "-100px",
                rotate: "15deg",
              }}
              animate={{
                x: ["0px", "calc(100vw + 100px)"],
                opacity: [0, 1, 1, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeOut",
                delay: i * 8 + Math.random() * 5,
                repeatDelay: 15 + Math.random() * 10,
              }}
            />
          ))}
        </div>

        {/* Soft ambient glow */}
        <div className="absolute inset-0">
          <motion.div
            className="absolute top-1/4 left-1/4 w-32 h-32 bg-green-500/5 rounded-full blur-3xl"
            animate={{
              opacity: [0.3, 0.6, 0.3],
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
          <motion.div
            className="absolute bottom-1/3 right-1/3 w-40 h-40 bg-emerald-500/5 rounded-full blur-3xl"
            animate={{
              opacity: [0.2, 0.5, 0.2],
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: 10,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 2,
            }}
          />
        </div>

        {/* Minimal corner indicators */}
        <div className="absolute top-6 right-6">
          <motion.div
            className="w-1.5 h-1.5 bg-green-400/50 rounded-full"
            animate={{
              opacity: [0.3, 0.7, 0.3],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </div>
        <div className="absolute bottom-6 left-6">
          <motion.div
            className="w-1.5 h-1.5 bg-emerald-400/50 rounded-full"
            animate={{
              opacity: [0.3, 0.7, 0.3],
            }}
            transition={{
              duration: 2.5,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 1,
            }}
          />
        </div>
      </div>

      {/* Login Card */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md mx-4"
      >
        <Card className="backdrop-blur-xl bg-slate-900/80 dark:bg-slate-950/80 border border-slate-700/50 dark:border-slate-600/30 shadow-2xl">
          <CardHeader className="text-center space-y-4 pb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mx-auto w-16 h-16 bg-gradient-to-br from-green-400 to-emerald-600 rounded-xl flex items-center justify-center"
            >
              <TrendingUp className="w-8 h-8 text-white" />
            </motion.div>
            <div>
              <CardTitle className="text-3xl font-bold text-white mb-2">GreenPeak</CardTitle>
              <CardDescription className="text-slate-300 text-base">
                Advanced Trading Analytics Platform
              </CardDescription>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 bg-red-500/20 border border-red-400/30 rounded-lg text-red-200 text-sm"
                >
                  {error}
                </motion.div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="username" className="text-slate-200 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Username
                </Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter your username"
                  value={credentials.username}
                  onChange={(e) => setCredentials((prev) => ({ ...prev, username: e.target.value }))}
                  required
                  className="bg-slate-800/50 border-slate-600/50 text-white placeholder:text-slate-400 focus:border-green-400 focus:ring-green-400/20"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-200 flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={credentials.password}
                    onChange={(e) => setCredentials((prev) => ({ ...prev, password: e.target.value }))}
                    required
                    className="bg-slate-800/50 border-slate-600/50 text-white placeholder:text-slate-400 focus:border-green-400 focus:ring-green-400/20 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              
              <Button 
                type="submit" 
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white border-0 h-12 text-base font-semibold shadow-lg hover:shadow-xl transition-all duration-200" 
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Signing in...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Sign In
                    <ChevronRight className="w-4 h-4" />
                  </div>
                )}
              </Button>
            </form>
            
            {/* Demo credentials display */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-4 p-4 bg-slate-800/30 border border-slate-700/50 rounded-lg"
            >
              <div className="text-center space-y-2">
                <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Demo Credentials</p>
                <div className="space-y-1">
                  <p className="text-sm text-slate-300">
                    <span className="text-slate-400">Username:</span>{" "}
                    <span className="font-mono text-green-400 font-semibold">greenpeak</span>
                  </p>
                  <p className="text-sm text-slate-300">
                    <span className="text-slate-400">Password:</span>{" "}
                    <span className="font-mono text-green-400 font-semibold">123456</span>
                  </p>
                </div>
                <p className="text-xs text-slate-500 mt-2 italic">Any credentials will work for demo purposes</p>
              </div>
            </motion.div>

          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
