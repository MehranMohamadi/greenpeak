"use client"

import Link from "next/link"
import { Database, FileJson2, ShieldCheck } from "lucide-react"
import { useAuth } from "@/components/auth/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function WorkplaceTools() {
  const { isAdmin } = useAuth()
  if (!isAdmin) return null
  return <section className="space-y-4" aria-label="تنظیمات و ابزارها">
    <h2 className="text-xl font-semibold">تنظیمات و ابزارها</h2>
    <div className="grid gap-4 md:grid-cols-3">{[
      { href: "/analytics/feature-pipeline-debug", title: "پایپ‌لاین شاخص‌ها", description: "ورودی خام و مراحل تبدیل داده", icon: Database },
      { href: "/analytics/mt5-snapshots", title: "JSON متاتریدر", description: "خروجی فنی حساب‌های متصل خودتان", icon: FileJson2 },
      { href: "/architecture/ai-market-analysis", title: "معماری تحلیل", description: "مستندات داخلی سیستم تحلیل", icon: ShieldCheck },
    ].map(({ href, title, description, icon: Icon }) => <Card key={href}><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Icon className="h-4 w-4 text-primary" />{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader><CardContent><Button asChild variant="outline"><Link href={href}>مشاهده</Link></Button></CardContent></Card>)}</div>
  </section>
}
