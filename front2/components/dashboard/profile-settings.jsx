"use client"

import Link from "next/link"
import { ShieldCheck, Star } from "lucide-react"
import { useAuth } from "@/components/auth/auth-context"
import CustomizationPanel from "@/components/dashboard/customization-panel"
import WatchlistManager from "@/components/dashboard/watchlist-manager"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function ProfileSettings() {
  const { isAdmin } = useAuth()

  return (
    <section id="dashboard-settings" className="scroll-mt-20 space-y-6">
      <div className="grid gap-6 md:grid-cols-2 [&>*]:min-w-0">
        <CustomizationPanel />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Star className="h-5 w-5" />مدیریت دیده‌بان</CardTitle>
          </CardHeader>
          <CardContent><WatchlistManager /></CardContent>
        </Card>
      </div>

      {isAdmin && <Card dir="rtl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" />پنل مدیریت</CardTitle>
        </CardHeader>
        <CardContent><Button asChild><Link href="/admin/settings">ورود به پنل مدیریت</Link></Button></CardContent>
      </Card>}
    </section>
  )
}
