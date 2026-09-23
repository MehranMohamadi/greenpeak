"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Grid3X3 } from "lucide-react"
import { useRouter } from "next/navigation"
import { marketAnalysisCategories } from "@/lib/analytics-registry"

export default function CategoryGrid({
  currentPage,
  show,
  onClose,
  categories = marketAnalysisCategories,
}) {
  const router = useRouter()
  const currentCategoryIndex = categories.findIndex(cat => cat.page === currentPage)

  if (!show) return null

  return (
    <div className="mb-6 animate-in slide-in-from-top-2 duration-200">
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">

            {categories.map((category, index) => (
              <Button
                key={category.page}
                variant={index === currentCategoryIndex ? "secondary" : "ghost"}
                size="sm"
                className={`h-auto p-2 justify-start gap-2 ${
                  index === currentCategoryIndex
                    ? "bg-primary/10 text-foreground"
                    : ""
                }`}
                onClick={() => {
                  router.push(`/analytics/${category.page}`)
                  onClose()
                }}
              >
                <div className="rounded-md bg-primary/10 p-1 text-primary">
                  <category.icon className="h-3 w-3" />
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
