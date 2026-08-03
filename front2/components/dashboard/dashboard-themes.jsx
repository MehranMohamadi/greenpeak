"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Palette, Check, Moon, Sun, Monitor, Sparkles, Zap, TrendingUp } from "lucide-react"
import { useTheme } from "next-themes"

const themes = [
  {
    id: "default",
    name: "Default Light",
    description: "Clean and professional light theme",
    icon: Sun,
    category: "Light",
    colors: {
      primary: "bg-blue-500",
      secondary: "bg-gray-100",
      accent: "bg-green-500",
      background: "bg-white",
      text: "text-gray-900"
    },
    preview: "bg-gradient-to-br from-blue-50 to-white border-blue-200"
  },
  {
    id: "dark",
    name: "Dark Pro",
    description: "Professional dark theme for extended use",
    icon: Moon,
    category: "Dark",
    colors: {
      primary: "bg-slate-700",
      secondary: "bg-slate-800",
      accent: "bg-blue-400",
      background: "bg-gray-900",
      text: "text-white"
    },
    preview: "bg-gradient-to-br from-slate-800 to-gray-900 border-slate-600"
  },
  {
    id: "system",
    name: "System",
    description: "Follows your system preference",
    icon: Monitor,
    category: "Auto",
    colors: {
      primary: "bg-indigo-500",
      secondary: "bg-gray-100 dark:bg-gray-800",
      accent: "bg-purple-500",
      background: "bg-white dark:bg-gray-900",
      text: "text-gray-900 dark:text-white"
    },
    preview: "bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900 dark:to-purple-900 border-indigo-200 dark:border-indigo-700"
  },
  {
    id: "trading-dark",
    name: "Trading Dark",
    description: "High contrast dark theme for trading",
    icon: TrendingUp,
    category: "Trading",
    colors: {
      primary: "bg-black",
      secondary: "bg-green-900",
      accent: "bg-red-500",
      background: "bg-gray-950",
      text: "text-green-400"
    },
    preview: "bg-gradient-to-br from-black to-gray-900 border-green-500"
  },
  {
    id: "minimal-light",
    name: "Minimal Light",
    description: "Clean and minimal light design",
    icon: Sparkles,
    category: "Light",
    colors: {
      primary: "bg-gray-900",
      secondary: "bg-gray-50",
      accent: "bg-indigo-500",
      background: "bg-white",
      text: "text-gray-900"
    },
    preview: "bg-gradient-to-br from-gray-50 to-indigo-50 border-gray-200"
  },
  {
    id: "terminal",
    name: "Terminal",
    description: "Retro terminal-inspired theme",
    icon: Zap,
    category: "Dark",
    colors: {
      primary: "bg-green-500",
      secondary: "bg-black",
      accent: "bg-yellow-400",
      background: "bg-black",
      text: "text-green-400"
    },
    preview: "bg-gradient-to-br from-black to-green-950 border-green-400"
  }
]

const categories = [
  { id: "all", name: "All Themes" },
  { id: "Light", name: "Light" },
  { id: "Dark", name: "Dark" },
  { id: "Trading", name: "Trading" },
  { id: "Auto", name: "Auto" }
]

export default function DashboardThemes() {
  const { theme, setTheme, themes: availableThemes } = useTheme()
  const [selectedTheme, setSelectedTheme] = useState(theme || "system")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setSelectedTheme(theme || "system")
  }, [theme])

  const handleThemeChange = (themeId) => {
    setSelectedTheme(themeId)
    setTheme(themeId)
  }

  const filteredThemes = selectedCategory === "all" 
    ? themes 
    : themes.filter(t => t.category === selectedCategory)

  if (!mounted) {
    return (
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Dashboard Themes
          </CardTitle>
          <CardDescription>Loading themes...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="lg:col-span-1 animate-fade-in-up">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5 text-purple-600" />
          Dashboard Themes
        </CardTitle>
        <CardDescription>
          Choose your preferred theme for the best experience
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Category Filter */}
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <Button
              key={category.id}
              variant={selectedCategory === category.id ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(category.id)}
              className="text-xs transition-all duration-200 hover:scale-105"
            >
              {category.name}
            </Button>
          ))}
        </div>

        {/* Current Theme Display */}
        <div className="p-4 rounded-lg border bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-sm font-medium">Current Theme</span>
          </div>
          <div className="text-lg font-semibold">
            {themes.find(t => t.id === selectedTheme)?.name || "System"}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {themes.find(t => t.id === selectedTheme)?.description || "Following system preference"}
          </div>
        </div>

        {/* Theme Grid */}
        <div className="space-y-3">
          {filteredThemes.map((themeOption, index) => {
            const Icon = themeOption.icon
            const isSelected = selectedTheme === themeOption.id
            
            return (
              <div
                key={themeOption.id}
                className={`group relative overflow-hidden rounded-lg border-2 transition-all duration-300 cursor-pointer hover:scale-[1.02] hover:shadow-lg animate-fade-in-up ${
                  isSelected 
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' 
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
                style={{ animationDelay: `${index * 100}ms` }}
                onClick={() => handleThemeChange(themeOption.id)}
              >
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${themeOption.colors.primary} bg-opacity-10`}>
                        <Icon className={`h-4 w-4 ${themeOption.colors.primary.replace('bg-', 'text-')}`} />
                      </div>
                      <div>
                        <div className="font-semibold text-sm flex items-center gap-2">
                          {themeOption.name}
                          <Badge variant="outline" className="text-xs">
                            {themeOption.category}
                          </Badge>
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          {themeOption.description}
                        </div>
                      </div>
                    </div>
                    
                    {isSelected && (
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-blue-600 animate-scale-in" />
                        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                      </div>
                    )}
                  </div>
                  
                  {/* Theme Preview */}
                  <div className={`h-8 rounded-md ${themeOption.preview} flex items-center justify-center space-x-1 transition-transform duration-200 group-hover:scale-105`}>
                    <div className={`w-2 h-2 rounded-full ${themeOption.colors.primary}`}></div>
                    <div className={`w-2 h-2 rounded-full ${themeOption.colors.accent}`}></div>
                    <div className={`w-2 h-2 rounded-full ${themeOption.colors.secondary}`}></div>
                  </div>
                </div>
                
                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
              </div>
            )
          })}
        </div>

        {/* Theme Actions */}
        <div className="flex gap-2 pt-4 border-t">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setTheme("system")}
            className="flex-1 transition-all duration-200 hover:scale-105"
          >
            <Monitor className="h-4 w-4 mr-2" />
            Auto
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setTheme("light")}
            className="flex-1 transition-all duration-200 hover:scale-105"
          >
            <Sun className="h-4 w-4 mr-2" />
            Light
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setTheme("dark")}
            className="flex-1 transition-all duration-200 hover:scale-105"
          >
            <Moon className="h-4 w-4 mr-2" />
            Dark
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
