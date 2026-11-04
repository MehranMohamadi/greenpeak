"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Clock3, ExternalLink, MapPin, Sparkles, Ticket, TrendingUp } from "lucide-react";
import { useSidebarHover } from "@/app/context/sidebar-hover-context";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { getMashhadEventSection, getTehranDateKey, getUpcomingMashhadEvents, mashhadEventCategories, mashhadEventsCheckedOn } from "@/lib/fun-content";

const checkedOnLabel = new Intl.DateTimeFormat("fa-IR", { timeZone: "Asia/Tehran", dateStyle: "long" }).format(new Date(`${mashhadEventsCheckedOn}T12:00:00+03:30`));

function EventCard({ event, today }) {
  return (
    <Card className="flex h-full min-w-0 flex-col" role="article" aria-labelledby={`event-${event.id}`}>
      <CardHeader>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <Badge variant="secondary">{event.category}</Badge>
          <span className="text-xs text-muted-foreground">{event.startDate < today ? "در حال برگزاری" : "پیش رو"}</span>
        </div>
        <CardTitle id={`event-${event.id}`} className="text-lg leading-8">{event.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 space-y-4">
        <p className="text-sm leading-7 text-muted-foreground">{event.description}</p>
        <dl className="space-y-2 text-sm leading-7">
          {[
            [CalendarDays, "تاریخ", event.date],
            [Clock3, "ساعت", event.time || "در اطلاعیه اعلام نشده"],
            [MapPin, "محل", event.venue],
            [Ticket, "هزینه", event.price || "در اطلاعیه اعلام نشده"],
          ].map(([Icon, label, value]) => (
            <div key={label} className="flex items-start gap-2">
              <Icon aria-hidden="true" className="mt-1.5 h-4 w-4 shrink-0 text-primary" />
              <dt className="sr-only">{label}</dt><dd>{value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
      <CardFooter className="flex-wrap justify-between gap-3">
        <a href={event.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs leading-6 text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {event.sourceLabel}<ExternalLink aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
        </a>
        {event.registrationUrl && <a href={event.registrationUrl} target="_blank" rel="noopener noreferrer" aria-label={`جزئیات و ثبت‌نام ${event.title}`} className={buttonVariants({ variant: "outline", size: "sm" })}>جزئیات و ثبت‌نام<ExternalLink aria-hidden="true" className="mr-2 h-3.5 w-3.5" /></a>}
      </CardFooter>
    </Card>
  );
}

export function CityEventsSection({ section, today }) {
  const categories = section ? [section] : Object.keys(mashhadEventCategories);
  return (
    <section dir="rtl" className="mx-auto max-w-6xl space-y-8 py-6 text-right">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{mashhadEventCategories[section]?.label || "رویدادهای آیندهٔ مشهد"}</h1>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">برنامه‌های اعلام‌شدهٔ مشهد؛ پیش از مراجعه، ظرفیت و جزئیات نهایی را از برگزارکننده بررسی کنید.</p>
        </div>
        <p className="text-xs leading-7 text-muted-foreground">آخرین بررسی منابع: {checkedOnLabel}</p>
      </header>
      {!today ? <p role="status" className="text-sm text-muted-foreground">در حال بررسی تاریخ رویدادها…</p> : categories.map((key) => {
        const category = mashhadEventCategories[key];
        const events = getUpcomingMashhadEvents(key, today);
        const Icon = key === "financial" ? TrendingUp : Sparkles;
        return <section key={key} aria-labelledby={`events-${key}`} className="space-y-4">
          <div className="flex items-center gap-3">
            <Icon aria-hidden="true" className="h-5 w-5 shrink-0 text-primary" />
            <div><h2 id={`events-${key}`} className="text-lg font-medium">{category.label}</h2><p className="mt-1 text-sm text-muted-foreground">{category.description}</p></div>
          </div>
          {events.length ? <div className="grid auto-rows-fr gap-4 md:grid-cols-2">{events.map((event) => <EventCard key={event.id} event={event} today={today} />)}</div> : <Card><CardContent className="pt-5 text-sm leading-7 text-muted-foreground">در فهرست بررسی‌شده، رویداد آینده‌ای برای این بخش باقی نمانده است. برنامه‌های جدید پس از بررسی منابع اضافه می‌شوند.</CardContent></Card>}
        </section>;
      })}
    </section>
  );
}

export default function MashhadEvents({ cityPage = false }) {
  const { selectedRightItem } = useSidebarHover();
  const [today, setToday] = useState(null);
  useEffect(() => {
    const updateDate = () => setToday(getTehranDateKey());
    updateDate();
    const timer = setInterval(updateDate, 60_000);
    return () => clearInterval(timer);
  }, []);
  const isMashhadSelected = cityPage || selectedRightItem?.trail?.some((item) => item.label === "در شهر");

  if (!isMashhadSelected) {
    return <section dir="rtl" className="mx-auto max-w-5xl py-8 text-right"><div className="rounded-2xl border border-cyan-200 bg-gradient-to-l from-cyan-500/10 to-amber-400/10 p-8 dark:border-cyan-900"><p className="text-sm font-medium text-cyan-600">حیاط</p><h1 className="mt-2 text-3xl font-bold">به بخش دورهمی ها خوش آمدید ✨</h1><p className="mt-3 leading-7 text-muted-foreground">برای دیدن برنامه‌های فرهنگی و مالی، «در شهر» را از منوی سمت راست انتخاب کنید.</p></div></section>;
  }

  return <CityEventsSection section={getMashhadEventSection(selectedRightItem)} today={today} />;
}
