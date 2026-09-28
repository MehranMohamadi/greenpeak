import Link from "next/link"
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  BookOpen,
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Database,
  Gauge,
  HelpCircle,
  Landmark,
  LayoutDashboard,
  LineChart,
  ListChecks,
  Newspaper,
  Search,
  Settings,
  ShieldCheck,
  Target,
  TrendingUp,
  WalletCards,
} from "lucide-react"

import Layout from "@/components/kokonutui/layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const quickLinks = [
  { href: "/", label: "داشبورد", icon: LayoutDashboard },
  { href: "/analytics", label: "گزارش بازار", icon: TrendingUp },
  { href: "/analytics/events", label: "رویدادها و اخبار", icon: CalendarDays },
  { href: "/settings", label: "تنظیمات", icon: Settings },
]

const guideSections = [
  ["#goals", "هدف سامانه"],
  ["#start", "شروع سریع"],
  ["#dashboard", "داشبورد"],
  ["#report", "گزارش بازار"],
  ["#charts", "کار با نمودارها"],
  ["#groups", "گروه‌های تحلیلی"],
  ["#events", "رویدادها و اخبار"],
  ["#settings", "تنظیمات و اتصال"],
  ["#quality", "کیفیت داده"],
  ["#glossary", "واژه‌نامه"],
  ["#faq", "پرسش‌های رایج"],
]

