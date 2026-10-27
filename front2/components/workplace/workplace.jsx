"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { BriefcaseBusiness } from "lucide-react"
import Layout from "@/components/kokonutui/layout"
import { useAuth } from "@/components/auth/auth-context"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import WorkplaceAttendance from "@/components/workplace/workplace-attendance"
import WorkplaceUsers from "@/components/workplace/workplace-users"
import WorkplaceTools from "@/components/workplace/workplace-tools"
import WorkTasks from "@/components/workplace/work-tasks"
import { workTaskIdFromSearch } from "@/lib/work-tasks.mjs"
import { workplaceTab, workplaceTabs } from "@/lib/workplace-navigation.mjs"

function AttendanceTab({ accountsRevision }) {
  const { isAdmin } = useAuth()
  const params = useSearchParams()
  const requestedScope = params.get("scope") === "team" ? "team" : "mine"
  const [scope, setScope] = useState(requestedScope)
  const [visitedTeam, setVisitedTeam] = useState(scope === "team")
  useEffect(() => {
    setScope(requestedScope)
    if (requestedScope === "team") setVisitedTeam(true)
  }, [requestedScope])
  const changeScope = next => {
    setScope(next)
    if (next === "team") setVisitedTeam(true)
    const query = new URLSearchParams(params.toString())
    query.set("tab", "attendance")
    query.set("scope", next)
    query.delete("task")
    window.history.replaceState(null, "", `/workplace?${query}`)
  }
  const team = isAdmin && scope === "team"
  return <div className="space-y-5">
    {isAdmin && <div role="group" aria-label="نمای حضور و غیاب" className="flex flex-wrap gap-2">
      <Button size="sm" variant={!team ? "default" : "outline"} aria-pressed={!team} onClick={() => changeScope("mine")}>حضور من</Button>
      <Button size="sm" variant={team ? "default" : "outline"} aria-pressed={team} onClick={() => changeScope("team")}>گزارش کارکنان</Button>
    </div>}
    <div hidden={team}><WorkplaceAttendance accountsRevision={accountsRevision} /></div>
    {isAdmin && visitedTeam && <div hidden={!team}><WorkplaceAttendance admin accountsRevision={accountsRevision} /></div>}
  </div>
}

export default function Workplace() {
  const { user, isAdmin, isLoading } = useAuth()
  const params = useSearchParams()
  const taskId = workTaskIdFromSearch(params.toString())
  const section = taskId ? "tasks" : workplaceTab(params.toString(), isAdmin)
  const [visited, setVisited] = useState(() => new Set([section]))
  const [accountsRevision, setAccountsRevision] = useState(0)
  useEffect(() => { setVisited(current => current.has(section) ? current : new Set([...current, section])) }, [section])
  const changeSection = next => {
    if (!workplaceTabs.some(tab => tab.id === next && (!tab.adminOnly || isAdmin))) return
    const query = new URLSearchParams(params.toString())
    query.set("tab", next)
    query.delete("task")
    if (!isAdmin) query.delete("scope")
    // Next syncs useSearchParams with native history without remounting forms.
    window.history.replaceState(null, "", `/workplace?${query}`)
  }
  if (isLoading) return <p className="p-6" role="status" dir="rtl">در حال بررسی دسترسی…</p>
  if (!["staff", "admin"].includes(user?.role)) return <p className="p-6" dir="rtl">دسترسی لازم برای این بخش را ندارید.</p>
  return <Layout><div dir="rtl" className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="flex items-center gap-2 text-2xl font-bold"><BriefcaseBusiness className="h-6 w-6 text-primary" />میز کار من</h1>
      <Button asChild variant="outline"><Link href="/profile">بازگشت به پروفایل</Link></Button>
    </header>
    <Tabs value={section} onValueChange={changeSection} dir="rtl" className="space-y-5">
      <TabsList aria-label="بخش‌های میز کار" className="h-auto max-w-full flex-wrap justify-start gap-1">
        {workplaceTabs.filter(tab => !tab.adminOnly || isAdmin).map(tab => <TabsTrigger key={tab.id} value={tab.id}>{tab.label}</TabsTrigger>)}
      </TabsList>
      <TabsContent value="tasks" forceMount className="data-[state=inactive]:hidden">{(visited.has("tasks") || section === "tasks") && <WorkTasks initialTaskId={taskId} accountsRevision={accountsRevision} />}</TabsContent>
      <TabsContent value="attendance" forceMount className="data-[state=inactive]:hidden">{(visited.has("attendance") || section === "attendance") && <AttendanceTab accountsRevision={accountsRevision} />}</TabsContent>
      {isAdmin && <>
        <TabsContent value="users" forceMount className="data-[state=inactive]:hidden">{(visited.has("users") || section === "users") && <WorkplaceUsers onUsersChanged={() => setAccountsRevision(value => value + 1)} />}</TabsContent>
        <TabsContent value="tools"><WorkplaceTools /></TabsContent>
      </>}
    </Tabs>
  </div></Layout>
}
