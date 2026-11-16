"use client"

import { Triangle } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

export default function AnalysisDetailsDialog({ title, children }) {
  return <Dialog>
    <DialogTrigger asChild>
      <button type="button" aria-label={`دلایل و سناریوهای ${title}`} title="دلایل و سناریوها" className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-primary hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        <Triangle aria-hidden="true" className="h-3.5 w-3.5 -rotate-90 fill-current" />
      </button>
    </DialogTrigger>
    <DialogContent dir="rtl" className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader className="text-right"><DialogTitle>{title}</DialogTitle><DialogDescription>دلایل و سناریوها</DialogDescription></DialogHeader>
      <div className="space-y-2 text-[13px] font-medium leading-[26px] text-black dark:text-white">{children}</div>
    </DialogContent>
  </Dialog>
}