const analysisGroups = [
  {
    number: "۰۱",
    href: "/analytics/monetary-policy",
    title: "سیاست پولی و نقدینگی سیستم",
    english: "Monetary Policy & System Liquidity",
    icon: Landmark,
    purpose: "بررسی هزینه پول، جهت سیاست فدرال رزرو و مقدار نقدینگی موجود در سیستم مالی.",
    charts: [
      "بازده اوراق خزانه ۱۰ساله",
      "نرخ مؤثر وجوه فدرال",
      "نرخ تأمین مالی شبانه تضمین‌شده (SOFR)",
      "نرخ بهره واقعی ۱۰ساله",
      "کل دارایی‌های فدرال رزرو",
      "حجم پول M2",
      "مانده عملیات ریپو معکوس شبانه",
    ],
    reading: "افزایش نرخ‌ها معمولاً شرایط مالی را سخت‌تر می‌کند؛ اما تفسیر نهایی باید همراه با تورم، رشد و وضعیت نقدینگی انجام شود.",
  },
  {
    number: "۰۲",
    href: "/analytics/macroeconomic",
    title: "رشد، تورم و بازار کار",
    english: "Growth, Inflation & Labor",
    icon: BarChart3,
    purpose: "تشخیص شتاب یا ضعف اقتصاد آمریکا و فشارهای تورمی مؤثر بر سیاست پولی و سود شرکت‌ها.",
    charts: [
      "رشد تولید ناخالص داخلی واقعی",
      "رشد ماهانه خرده‌فروشی",
      "اعتماد مصرف‌کننده",
      "تورم سالانه CPI و Core CPI",
      "تورم سالانه Core PCE",
      "تورم تولیدکننده برای تقاضای نهایی",
      "نرخ بیکاری",
      "سطح اشتغال غیرکشاورزی",
    ],
    reading: "رشد بالا به‌تنهایی مثبت نیست؛ اگر با تورم چسبنده همراه باشد می‌تواند احتمال نرخ بهره بالاتر را افزایش دهد.",
  },
  {
    number: "۰۳",
    href: "/analytics/systemic-risk",
    title: "اعتبار و ثبات مالی",
    english: "Credit & Financial Stability",
    icon: ShieldCheck,
    purpose: "اندازه‌گیری قیمت ریسک اعتباری، تنش مالی و پیام منحنی بازده درباره چرخه اقتصادی.",
    charts: [
      "اسپرد تعدیل‌شده اوراق High Yield",
      "اسپرد تعدیل‌شده اوراق شرکتی BBB",
      "شاخص تنش مالی فدرال رزرو سنت‌لوئیس",
      "اختلاف بازده اوراق ۱۰ساله و ۲ساله",
    ],
    reading: "بازشدن اسپردهای اعتباری و افزایش شاخص تنش معمولاً نشانه کاهش اشتهای ریسک است؛ وارونگی منحنی بازده نیز باید در بستر چرخه بررسی شود.",
  },
  {
    number: "۰۴",
    href: "/analytics/corporate-earnings",
    title: "بنیادهای شرکتی و سودآوری",
    english: "Corporate Fundamentals & Earnings",
    icon: Building2,
    purpose: "بررسی اینکه حرکت شاخص با رشد واقعی درآمد، سود و کیفیت ترازنامه شرکت‌ها پشتیبانی می‌شود یا نه.",
    charts: [
      "EPS عملیاتی گزارش‌شده S&P 500",
      "رشد تجمیعی درآمد شرکت‌ها",
      "حاشیه سود تجمیعی",
      "بازده دارایی‌ها (ROA)",
    ],
    reading: "در شاخص‌های تجمیعی، پوشش شرکت‌ها و تاریخ آخرین صورت مالی مهم است. درصد پوشش در متادیتا نمایش داده می‌شود.",
  },
  {
    number: "۰۵",
    href: "/analytics/valuation",
    title: "ارزش‌گذاری",
    english: "Valuation",
    icon: CircleDollarSign,
    purpose: "مقایسه قیمت بازار با سود، فروش، ارزش دفتری، رشد سود و سود نقدی.",
    charts: [
      "نسبت P/E دوازده‌ماهه گذشته",
      "Forward P/E دوازده‌ماهه آینده",
      "نسبت قیمت به ارزش دفتری",
      "نسبت قیمت به فروش",
      "PEG Proxy پنج‌ساله",
      "بازده سود نقدی",
    ],
    reading: "PEG این سایت یک پروکسی تاریخی است: P/E گذشته تقسیم بر رشد سالانه‌شده EPS در پنج سال. این مقدار با Forward PEG مبتنی بر پیش‌بینی تحلیلگران یکسان نیست.",
  },
  {
    number: "۰۶",
    href: "/analytics/market-internals",
    title: "ساختار بازار، بخش‌ها و تمرکز",
    english: "Market Structure, Sectors & Concentration",
    icon: Gauge,
    purpose: "بررسی پهنای مشارکت بازار و تشخیص اینکه بازده شاخص توسط چند شرکت یا بخش محدود هدایت می‌شود یا گسترده است.",
    charts: [
      "تمرکز وزن شرکت‌های بزرگ در SPY",
      "مشارکت شرکت‌ها در بازده S&P 500، در صورت وجود وزن تاریخی معتبر",
      "مقایسه S&P 500 وزنی با نسخه Equal Weight",
      "وزن ۱۱ بخش GICS",
      "نقشه حرارتی بازده نسبی بخش‌ها",
      "رشد در برابر ارزش، بزرگ در برابر کوچک و چرخه‌ای در برابر دفاعی",
    ],
    reading: "برچسب ETF proxy یعنی نمودار از ETF نماینده استفاده می‌کند. داده فعلی هیچ‌وقت به‌جای وزن تاریخی ناموجود قرار داده نمی‌شود.",
  },
  {
    number: "۰۷",
    href: "/analytics/sentiment",
    title: "موقعیت‌گیری، احساسات و نوسان",
    english: "Positioning, Sentiment & Volatility",
    icon: Activity,
    purpose: "مشاهده ترس بازار، ساختار نوسان، رفتار معامله‌گران اختیار و موقعیت بازیگران بازار آتی.",
    charts: [
      "شاخص نوسان VIX",
      "منحنی زمانی VIX از ۹روزه تا یک‌ساله",
      "نسبت Put/Call اختیارهای SPX و SPXW",
      "نظرسنجی صعودی، خنثی و نزولی AAII",
      "موقعیت مدیران دارایی و Leveraged Money در معاملات آتی S&P 500",
    ],
    reading: "احساسات افراطی می‌تواند ادامه روند یا بازگشت آن را همراهی کند؛ هیچ آستانه‌ای به‌تنهایی سیگنال خرید یا فروش نیست.",
  },
  {
    number: "۰۸",
    href: "/analytics/intermarket",
    title: "جریان سرمایه و روابط بین‌بازاری",
    english: "Capital Flows & Intermarket",
    icon: LineChart,
    purpose: "قرار دادن بازار سهام در کنار دلار و کالاهای مهم برای فهم زمینه جهانی ریسک، تورم و رشد.",
    charts: [
      "شاخص S&P 500",
      "شاخص گسترده و وزنی دلار آمریکا",
      "قیمت طلا",
      "نفت خام WTI",
      "قیمت مس",
    ],
    reading: "برای مقایسه، به جهت و واگرایی سری‌ها توجه کنید؛ تفاوت واحدها به معنی امکان مقایسه مستقیم مقدار عددی آن‌ها نیست.",
  },
]

