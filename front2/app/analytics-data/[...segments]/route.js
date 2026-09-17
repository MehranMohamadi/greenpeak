import { NextResponse } from "next/server"

const ALLOWED_PATHS = new Set([
  "market/analysis/latest",
  "news/sources/alpha_vantage",
])

export async function GET(request, { params }) {
  const { segments } = await params
  const path = segments.join("/")
  if (!ALLOWED_PATHS.has(path)) {
    return NextResponse.json({ detail: "Unsupported analytics data path." }, { status: 404 })
  }

  const upstreamBase = (
    process.env.ANALYTICS_PROXY_BASE_URL ||
    process.env.GREENPEAK_INTERNAL_API_BASE_URL ||
    "http://127.0.0.1:8000/api/v1"
  ).replace(/\/$/, "")
  const upstream = new URL(`${upstreamBase}/${path}`)
  upstream.search = new URL(request.url).search

  try {
    const response = await fetch(upstream, { cache: "no-store" })
    return new NextResponse(await response.text(), {
      status: response.status,
      headers: {
        "content-type": response.headers.get("content-type") || "application/json",
        "cache-control": "no-store",
      },
    })
  } catch {
    return NextResponse.json({ detail: "Analytics upstream is unavailable." }, { status: 503 })
  }
}
