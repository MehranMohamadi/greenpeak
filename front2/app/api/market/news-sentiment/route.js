const DEFAULT_TICKER = "AAPL"
const TICKER_PATTERN = /^[A-Z0-9.-]{1,10}$/

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
  const ticker = (searchParams.get("ticker") || DEFAULT_TICKER).trim().toUpperCase()

  if (!TICKER_PATTERN.test(ticker)) {
    return Response.json({ error: "Invalid ticker" }, { status: 400 })
  }

  const upstreamUrl = new URL("https://www.alphavantage.co/query")
  upstreamUrl.search = new URLSearchParams({
    function: "NEWS_SENTIMENT",
    tickers: ticker,
    sort: "LATEST",
    limit: "20",
    apikey: apiKey,
  }).toString()

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

    const feed = payload.feed.slice(0, 20).map((article) => ({
      title: article.title || "Untitled article",
      url: safeArticleUrl(article.url),
      summary: article.summary || "",
      source: article.source || "Unknown source",
      publishedAt: article.time_published || null,
      overallSentimentScore: Number.isFinite(Number(article.overall_sentiment_score))
        ? Number(article.overall_sentiment_score)
        : null,
      overallSentimentLabel: article.overall_sentiment_label || "Neutral",
      tickerSentiment: Array.isArray(article.ticker_sentiment)
        ? article.ticker_sentiment
            .filter((item) => item.ticker === ticker)
            .map((item) => ({
              ticker: item.ticker,
              relevanceScore: Number(item.relevance_score),
              sentimentScore: Number(item.ticker_sentiment_score),
              sentimentLabel: item.ticker_sentiment_label,
            }))
        : [],
    }))

    return Response.json({ ticker, items: feed, count: feed.length })
  } catch {
    return Response.json(
      { error: "Failed to fetch Alpha Vantage news sentiment" },
      { status: 502 }
    )
  }
}
