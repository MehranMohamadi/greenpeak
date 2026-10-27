import { redirect } from "next/navigation"

export default function EmployeesPage() {
  redirect("/workplace?tab=attendance&scope=team")
}
