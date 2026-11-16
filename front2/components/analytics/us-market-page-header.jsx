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
              سه تب نبض بازار، کوتاه‌مدت و میان‌مدت کنار نمودار قرار دارند و زمان ارزیابی هر تب مستقل است. متن کامل نبض بازار داخل همان تب نمایش داده می‌شود؛ آیکون مثلث در کوتاه‌مدت و میان‌مدت، دلایل و سناریوهای تکمیلی را در پاپ‌آپ باز می‌کند. ریسک و اعتماد به تحلیل از نشان‌های کوچک زیر تحلیل قابل بررسی‌اند؛ اعتماد، کفایت و تازگی داده‌ها را بیان می‌کند. رویدادهای مهم هفت روز گذشته و آینده در یک فهرست زمانی با خط اکنون نمایش داده می‌شوند؛ جزئیات هر رویداد و تحلیل هر خبر با انتخاب آن باز می‌شود. عوامل مثبت و پتانسیل‌ها در باکس عوامل حمایتی و فشارهای نزولی و ریسک‌ها در باکس ریسک‌های بازار جمع شده‌اند؛ بازهٔ اثرگذاری هر مورد در پاپ‌آپ آن دیده می‌شود و عوامل جدید یا تغییرکرده مشخص می‌شوند. گزارش دوشنبه کامل‌تر است؛ نوبت شب و تعطیلات فقط نبض را تازه می‌کنند. زمان دریافت نمودار با زمان انتشار تحلیل متفاوت است.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  )
}
