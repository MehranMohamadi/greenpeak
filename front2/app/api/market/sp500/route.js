const YAHOO_SYMBOL = "^GSPC"
const REFRESH_SECONDS = 5 * 60
const TIMEFRAMES = {
  "1D": { range: "1d", interval: "5m" },
  "5D": { range: "5d", interval: "5m" },
  "1M": { range: "1mo", interval: "30m" },
  "6M": { range: "6mo", interval: "1d" },
  YTD: { range: "ytd", interval: "1d" },
  "1Y": { range: "1y", interval: "1d" },
  "5Y": { range: "5y", interval: "1wk" },
  MAX: { range: "max", interval: "1mo" },
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value)
}

export async function GET(request) {
  try {
    const requestedTimeframe = new URL(request.url).searchParams
      .get("timeframe")
      ?.toUpperCase()
    const timeframe = requestedTimeframe || "5D"
    const timeframeConfig = TIMEFRAMES[timeframe]

    if (!timeframeConfig) {
      return Response.json(
        { error: "Unsupported S&P 500 timeframe" },
        { status: 400 }
      )
    }

    const url = new URL(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(YAHOO_SYMBOL)}`
    )
    url.searchParams.set("range", timeframeConfig.range)
    url.searchParams.set("interval", timeframeConfig.interval)
    url.searchParams.set("includePrePost", "false")
    url.searchParams.set("events", "div,splits")

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (compatible; GreenPeak/1.0; +https://greenpeak.tech)",
      },
      next: { revalidate: REFRESH_SECONDS },
    })

    if (!response.ok) {
      return Response.json(
        { error: "Yahoo Finance market data is temporarily unavailable" },
        { status: 502 }
      )
    }

    const payload = await response.json()
    const result = payload?.chart?.result?.[0]
    const timestamps = result?.timestamp
    const quote = result?.indicators?.quote?.[0]

    if (!Array.isArray(timestamps) || !quote) {
      return Response.json(
        { error: payload?.chart?.error?.description || "Invalid Yahoo Finance response" },
        { status: 502 }
      )
    }

    const data = timestamps.flatMap((time, index) => {
      const open = quote.open?.[index]
      const high = quote.high?.[index]
      const low = quote.low?.[index]
      const close = quote.close?.[index]
      const volume = quote.volume?.[index]

      if (
        !Number.isInteger(time) ||
        !isFiniteNumber(open) ||
        !isFiniteNumber(high) ||
        !isFiniteNumber(low) ||
        !isFiniteNumber(close)
      ) {
        return []
      }

      return [
        {
          // Lightweight Charts expects Unix timestamps in seconds.
          time,
          open,
          high,
          low,
          close,
          ...(isFiniteNumber(volume) ? { volume } : {}),
        },
      ]
    })

    if (data.length === 0) {
      return Response.json(
        { error: "Yahoo Finance returned no valid S&P 500 candles" },
        { status: 502 }
      )
    }

    return Response.json(data, {
      headers: {
        "Cache-Control": `public, s-maxage=${REFRESH_SECONDS}, stale-while-revalidate=60`,
        "X-Market-Symbol": YAHOO_SYMBOL,
        "X-Data-Interval": timeframeConfig.interval,
        "X-Data-Timeframe": timeframe,
        "X-Data-Source": "Yahoo Finance",
      },
    })
  } catch {
    return Response.json(
      { error: "Failed to fetch S&P 500 data from Yahoo Finance" },
      { status: 502 }
    )
  }
}
