import { WATCH_INTRADAY_SERIES, parseWatchGold, parseWatchYahoo } from "@/lib/market-watch-source"

const REFRESH_SECONDS = 300

export async function GET(request) {
  const series = new URL(request.url).searchParams.get("series")
  const definition = Object.hasOwn(WATCH_INTRADAY_SERIES, series) ? WATCH_INTRADAY_SERIES[series] : null
  if (!definition) return Response.json({ error: "Unsupported market-watch series" }, { status: 400 })
  const key = process.env.TWELVE_DATA_API_KEY || process.env.TWELVEDATA_API_KEY
  if (series === "gold" && !key) return Response.json({ error: "کلید Twelve Data برای طلای دیده‌بان تنظیم نشده است." }, { status: 503 })
  try {
    const url = series === "gold"
      ? new URL("https://api.twelvedata.com/time_series")
      : new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(definition.symbol)}`)
    if (series === "gold") {
      url.search = new URLSearchParams({ symbol: "XAU/USD", interval: "5min", outputsize: "1500", timezone: "UTC", order: "asc", apikey: key }).toString()
    } else {
      url.search = new URLSearchParams({ range: "5d", interval: "5m", includePrePost: "false" }).toString()
    }
    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (compatible; GreenPeak/1.0)" },
      signal: AbortSignal.timeout(20000),
      next: { revalidate: REFRESH_SECONDS },
    })
    if (!response.ok) throw new Error("Source unavailable")
    const payload = await response.json()
    const result = series === "gold" ? parseWatchGold(payload) : parseWatchYahoo(payload, series)
    return Response.json(result, { headers: { "Cache-Control": `public, s-maxage=${REFRESH_SECONDS}, stale-while-revalidate=60` } })
  } catch {
    // Upstream messages/URLs can contain the provider key; never return or log them.
    return Response.json({ error: series === "gold" ? "دادهٔ ۵ دقیقه‌ای طلا از Twelve Data در دسترس نیست؛ کلید، دسترسی سرویس یا سهمیه را بررسی کنید." : "دادهٔ ۵ دقیقه‌ای منبع موقتاً در دسترس نیست." }, { status: 502 })
  }
}
