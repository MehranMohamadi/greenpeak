"use client"

import { usePathname } from "next/navigation"
import ProtectedRoute from "@/components/auth/protected-route"

export default function AuthWrapper({ children }) {
  const pathname = usePathname()
  
  // Don't protect the login page
  if (pathname === '/login') {
    return children
  }
  
  // Protect all other pages
  return (
    <ProtectedRoute>
      {children}
    </ProtectedRoute>
  )
}
