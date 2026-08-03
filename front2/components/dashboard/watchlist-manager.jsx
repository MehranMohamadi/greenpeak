"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Star, Plus, X, TrendingUp, TrendingDown } from "lucide-react"

export default function WatchlistManager() {
  const [watchlists, setWatchlists] = useState([
    {
      id: 1,
      name: "Tech Stocks",
      symbols: [
        { symbol: "AAPL", price: "175.43", change: "+2.34", changePercent: "+1.35%", trend: "up" },
        { symbol: "MSFT", price: "378.85", change: "-1.23", changePercent: "-0.32%", trend: "down" },
        { symbol: "GOOGL", price: "138.21", change: "+0.87", changePercent: "+0.63%", trend: "up" },
      ],
    },
    {
      id: 2,
      name: "Crypto",
      symbols: [
        { symbol: "BTC", price: "43,250", change: "+1,234", changePercent: "+2.94%", trend: "up" },
        { symbol: "ETH", price: "2,587", change: "-45", changePercent: "-1.71%", trend: "down" },
      ],
    },
  ])

  const [newSymbol, setNewSymbol] = useState("")
  const [selectedWatchlist, setSelectedWatchlist] = useState(null)
  const [isAddingWatchlist, setIsAddingWatchlist] = useState(false)
  const [newWatchlistName, setNewWatchlistName] = useState("")

  const addSymbolToWatchlist = (watchlistId) => {
    if (!newSymbol.trim()) return

    setWatchlists((prev) =>
      prev.map((watchlist) =>
        watchlist.id === watchlistId
          ? {
              ...watchlist,
              symbols: [
                ...watchlist.symbols,
                {
                  symbol: newSymbol.toUpperCase(),
                  price: "0.00",
                  change: "0.00",
                  changePercent: "0.00%",
                  trend: "neutral",
                },
              ],
            }
          : watchlist,
      ),
    )
    setNewSymbol("")
  }

  const removeSymbolFromWatchlist = (watchlistId, symbolToRemove) => {
    setWatchlists((prev) =>
      prev.map((watchlist) =>
        watchlist.id === watchlistId
          ? {
              ...watchlist,
              symbols: watchlist.symbols.filter((s) => s.symbol !== symbolToRemove),
            }
          : watchlist,
      ),
    )
  }

  const createNewWatchlist = () => {
    if (!newWatchlistName.trim()) return

    const newWatchlist = {
      id: Date.now(),
      name: newWatchlistName,
      symbols: [],
    }

    setWatchlists((prev) => [...prev, newWatchlist])
    setNewWatchlistName("")
    setIsAddingWatchlist(false)
  }

  const deleteWatchlist = (watchlistId) => {
    setWatchlists((prev) => prev.filter((w) => w.id !== watchlistId))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">My Watchlists</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsAddingWatchlist(true)}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          New Watchlist
        </Button>
      </div>

      {/* Create New Watchlist */}
      {isAddingWatchlist && (
        <Card className="border-dashed">
          <CardContent className="p-4">
            <div className="flex gap-2">
              <Input
                placeholder="Watchlist name"
                value={newWatchlistName}
                onChange={(e) => setNewWatchlistName(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && createNewWatchlist()}
              />
              <Button onClick={createNewWatchlist}>Create</Button>
              <Button variant="outline" onClick={() => setIsAddingWatchlist(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Watchlists */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {watchlists.map((watchlist) => (
          <Card key={watchlist.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Star className="h-4 w-4 text-yellow-500" />
                  {watchlist.name}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteWatchlist(watchlist.id)}
                  className="text-red-600 hover:text-red-700"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <CardDescription>{watchlist.symbols.length} symbols</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Add Symbol */}
              <div className="flex gap-2">
                <Input
                  placeholder="Add symbol (e.g., AAPL)"
                  value={newSymbol}
                  onChange={(e) => setNewSymbol(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && addSymbolToWatchlist(watchlist.id)}
                />
                <Button size="sm" onClick={() => addSymbolToWatchlist(watchlist.id)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* Symbols */}
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {watchlist.symbols.map((symbol) => (
                  <div
                    key={symbol.symbol}
                    className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{symbol.symbol}</Badge>
                      <span className="font-medium">${symbol.price}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm ${symbol.trend === "up" ? "text-green-600" : symbol.trend === "down" ? "text-red-600" : "text-gray-600"}`}
                      >
                        {symbol.change} ({symbol.changePercent})
                      </span>
                      {symbol.trend === "up" ? (
                        <TrendingUp className="h-4 w-4 text-green-500" />
                      ) : symbol.trend === "down" ? (
                        <TrendingDown className="h-4 w-4 text-red-500" />
                      ) : null}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSymbolFromWatchlist(watchlist.id, symbol.symbol)}
                        className="text-red-600 hover:text-red-700 p-1"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
