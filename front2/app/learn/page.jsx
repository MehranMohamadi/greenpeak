import Link from "next/link"
import { ArrowLeft, BookOpen, Clock3, GraduationCap, ShieldCheck } from "lucide-react"
import Layout from "@/components/kokonutui/layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { comingSoonTopics, riskCards, riskLessons } from "@/lib/learning-content.mjs"
import { requireAdminPage } from "@/lib/admin-page"

export const metadata = { title: "آموزش | GreenPeak", description: "یادگیری روزانه مفاهیم سرمایه‌گذاری؛ درس، تمرین و مرور مدیریت ریسک." }

export default async function LearningPage() {
  await requireAdminPage()
  return <Layout>
    <div lang="fa" dir="rtl" className="mx-auto max-w-6xl space-y-8 py-5 text-right md:py-8">
      <header className="space-y-4 border-b pb-7">
        <p className="flex items-center gap-2 text-sm font-medium text-primary"><GraduationCap className="h-5 w-5" />آموزش GreenPeak</p>
        <h1 className="text-3xl font-bold md:text-4xl">هر روز، یک قدم آگاهانه‌تر</h1>
        <p className="max-w-2xl text-sm leading-8 text-muted-foreground md:text-base">مفاهیم سرمایه‌گذاری را با درس‌های کوتاه یاد بگیرید، با سؤال تمرین کنید و با مرور دوباره به خاطر بسپارید.</p>
      </header>
      <section aria-labelledby="exam-track" className="space-y-4">
        <div><h2 id="exam-track" className="text-xl font-semibold">اصول بازار سرمایه</h2><p className="mt-2 text-sm text-muted-foreground">مسیر مفهومی و تمرینی · از مبانی تا حل مسئله</p></div>
        <article className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-bl from-primary/10 via-card to-card p-5 md:p-8">
          <div className="flex flex-wrap items-center gap-2"><Badge>آماده مطالعه</Badge><Badge variant="outline">مقدماتی و تحلیلی</Badge></div>
          <div className="mt-5 flex items-start gap-4"><span className="rounded-xl bg-primary/10 p-3 text-primary"><ShieldCheck className="h-7 w-7" /></span><div><h3 className="text-2xl font-bold">مدیریت ریسک</h3><p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">از شناخت ریسک و بازده تا سنجش نوسان، تنوع‌بخشی، بتا و انتخاب روش مواجهه با ریسک. همراه با مثال‌های محاسباتی و پاسخ تشریحی.</p></div></div>
          <div className="mt-6 flex flex-wrap items-center gap-5 text-sm text-muted-foreground"><span className="flex items-center gap-2"><BookOpen className="h-4 w-4" />{riskLessons.length.toLocaleString("fa-IR")} درس · {riskCards.length.toLocaleString("fa-IR")} کارت تألیفی</span><span className="flex items-center gap-2"><Clock3 className="h-4 w-4" />روزانه حدود ۵ دقیقه</span></div>
          <Button asChild className="mt-6 gap-2"><Link href="/learn/risk-management">ورود به مدیریت ریسک<ArrowLeft className="h-4 w-4" /></Link></Button>
        </article>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{comingSoonTopics.map(topic => <article key={topic} className="flex items-start justify-between gap-3 rounded-xl border bg-card p-4"><h3 className="text-sm leading-7 text-muted-foreground">{topic}</h3><Badge variant="secondary" className="shrink-0">به زودی</Badge></article>)}</div>
      </section>
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-5"><div><h2 className="font-semibold">سرمایه‌گذاری در زندگی واقعی</h2><p className="mt-2 text-sm text-muted-foreground">نظم مالی، مدیریت پول و تصمیم‌های روزمره</p></div><Badge variant="secondary">به زودی</Badge></section>
      <p className="text-xs leading-7 text-muted-foreground">مدیریت ریسک یک بخش آموزشی مستقل در این محصول است؛ پوشش کامل سرفصل رسمی آزمون اصول بازار سرمایه هنوز تأیید نشده است.</p>
    </div>
  </Layout>
}
