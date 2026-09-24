"use client"

import { memo, useEffect, useMemo, useState } from "react"
import { AlertCircle, ExternalLink, LoaderCircle, RotateCcw } from "lucide-react"

const FINLOGIX_EARNINGS_URL = "https://apieconomic.finlogix.com/v1/earnings"
const DEFAULT_COUNTRY = "US"
const DEFAULT_IMPORTANCE = ["medium", "high"]

const COUNTRY_OPTIONS = [
  { value: "US", label: "United States" },
  { value: "CA", label: "Canada" },
  { value: "GB", label: "United Kingdom" },
  { value: "DE", label: "Germany" },
  { value: "FR", label: "France" },
  { value: "JP", label: "Japan" },
  { value: "CN", label: "China" },
  { value: "AU", label: "Australia" },
]

const IMPORTANCE_OPTIONS = [
  { value: "low", label: "Low", level: 1 },
  { value: "medium", label: "Medium", level: 2 },
  { value: "high", label: "High", level: 3 },
]

const DATE_RANGE_OPTIONS = [
  { value: "recentAndNext", label: "Recent & next" },
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "thisWeek", label: "This week" },
  { value: "nextWeek", label: "Next week" },
  { value: "thisMonth", label: "This month" },
]

const dateAtMidnight = (date = new Date()) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate())

const addDays = (date, days) => {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

const getMonday = (date) => {
  const result = dateAtMidnight(date)
  const day = result.getDay()
  result.setDate(result.getDate() - (day === 0 ? 6 : day - 1))
  return result
}

const getDateRange = (range) => {
  const today = dateAtMidnight()

  if (range === "today") return { start: today, end: today }
  if (range === "tomorrow") {
    const tomorrow = addDays(today, 1)
    return { start: tomorrow, end: tomorrow }
  }
  if (range === "thisWeek") {
    const start = getMonday(today)
    return { start, end: addDays(start, 6) }
  }
  if (range === "nextWeek") {
    const start = addDays(getMonday(today), 7)
    return { start, end: addDays(start, 6) }
  }
  if (range === "thisMonth") {
    return {
      start: new Date(today.getFullYear(), today.getMonth(), 1),
      end: new Date(today.getFullYear(), today.getMonth() + 1, 0),
    }
  }

  return { start: addDays(today, -3), end: addDays(today, 7) }
}

const formatApiDate = (date, endOfDay = false) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}T${endOfDay ? "23:59:59" : "00:00:00"}`
}

const formatEventDate = (date) => {
  if (!date) return "Unknown date"
  const parsedDate = new Date(`${date.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(parsedDate.getTime())) return date
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(parsedDate)
}

const displayValue = (value) => (value === null || value === undefined || value === "" ? "—" : value)

const releaseLabel = (value) => ({
  before_open: "Before open",
  after_close: "After close",
  by_day_end: "By day end",
}[value] || "—")

const importanceMeta = (level) => IMPORTANCE_OPTIONS.find((option) => option.level === Number(level))

