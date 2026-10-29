// One session check also records presence when the page is visible.
export function startSessionHeartbeat({ document, window, refresh }) {
  const controller = new AbortController()
  let inFlight = false
  const report = async () => {
    if (controller.signal.aborted || inFlight) return
    inFlight = true
    try {
      await refresh({ signal: controller.signal, recordActivity: document.visibilityState === "visible" })
    } catch { /* Retry on the next heartbeat after a temporary network failure. */ }
    finally { inFlight = false }
  }
  const onVisible = () => { if (document.visibilityState === "visible") report() }
  const timer = window.setInterval(report, 60000)
  document.addEventListener("visibilitychange", onVisible)
  window.addEventListener("focus", onVisible)
  onVisible()
  return () => {
    controller.abort()
    window.clearInterval(timer)
    document.removeEventListener("visibilitychange", onVisible)
    window.removeEventListener("focus", onVisible)
  }
}
