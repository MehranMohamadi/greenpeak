"use client"

import { memo, useEffect, useId, useMemo, useState } from "react"
import { useTheme } from "next-themes"

const FINLOGIX_SCRIPT_ID = "finlogix-widget-script"
const FINLOGIX_SCRIPT_URL = "https://widget.finlogix.com/Widget.js"

function loadFinlogixWidget() {
  if (window.Widget?.init) return Promise.resolve(window.Widget)

  return new Promise((resolve, reject) => {
    const existingScript = document.getElementById(FINLOGIX_SCRIPT_ID)
    const script = existingScript || document.createElement("script")

    const handleLoad = () => {
      if (window.Widget?.init) resolve(window.Widget)
      else reject(new Error("Finlogix widget loader did not initialize"))
    }
    const handleError = () => reject(new Error("Finlogix widget loader is unavailable"))

    script.addEventListener("load", handleLoad, { once: true })
    script.addEventListener("error", handleError, { once: true })

    if (!existingScript) {
      script.id = FINLOGIX_SCRIPT_ID
      script.src = FINLOGIX_SCRIPT_URL
      script.async = true
      document.head.appendChild(script)
    }
  })
}

function EarningsCalendarWidget() {
  const { theme, resolvedTheme } = useTheme()
  const [error, setError] = useState("")
  const reactId = useId()
  const containerId = useMemo(
    () => `finlogix-earnings-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`,
    [reactId],
  )
  const isDarkTheme =
    resolvedTheme === "dark" || theme === "trading-dark" || theme === "terminal"

  useEffect(() => {
    if (!resolvedTheme) return undefined

    let cancelled = false
    const container = document.getElementById(containerId)
    if (container) container.replaceChildren()
    setError("")

    loadFinlogixWidget()
      .then((Widget) => {
        if (cancelled || !document.getElementById(containerId)) return
        Widget.init({
          type: "EarningCalendar",
          language: "en",
          importanceOptions: ["low", "medium", "high"],
          dateRangeOptions: [
            "recentAndNext",
            "today",
            "tomorrow",
            "thisWeek",
            "nextWeek",
            "thisMonth",
          ],
          isAdaptive: true,
          theme: isDarkTheme ? "dark" : "light",
          renderDocumentId: containerId,
        })
      })
      .catch(() => {
        if (!cancelled) setError("Earnings calendar is temporarily unavailable.")
      })

    return () => {
      cancelled = true
      document.getElementById(containerId)?.replaceChildren()
    }
  }, [containerId, isDarkTheme, resolvedTheme])

  return (
    <div className="relative h-[720px] min-h-[520px] w-full overflow-hidden rounded-lg bg-white dark:bg-slate-950">
      <div id={containerId} className="h-full w-full" />
      {error && (
        <div role="status" className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-muted-foreground">
          {error}
        </div>
      )}
    </div>
  )
}

export default memo(EarningsCalendarWidget)
