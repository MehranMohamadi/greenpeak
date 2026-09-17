const SERIES = {
  SP500: {
    indicator_id: "sp500_index",
    title: "S&P 500 Index",
    unit: "index points",
    frequency: "daily",
    population: "S&P 500 index constituents",
    seasonal_adjustment: "not applicable",
    transformation: "source index level",
  },
  DTWEXBGS: {
    indicator_id: "broad_trade_weighted_us_dollar",
    title: "Broad Trade-Weighted U.S. Dollar Index",
    unit: "index",
    frequency: "daily",
    population: "Broad basket of U.S. trading-partner currencies",
    seasonal_adjustment: "not seasonally adjusted",
    transformation: "source index level",
  },
  GOLDAMGBD228NLBM: {
    indicator_id: "gold_fixing_price",
    title: "Gold Fixing Price",
    unit: "U.S. dollars per troy ounce",
    frequency: "daily",
    population: "London morning gold fixing",
    seasonal_adjustment: "not applicable",
    transformation: "source price level",
  },
  DCOILWTICO: {
    indicator_id: "wti_crude_oil_price",
    title: "West Texas Intermediate Crude Oil",
    unit: "U.S. dollars per barrel",
    frequency: "daily",
    population: "Cushing, Oklahoma WTI spot market",
    seasonal_adjustment: "not seasonally adjusted",
    transformation: "source price level",
  },
  PCOPPUSDM: {
    indicator_id: "global_copper_price",
    title: "Global Copper Price",
    unit: "U.S. dollars per metric ton",
    frequency: "monthly",
    population: "Global copper benchmark represented by the source series",
    seasonal_adjustment: "not seasonally adjusted",
    transformation: "source price level",
  },
}

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const series = searchParams.get("series")
  const definition = SERIES[series]

  if (!definition) {
    return Response.json({ error: "Unsupported intermarket series" }, { status: 400 })
  }

  const apiKey = process.env.FRED_API_KEY
  if (!apiKey) {
    return Response.json(
      { error: "Intermarket data is unavailable because FRED_API_KEY is not configured." },
      { status: 503 },
    )
  }

  try {
    const params = new URLSearchParams({
      series_id: series,
      api_key: apiKey,
      file_type: "json",
      sort_order: "asc",
    })
    const response = await fetch(
      `https://api.stlouisfed.org/fred/series/observations?${params.toString()}`,
      { next: { revalidate: 300 } },
    )

    if (!response.ok) {
      return Response.json({ error: "The FRED data service did not return this series." }, { status: 502 })
    }

    const payload = await response.json()
    const data = (payload.observations || [])
      .map((observation) => ({
        date: observation.date,
        value: observation.value === "." ? null : Number(observation.value),
      }))
      .filter((observation) => observation.date && Number.isFinite(observation.value))

    const observationDate = data.at(-1)?.date || null
    return Response.json({
      series,
      data,
      metadata: {
        ...definition,
        owner_group: "capital_flows_intermarket",
        source_provider: "Federal Reserve Bank of St. Louis",
        source_series_id: series,
        observation_date: observationDate,
        retrieved_at: new Date().toISOString(),
        quality_status: data.length > 0 ? "available" : "unavailable",
        quality_reason: data.length > 0 ? null : "no_valid_observations",
        data_version: "2.0",
      },
    })
  } catch {
    return Response.json({ error: "Intermarket data could not be retrieved." }, { status: 502 })
  }
}
