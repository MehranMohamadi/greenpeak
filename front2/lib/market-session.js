// Validate reported session states; never infer an open/closed state locally.
export function validMarketSession(payload) {
  if (!Array.isArray(payload?.sessions) || payload.sessions.length === 0) return false
  const names = new Set()
  return payload.sessions.every((session) => {
    if (typeof session?.name !== "string" || !session.name.trim() || names.has(session.name)
      || !["open", "closed"].includes(session.status)) return false
    names.add(session.name)
    return true
  })
}

export async function fetchMarketSession(url, { signal, fetchImpl = globalThis.fetch } = {}) {
  try {
    const response = await fetchImpl(url, { signal, cache: "no-store" })
    if (!response.ok) return null
    const data = await response.json()
    return validMarketSession(data) ? data : null
  } catch {
    // Network failures and interrupted refreshes are an unavailable state,
    // not a fabricated session or an unhandled console exception.
    return null
  }
}
