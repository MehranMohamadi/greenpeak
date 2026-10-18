"use client"

import { Download, Link2, Video } from "lucide-react"
import MT5Pairing from "@/components/dashboard/mt5-pairing"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function BrokerConnectionSetup() {
  return (
    <section id="broker-connection" aria-labelledby="broker-connection-title" className="scroll-mt-20 space-y-4" dir="rtl">
      <header className="space-y-2">
        <h2 id="broker-connection-title" className="flex items-center gap-2 text-xl font-semibold text-foreground">
          <Link2 className="h-5 w-5 text-primary" />اتصال حساب معاملاتی
        </h2>
        <p className="text-sm leading-7 text-muted-foreground">کلید اتصال (API Key)، فایل اکسپرت و راهنمای ویدئویی متاتریدر ۵ در همین بخش قرار دارند.</p>
      </header>

      <MT5Pairing />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Download className="h-5 w-5 text-primary" />فایل اکسپرت گرین‌پیک</CardTitle>
            <CardDescription>فایل نصب اکسپرت اتصال حساب متاتریدر ۵</CardDescription>
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
            <CardDescription>راهنمای نصب اکسپرت و وارد کردن کلید اتصال</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Badge variant="secondary">به زودی...</Badge>
            <p className="text-sm leading-7 text-muted-foreground">ویدئوی مراحل اتصال حساب در این قسمت نمایش داده خواهد شد.</p>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
