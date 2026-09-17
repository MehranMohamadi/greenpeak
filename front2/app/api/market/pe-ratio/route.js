const SOURCE_URL = "https://www.multpl.com/s-p-500-pe-ratio/table/by-month"
const REFRESH_SECONDS = 6 * 60 * 60

function decodeText(value) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x[0-9a-f]+;|&#\d+;|&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()
}

function parseRows(html) {
  const tableStart = html.indexOf('<table id="datatable"')
  const tableEnd = html.indexOf("</table>", tableStart)
  if (tableStart < 0 || tableEnd < 0) return []

  const table = html.slice(tableStart, tableEnd)
  return [...table.matchAll(/<tr[^>]*>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<\/tr>/gi)]
    .flatMap((match) => {
      const timestamp = Date.parse(`${decodeText(match[1])} UTC`)
      const numericText = decodeText(match[2]).match(/-?\d+(?:\.\d+)?/g)?.at(-1)
      const value = Number(numericText)
      if (!Number.isFinite(timestamp) || !Number.isFinite(value)) return []
      return [{
        date: new Date(timestamp).toISOString().slice(0, 10),
        value,
        is_estimate: /title=["']Estimate["']/i.test(match[2]),
      }]
    })
    .sort((left, right) => left.date.localeCompare(right.date))
}

export async function GET(request) {
  const requestedLimit = Number.parseInt(new URL(request.url).searchParams.get("limit") || "10", 10)
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 2), 120) : 10

  try {
    const response = await fetch(SOURCE_URL, {
      headers: {
        Accept: "text/html",
        "User-Agent": "Mozilla/5.0 (compatible; GreenPeak/1.0; +https://greenpeak.tech)",
      },
      next: { revalidate: REFRESH_SECONDS },
    })
    if (!response.ok) {
      return Response.json({ error: "The verified P/E source is temporarily unavailable." }, { status: 502 })
    }

    const data = parseRows(await response.text()).slice(-limit)
    if (data.length < 2) {
      return Response.json({ error: "The verified P/E source returned insufficient observations." }, { status: 502 })
    }

    return Response.json({
      data,
      metadata: {
        indicator_id: "sp500_trailing_pe_ratio",
        title: "S&P 500 Trailing P/E Ratio",
        unit: "ratio",
        frequency: "monthly",
        source: "Multpl",
        source_provider: "Multpl",
        source_url: SOURCE_URL,
        observation_date: data.at(-1).date,
        latest_observation_is_estimate: data.at(-1).is_estimate,
        retrieved_at: new Date().toISOString(),
        quality_status: "available",
        transformation: "published values; recent source-marked estimates are flagged; GreenPeak generates no values",
      },
    }, {
      headers: {
        "Cache-Control": `public, s-maxage=${REFRESH_SECONDS}, stale-while-revalidate=3600`,
      },
    })
  } catch {
    return Response.json({ error: "P/E data could not be retrieved." }, { status: 502 })
  }
}
