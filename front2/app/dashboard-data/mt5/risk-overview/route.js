import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
const headers = { "Cache-Control": "no-store" }

export async function GET(request) {
  const apiBase = (process.env.GREENPEAK_INTERNAL_API_BASE_URL || "http://127.0.0.1:8000/api/v1").replace(/\/$/, "")
  const authorization = request.headers.get("authorization")
  if (!authorization) return NextResponse.json({ detail: "Authentication required" }, { status: 401, headers })
  try {
    const response = await fetch(`${apiBase}/mt5/risk-overview`, {
      headers: { Authorization: authorization }, cache: "no-store",
    })
    const body = await response.json().catch(() => null)
    if (response.ok && (!body || !Array.isArray(body.accounts) || !body.leverage)) {
      return NextResponse.json({ detail: "Invalid risk overview response" }, { status: 502, headers })
    }
    return NextResponse.json(body || { detail: "Invalid backend response" }, { status: response.status, headers })
  } catch {
    return NextResponse.json({ detail: "Trading risk service is unavailable" }, { status: 503, headers })
  }
}
