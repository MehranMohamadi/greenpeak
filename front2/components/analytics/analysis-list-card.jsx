const accents = {
  positive: "border-emerald-500/25 bg-emerald-500/5",
  negative: "border-rose-500/25 bg-rose-500/5",
  warning: "border-amber-500/25 bg-amber-500/5",
  info: "border-sky-500/25 bg-sky-500/5",
  violet: "border-violet-500/25 bg-violet-500/5",
  neutral: "border-border bg-muted/20",
}

function normalizeItem(item) {
  if (typeof item === "string") return { title: item, detail: "", refs: [] }
  if (!item || typeof item !== "object") return { title: String(item ?? ""), detail: "", refs: [] }
  return {
    title: item.title_fa || item.fact || item.title || item.driver || item.risk || item.conflict || item.text || "نکته تحلیلی",
    detail: item.detail_fa || item.detail || item.description || item.explanation || "",
    refs: item.evidence_refs || (item.evidence_ref ? [item.evidence_ref] : []),
  }
}

export default function AnalysisListCard({ title, items, tone = "neutral", emptyText = "موردی ثبت نشده است." }) {
  const values = (items || []).filter(Boolean).map(normalizeItem)
  return <section className={`rounded-xl border p-4 ${accents[tone] || accents.neutral}`} dir="rtl">
    <div className="mb-3 flex items-center justify-between gap-2">
      <h3 className="font-semibold">{title}</h3>
      <span className="rounded-full bg-background/80 px-2 py-0.5 text-[11px] text-muted-foreground">{values.length}</span>
    </div>
    {values.length ? <div className="space-y-2.5">{values.map((item, index) => <article key={index} className="rounded-lg border bg-background/75 p-3 shadow-sm">
      <div className="flex items-start gap-2"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-foreground/5 text-[11px] font-semibold">{index + 1}</span><p className="text-sm font-medium leading-6">{item.title}</p></div>
      {item.detail && <p className="mt-1.5 pr-7 text-xs leading-6 text-muted-foreground">{item.detail}</p>}
      {!!item.refs.length && <p className="mt-2 truncate pr-7 text-[10px] text-muted-foreground/75" dir="ltr">{item.refs.join(" · ")}</p>}
    </article>)}</div> : <p className="text-xs text-muted-foreground">{emptyText}</p>}
  </section>
}
