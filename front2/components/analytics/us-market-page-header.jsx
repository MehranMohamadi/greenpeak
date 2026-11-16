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
      <h1 className="mb-1 flex items-center justify-start gap-2 text-xl font-bold text-gray-900 dark:text-white md:text-2xl">
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
              سه تب نبض بازار، کوتاه‌مدت و میان‌مدت در باکس کنار نمودار قرار دارند. نبض بازار، فضای خبری و حال‌وهوای آخرین روز یا جلسهٔ مشاهده‌شده را نشان می‌دهد. تب‌های چشم‌انداز، مسیر چند هفتهٔ آینده و تصویر ۶ تا ۱۲ ماهه را با تاریخ ارزیابی مستقل نمایش می‌دهند؛ دلایل و سناریوها با بازکردن جزئیات قابل مطالعه‌اند. گزارش دوشنبه کامل‌تر است؛ نوبت شب و تعطیلات فقط نبض را تازه می‌کنند. نمودار هر دقیقه دوباره دریافت می‌شود؛ زمان دریافت داده با زمان انتشار گزارش متفاوت است.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  )
}
