import { redirect } from "next/navigation"

export default function AdminSettingsPage() {
  redirect("/workplace?tab=users")
}
