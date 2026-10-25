"use client"

import { useId, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Search, TrendingUp, TrendingDown, X } from "lucide-react"
import useMarketWatch from "@/hooks/use-market-watch"

export default function WatchlistManager() {
  const { data, isLoading } = useMarketWatch()
  const [symbols, setSymbols] = useState(() => data.map(({ id, symbol }) => ({ id, symbol })))
  const [query, setQuery] = useState("")
  const suggestionsId = useId()
  const search = query.trim().toLowerCase()
  const match = data.find((item) => item.symbol.toLowerCase() === search || item.id.toLowerCase() === search)
  const alreadyAdded = symbols.some((item) => item.id === match?.id || item.symbol.toLowerCase() === search)
  const visibleSymbols = symbols
    .filter((item) => `${item.symbol} ${item.id}`.toLowerCase().includes(search))
    .map((entry) => data.find((quote) => quote.id === entry.id) || {
      ...entry, price: "—", change: "—", changePercent: "—", trend: "neutral", error: "داده واقعی در دسترس نیست",
    })

  const addSymbol = (event) => {
    event.preventDefault()
    if (!search || alreadyAdded) return
    const nextSymbol = match
      ? { id: match.id, symbol: match.symbol }
      : { id: `custom:${search}`, symbol: query.trim().toUpperCase() }
    setSymbols((current) => [...current, nextSymbol])
    setQuery("")
  }

  return (
    <div className="space-y-3" dir="rtl">
      <form onSubmit={addSymbol} className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search aria-hidden="true" className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            list={suggestionsId}
            maxLength={40}
            placeholder="جست‌وجو یا افزودن نماد (مثلاً AAPL)"
            aria-label="جست‌وجو یا افزودن نماد"
            className="pr-9"
          />
          <datalist id={suggestionsId}>
            {data.map((item) => <option key={item.id} value={item.symbol} />)}
          </datalist>
        </div>
        <Button type="submit" size="sm" disabled={!search || alreadyAdded} className="gap-2">
          <Plus aria-hidden="true" className="h-4 w-4" />افزودن
        </Button>
      </form>
      <div className="space-y-2" aria-busy={isLoading}>
      {visibleSymbols.map((item) => (
        <div
          key={item.id}
          className="flex flex-wrap items-center justify-between gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{item.symbol}</Badge>
            <span className="font-medium" dir="ltr">{item.price}</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              dir="ltr"
              className={`text-sm ${item.trend === "up" ? "text-cyan-600" : item.trend === "down" ? "text-red-600" : "text-gray-600"}`}
              title={item.error || undefined}
            >
              {item.change} ({item.changePercent})
            </span>
            {item.trend === "up" ? (
              <TrendingUp className="h-4 w-4 text-cyan-500" />
            ) : item.trend === "down" ? (
              <TrendingDown className="h-4 w-4 text-red-500" />
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setSymbols((current) => current.filter((symbol) => symbol.id !== item.id))}
              aria-label={`حذف ${item.symbol}`}
              className="h-7 w-7 text-red-600 hover:text-red-700"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      ))}
      {visibleSymbols.length === 0 && <p role="status" className="py-2 text-sm text-muted-foreground">{search ? "نمادی پیدا نشد." : "نمادی در دیده‌بان نیست."}</p>}
      </div>
    </div>
  )
}
