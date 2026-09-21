import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(request) {
  const apiBase = (process.env.GREENPEAK_INTERNAL_API_BASE_URL || "http://127.0.0.1:8000/api/v1").replace(/\/$/, "")
  const authorization = request.headers.get("authorization")
  if (!authorization) {
    return NextResponse.json({ detail: "Authentication required" }, { status: 401 })
  }

  try {
    const response = await fetch(`${apiBase}/mt5/snapshots`, {
      headers: { Authorization: authorization },
      cache: "no-store",
    })
    const body = await response.json().catch(() => ({ detail: "Invalid backend response" }))
    if (response.ok && !Array.isArray(body)) {
      return NextResponse.json({ detail: "Invalid backend response" }, { status: 502 })
    }
    return NextResponse.json(body, { status: response.status })
  } catch {
    return NextResponse.json({ detail: "Trading account service is unavailable" }, { status: 503 })
  }
}
