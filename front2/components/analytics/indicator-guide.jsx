"use client"

import { Info } from "lucide-react"
import { getIndicatorGuide, indicatorGuideNote } from "@/lib/indicator-guides"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

const FIELDS = [
  ["literal", "معنی نام و مخفف"],
  ["meaning", "مفهوم اقتصادی"],
  ["increase", "اگر افزایش یابد"],
  ["decrease", "اگر کاهش یابد"],
]

/** @param {{ indicatorId?: string, title: string, indicators?: { id: string, label?: string }[], className?: string }} props */
export default function IndicatorGuide({ indicatorId = "", title, indicators, className = "" }) {
  const items = indicators || [{ id: indicatorId, label: title }]
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="icon"
          className={cn("relative z-20 h-7 w-7 shrink-0 rounded-full text-muted-foreground hover:bg-primary/10 hover:text-primary", className)}
          aria-label={`راهنمای ${title}`} title={`راهنمای ${title}`}>
          <Info className="h-4 w-4" aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent dir="rtl" className="flex max-h-[85dvh] w-[calc(100vw-2rem)] max-w-2xl flex-col overflow-hidden rounded-xl text-right" data-testid="indicator-guide">
        <DialogHeader className="shrink-0 pr-7 !text-right">
          <DialogTitle className="leading-8">راهنمای {title}</DialogTitle>
          <DialogDescription>معنی شاخص و تفسیر افزایش و کاهش آن</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 space-y-5 overflow-y-auto overscroll-contain">
          {items.map((item) => {
            const guide = getIndicatorGuide(item.id)
            const note = indicatorGuideNote(item.id)
            return <article key={item.id} className="space-y-3 rounded-lg border p-4">
              {!guide ? <p className="text-sm leading-7 text-muted-foreground">توضیح «{item.label || item.id}» در فایل راهنمای ارائه‌شده موجود نیست.</p> : <>
                {note && <p className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm leading-7 text-foreground">{note}</p>}
                <header className="space-y-1">
                  <h3 className="text-base font-semibold leading-7">{guide.titleFa}</h3>
                  <p className="text-left text-xs leading-5 text-muted-foreground" dir="ltr">{guide.titleEn}</p>
                </header>
                <dl className="space-y-3">
                  {FIELDS.map(([key, label]) => <div key={key}>
                    <dt className="mb-1 text-xs font-medium text-primary">{label}</dt>
                    <dd dir="auto" className="whitespace-pre-line text-sm leading-7 text-foreground">{guide[key]}</dd>
                  </div>)}
                </dl>
              </>}
            </article>
          })}
        </div>
        <p className="shrink-0 text-xs text-muted-foreground">منبع: راهنمای شاخص‌های گرین‌پیک</p>
      </DialogContent>
    </Dialog>
  )
}
