import { parseYahooTreasury, TREASURY_PERIOD_CONFIG, treasuryHistoryStart } from "@/lib/treasury-yield"

export async function GET(request) {
  const params = new URL(request.url).searchParams
  const period = (params.get("period") || "1M").toUpperCase()
  const config = TREASURY_PERIOD_CONFIG[period]
  if (!config) return Response.json({ error: "Unsupported Treasury period" }, { status: 400 })
  const interval = params.get("interval") || config.interval
  if (!["1h", "1d"].includes(interval) || (interval === "1h" && config.interval !== "1h")) {
    return Response.json({ error: "Unsupported Treasury interval for this period" }, { status: 400 })
  }
  try {
    const url = new URL("https://query1.finance.yahoo.com/v8/finance/chart/%5ETNX")
    if (interval === "1d") {
      // Yahoo silently coarsens range=max to quarterly bars even when interval=1d.
      // Explicit UTC bounds preserve daily observations for long-range charts/features.
      url.searchParams.set("period1", String(treasuryHistoryStart(period)))
      const cacheSeconds = period === "MAX" ? 900 : 60
      url.searchParams.set("period2", String(Math.floor(Date.now() / (cacheSeconds * 1000)) * cacheSeconds))
    } else url.searchParams.set("range", config.range)
    url.searchParams.set("interval", interval === "1h" ? "60m" : "1d")
    url.searchParams.set("includePrePost", "false")
    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (compatible; GreenPeak/1.0)" },
      signal: AbortSignal.timeout(20000),
      next: { revalidate: interval === "1d" && period === "MAX" ? 900 : 60 },
    })
    if (!response.ok) throw new Error("Yahoo Finance unavailable")
    const result = parseYahooTreasury(await response.json(), interval)
    return Response.json(result, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=60" } })
  } catch {
    return Response.json({ error: "Yahoo Finance Treasury data is temporarily unavailable" }, { status: 502 })
  }
}
