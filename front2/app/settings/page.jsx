"use client"

import Layout from "@/components/kokonutui/layout"
import CustomizationPanel from "@/components/dashboard/customization-panel"
import WatchlistManager from "@/components/dashboard/watchlist-manager"
import DashboardThemes from "@/components/dashboard/dashboard-themes"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Settings, Star, ShieldCheck } from "lucide-react"
import { useAuth } from "@/components/auth/auth-context"

export default function SettingsPage() {
  const { isAdmin } = useAuth()
  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-3">
            <Settings className="h-8 w-8 text-gray-600" />
            Dashboard Settings
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Customize your dashboard layout, manage watchlists, and personalize your experience
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CustomizationPanel />

          {/* Theme Selection */}
          <DashboardThemes />

          {isAdmin && <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                Admin Panel
              </CardTitle>
              <CardDescription>مدیران سایت و ابزارهای بررسی فنی</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/admin/settings">Admin Settings</Link>
              </Button>
            </CardContent>
          </Card>}
        </div>

        {/* Watchlist Manager */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5" />
              Watchlist Management
            </CardTitle>
            <CardDescription>Create and manage your custom watchlists</CardDescription>
          </CardHeader>
          <CardContent>
            <WatchlistManager />
          </CardContent>
        </Card>
      </div>
    </Layout>
  )
}
