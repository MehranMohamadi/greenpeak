const DEFAULT_TICKER = "AAPL"
const SYMBOL_PATTERN = /^(?:(?:CRYPTO|FOREX):)?[A-Z0-9.-]{1,15}$/
const TIME_PATTERN = /^\d{8}T\d{4}$/
const SORT_OPTIONS = new Set(["LATEST", "EARLIEST", "RELEVANCE"])
const TOPIC_OPTIONS = new Set([
  "blockchain",
  "earnings",
  "ipo",
  "mergers_and_acquisitions",
  "financial_markets",
  "economy_fiscal",
  "economy_monetary",
  "economy_macro",
  "energy_transportation",
  "finance",
  "life_sciences",
  "manufacturing",
  "real_estate",
  "retail_wholesale",
  "technology",
])

function parseList(value, { uppercase = false } = {}) {
  if (!value) return []

  return [...new Set(
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => uppercase ? item.toUpperCase() : item.toLowerCase())
  )]
}

function isValidApiTime(value) {
  if (!TIME_PATTERN.test(value)) return false

  const year = Number(value.slice(0, 4))
  const month = Number(value.slice(4, 6))
  const day = Number(value.slice(6, 8))
  const hour = Number(value.slice(9, 11))
  const minute = Number(value.slice(11, 13))
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute))

  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    date.getUTCHours() === hour &&
    date.getUTCMinutes() === minute
}

function safeArticleUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null
  } catch {
    return null
  }
}

export async function GET(request) {
  const apiKey = process.env.ALPHA_VANTAGE_KEY

  if (!apiKey) {
    return Response.json(
      { error: "Alpha Vantage API key is not configured" },
      { status: 503 }
    )
  }

  const { searchParams } = new URL(request.url)
  const tickers = parseList(
    searchParams.get("tickers") ?? searchParams.get("ticker") ?? DEFAULT_TICKER,
    { uppercase: true }
  )
  const topics = parseList(searchParams.get("topics"))
  const timeFrom = searchParams.get("time_from")?.trim() || ""
  const timeTo = searchParams.get("time_to")?.trim() || ""
  const sort = (searchParams.get("sort") || "LATEST").trim().toUpperCase()
  const rawLimit = searchParams.get("limit") || "50"
  const limit = Number(rawLimit)

  if (tickers.length > 10 || tickers.some((ticker) => !SYMBOL_PATTERN.test(ticker))) {
    return Response.json({ error: "Invalid tickers" }, { status: 400 })
  }

  if (topics.length > TOPIC_OPTIONS.size || topics.some((topic) => !TOPIC_OPTIONS.has(topic))) {
    return Response.json({ error: "Invalid topics" }, { status: 400 })
  }

  if ((timeFrom && !isValidApiTime(timeFrom)) || (timeTo && !isValidApiTime(timeTo))) {
    return Response.json(
      { error: "Invalid time range; expected YYYYMMDDTHHMM in UTC" },
      { status: 400 }
    )
  }

  if (timeFrom && timeTo && timeFrom > timeTo) {
    return Response.json({ error: "time_from must not be after time_to" }, { status: 400 })
  }

  if (!SORT_OPTIONS.has(sort)) {
    return Response.json({ error: "Invalid sort option" }, { status: 400 })
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
    return Response.json({ error: "limit must be between 1 and 1000" }, { status: 400 })
  }

  const upstreamUrl = new URL("https://www.alphavantage.co/query")
  const upstreamParams = new URLSearchParams({
    function: "NEWS_SENTIMENT",
    sort,
    limit: String(limit),
    apikey: apiKey,
  })

  if (tickers.length) upstreamParams.set("tickers", tickers.join(","))
  if (topics.length) upstreamParams.set("topics", topics.join(","))
  if (timeFrom) upstreamParams.set("time_from", timeFrom)
  if (timeTo) upstreamParams.set("time_to", timeTo)
  upstreamUrl.search = upstreamParams.toString()

  try {
    const response = await fetch(upstreamUrl, { next: { revalidate: 300 } })
    const payload = await response.json()

    if (!response.ok) {
      return Response.json({ error: "Alpha Vantage request failed" }, { status: 502 })
    }

    if (payload.Note || payload.Information) {
      return Response.json(
        { error: "Alpha Vantage rate limit reached" },
        { status: 429 }
      )
    }

    if (payload["Error Message"] || !Array.isArray(payload.feed)) {
      return Response.json({ error: "Invalid Alpha Vantage response" }, { status: 502 })
    }

    const feed = payload.feed.slice(0, limit).map((article) => ({
      title: article.title || "Untitled article",
      url: safeArticleUrl(article.url),
      summary: article.summary || "",
      source: article.source || "Unknown source",
      sourceDomain: article.source_domain || null,
      authors: Array.isArray(article.authors) ? article.authors.slice(0, 10) : [],
      bannerImage: safeArticleUrl(article.banner_image),
      publishedAt: article.time_published || null,
      overallSentimentScore: Number.isFinite(Number(article.overall_sentiment_score))
        ? Number(article.overall_sentiment_score)
        : null,
      overallSentimentLabel: article.overall_sentiment_label || "Neutral",
      tickerSentiment: Array.isArray(article.ticker_sentiment)
        ? article.ticker_sentiment
            .map((item) => ({
              ticker: item.ticker,
              relevanceScore: Number(item.relevance_score),
              sentimentScore: Number(item.ticker_sentiment_score),
              sentimentLabel: item.ticker_sentiment_label,
            }))
        : [],
      topics: Array.isArray(article.topics)
        ? article.topics.map((item) => ({
            topic: item.topic,
            relevanceScore: Number(item.relevance_score),
          }))
        : [],
    }))

    return Response.json({
      filters: { tickers, topics, timeFrom: timeFrom || null, timeTo: timeTo || null, sort, limit },
      items: feed,
      count: feed.length,
      sentimentScoreDefinition: payload.sentiment_score_definition || null,
      relevanceScoreDefinition: payload.relevance_score_definition || null,
    })
  } catch {
    return Response.json(
      { error: "Failed to fetch Alpha Vantage news sentiment" },
      { status: 502 }
    )
  }
}
