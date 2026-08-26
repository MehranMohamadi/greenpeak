import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import path from "node:path"

import { DEFAULT_NEWS_TOPICS } from "./news-sentiment-topics.mjs"

export { DEFAULT_NEWS_TOPICS } from "./news-sentiment-topics.mjs"

const CACHE_VERSION = 1
const DAY_MS = 24 * 60 * 60 * 1000
const SCHEDULER_INTERVAL_MS = 60 * 60 * 1000
const INCOMPLETE_RETRY_MS = 60 * 60 * 1000
const DEFAULT_PER_TOPIC_LIMIT = 1000
const schedulerKey = Symbol.for("greenpeak.newsSentimentRefreshTimer")

let refreshPromise = null

function positiveInteger(value, fallback, maximum) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 && parsed <= maximum ? parsed : fallback
}

function cacheTtlMs() {
  return positiveInteger(process.env.NEWS_SENTIMENT_CACHE_TTL_MS, DAY_MS, 7 * DAY_MS)
}

function perTopicLimit() {
  return positiveInteger(process.env.NEWS_SENTIMENT_PER_TOPIC_LIMIT, DEFAULT_PER_TOPIC_LIMIT, 1000)
}

export function newsCachePath() {
  return process.env.NEWS_SENTIMENT_CACHE_PATH || path.join(process.cwd(), ".cache", "news-sentiment.json")
}

function safeArticleUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null
  } catch {
    return null
  }
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function normalizeArticle(article, matchedTopic) {
  return {
    title: article.title || "Untitled article",
    url: safeArticleUrl(article.url),
    summary: article.summary || "",
    source: article.source || "Unknown source",
    sourceDomain: article.source_domain || null,
    authors: Array.isArray(article.authors) ? article.authors.slice(0, 10) : [],
    bannerImage: safeArticleUrl(article.banner_image),
    publishedAt: article.time_published || null,
    overallSentimentScore: finiteNumber(article.overall_sentiment_score),
    overallSentimentLabel: article.overall_sentiment_label || "Neutral",
    tickerSentiment: Array.isArray(article.ticker_sentiment)
      ? article.ticker_sentiment.map((item) => ({
          ticker: item.ticker,
          relevanceScore: finiteNumber(item.relevance_score),
          sentimentScore: finiteNumber(item.ticker_sentiment_score),
          sentimentLabel: item.ticker_sentiment_label,
        }))
      : [],
    topics: Array.isArray(article.topics)
      ? article.topics.map((item) => ({
          topic: item.topic,
          relevanceScore: finiteNumber(item.relevance_score),
        }))
      : [],
    matchedTopics: [matchedTopic],
  }
}

function articleIdentity(article) {
  if (article.url) return `url:${article.url}`
  return `fallback:${article.title}\u0000${article.publishedAt || ""}\u0000${article.source}`
}

export function mergeTopicFeeds(topicFeeds) {
  const merged = new Map()

  for (const { topic, items } of topicFeeds) {
    for (const rawItem of items) {
      const item = rawItem.matchedTopics ? rawItem : normalizeArticle(rawItem, topic)
      const identity = articleIdentity(item)
      const existing = merged.get(identity)

      if (existing) {
        existing.matchedTopics = [...new Set([...existing.matchedTopics, topic])]
      } else {
        merged.set(identity, { ...item, matchedTopics: [...new Set([...item.matchedTopics, topic])] })
      }
    }
  }

  return [...merged.values()].sort((left, right) =>
    String(right.publishedAt || "").localeCompare(String(left.publishedAt || ""))
  )
}

function isCacheShape(value) {
  return value && value.version === CACHE_VERSION &&
    typeof value.refreshedAt === "string" && Array.isArray(value.items) &&
    DEFAULT_NEWS_TOPICS.every((topic) => value.topics?.includes(topic))
}

export async function readNewsCache(cachePath = newsCachePath()) {
  try {
    const parsed = JSON.parse(await readFile(cachePath, "utf8"))
    return isCacheShape(parsed) ? parsed : null
  } catch (error) {
    if (error?.code === "ENOENT" || error instanceof SyntaxError) return null
    throw error
  }
}

async function writeNewsCache(cache, cachePath = newsCachePath()) {
  await mkdir(path.dirname(cachePath), { recursive: true })
  const temporaryPath = `${cachePath}.${process.pid}.${Date.now()}.tmp`
  await writeFile(temporaryPath, `${JSON.stringify(cache)}\n`, "utf8")
  await rename(temporaryPath, cachePath)
}

async function fetchTopic(topic, apiKey, fetchImpl) {
  const upstreamUrl = new URL("https://www.alphavantage.co/query")
  upstreamUrl.search = new URLSearchParams({
    function: "NEWS_SENTIMENT",
    topics: topic,
    sort: "LATEST",
    limit: String(perTopicLimit()),
    apikey: apiKey,
  }).toString()

  const response = await fetchImpl(upstreamUrl, { cache: "no-store" })
  const payload = await response.json()

  if (!response.ok) throw new Error("Alpha Vantage request failed")
  if (payload.Note || payload.Information) throw new Error("Alpha Vantage rate limit reached")
  if (payload["Error Message"] || !Array.isArray(payload.feed)) {
    throw new Error("Invalid Alpha Vantage response")
  }

  return {
    items: payload.feed.map((article) => normalizeArticle(article, topic)),
    sentimentScoreDefinition: payload.sentiment_score_definition || null,
    relevanceScoreDefinition: payload.relevance_score_definition || null,
  }
}

function previousTopicItems(previous, topic) {
  if (!previous) return []
  return previous.items.filter((item) => item.matchedTopics?.includes(topic))
}

