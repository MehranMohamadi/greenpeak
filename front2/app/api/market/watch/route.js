import { WATCH_INTRADAY_SERIES, parseWatchYahoo } from "@/lib/market-watch-source"

const REFRESH_SECONDS = 300

export async function GET(request) {
  const series = new URL(request.url).searchParams.get("series")
  const definition = Object.hasOwn(WATCH_INTRADAY_SERIES, series) ? WATCH_INTRADAY_SERIES[series] : null
  if (!definition) return Response.json({ error: "Unsupported market-watch series" }, { status: 400 })
  try {
    const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(definition.symbol)}`)
    url.search = new URLSearchParams({ range: "5d", interval: "5m", includePrePost: "false" }).toString()
    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (compatible; GreenPeak/1.0)" },
      signal: AbortSignal.timeout(20000),
      next: { revalidate: REFRESH_SECONDS },
    })
    if (!response.ok) throw new Error("Source unavailable")
    const payload = await response.json()
    const result = parseWatchYahoo(payload, series)
    return Response.json(result, { headers: { "Cache-Control": `public, s-maxage=${REFRESH_SECONDS}, stale-while-revalidate=60` } })
  } catch {
    return Response.json({ error: series === "gold" ? "دادهٔ ۵ دقیقه‌ای طلای آتی COMEX موقتاً در دسترس نیست." : "دادهٔ ۵ دقیقه‌ای منبع موقتاً در دسترس نیست." }, { status: 502 })
  }
}