function EarningsCalendarWidget() {
  const [country, setCountry] = useState(DEFAULT_COUNTRY)
  const [importance, setImportance] = useState(DEFAULT_IMPORTANCE)
  const [dateRange, setDateRange] = useState("recentAndNext")
  const [events, setEvents] = useState([])
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(true)

  const activeImportanceLevels = useMemo(
    () => new Set(IMPORTANCE_OPTIONS.filter((option) => importance.includes(option.value)).map((option) => option.level)),
    [importance],
  )

  const visibleEvents = useMemo(
    () => events.filter((event) => activeImportanceLevels.has(Number(event.importance))),
    [activeImportanceLevels, events],
  )

  const groupedEvents = useMemo(() => {
    const groups = new Map()
    visibleEvents.forEach((event) => {
      const date = event.date?.slice(0, 10) || "unknown"
      if (!groups.has(date)) groups.set(date, [])
      groups.get(date).push(event)
    })
    return Array.from(groups.entries())
  }, [visibleEvents])

  useEffect(() => {
    const controller = new AbortController()
    const range = getDateRange(dateRange)
    const url = new URL(FINLOGIX_EARNINGS_URL)
    url.searchParams.set("countries", country)
    url.searchParams.set("start", formatApiDate(range.start))
    url.searchParams.set("end", formatApiDate(range.end, true))

    setIsLoading(true)
    setError("")

    fetch(url, { cache: "no-store", signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Finlogix earnings request failed")
        return response.json()
      })
      .then((data) => {
        if (!Array.isArray(data)) throw new Error("Finlogix returned an invalid response")
        setEvents(data)
      })
      .catch((requestError) => {
        if (requestError.name !== "AbortError") {
          setEvents([])
          setError("Earnings calendar is temporarily unavailable.")
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })

    return () => controller.abort()
  }, [country, dateRange])

  const toggleImportance = (value) => {
    setImportance((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    )
  }

  const resetFilters = () => {
    setCountry(DEFAULT_COUNTRY)
    setImportance(DEFAULT_IMPORTANCE)
    setDateRange("recentAndNext")
  }

  return (
    <div className="flex h-[576px] min-h-[416px] w-full flex-col overflow-hidden rounded-lg bg-background text-foreground">
      <div className="shrink-0 border-b border-border bg-muted/20 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="earnings-country">Country</label>
          <select
            id="earnings-country"
            value={country}
            onChange={(event) => setCountry(event.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-ring"
          >
            {COUNTRY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>

          <label className="ml-1 text-xs font-medium text-muted-foreground" htmlFor="earnings-range">Range</label>
          <select
            id="earnings-range"
            value={dateRange}
            onChange={(event) => setDateRange(event.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-ring"
          >
            {DATE_RANGE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>

          <div className="flex items-center gap-1" aria-label="Earnings importance">
            {IMPORTANCE_OPTIONS.map((option) => {
              const isActive = importance.includes(option.value)
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => toggleImportance(option.value)}
                  className={`h-8 rounded-md border px-2 text-xs font-medium transition-colors ${
                    isActive
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-input bg-background text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {option.label}
                </button>
              )
            })}
          </div>

          <button
            type="button"
            onClick={resetFilters}
            className="ml-auto inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Reset filters"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {isLoading && (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Loading earnings…
          </div>
        )}

        {!isLoading && error && (
          <div role="status" className="flex h-full items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {!isLoading && !error && groupedEvents.length === 0 && (
          <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
            No earnings match the selected filters.
          </div>
        )}

        {!isLoading && !error && groupedEvents.length > 0 && (
          <div className="min-w-[760px]">
            <div className="sticky top-0 z-10 grid grid-cols-[minmax(180px,1fr)_70px_repeat(2,72px)_repeat(2,82px)_76px_88px] gap-2 border-b border-border bg-background/95 px-3 py-2 text-[11px] font-medium text-muted-foreground backdrop-blur">
              <span>Company</span><span>Impact</span><span>EPS</span><span>Forecast</span><span>Revenue</span><span>Forecast</span><span>Market cap</span><span>Release</span>
            </div>
            {groupedEvents.map(([date, dateEvents]) => (
              <section key={date}>
                <div className="sticky top-[33px] z-[5] border-b border-border bg-muted px-3 py-1.5 text-xs font-semibold text-foreground">
                  {formatEventDate(date)}
                </div>
                {dateEvents.map((event, index) => {
                  const impact = importanceMeta(event.importance)
                  return (
                    <div
                      key={`${event.symbol || event.name}-${event.date}-${index}`}
                      className="grid grid-cols-[minmax(180px,1fr)_70px_repeat(2,72px)_repeat(2,82px)_76px_88px] items-center gap-2 border-b border-border/60 px-3 py-2 text-xs odd:bg-muted/15 hover:bg-muted/35"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{event.name || event.symbol || "Unknown company"}</p>
                        <p className="truncate text-[10px] text-muted-foreground">{[event.ticker, event.exchange].filter(Boolean).join(" · ") || event.symbol}</p>
                      </div>
                      <span className={`w-fit rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        impact?.value === "high"
                          ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                          : impact?.value === "medium"
                            ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                            : "bg-slate-500/15 text-slate-600 dark:text-slate-300"
                      }`}>{impact?.label || "—"}</span>
                      <span>{displayValue(event.indices?.earnings?.actual)}</span>
                      <span className="text-muted-foreground">{displayValue(event.indices?.earnings?.forecast)}</span>
                      <span>{displayValue(event.indices?.revenues?.actual)}</span>
                      <span className="text-muted-foreground">{displayValue(event.indices?.revenues?.forecast)}</span>
                      <span>{displayValue(event.marketCapUSD)}</span>
                      <span className="text-[10px] text-muted-foreground">{releaseLabel(event.marketRelease)}</span>
                    </div>
                  )
                })}
              </section>
            ))}
          </div>
        )}
      </div>

      <a
        href="https://www.finlogix.com/calendar/earnings?utm_source=greenpeak&utm_medium=widget&utm_campaign=EarningCalendar"
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="flex shrink-0 items-center justify-center gap-1 border-t border-border bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
      >
        Earnings data supplied by Finlogix <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  )
}

export default memo(EarningsCalendarWidget)
