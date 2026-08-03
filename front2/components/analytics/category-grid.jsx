"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Grid3X3 } from "lucide-react"
import { useRouter } from "next/navigation"
import { analyticsCategories, getCategoryByName, getCategoryIndex } from "../../lib/analytics-utils"


const categories = analyticsCategories

export default function CategoryGrid({
  selectedCategory,
  show,
  onClose,
}) {
  const router = useRouter()
const currentCategoryIndex = categories.findIndex(cat => cat.name === selectedCategory)

  if (!show) return null

  return (
    <div className="mb-6 animate-in slide-in-from-top-2 duration-200">
      <Card className="border border-gray-200 dark:border-[#2B2B30] bg-white dark:bg-[#1F1F23]">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">

            {categories.map((category, index) => (
              <Button
                key={category.page}
                variant={index === currentCategoryIndex ? "secondary" : "ghost"}
                size="sm"
                className={`h-auto p-2 justify-start gap-2 ${
                  index === currentCategoryIndex
                    ? "bg-blue-50 dark:bg-blue-950/20"
                    : ""
                }`}
                onClick={() => {
                  router.push(`/analytics/${category.page}`)
                  onClose()
                }}
              >
                <div className={`p-1 bg-gradient-to-r ${category.color} rounded`}>
                  <category.icon className="h-3 w-3 text-white" />
                </div>

                <span className="text-xs font-medium truncate">
                  {category.name}
                </span>
              </Button>
            ))}

          </div>
        </CardContent>
      </Card>
    </div>
  )
}