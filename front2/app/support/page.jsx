import Link from "next/link"
import { ArrowLeft, BookOpen, Headset, Settings } from "lucide-react"

import Layout from "@/components/kokonutui/layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import FeedbackForm from "@/components/support/feedback-form"

export const metadata = {
  title: "Support | GreenPeak",
  description: "ارتباط با پشتیبانی GreenPeak، ارسال نظرات و پیشنهادها و گزارش مشکل",
}

export default function SupportPage() {
  return (
    <Layout>
      <main dir="rtl" className="mx-auto w-full max-w-5xl space-y-6 px-1 py-3 text-right sm:px-3 md:py-6">
        <section className="overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/15 via-background to-background p-5 shadow-sm md:p-8">
          <div className="flex items-start gap-4">
            <Headset aria-hidden="true" className="mt-1 h-8 w-8 shrink-0 text-primary" />
            <div className="space-y-4">
              <Badge variant="secondary">ارتباط با GreenPeak</Badge>
              <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">پشتیبانی GreenPeak</h1>
              <p className="max-w-3xl text-sm leading-8 text-muted-foreground md:text-base">
                سؤال، پیشنهاد یا مشکلی درباره سایت دارید؟ از فرم این صفحه یا ایمیل پشتیبانی با تیم GreenPeak در ارتباط باشید.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" className="gap-2"><Link href="/help"><BookOpen className="h-4 w-4" />راهنمای استفاده از سایت<ArrowLeft className="h-4 w-4" /></Link></Button>
                <Button asChild variant="outline" className="gap-2"><Link href="/settings"><Settings className="h-4 w-4" />تنظیمات</Link></Button>
              </div>
            </div>
          </div>
        </section>

        <section id="contact" className="grid scroll-mt-16 gap-4 lg:grid-cols-2">
          <Card className="h-full border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">ارتباط با GreenPeak</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm leading-7 text-muted-foreground">برای پشتیبانی، پرسش درباره سایت یا پیگیری پیام، از این ایمیل استفاده کنید:</p>
              <a dir="ltr" className="inline-flex rounded-lg border bg-muted/30 px-4 py-3 text-base font-semibold text-primary transition hover:border-primary/50 hover:bg-muted/50" href="mailto:greenpeak.fin@gmail.com">greenpeak.fin@gmail.com</a>
              <p className="text-xs leading-6 text-muted-foreground">پیام‌های فرم نظرات و پیشنهادها به همین صندوق ارسال می‌شوند و ادمین می‌تواند از طریق ایمیل پاسخ دهد.</p>
            </CardContent>
          </Card>
          <FeedbackForm />
        </section>

        <section className="rounded-xl border bg-card p-5">
          <h2 className="font-semibold text-foreground">چطور نظر یا مشکل سایت را گزارش کنم؟</h2>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            در فرم بالا نوع پیام را انتخاب کنید، ایمیل خود را برای پاسخ وارد کنید و جزئیات را در بخش نظرات و پیشنهادها بنویسید. پیام مستقیماً به ایمیل پشتیبانی می‌رسد.
          </p>
        </section>
      </main>
    </Layout>
  )
}
