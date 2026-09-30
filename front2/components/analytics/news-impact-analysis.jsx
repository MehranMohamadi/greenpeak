"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowLeft, CircleAlert, ExternalLink, GitBranch, HelpCircle, Loader2, Newspaper, TrendingDown, TrendingUp } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const directionConfig = {
  up: { label: "صعودی", className: "border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", Icon: TrendingUp },
  down: { label: "نزولی", className: "border-rose-500/35 bg-rose-500/10 text-rose-700 dark:text-rose-300", Icon: TrendingDown },
  mixed: { label: "ترکیبی", className: "border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-300", Icon: GitBranch },
  unclear: { label: "نامشخص", className: "border-slate-500/35 bg-slate-500/10 text-slate-600 dark:text-slate-300", Icon: HelpCircle },
}

const confidenceLabels = { low: "اطمینان کم", medium: "اطمینان متوسط", high: "اطمینان بالا" }
const evidenceLabels = { reported: "واقعیت منبع", derived: "استنباط تحلیلی", unknown: "نامشخص" }

function formatTime(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(date)
}

function DirectionBadge({ direction = "unclear" }) {
  const config = directionConfig[direction] || directionConfig.unclear
  const Icon = config.Icon
  return <Badge variant="outline" className={config.className}><Icon className="me-1 h-3 w-3" />{config.label}</Badge>
}

function GraphNode({ node }) {
  const roleClass = node?.role === "market"
    ? "border-primary/35 bg-primary/10 shadow-sm"
    : node?.role === "news"
      ? "border-sky-500/35 bg-sky-500/10"
      : "border-border bg-muted/35"
  return <div className={`min-w-0 rounded-lg border p-2.5 ${roleClass}`}>
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] text-muted-foreground">{node?.role === "news" ? "خبر" : node?.role === "market" ? "خروجی بازار" : "محرک"}</span>
      {node?.direction && <DirectionBadge direction={node.direction} />}
    </div>
    <p className="mt-1.5 text-xs font-medium leading-5">{node?.label || "نود نامشخص"}</p>
    {node?.summary && <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-muted-foreground">{node.summary}</p>}
  </div>
}

function ImpactGraph({ graph, interpretation }) {
  const nodesById = useMemo(() => Object.fromEntries((graph.nodes || []).map((node) => [node.id, node])), [graph.nodes])

  return <div className="space-y-4">
    {interpretation && <section className="rounded-lg border border-primary/20 bg-primary/[0.06] p-3">
      <p className="text-xs font-medium text-primary">جمع‌بندی تحلیل</p>
      <p className="mt-1.5 text-sm leading-7 text-muted-foreground">{interpretation}</p>
    </section>}

    <section aria-labelledby="impact-paths-title">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 id="impact-paths-title" className="flex items-center gap-1.5 text-sm font-medium"><GitBranch className="h-4 w-4 text-primary" />زنجیره‌های اثر</h3>
        <span className="text-[11px] text-muted-foreground">{graph.edges.length.toLocaleString("fa-IR")} رابطه</span>
      </div>
      <div className="space-y-2.5">
        {graph.edges.map((edge) => {
          const sourceNode = nodesById[edge.from]
          const targetNode = nodesById[edge.to]
          const confidenceClass = edge.confidence === "high" ? "opacity-100" : edge.confidence === "medium" ? "opacity-85" : "opacity-65"
          return <article key={edge.id} className={`rounded-xl border border-border bg-background/60 p-3 ${confidenceClass}`}>
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2" dir="rtl">
              <GraphNode node={sourceNode} />
              <div className="flex flex-col items-center gap-1 text-primary">
                <ArrowLeft className="h-5 w-5" />
                <DirectionBadge direction={edge.direction} />
              </div>
              <GraphNode node={targetNode} />
            </div>
            {edge.condition && <div className="mx-auto mt-2 flex max-w-[92%] items-center justify-center gap-2 rounded-lg border border-dashed border-amber-500/40 bg-amber-500/[0.07] px-3 py-2 text-center text-[11px] leading-5 text-amber-800 dark:text-amber-200">
              <span className="h-2.5 w-2.5 shrink-0 rotate-45 border border-current" />
              <span>شرط: {edge.condition}</span>
            </div>}
            <details className="mt-2 rounded-lg bg-muted/35 px-3 py-2 text-xs">
              <summary className="cursor-pointer font-medium text-primary">دلیل این رابطه</summary>
              <p className="mt-2 leading-6 text-muted-foreground">{edge.reason}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge variant="outline">{confidenceLabels[edge.confidence] || edge.confidence}</Badge>
                {edge.horizon && <Badge variant="outline">افق: {edge.horizon}</Badge>}
              </div>
            </details>
          </article>
        })}
      </div>
    </section>

    {graph.scenarios?.length > 0 && <section>
      <h3 className="mb-2 text-sm font-medium">سناریوهای وابسته به شرط</h3>
      <div className="space-y-2">{graph.scenarios.map((scenario, index) => <div key={`${index}-${scenario.condition}`} className="flex gap-2 rounded-lg border border-amber-500/25 bg-amber-500/[0.06] p-3 text-xs leading-6"><span className="mt-1 h-2.5 w-2.5 shrink-0 rotate-45 border border-amber-500" /><span>{scenario.condition}</span></div>)}</div>
    </section>}

    <section>
      <h3 className="mb-2 text-sm font-medium">شواهد و مبنای تحلیل</h3>
      <div className="space-y-2">{graph.evidence.map((item) => <div key={item.id} className="rounded-lg border border-border p-3">
        <div className="flex flex-wrap items-center gap-1.5"><Badge variant="outline">{evidenceLabels[item.status] || item.status}</Badge>{item.source && <span className="text-[10px] text-muted-foreground">{item.source}</span>}{item.publishedAt && <time className="text-[10px] text-muted-foreground">{formatTime(item.publishedAt)}</time>}</div>
        <p className="mt-1.5 text-xs leading-6 text-muted-foreground">{item.claim}</p>
      </div>)}</div>
    </section>

    {graph.uncertainties?.length > 0 && <section className="rounded-lg border border-dashed border-border p-3">
      <h3 className="flex items-center gap-1.5 text-sm font-medium"><CircleAlert className="h-4 w-4 text-amber-500" />ابهام‌ها و محدودیت‌ها</h3>
      <ul className="mt-2 space-y-1.5 text-xs leading-6 text-muted-foreground">{graph.uncertainties.map((item, index) => <li key={`${index}-${item}`} className="flex gap-2"><span className="text-amber-500">•</span><span>{item}</span></li>)}</ul>
    </section>}
  </div>
}

