"use client"

import { memo, useEffect, useRef } from "react"
import { useTheme } from "next-themes"

function EconomicCalendarWidget() {
  const container = useRef<HTMLDivElement | null>(null)
  const { theme, resolvedTheme } = useTheme()
  const isDarkTheme =
    resolvedTheme === "dark" || theme === "trading-dark" || theme === "terminal"

  useEffect(() => {
    const currentContainer = container.current

    if (!currentContainer || !resolvedTheme) return

    const widget = currentContainer.querySelector("#economicCalendarWidget")
    widget?.querySelector("iframe")?.remove()

    const calendarWindow = window as Window & { calendarCompletedID?: string[] }
    const completedIndex = calendarWindow.calendarCompletedID?.indexOf(
      "economicCalendarWidget"
    )

    if (completedIndex !== undefined && completedIndex >= 0) {
      calendarWindow.calendarCompletedID?.splice(completedIndex, 1)
    }

    const script = document.createElement("script")
    script.src = "https://www.tradays.com/c/js/widgets/calendar/widget.js?v=15"
    script.type = "text/javascript"
    script.async = true
    script.dataset.type = "calendar-widget"
    script.innerHTML = JSON.stringify({
      width: "100%",
      height: "100%",
      mode: "2",
      fw: "react",
      theme: isDarkTheme ? 1 : 0,
    })

    currentContainer.appendChild(script)

    return () => {
      script.remove()
    }
  }, [isDarkTheme, resolvedTheme])

  return (
    <div
      ref={container}
      className="h-[720px] min-h-[520px] w-full overflow-hidden rounded-lg bg-white dark:bg-slate-950"
    >
      <div id="economicCalendarWidget" className="h-full w-full" />
      <div className="ecw-copyright sr-only">
        <a
          href="https://www.metatrader.com/?utm_source=calendar.widget&utm_medium=link&utm_term=economic.calendar&utm_content=visit.mql5.calendar&utm_campaign=202.calendar.widget"
          rel="noopener nofollow"
          target="_blank"
        >
          MetaTrader World Markets
        </a>
      </div>
    </div>
  )
}

export default memo(EconomicCalendarWidget)
