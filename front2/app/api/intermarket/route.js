const REFRESH_SECONDS = 5 * 60
const SUPPORTED_RANGES = new Set(["1mo", "6mo", "1y", "5y", "10y", "max"])

const SERIES = {
  SP500: {
    indicator_id: "sp500_index",
    title: "S&P 500 Index",
    unit: "index points",
    frequency: "daily",
    population: "S&P 500 index constituents",
    seasonal_adjustment: "not applicable",
    transformation: "source index level",
    fred_source: "S&P Dow Jones Indices LLC via FRED",
    fred_max_age_days: 7,
    yahoo_symbol: "^GSPC",
  },
  DTWEXBGS: {
    indicator_id: "broad_trade_weighted_us_dollar",
    title: "Nominal Broad U.S. Dollar Index",
    unit: "index Jan 2006=100",
    frequency: "daily",
    population: "Broad basket of U.S. trading-partner currencies",
    seasonal_adjustment: "not seasonally adjusted",
    transformation: "source index level",
    fred_source: "Board of Governors of the Federal Reserve System via FRED",
    fred_max_age_days: 14,
    yahoo_symbol: "DX-Y.NYB",
    yahoo_title: "U.S. Dollar Index Futures",
    yahoo_metadata: {
      indicator_id: "us_dollar_index_futures",
      unit: "index points",
      population: "ICE U.S. Dollar Index basket of six currencies",
      seasonal_adjustment: "not applicable",
    },
  },
  GOLDAMGBD228NLBM: {
    indicator_id: "gold_price",
    title: "Gold Price",
    unit: "U.S. dollars per troy ounce",
    frequency: "daily",
    population: "Gold market benchmark",
    seasonal_adjustment: "not applicable",
    transformation: "source price level",
    fred_source: "London Bullion Market data via FRED",
    fred_max_age_days: 14,
    yahoo_symbol: "GC=F",
    yahoo_title: "COMEX Gold Futures",
    yahoo_metadata: {
      indicator_id: "comex_gold_futures",
      population: "Front-month COMEX gold futures contract",
    },
  },
  DCOILWTICO: {
    indicator_id: "wti_crude_oil_price",
    title: "West Texas Intermediate Crude Oil",
    unit: "U.S. dollars per barrel",
    frequency: "daily",
    population: "Cushing, Oklahoma WTI spot market",
    seasonal_adjustment: "not seasonally adjusted",
    transformation: "source price level",
    fred_source: "U.S. Energy Information Administration via FRED",
  },
  PCOPPUSDM: {
    indicator_id: "global_copper_price",
    title: "Global Copper Price",
    unit: "U.S. dollars per metric ton",
    frequency: "monthly",
    population: "Global copper benchmark represented by the source series",
    seasonal_adjustment: "not seasonally adjusted",
    transformation: "source price level",
    fred_source: "International Monetary Fund via FRED",
  },
}

function rangeStart(range) {
  if (range === "max") return null
  const date = new Date()
  const amount = Number.parseInt(range, 10)
  if (range.endsWith("mo")) date.setUTCMonth(date.getUTCMonth() - amount)
  if (range.endsWith("y")) date.setUTCFullYear(date.getUTCFullYear() - amount)
  return date.toISOString().slice(0, 10)
}

function isFresh(data, maximumAgeDays) {
  if (!maximumAgeDays || data.length === 0) return data.length > 0
  const observationTime = Date.parse(`${data.at(-1).date}T00:00:00Z`)
  return Number.isFinite(observationTime) && Date.now() - observationTime <= maximumAgeDays * 24 * 60 * 60 * 1000
}

