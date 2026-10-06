"use client"

import { usePathname } from "next/navigation"
import ProtectedRoute from "@/components/auth/protected-route"

export default function AuthWrapper({ children }) {
  const pathname = usePathname()
  
  // Authentication pages are public.
  if (['/login', '/signup', '/verify-email', '/resend-verification', '/forgot-password', '/reset-password'].includes(pathname)) {
    return children
  }
  
  // Protect all other pages
  return (
    <ProtectedRoute>
      {children}
    </ProtectedRoute>
  )
}
