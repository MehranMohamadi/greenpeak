"use client"

import Link from "next/link"
import { Settings, ShieldCheck, Star } from "lucide-react"
import { useAuth } from "@/components/auth/auth-context"
import CustomizationPanel from "@/components/dashboard/customization-panel"
import DashboardThemes from "@/components/dashboard/dashboard-themes"
import WatchlistManager from "@/components/dashboard/watchlist-manager"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function ProfileSettings() {
  const { isAdmin } = useAuth()

  return (
    <section id="dashboard-settings" aria-labelledby="dashboard-settings-title" className="scroll-mt-20 space-y-6">
      <header dir="rtl" className="space-y-2">
        <h2 id="dashboard-settings-title" className="flex items-center gap-2 text-xl font-semibold text-foreground">
          <Settings className="h-5 w-5 text-primary" />تنظیمات داشبورد
        </h2>
        <p className="text-sm text-muted-foreground">چیدمان، ظاهر و دیده‌بان شخصی خود را اینجا مدیریت کنید.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <CustomizationPanel />
        <DashboardThemes />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Star className="h-5 w-5" />مدیریت دیده‌بان</CardTitle>
          <CardDescription>دیده‌بان‌های شخصی خود را ایجاد و مدیریت کنید</CardDescription>
        </CardHeader>
        <CardContent><WatchlistManager /></CardContent>
      </Card>

      {isAdmin && <Card dir="rtl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" />پنل مدیریت</CardTitle>
          <CardDescription>مدیران سایت و ابزارهای بررسی فنی</CardDescription>
        </CardHeader>
        <CardContent><Button asChild><Link href="/admin/settings">ورود به پنل مدیریت</Link></Button></CardContent>
      </Card>}
    </section>
  )
}
