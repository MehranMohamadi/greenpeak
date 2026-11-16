"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Field, fieldClass, boxClass, dateLabel, localInput } from "@/components/workplace/quality-shared"

const empty = { title: "", publisher: "", author: "", source_url: "", published_at: "", expires_at: "", horizon: "medium", kind: "research", topics: "", content: "" }

export default function QualitySources({ data, api, action, busy }) {
  const [draft, setDraft] = useState(empty)
  const [query, setQuery] = useState("")
  const [research, setResearch] = useState(null)
  const [selected, setSelected] = useState(null)
  const set = (key, value) => setDraft(current => ({ ...current, [key]: value }))
  const readFile = file => action(async () => {
    if (!file || file.size > 5000000) throw new Error("فایل باید حداکثر ۵ مگابایت باشد.")
    const encoded = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1]); reader.onerror = () => reject(new Error("خواندن فایل ممکن نشد.")); reader.readAsDataURL(file) })
    const result = await api("/documents/extract", "POST", { filename: file.name, data_base64: encoded })
    set("content", result.content)
  }, "متن فایل استخراج شد؛ متن، تاریخ انتشار و مرجع را پیش از ثبت بررسی کنید.")
  return <div className="space-y-5">
    <section className={boxClass}>
      <h3 className="font-medium">پژوهش هدفمند</h3><p className="text-xs leading-6 text-muted-foreground">جست‌وجوی آنلاین عنوان و خلاصهٔ اطلاعیه‌های فدرال رزرو، BLS و BEA در ۶۰ روز اخیر، همراه جست‌وجوی کتابخانهٔ خودتان. برای منابع بین‌المللی عبارت انگلیسی وارد کنید. این جست‌وجو کل اینترنت را پوشش نمی‌دهد.</p>
      <form className="flex gap-2" onSubmit={event => { event.preventDefault(); action(async () => setResearch(await api(`/research?query=${encodeURIComponent(query)}`)), "جست‌وجوی منابع پایان یافت.") }}><input aria-label="موضوع پژوهش" value={query} minLength={3} maxLength={200} required onChange={event => setQuery(event.target.value)} className={fieldClass} /><Button disabled={busy}>جست‌وجو</Button></form>
      {research && <div className="space-y-3"><p className="text-xs text-muted-foreground">{research.sources.map(source => `${source.publisher}: ${source.status === "available" ? "در دسترس" : "ناموفق"}`).join(" · ")}</p>{research.items.length === 0 && <p className="text-sm">اطلاعیهٔ منطبقی پیدا نشد.</p>}{research.items.map((item, index) => <article key={`${item.source_url}-${index}`} className="space-y-2 rounded-lg bg-muted/30 p-3"><a href={item.source_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline" dir="ltr">{item.title}</a><p className="text-xs">{item.publisher} · {dateLabel(item.published_at)}</p><p className="text-xs leading-6">{item.excerpt}</p><Button size="sm" variant="outline" onClick={() => setDraft(current => ({ ...current, title: item.title, publisher: item.publisher, source_url: item.source_url, published_at: localInput(item.published_at), kind: "official", content: "" }))}>انتخاب برای بررسی و ورود</Button></article>)}{research.library.length > 0 && <div><p className="text-sm font-medium">در کتابخانه</p>{research.library.map(item => <button key={item.id} type="button" disabled={busy} className="block py-2 text-sm text-primary" onClick={() => action(async () => setSelected(await api(`/sources/${item.id}`)), "منبع باز شد.")}>{item.title}</button>)}</div>}</div>}
    </section>
    <form className={boxClass} onSubmit={event => {
      event.preventDefault()
      action(async () => { const result = await api("/sources", "POST", { ...draft, published_at: new Date(draft.published_at).toISOString(), expires_at: new Date(draft.expires_at).toISOString() }); setDraft(empty); setSelected(result); return result }, "منبع ثبت شد؛ پس از بررسی متن، تأییدش کنید تا وارد تحلیل شود.")
    }}>
      <h3 className="font-medium">ورود مقاله، هفته‌نامه یا منبع رسمی</h3>
      <p className="text-xs leading-6 text-muted-foreground">متن یا PDF متنی، TXT و Markdown را وارد کنید. PDF اسکن‌شده به OCR نیاز دارد. متن نظر و پژوهش با دادهٔ رسمی متمایز می‌ماند؛ حداکثر پنج بخش مرتبط از منابع تأییدشده و منقضی‌نشده وارد هر گزارش می‌شود.</p>
      <div className="grid gap-3 sm:grid-cols-2"><Field label="عنوان"><input className={fieldClass} required minLength={3} maxLength={240} value={draft.title} onChange={event => set("title", event.target.value)} /></Field><Field label="ناشر"><input className={fieldClass} required minLength={2} maxLength={120} value={draft.publisher} onChange={event => set("publisher", event.target.value)} /></Field></div>
      <Field label="نویسنده، در صورت مشخص بودن"><input className={fieldClass} maxLength={160} value={draft.author} onChange={event => set("author", event.target.value)} /></Field>
      <Field label="آدرس HTTPS منبع اصلی"><input className={fieldClass} type="url" required maxLength={2000} value={draft.source_url} onChange={event => set("source_url", event.target.value)} placeholder="https://" /></Field>
      <div className="flex flex-wrap gap-2"><Button variant="outline" type="button" disabled={busy || !draft.source_url} onClick={() => action(async () => { const result = await api("/sources/fetch", "POST", { source_url: draft.source_url }); set("content", result.content) }, "متن دریافت شد؛ کامل بودن و تاریخ آن را بررسی کنید.")}>دریافت متن از منابع منتخب</Button><label className="cursor-pointer rounded-md border border-input px-3 py-2 text-sm">ورود فایل<input type="file" accept=".pdf,.txt,.md" disabled={busy} className="sr-only" onChange={event => { const file = event.target.files?.[0]; if (file) void readFile(file); event.target.value = "" }} /></label></div>
      <div className="grid gap-3 sm:grid-cols-2"><Field label="زمان انتشار واقعی"><input className={fieldClass} type="datetime-local" required value={draft.published_at} onChange={event => set("published_at", event.target.value)} /></Field><Field label="انقضای استفاده در تحلیل"><input className={fieldClass} type="datetime-local" required value={draft.expires_at} onChange={event => set("expires_at", event.target.value)} /></Field><Field label="افق استفاده"><select className={fieldClass} value={draft.horizon} onChange={event => set("horizon", event.target.value)}><option value="pulse">نبض همان روز</option><option value="short">کوتاه‌مدت</option><option value="medium">میان‌مدت و هفتگی</option></select></Field><Field label="نوع محتوا"><select className={fieldClass} value={draft.kind} onChange={event => set("kind", event.target.value)}><option value="official">داده / اطلاعیهٔ رسمی</option><option value="research">پژوهش و تحلیل</option><option value="opinion">دیدگاه نویسنده</option></select></Field></div>
      <Field label="موضوع‌ها و کلیدواژه‌ها"><input className={fieldClass} maxLength={300} value={draft.topics} onChange={event => set("topics", event.target.value)} /></Field>
      <Field label="متن منبع؛ با حفظ تاریخ، شروط و شواهد مخالف"><textarea rows={10} className={fieldClass} required minLength={80} maxLength={200000} value={draft.content} onChange={event => set("content", event.target.value)} /></Field>
      <Button disabled={busy}>ثبت برای بررسی</Button>
    </form>
    <section className={boxClass}><h3 className="font-medium">کتابخانهٔ منابع</h3>{!data.sources.length && <p className="text-sm text-muted-foreground">هنوز منبعی ثبت نشده است.</p>}{data.sources.map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3"><div><p className="text-sm">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.publisher} · {dateLabel(item.published_at)} · {new Date(item.expires_at) <= new Date() ? "منقضی‌شده" : item.approved ? "تأییدشده" : "در انتظار تأیید"}</p></div><Button size="sm" variant="outline" disabled={busy} onClick={() => action(async () => setSelected(await api(`/sources/${item.id}`)), "منبع باز شد.")}>بررسی متن</Button></div>)}</section>
    {selected && <article className={boxClass}><h3 className="font-medium">{selected.title}</h3><a href={selected.source_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">منبع اصلی</a><p className="text-xs">انتشار: {dateLabel(selected.published_at)} · انقضا: {dateLabel(selected.expires_at)}</p><pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words text-sm leading-7">{selected.content}</pre><Button disabled={busy} variant={selected.approved ? "outline" : "default"} onClick={() => action(async () => setSelected(await api(`/sources/${selected.id}/approval`, "PUT", { approved: !selected.approved, expected_revision: selected.revision })), selected.approved ? "تأیید منبع لغو شد." : "منبع برای استفادهٔ متناسب با تاریخ و افق تأیید شد.")}>{selected.approved ? "لغو تأیید" : "تأیید پس از بررسی"}</Button></article>}
  </div>
}
