import assert from "node:assert/strict"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"

import {
  DEFAULT_NEWS_TOPICS,
  filterNewsItems,
  getNewsCache,
  getNewsCacheProgressively,
  refreshNewsCache,
} from "../lib/news-sentiment-cache.mjs"

function upstreamArticle(title, url, publishedAt = "20260826T120000") {
  return {
    title,
    url,
    source: "Test Wire",
    time_published: publishedAt,
    overall_sentiment_score: "0.25",
    overall_sentiment_label: "Somewhat-Bullish",
    ticker_sentiment: [],
    topics: [],
  }
}

function response(payload) {
  return { ok: true, json: async () => payload }
}

test("refreshes each default topic independently and merges duplicate articles", async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), "greenpeak-news-"))
  context.after(() => rm(directory, { recursive: true, force: true }))
  const cachePath = path.join(directory, "news.json")
  const calls = []

  const fetchImpl = async (requestUrl) => {
    const url = new URL(requestUrl)
    calls.push(url)
    const topic = url.searchParams.get("topics")
    return response({
      feed: [
        upstreamArticle("Shared story", "https://example.com/shared"),
        upstreamArticle(`${topic} story`, `https://example.com/${topic}`),
      ],
    })
  }

  const cache = await refreshNewsCache({
    apiKey: "test-key",
    fetchImpl,
    cachePath,
    now: new Date("2026-08-26T12:00:00Z"),
  })

  assert.equal(calls.length, DEFAULT_NEWS_TOPICS.length)
  assert.deepEqual(calls.map((url) => url.searchParams.get("topics")), DEFAULT_NEWS_TOPICS)
  assert.ok(calls.every((url) => !url.searchParams.has("tickers")))
  assert.ok(calls.every((url) => url.searchParams.get("limit") === "1000"))
  assert.equal(cache.items.length, DEFAULT_NEWS_TOPICS.length + 1)
  assert.deepEqual(cache.items.find((item) => item.url === "https://example.com/shared").matchedTopics, DEFAULT_NEWS_TOPICS)
  assert.equal(cache.complete, true)

  let unexpectedCalls = 0
  const cachedResult = await getNewsCache({
    apiKey: "test-key",
    cachePath,
    now: new Date("2026-08-27T11:59:59Z"),
    fetchImpl: async () => {
      unexpectedCalls += 1
      throw new Error("fresh cache should be reused")
    },
  })
  assert.equal(unexpectedCalls, 0)
  assert.equal(cachedResult.stale, false)
})

test("keeps saved topic data when one daily topic refresh fails", async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), "greenpeak-news-"))
  context.after(() => rm(directory, { recursive: true, force: true }))
  const cachePath = path.join(directory, "news.json")

  await refreshNewsCache({
    apiKey: "test-key",
    cachePath,
    fetchImpl: async (requestUrl) => {
      const topic = new URL(requestUrl).searchParams.get("topics")
      return response({ feed: [upstreamArticle(`${topic} old`, `https://example.com/${topic}/old`)] })
    },
  })

  const failedTopic = DEFAULT_NEWS_TOPICS[2]
  const refreshed = await refreshNewsCache({
    apiKey: "test-key",
    cachePath,
    fetchImpl: async (requestUrl) => {
      const topic = new URL(requestUrl).searchParams.get("topics")
      if (topic === failedTopic) return response({ Information: "rate limited" })
      return response({ feed: [upstreamArticle(`${topic} new`, `https://example.com/${topic}/new`)] })
    },
  })

  assert.equal(refreshed.complete, false)
  assert.equal(refreshed.topicStatus[failedTopic].status, "stale")
  assert.ok(refreshed.items.some((item) => item.url === `https://example.com/${failedTopic}/old`))

  const retriedTopics = []
  const recovered = await getNewsCache({
    apiKey: "test-key",
    cachePath,
    now: new Date(Date.parse(refreshed.nextRetryAt) + 1),
    fetchImpl: async (requestUrl) => {
      const topic = new URL(requestUrl).searchParams.get("topics")
      retriedTopics.push(topic)
      return response({ feed: [upstreamArticle(`${topic} recovered`, `https://example.com/${topic}/recovered`)] })
    },
  })

  assert.deepEqual(retriedTopics, [failedTopic])
  assert.equal(recovered.cache.complete, true)
  assert.ok(recovered.cache.items.some((item) => item.url === `https://example.com/${failedTopic}/recovered`))
})

test("publishes each topic as soon as its upstream request finishes", async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), "greenpeak-news-"))
  context.after(() => rm(directory, { recursive: true, force: true }))
  const cachePath = path.join(directory, "news.json")
  const published = []

  await getNewsCacheProgressively({
    apiKey: "test-key",
    cachePath,
    fetchImpl: async (requestUrl) => {
      const topic = new URL(requestUrl).searchParams.get("topics")
      return response({ feed: [upstreamArticle(`${topic} live`, `https://example.com/${topic}/live`)] })
    },
  }, (event) => published.push(event))

  assert.deepEqual(published.map((event) => event.topic), DEFAULT_NEWS_TOPICS)
  assert.ok(published.every((event) => event.items.length === 1))
  assert.ok(published.every((event) => event.status.status === "fresh"))
})

test("filters the aggregate by topic and inclusive minute range", () => {
  const items = [
    { matchedTopics: ["earnings"], publishedAt: "20260826T120059", overallSentimentScore: 0.1 },
    { matchedTopics: ["finance"], publishedAt: "20260826T120100", overallSentimentScore: 0.9 },
  ]

  const result = filterNewsItems(items, {
    topics: ["earnings"],
    timeFrom: "20260826T1200",
    timeTo: "20260826T1200",
    sort: "LATEST",
    limit: null,
  })

  assert.equal(result.length, 1)
  assert.equal(result[0].publishedAt, "20260826T120059")
})
