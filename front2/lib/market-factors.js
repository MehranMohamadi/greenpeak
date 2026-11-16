// Preserve supported stored factors across both response generations. Horizon
// and review state are displayed, rather than silently removing dated factors.
const title = (item) => typeof item === "string" ? item : item?.title_fa || item?.title || item?.driver || item?.risk || ""
function unique(items) {
  const seen = new Set()
  return items.filter((item) => {
    const key = title(item).normalize("NFKC").replace(/[\u200c\u200f\s،؛:,.!?؟]+/g, "").toLocaleLowerCase("fa")
    if (!key || seen.has(key)) return false
    seen.add(key); return true
  })
}
function legacy(item, index, direction) {
  if (typeof item === "string") return { metric: `${direction}_${index}`, title_fa: item, duration: "unknown" }
  return { ...item, title_fa: title(item), metric: item?.metric || `${direction}_${index}`, why_it_matters_fa: item?.why_it_matters_fa || item?.detail_fa || item?.detail || item?.description || "" }
}
export function marketFactorGroups(market) {
  const drivers = market.market_drivers || []
  return {
    supportive: unique([...drivers.filter((item) => item.sentiment === "risk_on"), ...(market.positive_drivers || []).map((item, i) => legacy(item, i, "positive"))]),
    challenging: unique([...drivers.filter((item) => item.sentiment === "risk_off"), ...(market.negative_drivers || []).map((item, i) => legacy(item, i, "negative"))]),
    potentials: unique(market.market_potentials || []),
    risks: unique([...(market.risk_monitor || []).filter((item) => item.status !== "inactive").map((item) => ({ ...item, detail_fa: [item.why_active_fa, item.escalation_conditions_fa && `تشدید: ${item.escalation_conditions_fa}`, item.easing_conditions_fa && `کاهش: ${item.easing_conditions_fa}`].filter(Boolean).join(" — ") })), ...(market.key_risks || []).map((item, i) => legacy(item, i, "risk"))]),
  }
}

// Combine display categories without discarding distinct mechanisms or horizons
// that can share a title in the stored analytical categories.
export function marketFactorPanels(market) {
  const groups = marketFactorGroups(market)
  return {
    supportive: [...groups.supportive, ...groups.potentials],
    risks: [...groups.challenging, ...groups.risks],
  }
}

export function factorEffectHorizon(item) {
  const duration = { short_term: "کوتاه‌مدت", medium_term: "میان‌مدت", long_term: "بلندمدت" }[item.duration]
  const horizon = typeof item.horizon_fa === "string" ? item.horizon_fa.trim() : ""
  return [...new Set([duration, horizon].filter(Boolean))].join(" — ") || "در تحلیل ثبت نشده است."
}
