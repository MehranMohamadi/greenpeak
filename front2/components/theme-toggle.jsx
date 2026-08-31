"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"

export function ThemeToggle({ showLabel = false, className }) {
  const [mounted, setMounted] = React.useState(false)
  const { theme, setTheme } = useTheme()

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  return (
    <button
      type="button"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className={cn(
        "flex items-center justify-center hover:bg-gray-100 dark:hover:bg-[#1F1F23] transition-colors",
        showLabel ? "w-full rounded-lg p-2 text-sm" : "w-8 h-8 rounded-full",
        className
      )}
    >
      <Sun className="h-4 w-4 flex-shrink-0 text-gray-600 dark:text-gray-300 transition-all dark:hidden" />
      <Moon className="h-4 w-4 flex-shrink-0 text-gray-600 dark:text-gray-300 transition-all hidden dark:block" />
      <span className={showLabel ? "ml-3 w-full text-left text-gray-600 dark:text-gray-300" : "sr-only"}>Theme</span>
    </button>
  )
}