export default function NewsImpactAnalysis({ article }) {
  const [analyses, setAnalyses] = useState({})
  const [loadingId, setLoadingId] = useState(null)
  const [errors, setErrors] = useState({})
  const itemId = article?.item_id
  const analysis = itemId ? analyses[itemId] : null

  useEffect(() => {
    if (!itemId || analyses[itemId]) return
    const controller = new AbortController()
    setLoadingId(itemId)
    setErrors((current) => ({ ...current, [itemId]: "" }))
    fetch(`/analytics-data/news/items/${encodeURIComponent(itemId)}/analysis`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json().catch(() => null)
        if (!response.ok || !payload?.data?.impact_graph) throw new Error("تحلیل ساختاریافته این خبر در دسترس نیست.")
        setAnalyses((current) => ({ ...current, [itemId]: payload.data }))
      })
      .catch((reason) => {
        if (reason.name !== "AbortError") setErrors((current) => ({ ...current, [itemId]: reason.message }))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingId((current) => current === itemId ? null : current)
      })
    return () => controller.abort()
  }, [analyses, itemId])

  const graph = analysis?.impact_graph
  const title = graph?.title || analysis?.title_fa || article?.title_fa || article?.title

  return <Card className="flex h-[34rem] min-h-0 flex-col overflow-hidden" dir="rtl">
    <CardHeader className="shrink-0 border-b border-border/70 pb-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2"><GitBranch className="h-5 w-5 text-primary" />نقشه اثر خبر</CardTitle>
          {article && <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-muted-foreground">{title}</p>}
        </div>
        {article?.url && <a href={article.url} target="_blank" rel="noopener noreferrer" aria-label="مشاهده منبع خبر" className="shrink-0 rounded-md border p-1.5 text-primary transition hover:bg-primary/10"><ExternalLink className="h-4 w-4" /></a>}
      </div>
      {article && <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground"><span>{formatTime(article.published_at)}</span>{article.source_score !== null && article.source_score !== undefined && <span>ارتباط: {Number(article.source_score).toFixed(3)}</span>}</div>}
    </CardHeader>
    <CardContent className="min-h-0 flex-1 overflow-y-auto pt-4" aria-live="polite">
      {!article && <div className="flex h-full flex-col items-center justify-center px-6 text-center"><span className="rounded-full bg-primary/10 p-4 text-primary"><Newspaper className="h-7 w-7" /></span><p className="mt-4 font-medium">یک خبر را انتخاب کنید</p><p className="mt-2 max-w-sm text-sm leading-7 text-muted-foreground">با انتخاب هر خبر از باکس سمت راست، شواهد، مسیرهای علّی، پیامدهای بازار و ابهام‌های همان خبر اینجا نمایش داده می‌شوند.</p></div>}
      {article && loadingId === itemId && !graph && <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin text-primary" /><span>در حال ساخت نقشه اثر این خبر…</span></div>}
      {article && errors[itemId] && !graph && <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.08] p-4 text-sm leading-7 text-amber-800 dark:text-amber-200"><p className="font-medium">نقشه اثر آماده نشد</p><p className="mt-1">{errors[itemId]}</p>{article.analysis_fa && <p className="mt-3 border-t border-amber-500/20 pt-3 text-muted-foreground">{article.analysis_fa}</p>}</div>}
      {graph && <ImpactGraph graph={graph} interpretation={analysis.interpretation_fa} />}
    </CardContent>
  </Card>
}
