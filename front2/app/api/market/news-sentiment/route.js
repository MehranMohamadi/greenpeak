import {
  DEFAULT_NEWS_TOPICS,
  ensureDailyNewsRefresh,
  filterNewsItems,
  getNewsCache,
} from "@/lib/news-sentiment-cache.mjs"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const TIME_PATTERN = /^\d{8}T\d{4}$/
const SORT_OPTIONS = new Set(["LATEST", "EARLIEST", "RELEVANCE"])
const TOPIC_OPTIONS = new Set(DEFAULT_NEWS_TOPICS)

function parseList(value) {
  if (!value) return [...DEFAULT_NEWS_TOPICS]
  return [...new Set(value.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean))]
}

function isValidApiTime(value) {
  if (!TIME_PATTERN.test(value)) return false

  const year = Number(value.slice(0, 4))
  const month = Number(value.slice(4, 6))
  const day = Number(value.slice(6, 8))
  const hour = Number(value.slice(9, 11))
  const minute = Number(value.slice(11, 13))
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute))

  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day && date.getUTCHours() === hour && date.getUTCMinutes() === minute
}

export async function GET(request) {
  const apiKey = process.env.ALPHA_VANTAGE_KEY
  if (!apiKey) {
    return Response.json({ error: "Alpha Vantage API key is not configured" }, { status: 503 })
  }

  const { searchParams } = new URL(request.url)
  const topics = parseList(searchParams.get("topics"))
  const timeFrom = searchParams.get("time_from")?.trim() || ""
  const timeTo = searchParams.get("time_to")?.trim() || ""
  const sort = (searchParams.get("sort") || "LATEST").trim().toUpperCase()
  const rawLimit = searchParams.get("limit")
  const limit = rawLimit ? Number(rawLimit) : null

  if (!topics.length || topics.some((topic) => !TOPIC_OPTIONS.has(topic))) {
    return Response.json({ error: "Invalid topics" }, { status: 400 })
  }
  if ((timeFrom && !isValidApiTime(timeFrom)) || (timeTo && !isValidApiTime(timeTo))) {
    return Response.json({ error: "Invalid time range; expected YYYYMMDDTHHMM in UTC" }, { status: 400 })
  }
  if (timeFrom && timeTo && timeFrom > timeTo) {
    return Response.json({ error: "time_from must not be after time_to" }, { status: 400 })
  }
  if (!SORT_OPTIONS.has(sort)) return Response.json({ error: "Invalid sort option" }, { status: 400 })
  if (limit !== null && (!Number.isInteger(limit) || limit < 1 || limit > 6000)) {
    return Response.json({ error: "limit must be between 1 and 6000" }, { status: 400 })
  }

  ensureDailyNewsRefresh(apiKey)

  try {
    const { cache, stale, refreshError } = await getNewsCache({ apiKey })
    const items = filterNewsItems(cache.items, { topics, timeFrom, timeTo, sort, limit })

    return Response.json({
      filters: { topics, timeFrom: timeFrom || null, timeTo: timeTo || null, sort, limit },
      items,
      count: items.length,
      cache: {
        refreshedAt: cache.refreshedAt,
        expiresAt: cache.expiresAt,
        stale,
        complete: cache.complete,
        topicStatus: cache.topicStatus,
        refreshWarning: refreshError || null,
      },
      sentimentScoreDefinition: cache.sentimentScoreDefinition,
      relevanceScoreDefinition: cache.relevanceScoreDefinition,
    })
  } catch {
    return Response.json({ error: "Failed to load Alpha Vantage news sentiment" }, { status: 502 })
  }
}
