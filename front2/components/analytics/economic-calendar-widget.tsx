"use client"

import { memo } from "react"
import { useTheme } from "next-themes"

function EconomicCalendarWidget() {
  const { theme, resolvedTheme } = useTheme()
  const isDarkTheme =
    resolvedTheme === "dark" || theme === "trading-dark" || theme === "terminal"
  const calendarUrl = `https://www.tradays.com/en/economic-calendar/widget?mode=2&theme=${isDarkTheme ? 1 : 0}&fw=react&importance=12&currencies=1&utm_source=greenpeak`

  return (
    <div className="h-[720px] min-h-[520px] w-full overflow-hidden rounded-lg bg-white dark:bg-slate-950">
      {resolvedTheme && <iframe
        key={calendarUrl}
        title="United States economic calendar with medium and high importance events"
        src={calendarUrl}
        className="h-full w-full border-0"
      />}
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
