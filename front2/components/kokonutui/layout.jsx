"use client"

import Sidebar from "./sidebar"
import TopNav from "./top-nav"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"

export default function Layout({ children }) {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(64) // Track sidebar width

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    // Listen for sidebar resize events
    const handleSidebarResize = (event) => {
      setSidebarWidth(event.detail.width)
      
      // Use requestAnimationFrame for smoother coordination
      requestAnimationFrame(() => {
        // Trigger resize event with multiple timing options for different chart types
        setTimeout(() => {
          window.dispatchEvent(new Event('resize'))
        }, 150) // First resize event - early for fast charts
        
        setTimeout(() => {
          window.dispatchEvent(new Event('resize'))
        }, 250) // Second resize event - for standard charts
        
        setTimeout(() => {
          window.dispatchEvent(new Event('resize'))
        }, 350) // Final resize event - ensure all charts are updated
      })
    }

    window.addEventListener('sidebarResize', handleSidebarResize)
    return () => window.removeEventListener('sidebarResize', handleSidebarResize)
  }, [])

  if (!mounted) {
    return null
  }

  return (
    <div className={`flex h-screen ${theme === "dark" ? "dark" : ""}`}>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col transition-all duration-200 ease-out">
        <header className="h-11 border-b border-gray-200 dark:border-[#1F1F23] transition-all duration-200 ease-out">
          <TopNav />
        </header>
        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto pt-2 px-6 pb-6 bg-white dark:bg-[#0F0F12] transition-all duration-200 ease-out">
          {children}
        </main>
      </div>
    </div>
  )
}
