"use client"

import { useEffect, useState } from "react"
import { ExternalLink, Loader2, Newspaper, Search } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

function formatPublishedAt(value) {
  if (!value || !/^\d{8}T\d{6}$/.test(value)) return "Unknown time"

  const date = new Date(
    Date.UTC(
      Number(value.slice(0, 4)),
      Number(value.slice(4, 6)) - 1,
      Number(value.slice(6, 8)),
      Number(value.slice(9, 11)),
      Number(value.slice(11, 13)),
      Number(value.slice(13, 15))
    )
  )

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

function sentimentClass(label = "") {
  const normalized = label.toLowerCase()

  if (normalized.includes("bullish")) {
    return "border-green-300 bg-green-100 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-300"
  }

  if (normalized.includes("bearish")) {
    return "border-red-300 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
  }

  return "border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
}

export default function AlphaVantageNews() {
  const [tickerInput, setTickerInput] = useState("AAPL")
  const [ticker, setTicker] = useState("AAPL")
  const [items, setItems] = useState([])
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()

    async function loadNews() {
      setIsLoading(true)
      setError("")

      try {
        const response = await fetch(
          `/api/market/news-sentiment?ticker=${encodeURIComponent(ticker)}`,
          { signal: controller.signal }
        )
        const payload = await response.json()

        if (!response.ok) throw new Error(payload.error || "Unable to load news")
        setItems(payload.items || [])
      } catch (requestError) {
        if (requestError.name !== "AbortError") {
          setItems([])
          setError(requestError.message)
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }

    loadNews()
    return () => controller.abort()
  }, [ticker])

  const handleSubmit = (event) => {
    event.preventDefault()
    const nextTicker = tickerInput.trim().toUpperCase()

    if (/^[A-Z0-9.-]{1,10}$/.test(nextTicker)) {
      setTickerInput(nextTicker)
      setTicker(nextTicker)
    }
  }

  return (
    <Card>
      <CardHeader className="gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Newspaper className="h-5 w-5 text-pink-600" />
            Live News Sentiment
          </CardTitle>
          <CardDescription className="mt-1">
            Latest market news and sentiment scores from Alpha Vantage
          </CardDescription>
        </div>
        <form onSubmit={handleSubmit} className="flex w-full gap-2 md:w-auto">
          <label htmlFor="news-ticker" className="sr-only">Ticker symbol</label>
          <input
            id="news-ticker"
            value={tickerInput}
            onChange={(event) => setTickerInput(event.target.value)}
            className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm uppercase md:w-32"
            maxLength={10}
            placeholder="AAPL"
          />
          <Button type="submit" size="sm" disabled={isLoading}>
            <Search className="mr-2 h-4 w-4" />
            Search
          </Button>
        </form>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="flex min-h-40 items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading {ticker} news...
          </div>
        )}

        {!isLoading && error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {error}
          </div>
        )}

        {!isLoading && !error && items.length === 0 && (
          <div className="py-10 text-center text-sm text-muted-foreground">
            No recent news found for {ticker}.
          </div>
        )}

        {!isLoading && !error && items.length > 0 && (
          <div className="grid gap-3 lg:grid-cols-2">
            {items.slice(0, 8).map((article, index) => (
              <article key={`${article.url || article.title}-${index}`} className="rounded-lg border p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{article.source}</span>
                  <span aria-hidden="true">•</span>
                  <time>{formatPublishedAt(article.publishedAt)}</time>
                  <Badge variant="outline" className={sentimentClass(article.overallSentimentLabel)}>
                    {article.overallSentimentLabel}
                  </Badge>
                </div>
                <h3 className="font-semibold leading-snug text-foreground">
                  {article.url ? (
                    <a href={article.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                      {article.title}
                      <ExternalLink className="ml-1 inline h-3.5 w-3.5" />
                    </a>
                  ) : article.title}
                </h3>
                {article.summary && (
                  <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{article.summary}</p>
                )}
              </article>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