const statuses = [
  ["available", "داده معتبر و قابل نمایش است."],
  ["stale", "داده معتبر است اما از بازه تازگی مورد انتظار قدیمی‌تر شده است."],
  ["partial", "بخشی از ورودی‌ها یا شرکت‌های مورد انتظار موجود است."],
  ["unavailable", "داده معتبر برای نمایش وجود ندارد؛ مقدار جایگزین ساخته نمی‌شود."],
  ["invalid", "ساختار، تاریخ یا مقدار ورودی از اعتبارسنجی عبور نکرده است."],
  ["estimate", "آخرین مقدار توسط منبع به‌عنوان برآورد یا مقدار مقدماتی علامت خورده است."],
  ["proxy", "به‌جای خود شاخص از نماینده‌ای شفاف، مانند ETF یا فرمول تقریبی، استفاده شده است."],
]

const glossary = [
  ["bp یا واحد پایه", "یک‌صدم درصد؛ تغییر ۰٫۲۵ واحد درصد برابر با ۲۵ bp است."],
  ["pp یا واحد درصد", "اختلاف مستقیم دو درصد؛ از درصد تغییر متفاوت است."],
  ["YoY", "تغییر نسبت به دوره مشابه سال قبل."],
  ["MoM", "تغییر نسبت به ماه قبل."],
  ["TTM", "مجموع یا مقدار مربوط به دوازده ماه گذشته."],
  ["OAS", "اسپرد تعدیل‌شده بابت اختیار؛ معیاری از صرف ریسک اعتباری نسبت به اوراق دولتی."],
  ["Forward P/E", "قیمت نسبت به سود مورد انتظار دوازده ماه آینده؛ به پیش‌بینی تحلیلگران وابسته است."],
  ["Drawdown", "افت ارزش حساب یا دارایی نسبت به نقطه مرجع یا سقف تعریف‌شده."],
  ["Margin Level", "نسبت Equity به مارجین استفاده‌شده؛ تعریف و آستانه عملیاتی به بروکر وابسته است."],
  ["Swap", "هزینه یا اعتبار نگهداری شبانه موقعیت؛ واحد و روش محاسبه آن را بروکر تعیین می‌کند."],
]

function SectionHeading({ id, icon: Icon, eyebrow, title, description }) {
  return (
    <header id={id} className="scroll-mt-16 space-y-2">
      <div className="flex items-center gap-2 text-primary">
        <Icon className="h-5 w-5" />
        <p className="text-xs font-semibold tracking-wide">{eyebrow}</p>
      </div>
      <h2 className="text-xl font-bold text-foreground md:text-2xl">{title}</h2>
      {description && <p className="max-w-4xl text-sm leading-7 text-muted-foreground">{description}</p>}
    </header>
  )
}

function LinkButton({ href, children, variant = "outline" }) {
  return <Button asChild variant={variant} className="gap-2"><Link href={href}>{children}<ArrowLeft className="h-4 w-4" /></Link></Button>
}

