"use client"

import { Download, Video } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function BrokerConnectionSetup() {
  return (
    <div className="flex flex-wrap items-center gap-2" dir="rtl">
      <Button asChild variant="outline" size="sm" className="gap-2 border-cyan-500/40 bg-cyan-50 text-cyan-800 hover:bg-cyan-100 hover:text-cyan-900 dark:border-cyan-400/40 dark:bg-cyan-500/15 dark:text-cyan-200 dark:hover:bg-cyan-500/25 dark:hover:text-cyan-100">
        <a href="/downloads/GP_Agent.ex5" download="GP_Agent.ex5">
          <Download className="h-4 w-4" aria-hidden="true" />دانلود اکسپرت
        </a>
      </Button>
      <Button asChild variant="outline" size="sm" className="gap-2">
        <a href="/downloads/GreenPeak_Connection_3min_Synced.mp4" download="GreenPeak_Connection_3min_Synced.mp4">
          <Video className="h-4 w-4" aria-hidden="true" />ویدئوی آموزش اتصال
        </a>
      </Button>
    </div>
  )
}
