import "server-only"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { workTaskIdFromSearch } from "@/lib/work-tasks.mjs"

export async function requireAdminPage() {
  return requireRolesPage(["admin"])
}

export async function requireWorkplacePage(taskId = null) {
  const safeId = workTaskIdFromSearch(taskId ? `task=${encodeURIComponent(taskId)}` : "")
  return requireRolesPage(["staff", "admin"], safeId ? `/login?task=${safeId}` : "/login")
}

async function requireRolesPage(roles, loginPath = "/login") {
  const session = (await cookies()).get("gp_session")?.value
  if (!session) redirect(loginPath)
  const base = (process.env.GREENPEAK_INTERNAL_API_BASE_URL || "http://127.0.0.1:8000/api/v1").replace(/\/$/, "")
  let user
  try {
    const response = await fetch(`${base}/auth/session`, {
      headers: { Cookie: `gp_session=${encodeURIComponent(session)}` }, cache: "no-store",
    })
    if (response.ok) user = (await response.json()).user
  } catch {
    // Fail closed if the authentication service cannot verify this session.
  }
  if (!user) redirect(loginPath)
  if (!roles.includes(user.role)) redirect("/profile")
}
