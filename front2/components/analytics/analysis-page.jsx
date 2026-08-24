"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight, Grid3X3 } from "lucide-react"
import { useRouter } from "next/navigation"

import { cn } from "@/lib/utils"
import { marketAnalysisCategories, getMarketAnalysisCategory } from "@/lib/analytics-registry"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import CategoryGrid from "./category-grid"

export function AnalysisPageShell({ children, className }) {
  return <div className={cn("space-y-6 bg-white p-4 dark:bg-[#0F0F12] md:p-6", className)}>{children}</div>
}

export function AnalysisPageHeader({ page, title, description, icon: IconOverride, actions }) {
  const router = useRouter()
  const [showCategories, setShowCategories] = useState(false)
  const category = getMarketAnalysisCategory(page)
  const currentIndex = Math.max(0, marketAnalysisCategories.findIndex((item) => item.page === page))
  const Icon = IconOverride || category?.icon

  const navigate = (offset) => {
    const nextIndex = (currentIndex + offset + marketAnalysisCategories.length) % marketAnalysisCategories.length
    router.push(`/analytics/${marketAnalysisCategories[nextIndex].page}`)
  }

  return (
    <>
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold text-gray-900 dark:text-white md:text-3xl">
            {Icon && (
              <span className={cn("rounded-xl bg-gradient-to-br p-2 shadow-sm", category?.color || "from-slate-600 to-slate-700")}>
                <Icon className="h-6 w-6 text-white" />
              </span>
            )}
            {title || category?.name}
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 md:text-base">
            {description || category?.description}
          </p>
        </div>

        <div className="flex items-center gap-2 self-end md:self-auto">
          {actions}
          <div className="flex items-center rounded-lg border border-gray-200 bg-white p-1 dark:border-[#2B2B30] dark:bg-[#1F1F23]">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)} title="Previous category">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-8 w-8", showCategories && "bg-gray-100 dark:bg-gray-800")}
              onClick={() => setShowCategories((value) => !value)}
              title="All market analysis categories"
              aria-expanded={showCategories}
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(1)} title="Next category">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <CategoryGrid currentPage={page} show={showCategories} onClose={() => setShowCategories(false)} categories={marketAnalysisCategories} />
    </>
  )
}

export function AnalysisOverviewGrid({ children, className }) {
  return <div className={cn("grid grid-cols-1 items-start gap-6 lg:grid-cols-7", className)}>{children}</div>
}

export function AnalysisScoreCard({ title, icon: Icon, children, className }) {
  return (
    <Card className={cn("border-gray-200 bg-white shadow-sm dark:border-[#2B2B30] dark:bg-[#1F1F23] lg:col-span-2", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          {Icon && <Icon className="h-4 w-4 text-slate-600 dark:text-slate-300" />}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  )
}

export function AnalysisChartCard({ title, description, actions, children, footer, className }) {
  return (
    <Card className={cn("border-gray-200 bg-white shadow-sm dark:border-[#2B2B30] dark:bg-[#1F1F23] lg:col-span-5", className)}>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">{title}</CardTitle>
            {description && <CardDescription className="mt-1">{description}</CardDescription>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      </CardHeader>
      <CardContent>{children}{footer}</CardContent>
    </Card>
  )
}

export function TimeframeSelector({ periods, value, onChange, accentClass = "bg-blue-600 text-white" }) {
  return <div className="flex max-w-full gap-1 overflow-x-auto pb-1">{periods.map((period) => (
    <Button key={period} variant={value === period ? "default" : "outline"} size="sm" onClick={() => onChange(period)}
      className={cn("h-8 min-w-10 px-2 text-xs", value === period && accentClass)}>{period}</Button>
  ))}</div>
}

export function AnalysisFactorGrid({ title, children, className }) {
  return <section><h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">{title}</h2>
    <div className={cn("grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3", className)}>{children}</div></section>
}

export function AnalysisFactorCard({ selected, onClick, children, className }) {
  return <Card onClick={onClick} className={cn(
    "h-full cursor-pointer border-gray-200 bg-white shadow-sm transition-colors dark:border-[#2B2B30] dark:bg-[#1F1F23]",
    selected && "ring-2 ring-blue-500 bg-blue-50/60 dark:bg-blue-950/30", className
  )}>{children}</Card>
}

export function AnalysisState({ title, description, tone = "error" }) {
  const isError = tone === "error"
  return <div className={cn("rounded-lg border p-6 text-center", isError ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20" : "border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/20")}>
    <div className={cn("text-lg font-semibold", isError ? "text-red-600 dark:text-red-400" : "text-gray-700 dark:text-gray-300")}>{title}</div>
    {description && <p className={cn("mt-2", isError ? "text-red-600 dark:text-red-400" : "text-gray-600 dark:text-gray-400")}>{description}</p>}
  </div>
}
