import { validMarketSession } from "@/lib/market-session"

export const dynamic = "force-dynamic"

function unavailable() {
  return Response.json({ detail: "Market session service is temporarily unavailable." }, {
    status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "30" },
  })
}

export async function GET() {
  const upstreamBase = (
    process.env.GREENPEAK_INTERNAL_API_BASE_URL ||
    process.env.ANALYTICS_PROXY_BASE_URL ||
    "http://127.0.0.1:8000/api/v1"
  ).replace(/\/$/, "")
  try {
    const response = await fetch(`${upstreamBase}/system/session`, {
      cache: "no-store", signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) return unavailable()
    const data = await response.json()
    if (!validMarketSession(data)) return unavailable()
    return Response.json(data, { headers: { "Cache-Control": "no-store" } })
  } catch {
    // A stopped/restarting FastAPI process must not become Next's proxy 500.
    return unavailable()
  }
}
