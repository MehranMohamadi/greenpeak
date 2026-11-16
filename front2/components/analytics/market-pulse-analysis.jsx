import AnalysisDetailsDialog from "@/components/analytics/analysis-details-dialog"

export default function MarketPulseAnalysis({ market }) {
  const lines = (market.current_market_move_fa || market.what_changed_fa || market.market_story_fa || "").split("\n").map(line => line.trim()).filter(Boolean)
  const headline = lines.length > 1 ? lines[0] : null
  const summary = headline ? lines.slice(1).join("\n") : lines.join("\n")
  // This is the explanation belonging to this pulse. Factor/glance evidence
  // can be retained from an earlier report and must not become today's reasons.
  const explanation = market.current_analysis_fa || market.systemic_synthesis_fa || market.narrative_fa || ""
  const hasDetails = Boolean(summary && explanation.trim() && explanation.trim() !== summary.trim())
  return <>
    {headline && <h3 className="text-base font-semibold leading-7">{headline}</h3>}
    <div className="flex items-start gap-2">
      <p className={`min-w-0 flex-1 whitespace-pre-line leading-7 ${headline ? "text-sm" : "text-base font-semibold"}`}>{summary || explanation}</p>
      {hasDetails && <AnalysisDetailsDialog title="نبض بازار">
        <p className="whitespace-pre-line">{explanation}</p>
      </AnalysisDetailsDialog>}
    </div>
    {market.watch_next_fa?.[0] && <p className="border-r-2 border-primary pr-3 text-sm leading-7"><span className="font-medium text-primary">زیر نظر: </span>{market.watch_next_fa[0]}</p>}
  </>
}
