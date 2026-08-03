"use client"

import { useParams } from "next/navigation"
import Layout from "@/components/kokonutui/layout"
import FactorDetail from "@/components/analytics/factor-detail"

// Mock factor data for macroeconomic indicators
const factorData = {
  "nonfarm-payroll": {
    title: "Non-Farm Payroll",
    currentValue: "+187K",
    change: "-23K",
    trend: "down",
    description:
      "Monthly change in the number of employed persons in the United States, excluding farm workers, government employees, private household employees, and employees of nonprofit organizations",
    source: "Bureau of Labor Statistics",
    chartData: [
      { time: "2022-01-01", value: 467 },
      { time: "2022-06-01", value: 398 },
      { time: "2022-12-01", value: 223 },
      { time: "2023-01-01", value: 230 },
      { time: "2023-02-01", value: 210 },
      { time: "2023-03-01", value: 195 },
      { time: "2023-04-01", value: 175 },
      { time: "2023-05-01", value: 190 },
      { time: "2023-06-01", value: 187 },
    ],
  },
  "ism-pmi": {
    title: "ISM PMI Manufacturing",
    currentValue: "48.7",
    change: "-1.2",
    trend: "down",
    description:
      "Institute for Supply Management Purchasing Managers Index for Manufacturing - values above 50 indicate expansion, below 50 indicate contraction",
    source: "Institute for Supply Management",
    chartData: [
      { time: "2022-01-01", value: 57.6 },
      { time: "2022-06-01", value: 53.0 },
      { time: "2022-12-01", value: 48.4 },
      { time: "2023-01-01", value: 52.1 },
      { time: "2023-02-01", value: 51.3 },
      { time: "2023-03-01", value: 50.2 },
      { time: "2023-04-01", value: 49.8 },
      { time: "2023-05-01", value: 49.9 },
      { time: "2023-06-01", value: 48.7 },
    ],
  },
  "retail-sales": {
    title: "Retail Sales",
    currentValue: "+0.7%",
    change: "+0.2%",
    trend: "up",
    description: "Monthly percentage change in retail sales, measuring consumer spending on goods and services",
    source: "U.S. Census Bureau",
    chartData: [
      { time: "2022-01-01", value: 3.8 },
      { time: "2022-06-01", value: 1.0 },
      { time: "2022-12-01", value: -1.1 },
      { time: "2023-01-01", value: 0.3 },
      { time: "2023-02-01", value: 0.4 },
      { time: "2023-03-01", value: 0.5 },
      { time: "2023-04-01", value: 0.6 },
      { time: "2023-05-01", value: 0.5 },
      { time: "2023-06-01", value: 0.7 },
    ],
  },
  "consumer-confidence": {
    title: "Consumer Confidence Index",
    currentValue: "117.0",
    change: "+2.3",
    trend: "up",
    description:
      "Measures consumer confidence in the economy based on surveys of consumer attitudes and buying intentions",
    source: "The Conference Board",
    chartData: [
      { time: "2022-01-01", value: 110.5 },
      { time: "2022-06-01", value: 98.7 },
      { time: "2022-12-01", value: 108.3 },
      { time: "2023-01-01", value: 112.0 },
      { time: "2023-02-01", value: 113.5 },
      { time: "2023-03-01", value: 114.2 },
      { time: "2023-04-01", value: 115.1 },
      { time: "2023-05-01", value: 114.7 },
      { time: "2023-06-01", value: 117.0 },
    ],
  },
}

export default function MacroFactorDetailPage() {
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
      <FactorDetail factor={factor} category="macroeconomic" />
    </Layout>
  )
}
