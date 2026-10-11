import "server-only"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

export async function requireAdminPage() {
  const session = (await cookies()).get("gp_session")?.value
  if (!session) redirect("/login")
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
  if (!user) redirect("/login")
  if (user.role !== "admin") redirect("/settings")
}
