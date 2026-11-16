export default function MarketPulseAnalysis({ market }) {
  const lines = (market.current_market_move_fa || market.what_changed_fa || market.market_story_fa || "").split("\n").map(line => line.trim()).filter(Boolean)
  const headline = lines.length > 1 ? lines[0] : null
  const summary = headline ? lines.slice(1).join("\n") : lines.join("\n")
  // This is the explanation belonging to this pulse. Factor/glance evidence
  // can be retained from an earlier report and must not become today's analysis.
  const explanation = market.current_analysis_fa || market.systemic_synthesis_fa || market.narrative_fa || ""
  const hasAdditionalAnalysis = Boolean(summary && explanation.trim() && explanation.trim() !== summary.trim())
  return <section className="min-w-0 space-y-2 text-[13px] font-medium leading-[26px] text-black dark:text-white">
    {headline && <h3>{headline}</h3>}
    <p className="whitespace-pre-line">{summary || explanation}</p>
    {hasAdditionalAnalysis && <p className="whitespace-pre-line">{explanation}</p>}
    {market.watch_next_fa?.[0] && <p className="border-r-2 border-primary pr-3"><span>زیر نظر: </span>{market.watch_next_fa[0]}</p>}
  </section>
}
