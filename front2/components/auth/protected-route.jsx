"use client"

import { useAuth } from "./auth-context"
import { useRouter, usePathname } from "next/navigation"
import { useEffect } from "react"

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // Don't redirect if still loading or already on login page
    if (isLoading || pathname === '/login') return

    // Redirect to login if not authenticated
    if (!isAuthenticated) {
      router.push('/login')
    }
  }, [isAuthenticated, isLoading, router, pathname])

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#0F0F12]">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  // Show login redirect message if not authenticated
  if (!isAuthenticated && pathname !== '/login') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#0F0F12]">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-pulse text-gray-600 dark:text-gray-400">
            Redirecting to login...
          </div>
        </div>
      </div>
    )
  }

  // If authenticated or on login page, show the children
  return children
}