export default function HelpPage() {
  return (
    <Layout>
      <main dir="rtl" className="mx-auto w-full max-w-7xl space-y-10 px-1 py-3 text-right sm:px-3 md:py-6">
        <section className="overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/15 via-background to-background p-5 shadow-sm md:p-8">
          <div className="grid items-center gap-8 lg:grid-cols-[1fr_auto]">
            <div className="space-y-5">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">راهنمای فارسی GreenPeak</Badge>
                <Badge variant="outline">۸ گروه تحلیلی</Badge>
                <Badge variant="outline">داده‌های منبع‌دار</Badge>
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">راهنمای کامل استفاده از GreenPeak</h1>
                <p className="mt-4 max-w-4xl text-sm leading-8 text-muted-foreground md:text-base">
                  GreenPeak یک داشبورد پژوهش بازار آمریکا با تمرکز بر S&amp;P 500 است. این سامانه وضعیت بازار، اقتصاد، سیاست پولی، سود شرکت‌ها، ارزش‌گذاری، ساختار بازار، احساسات و روابط بین‌بازاری را در یک مسیر منظم کنار هم قرار می‌دهد تا کاربر به‌جای دنبال‌کردن یک عدد منفرد، تصویر کامل‌تری از شرایط بازار داشته باشد.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <LinkButton href="/" variant="default">ورود به داشبورد</LinkButton>
                <LinkButton href="/analytics">مشاهده گزارش بازار</LinkButton>
              </div>
            </div>
            <div className="hidden rounded-2xl border bg-background/80 p-6 text-primary shadow-sm lg:block">
              <BookOpen className="h-20 w-20" strokeWidth={1.25} />
            </div>
          </div>
        </section>

        <nav aria-label="دسترسی سریع راهنما" className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {quickLinks.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className="group rounded-xl border bg-card p-4 transition hover:border-primary/50 hover:shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-foreground">{label}</span>
                <Icon className="h-5 w-5 text-primary transition-transform group-hover:-translate-x-1" />
              </div>
            </Link>
          ))}
        </nav>

        <nav aria-label="فهرست مطالب راهنما" className="rounded-xl border bg-card p-4">
          <p className="mb-3 text-sm font-semibold text-foreground">فهرست مطالب</p>
          <div className="flex flex-wrap gap-2">
            {guideSections.map(([href, label]) => <a key={href} href={href} className="rounded-full border bg-background px-3 py-1.5 text-xs text-muted-foreground transition hover:border-primary/50 hover:text-primary">{label}</a>)}
          </div>
        </nav>

        <section className="space-y-5">
          <SectionHeading id="goals" icon={Target} eyebrow="هدف سامانه" title="GreenPeak چه مسئله‌ای را حل می‌کند؟" />
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ["دید یکپارچه", "داده‌های پراکنده بازار و اقتصاد در هشت دامنه مشخص سازمان‌دهی می‌شوند تا ارتباط میان نرخ بهره، رشد، سود شرکت‌ها و قیمت بازار قابل مشاهده باشد."],
              ["شفافیت داده", "منبع، تاریخ مشاهده، واحد، تناوب و وضعیت کیفیت کنار نمودار نمایش داده می‌شود. داده ناموجود با صفر یا مقدار ساختگی جایگزین نمی‌شود."],
              ["کمک به تصمیم‌سازی", "هدف، ساختن چارچوب منظم برای تحقیق و مدیریت ریسک است؛ خروجی سامانه توصیه قطعی خرید، فروش یا تضمین بازده نیست."],
            ].map(([title, text]) => (
              <Card key={title}>
                <CardHeader className="pb-2"><CardTitle className="text-base">{title}</CardTitle></CardHeader>
                <CardContent><p className="text-sm leading-7 text-muted-foreground">{text}</p></CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="space-y-5">
          <SectionHeading id="start" icon={ListChecks} eyebrow="شروع سریع" title="مسیر پیشنهادی برای کاربر تازه‌وارد" />
          <ol className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {[
              ["۱", "نمای لحظه‌ای را ببینید", "از داشبورد، وضعیت بازار، ساعت معاملات، خبرها و حساب‌های متصل را مرور کنید."],
              ["۲", "گزارش کل بازار را بخوانید", "در صفحه تحلیل، محرک‌های مثبت و منفی، تعارض‌ها، ریسک‌ها و موارد قابل پیگیری را ببینید."],
              ["۳", "وارد گروه مرتبط شوید", "برای فهم علت حرکت بازار، نمودارهای همان دامنه را در بازه‌های زمانی مختلف بررسی کنید."],
              ["۴", "رویداد بعدی را کنترل کنید", "تقویم اقتصادی، گزارش سود شرکت‌ها و خبرهای بازار را برای ریسک زمانی بررسی کنید."],
            ].map(([number, title, text]) => (
              <li key={number} className="rounded-xl border bg-card p-4">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{number}</span>
                <h3 className="mt-4 font-semibold text-foreground">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="space-y-5">
          <SectionHeading id="dashboard" icon={LayoutDashboard} eyebrow="صفحه اصلی" title="داشبورد معاملاتی" description="صفحه نخست برای مشاهده سریع وضعیت جاری بازار و حساب‌های معاملاتی متصل طراحی شده است." />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Clock3 className="h-5 w-5 text-primary" />بازار و خبر</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm leading-7 text-muted-foreground">
                <p><strong className="text-foreground">ساعت بازار:</strong> وضعیت باز یا بسته‌بودن جلسه معاملاتی را نشان می‌دهد.</p>
                <p><strong className="text-foreground">نوار خبر:</strong> تیترهای مهم را برای آگاهی سریع نمایش می‌دهد.</p>
                <p><strong className="text-foreground">دیده‌بان بازار:</strong> SPX، بازده ۱۰ساله، P/E، VIX، دلار و طلا را همراه با آخرین مقدار، تغییر و نمودار کوچک نشان می‌دهد.</p>
                <p>جهت سبز یا قرمز فقط تغییر مقدار در پنجره محاسبه است و سیگنال معامله محسوب نمی‌شود.</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><WalletCards className="h-5 w-5 text-primary" />حساب‌ها و شرایط بروکر</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm leading-7 text-muted-foreground">
                <p>برای هر حساب متصل، موجودی، خالص دارایی، سود و زیان شناور، اهرم کل، سطح مارجین و افت سرمایه نمایش داده می‌شود.</p>
                <p>با بازکردن ردیف حساب، مارجین آزاد و استفاده‌شده، مواجهه خالص و ناخالص، اهرم خالص، هزینه سالانه سواپ، نسبت هزینه سواپ به خالص دارایی و سواپ خرید/فروش هر نماد قابل مشاهده است.</p>
                <p>باکس «معاملات و سفارش‌ها» با سه فیلتر معاملات باز، سفارش‌های در انتظار و معاملات بسته‌شده، قیمت ورود و خروج/فعلی، مدت نگهداری، SL/TP، هزینه‌ها و وضعیت هر ردیف را نمایش می‌دهد.</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-5 w-5 text-primary" />مرکز مدیریت ریسک</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm leading-7 text-muted-foreground">
                <p>ریسک پوزیشن‌های باز تا حد ضرر، پوشش Stop، بودجه زیان روز، لورج مؤثر، Margin Level و تمرکز Exposure را از آخرین Snapshot حساب خلاصه می‌کند.</p>
                <p>در «برنامه امروز» می‌توانید سقف‌های شخصی را برای ریسک معامله، ریسک باز، زیان روزانه، لورج، تعداد ورود و حداقل مارجین تعیین کنید. این قواعد فقط در مرورگر شما ذخیره می‌شوند.</p>
                <p>پنل «بررسی معامله جدید» ریسک، نسبت سود به زیان و انطباق با قواعد را پیش از اجرا می‌سنجد. دکمه ثبت برنامه فقط یادداشت را ذخیره می‌کند و سفارش واقعی نمی‌فرستد.</p>
                <p>اگر Stop، مشخصات Tick یا سابقه کافی وجود نداشته باشد، وضعیت «داده کافی نیست» یا «محاسبه ناقص» نمایش داده می‌شود؛ مقدار گمشده صفر فرض نمی‌شود.</p>
              </CardContent>
            </Card>
          </div>
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-7 text-amber-900 dark:text-amber-200">
            اطلاعات حساب از آخرین Snapshot سالم دریافت می‌شود. نبود Snapshot، ورودنکردن کاربر یا قطع ارتباط MT5 باعث نمایش «داده موجود نیست» می‌شود؛ این صفحه از طرف کاربر سفارش جدیدی برای بروکر ارسال نمی‌کند.
          </div>
        </section>

        <section className="space-y-5">
          <SectionHeading id="report" icon={TrendingUp} eyebrow="نمای کلان" title="گزارش هوشمند بازار" description="صفحه «گزارش بازار» خروجی هشت دامنه را کنار هم قرار می‌دهد و برای شروع تحلیل روزانه مناسب است." />
          <Card>
            <CardContent className="grid gap-4 p-5 md:grid-cols-2 lg:grid-cols-3">
              {[
                ["خلاصه وضعیت", "روایت کوتاه از شرایط جاری بازار و رژیم غالب."],
                ["محرک‌های مثبت و منفی", "شاخص‌هایی که در داده‌های فعلی از بازار حمایت می‌کنند یا علیه آن هستند."],
                ["تعارض‌های بین‌دامنه‌ای", "مواردی که مثلاً قیمت بازار با اعتبار، نرخ بهره یا بنیاد شرکت‌ها هم‌جهت نیست."],
                ["ریسک‌ها و عدم قطعیت", "ضعف پوشش داده، قدیمی‌بودن مشاهده یا رویدادهایی که می‌توانند نتیجه را تغییر دهند."],
                ["چه چیزی تغییر کرد", "تفاوت مهم نسبت به تحلیل قبلی."],
                ["موارد قابل پیگیری", "داده‌ها و رویدادهایی که در به‌روزرسانی بعدی باید کنترل شوند."],
              ].map(([title, text]) => <div key={title} className="rounded-lg border bg-muted/20 p-4"><h3 className="font-medium text-foreground">{title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p></div>)}
            </CardContent>
          </Card>
        </section>

        <section className="space-y-5">
          <SectionHeading id="charts" icon={LineChart} eyebrow="کار با نمودارها" title="چطور صفحات تحلیلی را بخوانیم؟" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[
              ["انتخاب شاخص", "روی هر کارت کوچک کلیک کنید تا نمودار اصلی و توضیح تحلیلی همان شاخص نمایش داده شود."],
              ["بازه زمانی", "دکمه‌های 1M، 6M، 1Y، 5Y، 10Y یا MAX فقط محدوده نمایش را تغییر می‌دهند و داده را دوباره محاسبه نمی‌کنند."],
              ["نمای تمام‌صفحه", "آیکون بزرگ‌نمایی، نمودار منتخب را در فضای بزرگ‌تر باز می‌کند."],
              ["منبع و تاریخ", "زیر عنوان نمودار، منبع، تاریخ آخرین مشاهده، واحد و تناوب داده نوشته شده است."],
              ["نمودار کوچک", "Mini chart روند همان بازه انتخابی را خلاصه می‌کند؛ رنگ آن توصیه خرید یا فروش نیست."],
              ["تحلیل متنی", "پنل کنار نمودار، واقعیت‌های کلیدی، ابهام‌ها، ریسک‌های تفسیر و موارد قابل پیگیری را ارائه می‌کند."],
            ].map(([title, text]) => <Card key={title}><CardHeader className="pb-2"><CardTitle className="text-base">{title}</CardTitle></CardHeader><CardContent><p className="text-sm leading-7 text-muted-foreground">{text}</p></CardContent></Card>)}
          </div>
        </section>

        <section className="space-y-5">
          <SectionHeading id="groups" icon={Database} eyebrow="نقشه تحلیل" title="گروه‌ها و نمودارهای سایت" description="هر شاخص فقط یک گروه مالک دارد تا از تکرار و تفسیر متناقض جلوگیری شود." />
          <div className="grid gap-4 lg:grid-cols-2">
            {analysisGroups.map(({ number, href, title, english, icon: Icon, purpose, charts, reading }) => (
              <Card key={href} className="overflow-hidden">
                <CardHeader className="border-b bg-muted/20">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold text-primary">گروه {number}</p>
                      <CardTitle className="mt-1 text-lg">{title}</CardTitle>
                      <p dir="ltr" className="mt-1 text-left text-xs text-muted-foreground">{english}</p>
                    </div>
                    <span className="rounded-xl bg-primary/10 p-2.5 text-primary"><Icon className="h-5 w-5" /></span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 p-5">
                  <p className="text-sm leading-7 text-muted-foreground">{purpose}</p>
                  <div>
                    <p className="mb-2 text-sm font-semibold text-foreground">نمودارها و بلوک‌ها</p>
                    <ul className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                      {charts.map((chart) => <li key={chart} className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>{chart}</span></li>)}
                    </ul>
                  </div>
                  <div className="rounded-lg border border-dashed p-3 text-xs leading-6 text-muted-foreground"><strong className="text-foreground">نکته تفسیر:</strong> {reading}</div>
                  <Link href={href} className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">بازکردن این گروه<ArrowLeft className="h-4 w-4" /></Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="space-y-5">
          <SectionHeading id="events" icon={Newspaper} eyebrow="زمینه زمانی" title="رویدادها، گزارش سود و اخبار" />
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ["تقویم اقتصادی", "زمان انتشار، مقدار واقعی، پیش‌بینی و مقدار قبلی داده‌های مهم اقتصادی آمریکا را نمایش می‌دهد."],
              ["تقویم گزارش سود", "تاریخ احتمالی گزارش شرکت‌ها، EPS، درآمد، برآورد و زمان انتشار را نشان می‌دهد."],
              ["اخبار بازار", "خوراک خبر مستقل برای پیگیری رویدادهایی است که ممکن است هنوز در داده‌های دوره‌ای منعکس نشده باشند."],
            ].map(([title, text]) => <Card key={title}><CardHeader className="pb-2"><CardTitle className="text-base">{title}</CardTitle></CardHeader><CardContent><p className="text-sm leading-7 text-muted-foreground">{text}</p></CardContent></Card>)}
          </div>
          <p className="rounded-xl border border-dashed p-4 text-sm leading-7 text-muted-foreground">GreenPeak مقدار رویداد، تاریخ انتشار، پیش‌بینی سود یا امتیاز اثر بازار را در این صفحه تولید نمی‌کند؛ اطلاعات همان‌طور که از منبع دریافت شده نمایش داده می‌شود.</p>
        </section>

        <section className="space-y-5">
          <SectionHeading id="settings" icon={Settings} eyebrow="شخصی‌سازی" title="تنظیمات، دیده‌بان و اتصال MT5" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              ["چیدمان و هشدارها", "اجزای داشبورد و تنظیمات مرتبط با هشدارهای کاربر را مدیریت می‌کند."],
              ["ظاهر داشبورد", "پوسته و حالت نمایش را متناسب با محیط کاری انتخاب می‌کند."],
              ["دیده‌بان شخصی", "نمادها و فهرست‌های موردنیاز کاربر را برای دسترسی سریع نگهداری می‌کند."],
              ["اتصال MetaTrader", "اطلاعات Pairing لازم برای ارسال Snapshot حساب از ابزار MT5 را ارائه می‌کند."],
            ].map(([title, text]) => <Card key={title}><CardHeader className="pb-2"><CardTitle className="text-base">{title}</CardTitle></CardHeader><CardContent><p className="text-sm leading-7 text-muted-foreground">{text}</p></CardContent></Card>)}
          </div>
          <p className="rounded-xl border bg-muted/20 p-4 text-sm leading-7 text-muted-foreground">نمایشگرهای Feature Pipeline و MetaTrader Snapshot در تنظیمات برای بررسی فنی JSON خام هستند. کاربران عادی برای مشاهده نمودارها و خلاصه حساب نیازی به استفاده از آن‌ها ندارند.</p>
        </section>

        <section className="space-y-5">
          <SectionHeading id="quality" icon={Search} eyebrow="کیفیت و شفافیت" title="معنی برچسب‌های داده" description="قبل از نتیجه‌گیری از هر نمودار، وضعیت کیفیت و تاریخ مشاهده را کنترل کنید." />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {statuses.map(([status, description]) => (
              <div key={status} className="rounded-xl border bg-card p-4">
                <Badge variant="outline" className="font-mono">{status}</Badge>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>
          <div className="rounded-xl border bg-muted/20 p-4 text-sm leading-7 text-muted-foreground">
            تناوب همه داده‌ها یکسان نیست: قیمت ممکن است روزانه باشد، احساسات هفتگی، تورم ماهانه و GDP یا بنیاد شرکت‌ها فصلی. قدیمی‌تر بودن تاریخ یک سری لزوماً خطا نیست؛ برچسب <bdi className="font-mono text-foreground">stale</bdi> زمانی ظاهر می‌شود که سن مشاهده از آستانه همان تناوب عبور کند.
          </div>
        </section>

        <section className="space-y-5">
          <SectionHeading id="glossary" icon={HelpCircle} eyebrow="واژه‌نامه" title="اصطلاحات پرکاربرد" />
          <Card>
            <CardContent className="p-0">
              <dl className="divide-y">
                {glossary.map(([term, definition]) => (
                  <div key={term} className="grid gap-1 p-4 sm:grid-cols-[12rem_1fr] sm:gap-4">
                    <dt className="font-semibold text-foreground">{term}</dt>
                    <dd className="text-sm leading-7 text-muted-foreground">{definition}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-5">
          <SectionHeading id="faq" icon={HelpCircle} eyebrow="پرسش‌های رایج" title="اگر چیزی نمایش داده نشد چه کنم؟" />
          <div className="grid gap-4 md:grid-cols-2">
            {[
              ["چرا نمودار خالی است؟", "ممکن است منبع بالادستی در دسترس نباشد، تاریخچه معتبر کافی وجود نداشته باشد یا فیلتر زمانی انتخاب‌شده نقطه‌ای نداشته باشد. پیام داخل کارت و quality_reason را بررسی کنید."],
              ["چرا دو نمودار تاریخ آخر متفاوت دارند؟", "هر منبع تقویم انتشار و تناوب خودش را دارد. مقایسه باید با توجه به تاریخ مشاهده انجام شود، نه فقط جایگاه آخر خط روی نمودار."],
              ["آیا همه داده‌ها لحظه‌ای هستند؟", "خیر. هر نمودار تناوب خود را دارد. تاریخ زیر عنوان نمودار مرجع دقیق‌تری از واژه‌هایی مثل زنده یا جدید است."],
              ["چرا مقدار سایت با پلتفرم دیگری فرق دارد؟", "تعریف شاخص، زمان بسته‌شدن بازار، نوع تعدیل، جمعیت شرکت‌ها و نسخه داده می‌تواند متفاوت باشد. منبع، واحد و transformation متادیتا را مقایسه کنید."],
              ["چرا حساب متاتریدر دیده نمی‌شود؟", "ابتدا وارد حساب کاربری شوید، اتصال را در تنظیمات بررسی کنید و یک Snapshot تازه از MT5 ارسال کنید. سایت آخرین Snapshot سالم را نمایش می‌دهد."],
              ["آیا تحلیل متنی سیگنال معامله است؟", "خیر. متن تحلیلی برای خلاصه‌سازی شواهد، تعارض‌ها و ریسک‌هاست و جایگزین برنامه معاملاتی، مدیریت سرمایه یا مشاوره حرفه‌ای نیست."],
            ].map(([question, answer]) => <Card key={question}><CardHeader className="pb-2"><CardTitle className="text-base">{question}</CardTitle></CardHeader><CardContent><p className="text-sm leading-7 text-muted-foreground">{answer}</p></CardContent></Card>)}
          </div>
        </section>

        <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 md:p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-1 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <h2 className="font-bold text-amber-950 dark:text-amber-100">محدودیت استفاده و مسئولیت کاربر</h2>
              <p className="mt-2 text-sm leading-7 text-amber-900/80 dark:text-amber-200/80">
                اطلاعات GreenPeak برای آموزش و پژوهش بازار ارائه می‌شود. داده‌های اقتصادی و مالی ممکن است با تأخیر منتشر یا بعداً بازبینی شوند. هیچ نمودار، رنگ، روایت تحلیلی یا مقدار حساب به‌تنهایی توصیه خرید و فروش، تضمین عملکرد یا جایگزین بررسی مستقل ریسک نیست.
              </p>
            </div>
          </div>
        </section>

        <section className="flex flex-col items-start justify-between gap-4 rounded-2xl border bg-card p-5 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-bold text-foreground">برای شروع آماده‌اید؟</h2>
            <p className="mt-1 text-sm text-muted-foreground">از داشبورد شروع کنید یا مستقیماً گزارش تحلیلی بازار را باز کنید. برای پشتیبانی با <a dir="ltr" className="text-primary hover:underline" href="mailto:support@GreenPeak.tech">support@GreenPeak.tech</a> تماس بگیرید.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <LinkButton href="/" variant="default">داشبورد</LinkButton>
            <LinkButton href="/analytics">گزارش بازار</LinkButton>
          </div>
        </section>
      </main>
    </Layout>
  )
}
