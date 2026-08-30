"use client"

import { useEffect, useState } from "react"
import { ExternalLink, Loader2, Newspaper, Sparkles } from "lucide-react"
import { API_BASE } from "@/api/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const SOURCES = { alpha_vantage: "Alpha Vantage", cnbc_rss: "CNBC", investing_rss: "Investing.com" }
const formatTime = (value) => Number.isNaN(new Date(value).getTime()) ? "—" : new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))

function alphaTimestamp(value) {
  if (!value || !/^\d{8}T\d{6}$/.test(value)) return null
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(9, 11)}:${value.slice(11, 13)}:${value.slice(13, 15)}Z`
}

function localPreview(payload) {
  const cards = (payload.items || []).slice(0, 12).map((article, index) => ({
    cluster_id: `local-${index}-${encodeURIComponent(article.url || article.title || "news")}`,
    title: article.title,
    summary: article.summary,
    published_at: alphaTimestamp(article.publishedAt),
    topic: article.matchedTopics?.[0] || "financial_markets",
    source: "alpha_vantage",
    source_count: 1,
    url: article.url,
    tier: index < 5 ? "main" : "supplement",
  }))
  return {
    mode: "local_preview",
    qualified_at: payload.cache?.refreshedAt || new Date().toISOString(),
    cards,
    daily_summary: {
      positive_driver: "در پیش‌نمایش محلی تولید نمی‌شود",
      negative_driver: "در پیش‌نمایش محلی تولید نمی‌شود",
      next_event: "پس از اجرای پردازش واجد شرایط نمایش داده می‌شود",
    },
  }
}

export default function AlphaVantageNews() {
  const [daily, setDaily] = useState(null)
  const [explanations, setExplanations] = useState({})
  const [loadingId, setLoadingId] = useState(null)
  const [error, setError] = useState("")
  const [loadMessage, setLoadMessage] = useState("در حال دریافت خبرهای منتخب…")

  useEffect(() => {
    const controller = new AbortController()
    const wait = (milliseconds) => new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, milliseconds)
      controller.signal.addEventListener("abort", () => { clearTimeout(timer); reject(new DOMException("Aborted", "AbortError")) }, { once: true })
    })
    async function fetchLatest() {
      const response = await fetch(`${API_BASE}/news/daily/latest`, { signal: controller.signal })
      return { response, payload: await response.json() }
    }
    async function loadPreview() {
      const topics = "financial_markets,economy_monetary,economy_macro,earnings"
      const response = await fetch(`/api/market/news-sentiment?topics=${topics}&sort=LATEST&limit=12`, { signal: controller.signal })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Local news preview is unavailable")
      setDaily(localPreview(payload))
    }
    async function load() {
      let previewAttempted = false
      try {
        const initial = await fetchLatest()
        if (initial.response.ok) { setDaily(initial.payload.data); return }
        if (initial.response.status === 404) {
          setLoadMessage("اولین پردازش اخبار در حال اجراست…")
          const bootstrap = await fetch(`${API_BASE}/news/bootstrap`, { method: "POST", signal: controller.signal })
          if (bootstrap.ok) {
            for (let attempt = 0; attempt < 40; attempt += 1) {
              await wait(3000)
              const latest = await fetchLatest()
              if (latest.response.ok) { setDaily(latest.payload.data); return }
              if (latest.response.status !== 404) break
            }
          }
        }
        previewAttempted = true
        await loadPreview()
      } catch (reason) {
        if (reason.name === "AbortError") return
        if (previewAttempted) { setError(reason.message); return }
        try { await loadPreview() }
        catch (previewError) { if (previewError.name !== "AbortError") setError(previewError.message) }
      }
    }
    load()
    return () => controller.abort()
  }, [])

  async function explain(clusterId) {
    if (explanations[clusterId]) return
    setLoadingId(clusterId)
    try {
      const response = await fetch(`${API_BASE}/news/clusters/${encodeURIComponent(clusterId)}/why-important`, { method: "POST" })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.detail?.message || "Explanation is unavailable")
      setExplanations((current) => ({ ...current, [clusterId]: payload.data }))
    } catch (reason) { setError(reason.message) }
    finally { setLoadingId(null) }
  }

  return <Card dir="rtl">
    <CardHeader>
      <CardTitle className="flex items-center gap-2"><Newspaper className="h-5 w-5 text-pink-600" />اخبار مهم روز</CardTitle>
      <CardDescription>‏حداکثر ۱۲ رویداد غیرتکراری مرتبط با ‎S&amp;P 500‎؛ تازه‌سازی واجد شرایط روزانه ساعت ‎۱۶:۰۰‎ تهران.</CardDescription>
    </CardHeader>
    <CardContent>
      {!daily && !error && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{loadMessage}</div>}
      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">{error}</div>}
      {daily && <>
        {daily.mode === "local_preview" && <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">‏پیش‌نمایش محلی از ‎Alpha Vantage‎ نمایش داده می‌شود. رتبه‌بندی روزانه، منابع مکمل و تحلیل ‎LLM‎ هنوز اجرا نشده‌اند.</div>}
        <section className="mb-5 grid gap-3 rounded-lg border bg-muted/20 p-4 md:grid-cols-3">
          <div><span className="text-xs text-muted-foreground">عامل مثبت</span><p className="text-sm">{daily.daily_summary.positive_driver}</p></div>
          <div><span className="text-xs text-muted-foreground">عامل منفی</span><p className="text-sm">{daily.daily_summary.negative_driver}</p></div>
          <div><span className="text-xs text-muted-foreground">رویداد بعدی</span><p className="text-sm">{daily.daily_summary.next_event}</p></div>
        </section>
        <div className="mb-3 text-xs text-muted-foreground">‏آخرین پردازش: ‎{formatTime(daily.qualified_at)}‎</div>
        <div className="space-y-3">{daily.cards.map((article) => {
          const explanation = explanations[article.cluster_id]
          return <article key={article.cluster_id} className="rounded-lg border p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant={article.tier === "main" ? "default" : "secondary"}>{article.tier === "main" ? "رویداد اصلی" : "رویداد مکمل"}</Badge>
              <span dir="ltr">{SOURCES[article.source] || article.source}</span><span>•</span><time>{formatTime(article.published_at)}</time><Badge variant="outline">{article.topic}</Badge><span>‏{article.source_count} منبع</span>
            </div>
            <h3 className="font-semibold leading-snug">{article.title}</h3><p className="mt-2 text-sm text-muted-foreground">{article.summary}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {daily.mode !== "local_preview" && <Button size="sm" variant="outline" onClick={() => explain(article.cluster_id)} disabled={loadingId === article.cluster_id}>{loadingId === article.cluster_id ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Sparkles className="ml-2 h-4 w-4" />}چرا مهم است؟</Button>}
              <Button size="sm" variant="ghost" asChild><a href={article.url} target="_blank" rel="noopener noreferrer">مشاهده منبع<ExternalLink className="mr-2 h-4 w-4" /></a></Button>
            </div>
            {explanation && <div className="mt-3 rounded-md bg-muted p-3 text-sm"><p>{explanation.reason}</p><p className="mt-1 text-xs text-muted-foreground">‏کانال اثر: ‎{explanation.impact_channel}‎ · جهت احتمالی: ‎{explanation.likely_direction}‎ · اطمینان: ‎{explanation.confidence}‎</p></div>}
          </article>
        })}</div>
      </>}
    </CardContent>
  </Card>
}
