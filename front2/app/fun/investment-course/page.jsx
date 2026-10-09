import { ArrowDown, BookOpen, CalendarDays, CheckCircle2, ClipboardList, GraduationCap, Layers3, ShieldCheck, Target } from "lucide-react"

import Layout from "@/components/kokonutui/layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export const metadata = {
  title: "دورهمی سرمایه‌گذاری | GreenPeak",
  description: "دوره یک‌ماهه آموزش مبانی سرمایه‌گذاری؛ از شناخت ابزارها و ریسک تا ساخت سبد و تدوین برنامه سرمایه‌گذاری.",
}

const weeks = [
  {
    number: "۰۱",
    label: "هفته اول",
    title: "مبانی و هدف‌گذاری",
    icon: Target,
    description: "پیش از انتخاب یک دارایی، دلیل سرمایه‌گذاری و نیازهای مالی خود را روشن می‌کنیم.",
    topics: [
      "تفاوت پس‌انداز، سرمایه‌گذاری و معامله‌گری",
      "بودجه‌بندی، جریان درآمد و هزینه و نقش ذخیره اضطراری",
      "تورم، قدرت خرید پول و مفهوم سود مرکب",
      "هدف مالی، افق زمانی و تفاوت تحمل ریسک با توان پذیرش ریسک",
    ],
    practice: "نوشتن هدف‌های مالی کوتاه‌مدت و بلندمدت و تعیین زمان موردنیاز برای هر هدف.",
  },
  {
    number: "۰۲",
    label: "هفته دوم",
    title: "شناخت بازارها و ابزارها",
    icon: BookOpen,
    description: "با زبان ساده، ابزارهای رایج را می‌شناسیم و معیارهای مقایسه آن‌ها را یاد می‌گیریم.",
    topics: [
      "سهام و مفاهیم اولیه مالکیت، درآمد و سود شرکت",
      "اوراق بدهی، سررسید و مفهوم درآمد ثابت",
      "صندوق‌های سرمایه‌گذاری، ETF و تفاوت مدیریت فعال و غیرفعال",
      "آشنایی با طلا، سپرده و سایر دارایی‌ها از نظر ریسک، هزینه و نقدشوندگی",
    ],
    practice: "مقایسه دو ابزار سرمایه‌گذاری بر اساس افق زمانی، ریسک، هزینه و امکان تبدیل به نقد.",
  },
  {
    number: "۰۳",
    label: "هفته سوم",
    title: "ریسک و ساخت سبد",
    icon: ShieldCheck,
    description: "به‌جای تمرکز بر یک انتخاب، رابطه میان دارایی‌ها و ریسک کل سبد را بررسی می‌کنیم.",
    topics: [
      "مفهوم بازده، نوسان و احتمال زیان",
      "تنوع‌بخشی و آشنایی با همبستگی دارایی‌ها",
      "تخصیص دارایی متناسب با هدف، زمان و توان پذیرش ریسک",
      "اثر کارمزد، تورم و تصمیم‌های هیجانی بر نتیجه سرمایه‌گذاری",
    ],
    practice: "طراحی یک سبد نمونه آموزشی و توضیح نقش هر دارایی در آن، بدون نیاز به خرید واقعی.",
  },
  {
    number: "۰۴",
    label: "هفته چهارم",
    title: "تدوین برنامه و مرور تصمیم‌ها",
    icon: ClipboardList,
    description: "آموخته‌ها را به یک چارچوب مکتوب تبدیل می‌کنیم تا تصمیم‌ها قابل توضیح و پیگیری باشند.",
    topics: [
      "چک‌لیست بررسی یک سرمایه‌گذاری: هدف، ریسک، هزینه، منبع اطلاعات و نقدشوندگی",
      "آشنایی با سازوکار سفارش خرید و فروش و تفاوت قیمت پیشنهادی با قیمت اجرا",
      "تعیین زمان بازبینی سبد و آشنایی با بازتنظیم ترکیب دارایی‌ها",
      "خطاهای رفتاری، وعده‌های سود تضمینی و ارزیابی اعتبار اطلاعات",
    ],
    practice: "نوشتن و ارائه یک برنامه سرمایه‌گذاری آموزشی شامل هدف‌ها، معیارهای انتخاب و قواعد بازبینی.",
  },
]

const outcomes = [
  { icon: Target, title: "هدف روشن", text: "بتوانید هدف مالی و افق زمانی خود را تعریف کنید و معیارهای انتخاب را از روی آن بسازید." },
  { icon: Layers3, title: "شناخت ابزارها", text: "تفاوت ابزارهای اصلی و نقش ریسک، هزینه و نقدشوندگی را در مقایسه آن‌ها بفهمید." },
  { icon: ShieldCheck, title: "تصمیم با چارچوب", text: "برای ساخت سبد و مرور تصمیم‌ها، یک برنامه مکتوب و قابل پیگیری داشته باشید." },
]

