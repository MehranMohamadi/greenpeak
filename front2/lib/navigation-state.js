export const US_MARKET = { id: "us500", href: "/analytics", label: "US 500", labelFa: "بازار آمریکا · US 500" }

const aliases = { "liquidity-flows": "monetary-policy", "sector-performance": "market-internals", derivatives: "sentiment", institutional: "intermarket", "macro-calendar": "events" }
export function normalizeNavigationPath(pathname) {
  const path = (pathname || "/").split(/[?#]/)[0].replace(/\/+$/, "") || "/"
  if (path === "/sp500") return "/analytics"
  const parts = path.split("/")
  if (parts[1] === "analytics" && aliases[parts[2]]) parts[2] = aliases[parts[2]]
  return parts.join("/")
}

export function getActiveNavHref(pathname, hrefs) {
  const path = normalizeNavigationPath(pathname)
  return [...hrefs].sort((a, b) => b.length - a.length).find((href) => path === href || (href !== "/" && href !== US_MARKET.href && path.startsWith(`${href}/`))) || null
}

export function revealActiveMarket(branches, pathname, markets) {
  const active = markets.find((market) => market.children.some((child) => getActiveNavHref(pathname, [child.href])))
  return active ? { ...branches, [active.id]: true } : branches
}
