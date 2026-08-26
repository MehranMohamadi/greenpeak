"use client"

import { useEffect, useState } from "react"
import { ChevronDown, ExternalLink, Loader2, Newspaper, RotateCcw, Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DEFAULT_NEWS_TOPICS,
  NEWS_SENTIMENT_TOPICS,
  NEWS_TOPIC_LABELS,
} from "@/lib/news-sentiment-topics.mjs"

const INITIAL_FORM = { topics: DEFAULT_NEWS_TOPICS, timeFrom: "", timeTo: "", sort: "LATEST" }

function toApiTime(value) {
  return value ? new Date(value).toISOString().slice(0, 16).replace(/[-:]/g, "") : ""
}

function formatPublishedAt(value) {
  if (!value || !/^\d{8}T\d{6}$/.test(value)) return "Unknown time"
  const date = new Date(Date.UTC(
    Number(value.slice(0, 4)), Number(value.slice(4, 6)) - 1, Number(value.slice(6, 8)),
    Number(value.slice(9, 11)), Number(value.slice(11, 13)), Number(value.slice(13, 15))
  ))
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(date)
}

function formatCacheTime(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? null
    : new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(date)
}

function sentimentClass(label = "") {
  const normalized = label.toLowerCase()
  if (normalized.includes("bullish")) return "border-green-300 bg-green-100 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-300"
  if (normalized.includes("bearish")) return "border-red-300 bg-red-100 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
  return "border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
}

export default function AlphaVantageNews() {
  const [form, setForm] = useState(INITIAL_FORM)
  const [filters, setFilters] = useState(INITIAL_FORM)
  const [items, setItems] = useState([])
  const [cache, setCache] = useState(null)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [visibleCount, setVisibleCount] = useState(12)

  useEffect(() => {
    const controller = new AbortController()
    async function loadNews() {
      setIsLoading(true)
      setError("")
      setVisibleCount(12)
      try {
        const params = new URLSearchParams({ topics: filters.topics.join(","), sort: filters.sort })
        if (filters.timeFrom) params.set("time_from", toApiTime(filters.timeFrom))
        if (filters.timeTo) params.set("time_to", toApiTime(filters.timeTo))
        const response = await fetch(`/api/market/news-sentiment?${params}`, { signal: controller.signal })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || "Unable to load news")
        setItems(payload.items || [])
        setCache(payload.cache || null)
      } catch (requestError) {
        if (requestError.name !== "AbortError") {
          setItems([])
          setCache(null)
          setError(requestError.message)
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }
    loadNews()
    return () => controller.abort()
  }, [filters])

  const updateForm = (field, value) => setForm((current) => ({ ...current, [field]: value }))
  const toggleTopic = (topic) => setForm((current) => {
    if (current.topics.includes(topic) && current.topics.length === 1) return current
    return {
      ...current,
      topics: current.topics.includes(topic)
        ? current.topics.filter((item) => item !== topic)
        : [...current.topics, topic],
    }
  })
  const handleSubmit = (event) => {
    event.preventDefault()
    setFilters({ ...form })
  }
  const resetFilters = () => {
    setForm({ ...INITIAL_FORM, topics: [...DEFAULT_NEWS_TOPICS] })
    setFilters({ ...INITIAL_FORM, topics: [...DEFAULT_NEWS_TOPICS] })
  }

  const refreshedAt = formatCacheTime(cache?.refreshedAt)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Newspaper className="h-5 w-5 text-pink-600" />Live News Sentiment</CardTitle>
        <CardDescription>
          A combined topic-based feed from Alpha Vantage, stored on the server and refreshed once per day.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="mb-6 space-y-4 rounded-lg border bg-muted/20 p-4">
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Topics</legend>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {NEWS_SENTIMENT_TOPICS.map(({ value, label }) => (
                <label key={value} className="flex cursor-pointer items-center gap-2 rounded-md border bg-background p-2 text-sm">
                  <input type="checkbox" checked={form.topics.includes(value)} onChange={() => toggleTopic(value)} className="h-4 w-4 rounded border-input" />
                  {label}
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              All six feeds are fetched separately. Selecting topics here filters the combined server cache and does not make another upstream request.
            </p>
          </fieldset>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
              Apply filters
            </Button>
            <Button type="button" variant="outline" size="icon" onClick={resetFilters} title="Reset filters">
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowAdvanced((value) => !value)} aria-expanded={showAdvanced}>
              <ChevronDown className={`mr-2 h-4 w-4 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
              Sort and UTC time range
            </Button>
          </div>

          {showAdvanced && (
            <div className="grid gap-4 border-t pt-4 md:grid-cols-3">
              <div className="space-y-1.5">
                <label htmlFor="news-sort" className="text-sm font-medium">Sort</label>
                <select id="news-sort" value={form.sort} onChange={(event) => updateForm("sort", event.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="LATEST">Latest first</option>
                  <option value="EARLIEST">Earliest first</option>
                  <option value="RELEVANCE">Strongest sentiment</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="news-time-from" className="text-sm font-medium">Published from</label>
                <input id="news-time-from" type="datetime-local" value={form.timeFrom} onChange={(event) => updateForm("timeFrom", event.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="news-time-to" className="text-sm font-medium">Published to</label>
                <input id="news-time-to" type="datetime-local" value={form.timeTo} onChange={(event) => updateForm("timeTo", event.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
              </div>
            </div>
          )}
        </form>

        {cache && (
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{cache.stale ? "Showing the last saved server cache" : "Daily server cache"}</span>
            {refreshedAt && <><span>•</span><span>Updated {refreshedAt}</span></>}
            {!cache.complete && <Badge variant="outline">Some topic feeds are unavailable or using saved data</Badge>}
          </div>
        )}

        {isLoading && <div className="flex min-h-40 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading news sentiment...</div>}
        {!isLoading && error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">{error}</div>}
        {!isLoading && !error && items.length === 0 && <div className="py-10 text-center text-sm text-muted-foreground">No matching news found.</div>}
        {!isLoading && !error && items.length > 0 && (
          <>
            <div className="mb-3 text-sm text-muted-foreground">Showing {Math.min(visibleCount, items.length)} of {items.length} combined results</div>
            <div className="space-y-3">
              {items.slice(0, visibleCount).map((article, index) => (
                <article key={`${article.url || article.title}-${index}`} className="rounded-lg border p-4">
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{article.source}</span><span>•</span><time>{formatPublishedAt(article.publishedAt)}</time>
                    <Badge variant="outline" className={sentimentClass(article.overallSentimentLabel)}>
                      {article.overallSentimentLabel}{article.overallSentimentScore !== null && ` (${article.overallSentimentScore.toFixed(3)})`}
                    </Badge>
                  </div>
                  <h3 className="font-semibold leading-snug">
                    {article.url ? (
                      <a href={article.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                        {article.title}<ExternalLink className="ml-1 inline h-3.5 w-3.5" />
                      </a>
                    ) : article.title}
                  </h3>
                  {article.summary && <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{article.summary}</p>}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {article.matchedTopics?.map((topic) => <Badge key={topic} variant="secondary">{NEWS_TOPIC_LABELS[topic] || topic}</Badge>)}
                    {article.tickerSentiment?.slice(0, 4).map((item) => (
                      <Badge key={item.ticker} variant="outline" className={sentimentClass(item.sentimentLabel)}>{item.ticker}: {item.sentimentLabel}</Badge>
                    ))}
                  </div>
                </article>
              ))}
            </div>
            {visibleCount < items.length && (
              <div className="mt-4 flex justify-center"><Button variant="outline" onClick={() => setVisibleCount((count) => count + 12)}>Load more</Button></div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
