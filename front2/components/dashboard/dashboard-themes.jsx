"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Palette, Check, Moon, Sun, Monitor } from "lucide-react"
import { useTheme } from "next-themes"

const themes = [
  {
    id: "light",
    name: "Material Light",
    description: "GreenPeak surfaces with a light neutral background",
    icon: Sun,
    category: "Light",
    colors: {
      primary: "bg-primary",
      secondary: "bg-secondary",
      accent: "bg-destructive",
      background: "bg-white",
      text: "text-foreground"
    },
    preview: "bg-gradient-to-br from-primary/10 to-white border-primary/30"
  },
  {
    id: "dark",
    name: "Material Dark",
    description: "Pink-tinted dark surfaces with GreenPeak accents",
    icon: Moon,
    category: "Dark",
    colors: {
      primary: "bg-primary",
      secondary: "bg-secondary",
      accent: "bg-destructive",
      background: "bg-background",
      text: "text-foreground"
    },
    preview: "bg-gradient-to-br from-[#251c24] to-[#171117] border-primary/30"
  },
  {
    id: "system",
    name: "System",
    description: "Follows your system preference",
    icon: Monitor,
    category: "Auto",
    colors: {
      primary: "bg-primary",
      secondary: "bg-secondary",
      accent: "bg-destructive",
      background: "bg-background",
      text: "text-foreground"
    },
    preview: "bg-gradient-to-br from-primary/10 to-secondary border-primary/30"
  }
]

const categories = [
  { id: "all", name: "All Themes" },
  { id: "Light", name: "Light" },
  { id: "Dark", name: "Dark" },
  { id: "Auto", name: "Auto" }
]

export default function DashboardThemes() {
  const { theme, setTheme } = useTheme()
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
          <Palette className="h-5 w-5 text-primary" />
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
        <div className="rounded-xl border border-primary/30 bg-primary/10 p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-3 w-3 animate-pulse rounded-full bg-primary"></div>
            <span className="text-sm font-medium">Current Theme</span>
          </div>
          <div className="text-lg font-medium">
            {themes.find(t => t.id === selectedTheme)?.name || "System"}
          </div>
          <div className="text-sm text-muted-foreground">
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
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/40'
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
                        <div className="flex items-center gap-2 text-sm font-medium">
                          {themeOption.name}
                          <Badge variant="outline" className="text-xs">
                            {themeOption.category}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {themeOption.description}
                        </div>
                      </div>
                    </div>
                    
                    {isSelected && (
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-primary animate-scale-in" />
                        <div className="h-2 w-2 animate-pulse rounded-full bg-primary"></div>
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
                <div className="absolute inset-0 bg-gradient-to-r from-transparent to-primary/5 opacity-0 transition-opacity duration-200 group-hover:opacity-100"></div>
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
