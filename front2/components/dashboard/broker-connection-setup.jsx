"use client"

import { Download, Video } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function BrokerConnectionSetup() {
  return (
    <div className="grid gap-6 md:grid-cols-2" dir="rtl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Download className="h-5 w-5 text-primary" />فایل اکسپرت گرین‌پیک</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button asChild className="gap-2">
            <a href="/downloads/GP_Agent.ex5" download="GP_Agent.ex5">
              <Download className="h-4 w-4" aria-hidden="true" />دانلود اکسپرت متاتریدر ۵
            </a>
          </Button>
          <p className="text-xs text-muted-foreground" dir="ltr">GP_Agent.ex5 · MetaTrader 5</p>
          <p className="text-sm leading-7 text-muted-foreground">فایل اکسپرت را دانلود کنید و برای اتصال حساب، کلید اتصال همین صفحه را در تنظیمات اکسپرت وارد کنید.</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Video className="h-5 w-5 text-primary" />ویدئوی آموزش اتصال</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button asChild className="gap-2">
            <a href="/downloads/GreenPeak_Connection_3min_Synced.mp4" download="GreenPeak_Connection_3min_Synced.mp4">
              <Download className="h-4 w-4" aria-hidden="true" />دانلود ویدئوی آموزش اتصال
            </a>
          </Button>
          <p className="text-xs text-muted-foreground">فرمت MP4 · حجم حدود ۴ مگابایت</p>
          <p className="text-sm leading-7 text-muted-foreground">ویدئو را دانلود کنید و مراحل نصب اکسپرت و اتصال حساب متاتریدر ۵ را روی دستگاه خود ببینید.</p>
        </CardContent>
      </Card>
    </div>
  )
}
