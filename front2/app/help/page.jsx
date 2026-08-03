"use client"

import Layout from "@/components/kokonutui/layout"

export default function HelpPage() {
  return (
    <Layout>
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          Help & Documentation
        </h1>
        
        <div className="grid gap-6">
          <div className="bg-white dark:bg-[#1F1F23] rounded-lg p-6 border border-gray-200 dark:border-[#2A2A2E]">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Getting Started
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Welcome to GreenPeak Dash - your comprehensive S&P 500 analytics dashboard.
            </p>
            <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-2">
              <li>Navigate through different sections using the sidebar</li>
              <li>View real-time market data and analytics</li>
              <li>Customize your dashboard experience</li>
              <li>Track market sentiment and economic indicators</li>
            </ul>
          </div>
          
          <div className="bg-white dark:bg-[#1F1F23] rounded-lg p-6 border border-gray-200 dark:border-[#2A2A2E]">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Features
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">Analytics</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Comprehensive market analysis tools and indicators
                </p>
              </div>
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">S&P 500 Tracking</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Real-time index monitoring and historical data
                </p>
              </div>
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">Economic Data</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Macroeconomic indicators and monetary policy insights
                </p>
              </div>
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">Market Sentiment</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Track market sentiment and institutional flows
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-[#1F1F23] rounded-lg p-6 border border-gray-200 dark:border-[#2A2A2E]">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Support
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Need additional help? Contact our support team or check out these resources:
            </p>
            <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-2">
              <li>Documentation and user guides</li>
              <li>Video tutorials</li>
              <li>Community forums</li>
              <li>Contact support: support@GreenPeak.tech</li>
            </ul>
          </div>
        </div>
      </div>
    </Layout>
  )
}
