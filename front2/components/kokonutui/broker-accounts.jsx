"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, TrendingDown, Building2 } from "lucide-react"
import LoadingCard from "../ui/loading-card"

const BROKER_ACCOUNTS = [
  {
    id: "1",
    brokerName: "Interactive Brokers",
    accountNumber: "U1234567",
    balance: 125430.5,
    dayPnL: 2340.75,
    dayPnLPercent: 1.89,
    status: "active",
  },
  {
    id: "2",
    brokerName: "TD Ameritrade",
    accountNumber: "987654321",
    balance: 87650.0,
    dayPnL: -890.25,
    dayPnLPercent: -1.01,
    status: "active",
  },
  {
    id: "3",
    brokerName: "Charles Schwab",
    accountNumber: "CS789012",
    balance: 234500.0,
    dayPnL: 1250.0,
    dayPnLPercent: 0.53,
    status: "active",
  },
]

export default function BrokerAccounts() {
  const [accounts, setAccounts] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setTimeout(() => {
      setAccounts(BROKER_ACCOUNTS)
      setIsLoading(false)
    }, 1000)
  }, [])

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount)
  }

  const formatPercent = (percent) => {
    return `${percent > 0 ? "+" : ""}${percent.toFixed(2)}%`
  }

  const getTotalBalance = () => {
    return accounts.reduce((sum, account) => sum + account.balance, 0)
  }

  const getTotalDayPnL = () => {
    return accounts.reduce((sum, account) => sum + account.dayPnL, 0)
  }

  if (isLoading) {
    return <LoadingCard height="h-80" />
  }

  return (
    <Card className="bg-white dark:bg-[#1F1F23] border-gray-200 dark:border-[#2B2B30] shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2">
          <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          Broker Accounts
          <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
        </CardTitle>
        <div className="text-gray-600 dark:text-gray-400 text-sm">
          Total: {formatCurrency(getTotalBalance())} | Day P&L:{" "}
          <span
            className={getTotalDayPnL() >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}
          >
            {formatCurrency(getTotalDayPnL())}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 max-h-64 overflow-y-auto">
        {accounts.map((account) => (
          <div
            key={account.id}
            className="p-3 rounded-lg bg-gray-50 dark:bg-[#0F0F12] border border-gray-200 dark:border-[#2B2B30] hover:bg-gray-100 dark:hover:bg-[#1F1F23] transition-all duration-200"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-gray-900 dark:text-white">{account.brokerName}</h3>
                <div
                  className={`w-2 h-2 rounded-full animate-pulse ${account.dayPnL >= 0 ? "bg-green-400" : "bg-red-400"}`}
                ></div>
              </div>
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800">
                {account.status}
              </Badge>
            </div>

            <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">{account.accountNumber}</p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Balance</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(account.balance)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Day P&L</p>
                <div className="flex items-center gap-1">
                  <span
                    className={`text-lg font-bold ${account.dayPnL >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
                  >
                    {formatCurrency(account.dayPnL)}
                  </span>
                  {account.dayPnL >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-green-500 animate-pulse" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-500 animate-pulse" />
                  )}
                </div>
                <p
                  className={`text-xs ${account.dayPnL >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
                >
                  {formatPercent(account.dayPnLPercent)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