async function fetchFred(series, definition, range, apiKey) {
  if (!apiKey) return null
  const params = new URLSearchParams({
    series_id: series,
    api_key: apiKey,
    file_type: "json",
    sort_order: "asc",
  })
  const observationStart = rangeStart(range)
  if (observationStart) params.set("observation_start", observationStart)

  const response = await fetch(
    `https://api.stlouisfed.org/fred/series/observations?${params.toString()}`,
    { next: { revalidate: REFRESH_SECONDS } },
  )
  if (!response.ok) return null

  const payload = await response.json()
  const data = (payload.observations || [])
    .map((observation) => ({
      date: observation.date,
      value: observation.value === "." ? null : Number(observation.value),
    }))
    .filter((observation) => observation.date && Number.isFinite(observation.value))

  if (!isFresh(data, definition.fred_max_age_days)) return null
  return {
    data,
    metadata: {
      source: definition.fred_source,
      source_provider: "Federal Reserve Bank of St. Louis",
      source_series_id: series,
      source_url: `https://fred.stlouisfed.org/series/${series}`,
    },
  }
}

async function fetchYahoo(definition, range) {
  if (!definition.yahoo_symbol) return null
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(definition.yahoo_symbol)}`)
  url.searchParams.set("range", range)
  url.searchParams.set("interval", "1d")
  url.searchParams.set("includePrePost", "false")
  url.searchParams.set("events", "div,splits")

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 (compatible; GreenPeak/1.0; +https://greenpeak.tech)",
    },
    next: { revalidate: REFRESH_SECONDS },
  })
  if (!response.ok) return null

  const payload = await response.json()
  const result = payload?.chart?.result?.[0]
  const timestamps = result?.timestamp
  const closes = result?.indicators?.quote?.[0]?.close
  if (!Array.isArray(timestamps) || !Array.isArray(closes)) return null

  const data = timestamps.flatMap((timestamp, index) => {
    const value = closes[index]
    if (!Number.isInteger(timestamp) || !Number.isFinite(value)) return []
    return [{ date: new Date(timestamp * 1000).toISOString().slice(0, 10), value }]
  })
  if (data.length === 0) return null

  return {
    data,
    metadata: {
      ...definition.yahoo_metadata,
      source: "Yahoo Finance",
      source_provider: "Yahoo Finance",
      source_series_id: definition.yahoo_symbol,
      source_url: `https://finance.yahoo.com/quote/${encodeURIComponent(definition.yahoo_symbol)}`,
      title: definition.yahoo_title || definition.title,
      transformation: "daily source close; no interpolation",
    },
  }
}

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const series = searchParams.get("series")
  const definition = SERIES[series]
  const requestedRange = searchParams.get("range") || "10y"
  const range = SUPPORTED_RANGES.has(requestedRange) ? requestedRange : "10y"

  if (!definition) {
    return Response.json({ error: "Unsupported intermarket series" }, { status: 400 })
  }

  try {
    const result = await fetchFred(series, definition, range, process.env.FRED_API_KEY)
      || await fetchYahoo(definition, range)

    if (!result) {
      const reason = process.env.FRED_API_KEY
        ? "Verified upstream sources did not return valid observations."
        : "FRED_API_KEY is not configured and no verified fallback returned data."
      return Response.json({ error: reason }, { status: 503 })
    }

    const observationDate = result.data.at(-1)?.date || null
    const { fred_source, fred_max_age_days, yahoo_symbol, yahoo_title, yahoo_metadata, ...publicDefinition } = definition
    return Response.json({
      series,
      data: result.data,
      metadata: {
        ...publicDefinition,
        ...result.metadata,
        owner_group: "capital_flows_intermarket",
        observation_date: observationDate,
        retrieved_at: new Date().toISOString(),
        quality_status: result.data.length > 0 ? "available" : "unavailable",
        quality_reason: result.data.length > 0 ? null : "no_valid_observations",
        data_version: "2.1",
      },
    }, {
      headers: {
        "Cache-Control": `public, s-maxage=${REFRESH_SECONDS}, stale-while-revalidate=60`,
      },
    })
  } catch {
    return Response.json({ error: "Intermarket data could not be retrieved." }, { status: 502 })
  }
}
