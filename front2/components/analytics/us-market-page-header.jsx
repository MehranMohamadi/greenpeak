"use client"

import { Info } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export default function USMarketPageHeader({ className = "" }) {
  return (
    <div className={`flex items-center gap-2 ${className}`} dir="rtl">
      <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
        بازار آمریکا <span dir="ltr">US500</span>
      </h1>
      <Dialog>
        <DialogTrigger asChild>
          <button
            type="button"
            aria-label="راهنمای صفحه بازار آمریکا US500"
            title="راهنمای صفحه"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-primary transition-colors hover:bg-primary/10 hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Info className="h-5 w-5" aria-hidden="true" />
          </button>
        </DialogTrigger>
        <DialogContent dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle>درباره بازار آمریکا US500</DialogTitle>
            <DialogDescription className="leading-7">
              در این صفحه می‌توانید نمودار تعاملی شاخص S&amp;P 500 را در بازه‌های زمانی مختلف مشاهده کنید. داده‌های نمودار به‌صورت خودکار هر پنج دقیقه به‌روزرسانی می‌شوند و بخش تحلیل‌ها مسیر دسترسی به بررسی‌های تکمیلی بازار را فراهم می‌کند.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  )
}