export async function refreshNewsCache({
  apiKey,
  fetchImpl = fetch,
  cachePath = newsCachePath(),
  now = new Date(),
  topicsToFetch = DEFAULT_NEWS_TOPICS,
}) {
  if (!apiKey) throw new Error("Alpha Vantage API key is not configured")

  const previous = await readNewsCache(cachePath)
  const requestedTopics = new Set(topicsToFetch)
  const topicFeeds = []
  const topicStatus = {}
  let sentimentScoreDefinition = previous?.sentimentScoreDefinition || null
  let relevanceScoreDefinition = previous?.relevanceScoreDefinition || null
  let successfulTopics = 0

  // Alpha Vantage treats a comma-separated topic list as AND. Fetch each topic
  // independently so the aggregate represents the union requested by the product.
  for (const topic of DEFAULT_NEWS_TOPICS) {
    if (!requestedTopics.has(topic)) {
      const savedItems = previousTopicItems(previous, topic)
      topicFeeds.push({ topic, items: savedItems })
      topicStatus[topic] = previous?.topicStatus?.[topic] || {
        status: savedItems.length ? "stale" : "unavailable",
        count: savedItems.length,
      }
      continue
    }

    try {
      const result = await fetchTopic(topic, apiKey, fetchImpl)
      topicFeeds.push({ topic, items: result.items })
      topicStatus[topic] = { status: "fresh", count: result.items.length, lastAttemptAt: now.toISOString() }
      sentimentScoreDefinition ||= result.sentimentScoreDefinition
      relevanceScoreDefinition ||= result.relevanceScoreDefinition
      successfulTopics += 1
    } catch {
      const fallbackItems = previousTopicItems(previous, topic)
      topicFeeds.push({ topic, items: fallbackItems })
      topicStatus[topic] = {
        status: fallbackItems.length ? "stale" : "unavailable",
        count: fallbackItems.length,
        lastAttemptAt: now.toISOString(),
      }
    }
  }

  const isFullRefresh = requestedTopics.size === DEFAULT_NEWS_TOPICS.length
  if (successfulTopics === 0 && (isFullRefresh || !previous)) {
    throw new Error("Unable to refresh Alpha Vantage news sentiment")
  }

  const complete = DEFAULT_NEWS_TOPICS.every((topic) => topicStatus[topic]?.status === "fresh")
  const refreshedAt = isFullRefresh || complete ? now.toISOString() : previous.refreshedAt
  const cache = {
    version: CACHE_VERSION,
    refreshedAt,
    expiresAt: isFullRefresh || complete
      ? new Date(now.getTime() + cacheTtlMs()).toISOString()
      : previous.expiresAt,
    nextRetryAt: complete ? null : new Date(now.getTime() + INCOMPLETE_RETRY_MS).toISOString(),
    topics: [...DEFAULT_NEWS_TOPICS],
    topicStatus,
    complete,
    items: mergeTopicFeeds(topicFeeds),
    sentimentScoreDefinition,
    relevanceScoreDefinition,
  }
  await writeNewsCache(cache, cachePath)
  return cache
}

function isFresh(cache, now = new Date()) {
  return cache && Date.parse(cache.expiresAt) > now.getTime()
}

export async function getNewsCache(options) {
  const cachePath = options.cachePath || newsCachePath()
  const cached = await readNewsCache(cachePath)
  const now = options.now || new Date()
  const cacheIsFresh = isFresh(cached, now)
  const incompleteRetryDue = cached && !cached.complete &&
    (!cached.nextRetryAt || Date.parse(cached.nextRetryAt) <= now.getTime())

  if (!options.force && cacheIsFresh && !incompleteRetryDue) return { cache: cached, stale: false }

  const topicsToFetch = cacheIsFresh && incompleteRetryDue
    ? DEFAULT_NEWS_TOPICS.filter((topic) => cached.topicStatus?.[topic]?.status !== "fresh")
    : DEFAULT_NEWS_TOPICS

  if (!refreshPromise) {
    refreshPromise = refreshNewsCache({ ...options, cachePath, now, topicsToFetch }).finally(() => {
      refreshPromise = null
    })
  }

  try {
    return { cache: await refreshPromise, stale: false }
  } catch (error) {
    if (cached) return { cache: cached, stale: true, refreshError: error.message }
    throw error
  }
}

export function filterNewsItems(items, { topics, timeFrom, timeTo, sort, limit }) {
  let filtered = items.filter((item) =>
    topics.some((topic) => item.matchedTopics?.includes(topic)) &&
    (!timeFrom || String(item.publishedAt || "").slice(0, 13) >= timeFrom) &&
    (!timeTo || String(item.publishedAt || "").slice(0, 13) <= timeTo)
  )

  if (sort === "EARLIEST") {
    filtered = filtered.sort((left, right) => String(left.publishedAt || "").localeCompare(String(right.publishedAt || "")))
  } else if (sort === "RELEVANCE") {
    filtered = filtered.sort((left, right) =>
      (right.overallSentimentScore === null ? -Infinity : Math.abs(right.overallSentimentScore)) -
      (left.overallSentimentScore === null ? -Infinity : Math.abs(left.overallSentimentScore))
    )
  }

  return limit ? filtered.slice(0, limit) : filtered
}

export function ensureDailyNewsRefresh(apiKey) {
  if (!apiKey || globalThis[schedulerKey]) return

  const timer = setInterval(() => {
    getNewsCache({ apiKey }).catch(() => {})
  }, SCHEDULER_INTERVAL_MS)
  timer.unref?.()
  globalThis[schedulerKey] = timer
}
