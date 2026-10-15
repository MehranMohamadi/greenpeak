"use client"

import { LockKeyhole } from "lucide-react"
import { useAuth } from "@/components/auth/auth-context"

export function PremiumAnalysisNotice() {
  return <div dir="rtl" className="flex min-h-24 items-center justify-center gap-2 rounded-lg border bg-muted/20 p-5 text-sm text-muted-foreground"><LockKeyhole className="h-4 w-4 shrink-0 text-primary" />مخصوص کاربران پرمیوم</div>
}

export default function PremiumAnalysisGate({ children }) {
  const { canViewPremiumAnalysis } = useAuth()
  return canViewPremiumAnalysis ? children : <PremiumAnalysisNotice />
}
