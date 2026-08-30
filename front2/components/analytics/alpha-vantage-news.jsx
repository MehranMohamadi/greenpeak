"use client"

import { useEffect, useState } from "react"
import { ExternalLink, Loader2, Newspaper } from "lucide-react"
import { endpoints } from "@/api/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const SOURCES = [
  { id: "alpha_vantage", label: "Alpha Vantage" },
  { id: "cnbc_rss", label: "CNBC" },
  { id: "investing_rss", label: "Investing.com" },
]

function formatTime(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(date)
}

const formatScore = (value) => typeof value === "number" ? value.toFixed(3) : "—"

export default function AlphaVantageNews() {
  const [activeSource, setActiveSource] = useState("alpha_vantage")
  const [feeds, setFeeds] = useState({})
  const [loadingSource, setLoadingSource] = useState(null)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (feeds[activeSource] || loadingSource === activeSource) return
    const controller = new AbortController()
    const wait = (milliseconds) => new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, milliseconds)
      controller.signal.addEventListener("abort", () => { clearTimeout(timer); reject(new DOMException("Aborted", "AbortError")) }, { once: true })
    })
    async function requestFeed() {
      const response = await fetch(endpoints.news.source(activeSource, 50), { signal: controller.signal })
      return { response, payload: await response.json() }
    }
    async function load() {
      setLoadingSource(activeSource)
      setErrors((current) => ({ ...current, [activeSource]: "" }))
      try {
        let result = await requestFeed()
        if (result.response.status === 404) {
          const bootstrap = await fetch(endpoints.news.bootstrap, { method: "POST", signal: controller.signal })
          if (bootstrap.ok) {
            for (let attempt = 0; attempt < 40; attempt += 1) {
              await wait(3000); result = await requestFeed()
              if (result.response.ok || result.response.status !== 404) break
            }
          }
        }
        if (!result.response.ok) throw new Error(result.payload.detail?.message || "News feed is unavailable")
        setFeeds((current) => ({ ...current, [activeSource]: result.payload.data }))
      } catch (reason) {
        if (reason.name !== "AbortError") setErrors((current) => ({ ...current, [activeSource]: reason.message }))
      } finally {
        if (!controller.signal.aborted) setLoadingSource(null)
      }
    }
    load()
    return () => controller.abort()
  }, [activeSource, feeds])

  return <Card dir="rtl">
    <CardHeader>
      <CardTitle className="flex items-center gap-2"><Newspaper className="h-5 w-5 text-pink-600" />اخبار بازار</CardTitle>
      <CardDescription>‏هر منبع به‌صورت مستقل نمایش داده می‌شود؛ بدون مقایسه یا ادغام خبرها. تب پیش‌فرض ‎Alpha Vantage‎ است.</CardDescription>
    </CardHeader>
    <CardContent>
      <Tabs value={activeSource} onValueChange={setActiveSource} dir="ltr">
        <TabsList className="mb-5 grid h-auto w-full grid-cols-3">
          {SOURCES.map((source) => <TabsTrigger key={source.id} value={source.id}>{source.label}</TabsTrigger>)}
        </TabsList>
        {SOURCES.map((source) => {
          const feed = feeds[source.id]
          const error = errors[source.id]
          return <TabsContent key={source.id} value={source.id}>
            {loadingSource === source.id && <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />در حال دریافت حداقل ۲۰ خبر…</div>}
            {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-right text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">{error}</div>}
            {feed && <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3" dir="rtl">
                <span className="text-sm text-muted-foreground">‏نمایش ‎{feed.count}‎ خبر از ‎{feed.available_count}‎ خبر موجود</span>
                {feed.searched_topics?.length > 0 && <div className="flex flex-wrap items-center gap-1.5"><span className="text-xs text-muted-foreground">تاپیک‌های جست‌وجوشده:</span>{feed.searched_topics.map((topic) => <Badge key={topic} variant="secondary" dir="ltr">{topic}</Badge>)}</div>}
              </div>
              {!feed.native_importance_score_available && <p className="mb-4 text-right text-xs text-muted-foreground">‏این ‎RSS‎ امتیاز اهمیت بومی ارائه نمی‌کند؛ اخبار این تب بر اساس زمان انتشار مرتب شده‌اند.</p>}
              <div className="grid gap-4 md:grid-cols-2" dir="ltr">
                {feed.items.map((article) => <article key={article.item_id || article.url} className="flex h-full flex-col rounded-lg border p-4 text-left">
                  <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <time dir="rtl">{formatTime(article.published_at)}</time>
                    {source.id === "alpha_vantage" && <>
                      <Badge variant="outline">Relevance: {formatScore(article.source_score)}</Badge>
                      {article.importance && <Badge variant={article.importance === "high" ? "default" : "secondary"}>{article.importance === "high" ? "High" : "Medium"}</Badge>}
                      {article.minimum_backfill && <Badge variant="outline">Top available</Badge>}
                    </>}
                  </div>
                  <h3 className="font-semibold leading-snug">{article.title}</h3>
                  <p className="mt-3 whitespace-pre-line text-sm leading-6 text-muted-foreground">{article.summary || "No summary was provided by this source."}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">{article.topics?.map((topic) => <Badge key={topic} variant="outline">{topic}</Badge>)}</div>
                  {source.id === "alpha_vantage" && article.alpha_sentiment_score !== null && <div className="mt-3 text-xs text-muted-foreground">News sentiment: {formatScore(article.alpha_sentiment_score)}{article.alpha_sentiment_label ? ` · ${article.alpha_sentiment_label}` : ""}</div>}
                  <div className="mt-auto pt-4"><Button size="sm" variant="ghost" asChild><a href={article.url} target="_blank" rel="noopener noreferrer">Open article<ExternalLink className="ml-2 h-4 w-4" /></a></Button></div>
                </article>)}
              </div>
            </>}
          </TabsContent>
        })}
      </Tabs>
    </CardContent>
  </Card>
}