export default function InvestmentCoursePage() {
  return (
    <Layout>
      <div dir="rtl" className="mx-auto w-full max-w-6xl space-y-8 py-4 text-right md:py-6">
        <section aria-labelledby="investment-course-title" className="relative overflow-hidden rounded-2xl border border-cyan-500/20 bg-gradient-to-bl from-cyan-500/10 via-background to-emerald-500/5 p-5 md:p-8">
          <div aria-hidden="true" className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-cyan-500/10 blur-3xl" />
          <div className="relative grid items-center gap-8 lg:grid-cols-[1.6fr_1fr]">
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="gap-1.5"><GraduationCap className="h-3.5 w-3.5" />حیات · یادگیری و گفت‌وگو</Badge>
                <Badge variant="outline">دوره مقدماتی</Badge>
              </div>
              <div className="space-y-3">
                <h1 id="investment-course-title" className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">دورهمی سرمایه‌گذاری</h1>
                <p className="text-lg font-medium text-cyan-700 dark:text-cyan-300">یک ماه برای آشنایی با مبانی سرمایه‌گذاری</p>
                <p className="max-w-2xl text-sm leading-8 text-muted-foreground md:text-base">
                  از پرسش‌های پایه شروع می‌کنیم: چرا سرمایه‌گذاری می‌کنیم، چه ابزارهایی داریم و چگونه ریسک را می‌سنجیم؟ در چهار هفته، با توضیح ساده، مثال‌های آموزشی و گفت‌وگو، مسیر شناخت بازارها تا تدوین یک برنامه سرمایه‌گذاری را طی می‌کنیم.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild className="gap-2"><a href="#course-syllabus">دیدن سرفصل‌ها<ArrowDown className="h-4 w-4" /></a></Button>
                <Button asChild variant="outline"><a href="#course-outcomes">خروجی دوره</a></Button>
              </div>
            </div>
            <Card className="relative border-cyan-500/20 bg-background/80 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="h-5 w-5 text-primary" />مسیر دوره در یک نگاه</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <dl className="grid grid-cols-2 gap-3 border-b pb-4 text-sm">
                  <div><dt className="text-xs text-muted-foreground">مدت دوره</dt><dd className="mt-1 font-semibold">یک ماه · چهار هفته</dd></div>
                  <div><dt className="text-xs text-muted-foreground">سطح</dt><dd className="mt-1 font-semibold">مقدماتی، از پایه</dd></div>
                </dl>
                <ol className="space-y-3">
                  {weeks.map((week) => <li key={week.number} className="flex items-center gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{week.number}</span><div><p className="text-sm font-medium">{week.title}</p><p className="mt-0.5 text-xs text-muted-foreground">{week.label}</p></div></li>)}
                </ol>
              </CardContent>
            </Card>
          </div>
        </section>

        <section aria-labelledby="course-audience-title" className="rounded-xl border bg-card p-5">
          <h2 id="course-audience-title" className="text-lg font-semibold">این دوره برای چه کسانی است؟</h2>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            برای کسانی که می‌خواهند از پایه با سرمایه‌گذاری آشنا شوند، تفاوت ابزارها را بفهمند و برای هدف‌های مالی خود چارچوب داشته باشند. پیش‌نیاز تخصصی ندارد؛ موضوعات از مفاهیم روزمره شروع می‌شوند و به‌تدریج به ساخت سبد و برنامه‌ریزی می‌رسند.
          </p>
        </section>

        <section id="course-syllabus" aria-labelledby="course-syllabus-title" className="scroll-mt-6 space-y-4">
          <div><p className="text-xs font-medium text-primary">برنامه چهار هفته‌ای</p><h2 id="course-syllabus-title" className="mt-1 text-2xl font-bold">سرفصل‌های دوره</h2><p className="mt-2 text-sm leading-7 text-muted-foreground">هر هفته یک موضوع اصلی و یک تمرین دارد؛ تمرین‌ها آموخته‌ها را به تصمیم‌های قابل توضیح تبدیل می‌کنند.</p></div>
          <div className="grid items-stretch gap-4 md:grid-cols-2">
            {weeks.map(({ number, label, title, icon: Icon, description, topics, practice }) => (
              <Card key={number} className="flex h-full flex-col">
                <CardHeader>
                  <div className="mb-2 flex items-center justify-between gap-3"><Badge variant="outline">{label}</Badge><Icon aria-hidden="true" className="h-5 w-5 text-primary" /></div>
                  <CardTitle className="text-lg">{title}</CardTitle>
                  <CardDescription className="leading-7">{description}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-5">
                  <ul className="space-y-3 text-sm">
                    {topics.map((topic) => <li key={topic} className="flex items-start gap-2"><CheckCircle2 aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-cyan-600 dark:text-cyan-400" /><span className="leading-7">{topic}</span></li>)}
                  </ul>
                  <div className="mt-auto rounded-lg border bg-muted/30 p-3"><p className="text-xs font-semibold text-primary">تمرین {label}</p><p className="mt-1 text-sm leading-7 text-muted-foreground">{practice}</p></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section id="course-outcomes" aria-labelledby="course-outcomes-title" className="scroll-mt-6 space-y-4">
          <h2 id="course-outcomes-title" className="text-2xl font-bold">در پایان این ماه چه چیزی به دست می‌آوریم؟</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {outcomes.map(({ icon: Icon, title, text }) => <Card key={title}><CardHeader className="pb-2"><Icon aria-hidden="true" className="mb-2 h-6 w-6 text-primary" /><CardTitle className="text-base">{title}</CardTitle></CardHeader><CardContent><p className="text-sm leading-7 text-muted-foreground">{text}</p></CardContent></Card>)}
          </div>
          <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-5"><p className="font-semibold">خروجی نهایی: یک برنامه سرمایه‌گذاری آموزشی</p><p className="mt-2 text-sm leading-7 text-muted-foreground">برنامه‌ای که مشخص کند برای چه هدفی، با چه افق زمانی و بر اساس چه معیارهایی دارایی‌ها را بررسی می‌کنید؛ همراه با قواعدی برای کنترل ریسک و بازبینی تصمیم‌ها.</p></div>
        </section>
      </div>
    </Layout>
  )
}
