"use client";

import { useSidebarHover } from "@/app/context/sidebar-hover-context";

export default function MashhadEvents({ cityPage = false }) {
  const { selectedRightItem } = useSidebarHover();
  const isMashhadSelected = cityPage || selectedRightItem?.trail?.some((item) => item.label === "در شهر");

  if (!isMashhadSelected) {
    return <section dir="rtl" className="mx-auto max-w-5xl py-8 text-right"><div className="rounded-2xl border border-cyan-200 bg-gradient-to-l from-cyan-500/10 to-amber-400/10 p-8 dark:border-cyan-900"><p className="text-sm font-medium text-cyan-600">حیات</p><h1 className="mt-2 text-3xl font-bold">به بخش دورهمی ها خوش آمدید ✨</h1><p className="mt-3 leading-7 text-muted-foreground">برای دیدن برنامه‌های فرهنگی و اجتماعی، «در شهر» را از منوی سمت راست انتخاب کنید.</p></div></section>;
  }

  return (
    <section dir="rtl" className="mx-auto max-w-5xl py-8 text-right">
      <div className="rounded-2xl border border-cyan-200 bg-gradient-to-l from-cyan-500/10 to-amber-400/10 p-6 dark:border-cyan-900 sm:p-8">
        <p className="leading-7 text-muted-foreground">رویدادهای فرهنگی مشهد در این تب نمایش داده می‌شوند.</p>
      </div>
    </section>
  );
}
