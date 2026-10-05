"use client"

import { usePathname } from "next/navigation"
import ProtectedRoute from "@/components/auth/protected-route"

export default function AuthWrapper({ children }) {
  const pathname = usePathname()
  
  // Authentication pages are public.
  if (pathname === '/login' || pathname === '/signup') {
    return children
  }
  
  // Protect all other pages
  return (
    <ProtectedRoute>
      {children}
    </ProtectedRoute>
  )
}
