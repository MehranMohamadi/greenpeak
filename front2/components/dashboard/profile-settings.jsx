"use client"

import { useState } from "react"
import CustomizationPanel from "@/components/dashboard/customization-panel"
import WatchlistManager from "@/components/dashboard/watchlist-manager"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

export default function ProfileSettings({ notifications, password }) {
  const [layoutSettings, setLayoutSettings] = useState()
  const [watchlistSymbols, setWatchlistSymbols] = useState()
  const sections = [
    { id: "notifications", title: "اعلان‌ها و آلارم‌ها", description: "اعلان‌ها و آلارم‌های قیمت این حساب را تنظیم کنید.", content: notifications },
    { id: "password", title: "تغییر رمز عبور", description: "برای تغییر رمز، رمز فعلی و رمز جدید را وارد کنید.", content: password },
    { id: "customization", title: "شخصی‌سازی چیدمان", description: "چیدمان و اجزای داشبورد را انتخاب کنید.", content: <CustomizationPanel embedded settings={layoutSettings} onLayoutChange={setLayoutSettings} /> },
    { id: "watchlist", title: "مدیریت دیده‌بان", description: "نمادهای دیده‌بان خود را اضافه یا حذف کنید.", content: <WatchlistManager symbols={watchlistSymbols} onSymbolsChange={setWatchlistSymbols} /> },
  ]

  return (
    <nav id="dashboard-settings" aria-label="تنظیمات پروفایل" className="flex scroll-mt-20 flex-wrap items-center gap-2">
      {sections.map((section) => <Dialog key={section.id}>
        <DialogTrigger asChild><Button type="button" variant="outline" size="sm" className="h-9">{section.title}</Button></DialogTrigger>
        <DialogContent dir="rtl" className={`max-h-[90dvh] w-[calc(100vw-2rem)] overflow-y-auto ${section.id === "watchlist" ? "max-w-md" : "max-w-2xl"}`}>
          <DialogHeader className="pr-7 text-right sm:text-right">
            <DialogTitle>{section.title}</DialogTitle>
            <DialogDescription>{section.description}</DialogDescription>
          </DialogHeader>
          {section.content}
        </DialogContent>
      </Dialog>)}
    </nav>
  )
}
