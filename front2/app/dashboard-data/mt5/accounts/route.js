import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const apiBase = (process.env.GREENPEAK_INTERNAL_API_BASE_URL || "http://127.0.0.1:8000/api/v1").replace(/\/$/, "")
  const token = process.env.GREENPEAK_MT5_DASHBOARD_TOKEN
    || process.env.GREENPEAK_MT5_API_TOKENS?.split(",").map((value) => value.trim()).find(Boolean)
  if (!token) {
    return NextResponse.json({ detail: "Trading account connection is not configured" }, { status: 503 })
  }
  try {
    let response = await fetch(`${apiBase}/mt5/snapshots/latest-by-account`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
    let body = await response.json().catch(() => ({ detail: "Invalid backend response" }))
    // Keep the dashboard available during a rolling deploy from the earlier
    // single-account API. The grouped endpoint becomes authoritative once live.
    if (response.status === 404) {
      response = await fetch(`${apiBase}/mt5/snapshots/latest`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      })
      body = await response.json().catch(() => ({ detail: "Invalid backend response" }))
      if (response.ok) body = [body]
    }
    if (response.ok && !Array.isArray(body)) {
      return NextResponse.json({ detail: "Invalid backend response" }, { status: 502 })
    }
    return NextResponse.json(body, { status: response.status })
  } catch {
    return NextResponse.json({ detail: "Trading account service is unavailable" }, { status: 503 })
  }
}
