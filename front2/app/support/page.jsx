import { Headset } from "lucide-react"

import Layout from "@/components/kokonutui/layout"
import FeedbackForm from "@/components/support/feedback-form"

export const metadata = {
  title: "پشتیبانی | GreenPeak",
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
              <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">پشتیبانی</h1>
              <p className="max-w-3xl text-sm leading-8 text-muted-foreground md:text-base">
                برای پشتیبانی، پرسش درباره سایت یا پیگیری پیام، از این ایمیل استفاده کنید:
                {" "}
                <a dir="ltr" className="inline-block font-bold text-primary hover:underline" href="mailto:greenpeak.fin@gmail.com">greenpeak.fin@gmail.com</a>
              </p>
            </div>
          </div>
        </section>

        <section id="contact" className="scroll-mt-16">
          <FeedbackForm />
        </section>
      </main>
    </Layout>
  )
}
