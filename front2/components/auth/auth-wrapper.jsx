"use client"

import { usePathname } from "next/navigation"
import ProtectedRoute from "@/components/auth/protected-route"
import { useAuth } from "@/components/auth/auth-context"

export default function AuthWrapper({ children }) {
  const pathname = usePathname()
  const { isAdmin, isLoading } = useAuth()
  const adminOnly = pathname === "/admin" || pathname.startsWith("/admin/") || [
    "/analytics/feature-pipeline-debug", "/analytics/mt5-snapshots", "/architecture/ai-market-analysis",
  ].includes(pathname)
  
  // Authentication pages are public.
  if (['/login', '/signup', '/check-email', '/verify-email', '/resend-verification', '/forgot-password', '/reset-password'].includes(pathname)) {
    return children
  }
  
  // Protect all other pages
  return (
    <ProtectedRoute>
      {adminOnly && !isLoading && !isAdmin ? <div className="p-6 text-center" dir="rtl">این بخش فقط برای مدیران سایت در دسترس است.</div> : children}
    </ProtectedRoute>
  )
}
