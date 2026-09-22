import { NextResponse } from "next/server"

const ALLOWED_PATHS = new Set([
  "market/analysis/latest",
  "news/sources/alpha_vantage",
  "news/calendar/upcoming",
  "news/calendar/released",
])

const isAllowedPath = (path) =>
  ALLOWED_PATHS.has(path) || /^news\/items\/[a-zA-Z0-9_-]{1,80}\/analysis$/.test(path)

export async function GET(request, { params }) {
  const { segments } = await params
  const path = segments.join("/")
  if (!isAllowedPath(path)) {
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
