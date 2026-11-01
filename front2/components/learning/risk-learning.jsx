"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Clock3, RotateCcw, Search, ShieldCheck } from "lucide-react"
import { useAuth } from "@/components/auth/auth-context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { contentVersion, learningSources, riskCards, riskLessons } from "@/lib/learning-content.mjs"
import { dailyCards, emptyProgress, learningStats, parseProgress, recordReview, weeklyCards } from "@/lib/learning-progress.mjs"

const number = value => value.toLocaleString("fa-IR")
const normalize = value => value.replace(/ي/g, "ی").replace(/ك/g, "ک").replace(/\u200c/g, " ").toLocaleLowerCase("fa-IR")
const dateLabel = value => new Date(value).toLocaleString("fa-IR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })

function SourceLink({ source }) {
  const item = learningSources[source]
  return <a href={item.href} target="_blank" rel="noopener noreferrer" className="text-xs leading-6 text-primary underline underline-offset-4">{item.title} · {item.section}<span className="sr-only"> (در پنجره جدید)</span></a>
}

function PracticeSession({ cards, mode, onReview, onClose }) {
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState(null)
  const [revealed, setRevealed] = useState(false)
  const [saved, setSaved] = useState(false)
  const [score, setScore] = useState(0)
  const [done, setDone] = useState(false)
  const sessionHeading = useRef(null)
  useEffect(() => { sessionHeading.current?.focus() }, [index, done])
  const card = cards[index]
  const quiz = mode === "quiz"
  function submit(value) {
    setAnswer(value)
    setRevealed(true)
    if (value === card.answer) setScore(current => current + 1)
    if (quiz) {
      onReview(card.id, value === card.answer, value === card.answer ? "known" : "unknown")
      setSaved(true)
    }
  }
  function rate(confidence) {
    onReview(card.id, answer === card.answer, confidence)
    setSaved(true)
  }
  function next() {
    if (index === cards.length - 1) { setDone(true); return }
    setIndex(current => current + 1)
    setAnswer(null)
    setRevealed(false)
    setSaved(false)
  }
  if (done) return <section ref={sessionHeading} tabIndex={-1} aria-live="polite" className="rounded-2xl border bg-card p-6 text-center focus:outline-none">
    <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
    <h2 className="mt-4 text-xl font-bold">{quiz ? "آزمون کوتاه تمام شد" : "تمرین این نوبت تمام شد"}</h2>
    <p className="mt-3 text-sm leading-7 text-muted-foreground">{number(score)} پاسخ درست از {number(cards.length)} سؤال · پاسخ‌ها و زمان مرور بعدی ثبت شدند.</p>
    <p className="mt-2 text-xs leading-7 text-muted-foreground">این نتیجه مربوط به همین نوبت است؛ تسلط پس از پاسخ درست در مرورهای فاصله‌دار محاسبه می‌شود.</p>
    <Button className="mt-5" onClick={onClose}>بازگشت به آموزش</Button>
  </section>
  const lesson = riskLessons.find(item => item.id === card.lessonId)
  return <section ref={sessionHeading} tabIndex={-1} aria-label={quiz ? "آزمون کوتاه مدیریت ریسک" : "تمرین مدیریت ریسک"} className="space-y-5 rounded-2xl border bg-card p-4 focus:outline-none md:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="font-semibold">{quiz ? "آزمون کوتاه" : "تمرین و مرور"} · سؤال {number(index + 1)} از {number(cards.length)}</p><Button variant="ghost" size="sm" onClick={onClose}>بستن تمرین</Button></div>
    <Progress value={index / cards.length * 100} aria-label="پیشرفت این نوبت" />
    <div className="flex flex-wrap gap-2"><Badge variant="secondary">تألیفی</Badge><Badge variant="outline">{lesson.title}</Badge><Badge variant="outline">{card.type} · {card.difficulty}</Badge></div>
    <div className="text-xs leading-6 text-muted-foreground">هدف: {lesson.goal} · سطح: {lesson.level} · پیش‌نیاز: {riskLessons.indexOf(lesson) ? riskLessons[riskLessons.indexOf(lesson) - 1].title : "ندارد"}</div>
    <fieldset disabled={revealed} className="space-y-3">
      <legend className="mb-4 text-lg font-semibold leading-9">{card.question}</legend>
      {card.options.map((option, optionIndex) => <label key={optionIndex} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 text-sm leading-7 ${revealed && optionIndex === card.answer ? "border-emerald-500 bg-emerald-500/10" : answer === optionIndex ? "border-primary bg-primary/5" : "border-border"}`}>
        <input className="mt-2 accent-primary" type="radio" name="practice-answer" checked={answer === optionIndex} onChange={() => setAnswer(optionIndex)} />
        <span>{option}{revealed && optionIndex === card.answer && <span className="ms-2 font-semibold text-emerald-700 dark:text-emerald-400">· پاسخ صحیح</span>}{revealed && answer === optionIndex && optionIndex !== card.answer && <span className="ms-2 font-semibold text-destructive">· انتخاب شما، نادرست</span>}</span>
      </label>)}
    </fieldset>
    {!revealed ? <div className="flex flex-wrap gap-2"><Button disabled={answer === null} onClick={() => submit(answer)}>ثبت پاسخ</Button><Button variant="outline" onClick={() => submit(null)}>نمی‌دانم / نمایش پاسخ</Button></div> : <div aria-live="polite" className="space-y-4">
      <div className="rounded-xl bg-muted/50 p-4"><p className="font-semibold">{answer === card.answer ? "درست پاسخ دادید" : answer === null ? "پاسخ را با هم مرور کنیم" : "این پاسخ درست نبود"}</p><p className="mt-2 text-sm leading-8">{card.explanation}</p><ul className="mt-3 space-y-2 text-xs leading-7 text-muted-foreground">{card.options.map((option, i) => <li key={i}>{option}: {card.reasons[i]}</li>)}</ul></div>
      <SourceLink source={card.source} />
      {!saved && <div><p className="mb-3 text-sm">میزان اطمینان خود را ثبت کنید تا زمان مرور مشخص شود.</p><div className="flex flex-wrap gap-2">{[["known", "بلد بودم"], ["unsure", "با تردید"], ["unknown", "بلد نبودم"]].map(([value, label]) => <Button key={value} variant="outline" onClick={() => rate(value)}>{label}</Button>)}</div></div>}
      {saved && <div className="flex flex-wrap items-center gap-3"><Button className="gap-2" onClick={next}>{index === cards.length - 1 ? "مشاهده نتیجه" : "سؤال بعدی"}<ArrowLeft className="h-4 w-4" /></Button><span className="text-xs text-muted-foreground">نتیجه ثبت شد</span></div>}
    </div>}
  </section>
}

export default function RiskLearning() {
  const { user, isLoading } = useAuth()
  const storageKey = `greenpeak.learning.${contentVersion}.${user?.id || user?.username || "guest"}`
  const [loadedKey, setLoadedKey] = useState(null)
  const [progress, setProgress] = useState(emptyProgress)
  const [storageError, setStorageError] = useState(false)
  const [tab, setTab] = useState("today")
  const [lessonId, setLessonId] = useState(riskLessons[0].id)
  const [search, setSearch] = useState("")
  const [session, setSession] = useState(null)
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    if (isLoading) return
    let restored = emptyProgress()
    let failed = false
    try { restored = parseProgress(localStorage.getItem(storageKey), riskLessons, riskCards) } catch { failed = true }
    setProgress(restored)
    setStorageError(failed)
    setSession(null)
    setLoadedKey(storageKey)
  }, [storageKey, isLoading])
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])
  function save(updated) {
    setProgress(updated)
    try { localStorage.setItem(storageKey, JSON.stringify(updated)); setStorageError(false) } catch { setStorageError(true) }
    setNow(new Date())
  }
  function review(cardId, correct, confidence) { save(recordReview(progress, cardId, correct, confidence)) }
  function start(cards, mode = "practice") { if (cards.length) setSession({ cards, mode, key: Date.now() }) }
  function study(id) { setLessonId(id); setSearch(""); setTab("lessons") }
  if (isLoading || loadedKey !== storageKey) return <div lang="fa" dir="rtl" className="p-8 text-center text-muted-foreground" role="status">در حال آماده‌سازی آموزش…</div>

  const stats = learningStats(progress, riskCards, riskLessons)
  const today = dailyCards(riskCards, progress, now)
  const lesson = riskLessons.find(item => item.id === lessonId)
  const nextLesson = riskLessons.find(item => !progress.lessons[item.id])
  const lessonIndex = riskLessons.indexOf(lesson)
  const matchingCards = riskCards.filter(card => (search ? normalize(`${card.question} ${riskLessons.find(item => item.id === card.lessonId).title}`).includes(normalize(search)) : card.lessonId === lessonId))
  const dueCount = riskCards.filter(card => progress.cards[card.id] && Date.parse(progress.cards[card.id].nextReviewAt) <= now.getTime()).length
  const latest = Object.values(progress.cards).sort((a, b) => Date.parse(b.reviewedAt) - Date.parse(a.reviewedAt))[0]

  return <div lang="fa" dir="rtl" className="mx-auto max-w-6xl space-y-6 py-4 text-right md:py-6">
    <Link href="/learn" className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-primary"><ArrowRight className="h-4 w-4" />همه آموزش‌ها</Link>
    <header className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border bg-gradient-to-bl from-primary/10 to-card p-5 md:p-7">
      <div><p className="mb-3 flex items-center gap-2 text-sm text-primary"><ShieldCheck className="h-5 w-5" />مسیر مفهومی و تمرینی اصول بازار سرمایه</p><h1 className="text-3xl font-bold">مدیریت ریسک</h1><p className="mt-3 text-sm leading-8 text-muted-foreground">بخوانید، تمرین کنید و با مرور فاصله‌دار یادگیری را ماندگار کنید.</p></div>
      <Badge variant="outline">{number(riskLessons.length)} درس · {number(riskCards.length)} کارت تألیفی</Badge>
    </header>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">{[
      ["درس‌های مطالعه‌شده", stats.studied, riskLessons.length], ["کارت‌های تمرین‌شده", stats.seen, riskCards.length], ["تسلط در مرورهای بعدی", stats.mastered, riskCards.length],
    ].map(([label, count, total]) => <div key={label} className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="my-3 text-xl font-semibold">{number(count)} <span className="text-sm font-normal text-muted-foreground">از {number(total)}</span></p><Progress value={count / total * 100} aria-label={label} /></div>)}</div>
    <p className="text-xs leading-6 text-muted-foreground">تسلط: پاسخ درست و مطمئن در حداقل دو نوبت با فاصله دست‌کم ۲۴ ساعت. مطالعه درس به‌تنهایی تسلط محسوب نمی‌شود.</p>
    {storageError && <p role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm leading-7">ذخیره در مرورگر در دسترس نیست؛ پیشرفت فقط تا زمان بازبودن این صفحه حفظ می‌شود.</p>}
    {session ? <PracticeSession key={session.key} {...session} onReview={review} onClose={() => setSession(null)} /> : <Tabs dir="rtl" value={tab} onValueChange={setTab} className="space-y-5">
      <TabsList aria-label="بخش‌های آموزش ریسک" className="flex h-auto w-full flex-wrap justify-start gap-1"><TabsTrigger value="today">برنامه امروز</TabsTrigger><TabsTrigger value="lessons">درس‌ها و کارت‌ها</TabsTrigger><TabsTrigger value="review">نیاز به مرور</TabsTrigger><TabsTrigger value="quiz">آزمون کوتاه</TabsTrigger></TabsList>
      <TabsContent value="today" className="space-y-4">
        <div className="grid gap-4 md:grid-cols-[1.5fr_1fr]">
          <section className="rounded-2xl border bg-card p-5 md:p-6"><p className="flex items-center gap-2 text-sm text-primary"><Clock3 className="h-4 w-4" />حدود ۵ دقیقه برای یادگیری</p><h2 className="mt-4 text-xl font-bold">قدم کوچک امروز شما</h2><p className="mt-3 text-sm leading-8 text-muted-foreground">ابتدا مرورهای موعدرسیده، سپس یک کارت جدید از درس‌هایی که خوانده‌اید. هر نوبت حداکثر دو مرور و یک کارت جدید دارد.</p><div className="my-5 flex flex-wrap gap-2"><Badge variant="secondary">{number(dueCount)} مرور موعدرسیده</Badge><Badge variant="outline">{number(today.filter(card => !progress.cards[card.id]).length)} کارت جدید در این نوبت</Badge></div>
            {today.length ? <Button onClick={() => start(today)} className="gap-2">شروع تمرین امروز<ArrowLeft className="h-4 w-4" /></Button> : <p className="text-sm leading-7">{nextLesson ? "برای بازشدن کارت جدید، ابتدا درس بعدی را مطالعه کنید." : "مرور موعدرسیده‌ای ندارید؛ می‌توانید از بخش درس‌ها آزادانه تمرین کنید."}</p>}
          </section>
          <section className="rounded-2xl border bg-card p-5 md:p-6"><BookOpen className="h-6 w-6 text-primary" /><h2 className="mt-4 font-semibold">{nextLesson ? "درس بعدی" : "همه درس‌ها را خوانده‌اید"}</h2><p className="mt-3 text-sm leading-7 text-muted-foreground">{nextLesson?.title || "برای تقویت مباحث، پاسخ‌های اشتباه را مرور کنید یا آزمون کوتاه بدهید."}</p><Button variant="outline" className="mt-5" onClick={() => nextLesson ? study(nextLesson.id) : setTab("review")}>{nextLesson ? "مطالعه درس" : "مشاهده مرورها"}</Button></section>
        </div>
        {latest && <p className="text-xs text-muted-foreground">آخرین تمرین: {dateLabel(latest.reviewedAt)}</p>}
      </TabsContent>
      <TabsContent value="lessons" className="space-y-5">
        <div className="grid items-start gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          <nav aria-label="درس‌های مدیریت ریسک" className="space-y-1 rounded-xl border bg-card p-2">{riskLessons.map((item, index) => <button key={item.id} type="button" onClick={() => { setLessonId(item.id); setSearch("") }} aria-current={item.id === lessonId ? "step" : undefined} className={`flex w-full items-start gap-3 rounded-lg p-3 text-right text-sm leading-7 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${item.id === lessonId ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent"}`}><span className="font-semibold">{number(index + 1)}</span><span className="flex-1">{item.title}</span>{progress.lessons[item.id] && <CheckCircle2 aria-label="مطالعه شده" className="mt-1 h-4 w-4 shrink-0" />}</button>)}</nav>
          <article className="space-y-4 rounded-xl border bg-card p-5 md:p-6">
            <div className="flex flex-wrap gap-2"><Badge variant="secondary">{lesson.level}</Badge><Badge variant="outline">{number(lesson.minutes)} دقیقه</Badge></div>
            <h2 className="text-xl font-bold">{lesson.title}</h2><p className="text-sm font-medium leading-7 text-primary">هدف: {lesson.goal}</p><p className="text-xs text-muted-foreground">پیش‌نیاز پیشنهادی: {lessonIndex ? riskLessons[lessonIndex - 1].title : "ندارد"}</p>
            {lesson.paragraphs.map(paragraph => <p key={paragraph} className="text-sm leading-8 text-muted-foreground">{paragraph}</p>)}
            {lesson.formula && <pre dir="ltr" className="overflow-x-auto rounded-lg bg-muted p-4 text-left text-xs leading-7">{lesson.formula}</pre>}
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4"><h3 className="mb-2 text-sm font-semibold">مثال تألیفی</h3><p className="text-sm leading-8">{lesson.example}</p></div><p className="text-sm leading-8"><strong>خطای رایج: </strong>{lesson.mistake}</p>
            <div className="space-y-2 border-t pt-4"><p className="text-xs text-muted-foreground">مرجع مطالعه مرتبط</p><SourceLink source={lesson.source} /></div>
            <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={Boolean(progress.lessons[lessonId])} onClick={() => save({ ...progress, lessons: { ...progress.lessons, [lessonId]: new Date().toISOString() } })}>{progress.lessons[lessonId] ? "مطالعه‌شده" : "درس را مطالعه کردم"}</Button><Button onClick={() => start(riskCards.filter(card => card.lessonId === lessonId))}>تمرین این درس</Button>{lessonIndex < riskLessons.length - 1 && <Button variant="ghost" onClick={() => study(riskLessons[lessonIndex + 1].id)}>درس بعدی<ArrowLeft className="ms-2 h-4 w-4" /></Button>}</div>
          </article>
        </div>
        <section className="space-y-3"><h2 className="text-lg font-semibold">بانک کارت‌های تمرین</h2><div className="relative"><Search className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="جست‌وجوی کارت‌ها در همه مباحث" value={search} onChange={event => setSearch(event.target.value)} placeholder="جست‌وجوی سؤال یا مبحث در همه درس‌ها…" className="pr-10" /></div><p className="text-xs text-muted-foreground">{search ? "نتایج همه درس‌ها" : `کارت‌های درس ${lesson.title}`} · {number(matchingCards.length)} کارت</p>
          {!matchingCards.length && <p role="status" className="rounded-xl border p-5 text-sm text-muted-foreground">کارتی با این عبارت پیدا نشد.</p>}
          <div className="grid gap-3 md:grid-cols-2">{matchingCards.map(card => <div key={card.id} className="flex flex-col items-start gap-3 rounded-xl border bg-card p-4"><Badge variant="outline">{card.type} · تألیفی</Badge><p className="flex-1 text-sm leading-7">{card.question}</p><Button variant="ghost" size="sm" onClick={() => start([card])}>پاسخ به سؤال<ArrowLeft className="ms-2 h-4 w-4" /></Button></div>)}</div>
        </section>
      </TabsContent>
      <TabsContent value="review" className="space-y-4">
        <section className="rounded-xl border bg-card p-5"><h2 className="flex items-center gap-2 text-lg font-semibold"><RotateCcw className="h-5 w-5 text-primary" />اشتباه‌ها و مباحث نیازمند تمرین</h2><p className="mt-3 text-sm leading-7 text-muted-foreground">کارت‌های دارای آخرین پاسخ نادرست یا پاسخ همراه با تردید، اینجا نمایش داده می‌شوند.</p>{stats.weak.length > 0 && <Button className="mt-4" onClick={() => start(stats.weak.slice(0, 5))}>تمرین {number(Math.min(5, stats.weak.length))} کارت</Button>}</section>
        {!stats.weak.length && <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">هنوز پاسخ اشتباه یا نامطمئنی ثبت نشده است. پس از تمرین، موارد نیازمند مرور اینجا می‌آیند.</p>}
        {stats.weak.map(card => <div key={card.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4"><div><p className="text-sm leading-7">{card.question}</p><p className="mt-2 text-xs text-muted-foreground">مرور بعدی: {dateLabel(progress.cards[card.id].nextReviewAt)} · {riskLessons.find(item => item.id === card.lessonId).title}</p></div><Button variant="outline" size="sm" onClick={() => start([card])}>مرور کارت</Button></div>)}
      </TabsContent>
      <TabsContent value="quiz"><section className="space-y-4 rounded-2xl border bg-card p-6"><Badge variant="secondary">آزمون تألیفی · بدون محدودیت زمان</Badge><h2 className="text-xl font-bold">یک مرور کوتاه از شش مبحث</h2><p className="max-w-2xl text-sm leading-8 text-muted-foreground">شش سؤال، یک سؤال از هر درس. مجموعه سؤال‌ها هر هفته تغییر می‌کند؛ پس از هر پاسخ، توضیح را می‌بینید و نتیجه برای مرور ثبت می‌شود. این آزمون شبیه‌ساز رسمی آزمون اصول بازار سرمایه نیست.</p><Button disabled={stats.studied < riskLessons.length} onClick={() => start(weeklyCards(riskCards, riskLessons, now), "quiz")}>شروع آزمون کوتاه</Button>{stats.studied < riskLessons.length && <p className="text-xs leading-7 text-muted-foreground">برای شروع، شش درس را مطالعه و با دکمه «درس را مطالعه کردم» ثبت کنید.</p>}</section></TabsContent>
    </Tabs>}
    <footer className="space-y-2 border-t pt-5 text-xs leading-7 text-muted-foreground"><p>پیشرفت این آموزش برای {user ? "حساب شما" : "مهمان"} فقط در همین مرورگر ذخیره می‌شود؛ همگام‌سازی بین دستگاه‌ها و ارسال آموزشی تلگرام فعال نیست.</p><p>درس‌ها و سؤال‌ها تألیفی‌اند؛ لینک منابع برای مطالعه بیشتر است. این محتوا پوشش کامل آزمون رسمی یا توصیه خریدوفروش محسوب نمی‌شود. نسخه محتوا: {contentVersion}.</p></footer>
  </div>
}
