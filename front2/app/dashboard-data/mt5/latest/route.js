import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const apiBase = (process.env.GREENPEAK_INTERNAL_API_BASE_URL || "http://127.0.0.1:8000/api/v1").replace(/\/$/, "")
  const token = process.env.GREENPEAK_MT5_DASHBOARD_TOKEN
  if (!token) {
    return NextResponse.json({ detail: "MT5 dashboard connection is not configured" }, { status: 503 })
  }
  try {
    const response = await fetch(`${apiBase}/mt5/snapshots/latest`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
    const body = await response.json().catch(() => ({ detail: "Invalid backend response" }))
    return NextResponse.json(body, { status: response.status })
  } catch {
    return NextResponse.json({ detail: "MT5 snapshot service is unavailable" }, { status: 503 })
  }
}
