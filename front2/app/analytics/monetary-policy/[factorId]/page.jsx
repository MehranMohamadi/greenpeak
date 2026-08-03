"use client"

import { useParams } from "next/navigation"
import Layout from "@/components/kokonutui/layout"
import FactorDetail from "@/components/analytics/factor-detail"

// Mock factor data - in real app, this would come from API
const factorData = {
  "fed-balance-sheet": {
    title: "Federal Reserve Balance Sheet",
    currentValue: "$7.8T",
    change: "-2.1%",
    trend: "down",
    description:
      "Total assets held by the Federal Reserve including Treasury securities, mortgage-backed securities, and other assets",
    source: "Federal Reserve",
    chartData: [
      { time: "2022-01-01", value: 8.9 },
      { time: "2022-06-01", value: 8.8 },
      { time: "2022-12-01", value: 8.6 },
      { time: "2023-01-01", value: 8.2 },
      { time: "2023-02-01", value: 8.1 },
      { time: "2023-03-01", value: 8.0 },
      { time: "2023-04-01", value: 7.9 },
      { time: "2023-05-01", value: 7.8 },
      { time: "2023-06-01", value: 7.8 },
    ],
  },
  "money-supply-m2": {
    title: "Money Supply (M2)",
    currentValue: "$21.7T",
    change: "-1.8%",
    trend: "down",
    description:
      "M2 money supply includes cash, checking deposits, savings deposits, money market securities, mutual funds, and other time deposits",
    source: "FRED",
    chartData: [
      { time: "2022-01-01", value: 21.8 },
      { time: "2022-06-01", value: 21.9 },
      { time: "2022-12-01", value: 21.8 },
      { time: "2023-01-01", value: 22.1 },
      { time: "2023-02-01", value: 21.9 },
      { time: "2023-03-01", value: 21.8 },
      { time: "2023-04-01", value: 21.7 },
      { time: "2023-05-01", value: 21.7 },
      { time: "2023-06-01", value: 21.7 },
    ],
  },
  "real-interest-rate": {
    title: "Real Interest Rate",
    currentValue: "2.5%",
    change: "+0.3%",
    trend: "up",
    description:
      "Real interest rate calculated as nominal interest rate minus inflation rate, using TIPS yields as a proxy",
    source: "FRED",
    chartData: [
      { time: "2022-01-01", value: -1.2 },
      { time: "2022-06-01", value: -0.8 },
      { time: "2022-12-01", value: 1.2 },
      { time: "2023-01-01", value: 2.0 },
      { time: "2023-02-01", value: 2.1 },
      { time: "2023-03-01", value: 2.2 },
      { time: "2023-04-01", value: 2.3 },
      { time: "2023-05-01", value: 2.4 },
      { time: "2023-06-01", value: 2.5 },
    ],
  },
  "sofr-rate": {
    title: "SOFR Rate",
    currentValue: "5.35%",
    change: "+0.25%",
    trend: "up",
    description:
      "Secured Overnight Financing Rate - the benchmark interest rate for dollar-denominated derivatives and loans",
    source: "ICE",
    chartData: [
      { time: "2022-01-01", value: 0.05 },
      { time: "2022-06-01", value: 1.5 },
      { time: "2022-12-01", value: 4.3 },
      { time: "2023-01-01", value: 4.8 },
      { time: "2023-02-01", value: 5.0 },
      { time: "2023-03-01", value: 5.1 },
      { time: "2023-04-01", value: 5.2 },
      { time: "2023-05-01", value: 5.3 },
      { time: "2023-06-01", value: 5.35 },
    ],
  },
}

export default function FactorDetailPage() {
  const params = useParams()
  const factor = factorData[params.factorId]

  if (!factor) {
    return (
      <Layout>
        <div className="p-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Factor not found</h1>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <FactorDetail factor={factor} category="monetary-policy" />
    </Layout>
  )
}
