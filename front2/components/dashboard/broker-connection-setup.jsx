"use client"

import { Download, Video } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function BrokerConnectionSetup() {
  return (
    <div className="flex flex-wrap items-center gap-2" dir="rtl">
      <Button asChild size="sm" className="gap-2">
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
