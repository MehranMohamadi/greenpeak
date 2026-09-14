"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"

export function ThemeToggle({ showLabel = false, label = "Theme", className }) {
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
      aria-label={label}
      title={label}
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className={cn(
        "flex items-center justify-center hover:bg-gray-100 dark:hover:bg-[#1F1F23] transition-colors",
        showLabel ? "w-full gap-3 rounded-lg p-2 text-sm" : "w-8 h-8 rounded-full",
        className
      )}
    >
      <Sun className="h-4 w-4 flex-shrink-0 text-gray-600 dark:text-gray-300 transition-all dark:hidden" />
      <Moon className="h-4 w-4 flex-shrink-0 text-gray-600 dark:text-gray-300 transition-all hidden dark:block" />
      <span className={showLabel ? "w-full text-start text-gray-600 dark:text-gray-300" : "sr-only"}>{label}</span>
    </button>
  )
}
