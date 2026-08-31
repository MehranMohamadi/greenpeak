"use client";

import { CalendarDays, Clock3, ExternalLink, MapPin, Sparkles, Ticket } from "lucide-react";
import { useSidebarHover } from "@/app/context/sidebar-hover-context";
import { mashhadEvents } from "@/lib/fun-content";

export default function MashhadEvents() {
  const { selectedRightItem } = useSidebarHover();
  const isMashhadSelected = selectedRightItem?.trail?.some((item) => item.label === "مشهد");

  if (!isMashhadSelected) {
    return <section dir="rtl" className="mx-auto max-w-5xl py-8 text-right"><div className="rounded-2xl border border-fuchsia-200 bg-gradient-to-l from-fuchsia-500/10 to-amber-400/10 p-8 dark:border-fuchsia-900"><p className="text-sm font-medium text-fuchsia-600">حیاط</p><h1 className="mt-2 text-3xl font-bold">به بخش حال خوب خوش آمدید ✨</h1><p className="mt-3 leading-7 text-muted-foreground">برای دیدن برنامه‌های فرهنگی و اجتماعی، «مشهد» را از منوی سمت راست انتخاب کنید.</p></div></section>;
  }

  return (
    <section dir="rtl" className="relative -mx-6 -mb-6 -mt-2 min-h-[calc(100vh-2.75rem)] max-w-none overflow-hidden bg-[#eee7d8] px-6 py-6 text-right text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] dark:bg-[#061d22] dark:text-slate-50 sm:px-8">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-90 [background-image:radial-gradient(circle_at_88%_4%,rgba(13,148,136,0.3),transparent_30%),radial-gradient(circle_at_8%_94%,rgba(180,83,9,0.2),transparent_28%),repeating-conic-gradient(from_45deg_at_50%_50%,rgba(8,145,178,0.07)_0deg_15deg,transparent_15deg_30deg)] [background-size:auto,auto,48px_48px]" />
      <div className="relative">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div><div className="mb-3 inline-flex items-center gap-2 rounded-full border border-teal-700/20 bg-white/55 px-3 py-1 text-xs font-medium text-teal-800 backdrop-blur dark:bg-white/5 dark:text-teal-200"><Sparkles className="h-3.5 w-3.5" />رویدادهای منتخب شهر</div><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">این روزهای مشهد</h1><p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-300">برنامه‌های فرهنگی، هنری و اجتماعی پیش رو؛ پیش از مراجعه، جزئیات نهایی را در منبع رویداد بررسی کنید.</p></div>
          <p className="rounded-lg bg-white/55 px-3 py-2 text-xs text-slate-500 backdrop-blur dark:bg-white/5 dark:text-slate-400">آخرین بررسی: ۸ شهریور ۱۴۰۵</p>
        </div>

        <div className="grid auto-rows-fr gap-3 md:grid-cols-2">
          {mashhadEvents.map((event) => (
            <article key={event.id} className="group grid h-full overflow-hidden rounded-2xl border border-white/75 bg-white/80 shadow-sm backdrop-blur transition duration-200 hover:-translate-y-0.5 hover:border-teal-600/30 hover:shadow-lg dark:border-white/10 dark:bg-[#0b2a30]/90 sm:grid-cols-[8.5rem_1fr]">
              {event.imageUrl ? <a href={event.sourceUrl} target="_blank" rel="noreferrer" className="relative block min-h-32 overflow-hidden bg-teal-950/10 sm:min-h-full"><img src={event.imageUrl} alt={event.imageAlt} loading="lazy" className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" /><span className="absolute inset-0 bg-gradient-to-t from-teal-950/35 to-transparent" /></a> : <div aria-hidden="true" className="hidden items-center justify-center bg-gradient-to-br from-teal-800 to-cyan-950 text-3xl text-amber-300 sm:flex"><Sparkles className="h-8 w-8" /></div>}
              <div className="flex min-w-0 flex-col p-4">
                <div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-medium text-teal-700 dark:text-teal-300">{event.category}</p><h2 className="mt-1 text-base font-semibold leading-6">{event.title}</h2></div><span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-500 shadow-[0_0_0_4px_rgba(245,158,11,0.12)]" /></div>
                <div className="mt-3 grid gap-1.5 text-xs leading-5 text-slate-600 dark:text-slate-300"><p className="flex items-center gap-2"><CalendarDays className="h-3.5 w-3.5 shrink-0 text-teal-700 dark:text-teal-300" />{event.date}</p>{event.time && <p className="flex items-center gap-2"><Clock3 className="h-3.5 w-3.5 shrink-0 text-teal-700 dark:text-teal-300" />{event.time}</p>}<p className="flex items-start gap-2"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-700 dark:text-teal-300" /><span>{event.venue}</span></p>{event.price && <p className="flex items-center gap-2"><Ticket className="h-3.5 w-3.5 shrink-0 text-teal-700 dark:text-teal-300" />{event.price}</p>}</div>
                <a href={event.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 self-end text-[11px] font-medium text-teal-700 hover:text-teal-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:text-teal-300 dark:hover:text-teal-100">{event.sourceLabel}<ExternalLink className="h-3 w-3" /></a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
