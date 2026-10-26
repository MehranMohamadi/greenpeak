"use client"

import { useId, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Search, X } from "lucide-react"
import { MARKET_WATCH_SYMBOLS } from "@/hooks/use-market-watch"

export default function WatchlistManager({ symbols: savedSymbols, onSymbolsChange }) {
  const [localSymbols, setLocalSymbols] = useState(() => [...MARKET_WATCH_SYMBOLS])
  const symbols = savedSymbols ?? localSymbols
  const setSymbols = (update) => {
    const next = update(symbols)
    setLocalSymbols(next)
    onSymbolsChange?.(next)
  }
  const [query, setQuery] = useState("")
  const suggestionsId = useId()
  const search = query.trim().toLowerCase()
  const match = MARKET_WATCH_SYMBOLS.find((item) => item.symbol.toLowerCase() === search || item.id.toLowerCase() === search)
  const alreadyAdded = symbols.some((item) => item.id === match?.id || item.symbol.toLowerCase() === search)
  const visibleSymbols = symbols
    .filter((item) => `${item.symbol} ${item.id}`.toLowerCase().includes(search))

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
            placeholder="جست‌وجو یا افزودن نماد"
            aria-label="جست‌وجو یا افزودن نماد"
            className="pr-9"
          />
          <datalist id={suggestionsId}>
            {MARKET_WATCH_SYMBOLS.map((item) => <option key={item.id} value={item.symbol} />)}
          </datalist>
        </div>
        <Button type="submit" size="sm" disabled={!search || alreadyAdded} className="gap-2">
          <Plus aria-hidden="true" className="h-4 w-4" />افزودن
        </Button>
      </form>
      <ul className="flex flex-wrap gap-2" aria-label="نمادهای دیده‌بان">
        {visibleSymbols.map((item) => (
          <li key={item.id} className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-lg border bg-muted/40 py-1 pe-1 ps-3">
            <span className="min-w-0 break-words text-sm" dir="auto">{item.symbol}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setSymbols((current) => current.filter((symbol) => symbol.id !== item.id))}
              aria-label={`حذف ${item.symbol}`}
              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-red-600"
            >
              <X className="h-3 w-3" />
            </Button>
          </li>
        ))}
      </ul>
      {visibleSymbols.length === 0 && <p role="status" className="py-2 text-sm text-muted-foreground">{search ? "نمادی پیدا نشد." : "نمادی در دیده‌بان نیست."}</p>}
    </div>
  )
}
