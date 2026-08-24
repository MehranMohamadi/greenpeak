"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { TrendingUp, TrendingDown, Activity, Info, ExternalLink, Maximize2, Target, PieChart, BarChart3, Zap } from "lucide-react"
import { AnalysisFactorGrid, AnalysisOverviewGrid, AnalysisPageHeader, AnalysisPageShell } from "./analysis-page"

const MultiLineChart = dynamic(() => import("../charts/multi-line-chart"), { ssr: false })
const MiniChart = dynamic(() => import("./mini-chart"), { ssr: false })
const FullScreenChart = dynamic(() => import("./fullscreen-chart"), { ssr: false })

export default function MarketInternals() {
    const [selectedFactor, setSelectedFactor] = useState('breadth-ratio')
    const [selectedPeriod, setSelectedPeriod] = useState('5Y')
    const [isFullScreen, setIsFullScreen] = useState(false)

    // Market internals factors with mock data
    const marketInternalsFactors = [
        {
            id: "breadth-ratio",
            title: "Breadth (Adv/Decl)",
            category: "Market Breadth",
            currentValue: "1.8",
            change: "+0.3",
            trend: "up",
            description: "Advance/Decline ratio measuring market breadth",
            data: [
                { date: "2024-01-02", value: 1.2 },
                { date: "2024-02-01", value: 1.4 },
                { date: "2024-03-01", value: 1.5 },
                { date: "2024-04-01", value: 1.6 },
                { date: "2024-05-01", value: 1.7 },
                { date: "2024-06-01", value: 1.8 },
            ],
            source: "NYSE",
            benchmark: ">1.5 = Strong Breadth, 1.0-1.5 = Moderate, <1.0 = Weak"
        },
        {
            id: "volume",
            title: "Trading Volume",
            category: "Volume Analysis",
            currentValue: "4.2B",
            change: "+0.8B",
            trend: "up",
            description: "Daily trading volume across major exchanges",
            data: [
                { date: "2024-01-02", value: 3.1 },
                { date: "2024-02-01", value: 3.4 },
                { date: "2024-03-01", value: 3.6 },
                { date: "2024-04-01", value: 3.8 },
                { date: "2024-05-01", value: 4.0 },
                { date: "2024-06-01", value: 4.2 },
            ],
            source: "NYSE/NASDAQ",
            benchmark: ">5B = High Activity, 3-5B = Normal, <3B = Low Activity"
        },
        {
            id: "rsi-macd",
            title: "RSI/MACD",
            category: "Technical Momentum",
            currentValue: "65/Bullish",
            change: "+5/Signal",
            trend: "up",
            description: "RSI and MACD momentum indicators",
            data: [
                { date: "2024-01-02", value: 45 },
                { date: "2024-02-01", value: 52 },
                { date: "2024-03-01", value: 58 },
                { date: "2024-04-01", value: 61 },
                { date: "2024-05-01", value: 63 },
                { date: "2024-06-01", value: 65 },
            ],
            source: "Technical Analysis",
            benchmark: ">70 = Overbought, 30-70 = Normal, <30 = Oversold"
        },
        {
            id: "moving-averages",
            title: "Moving Averages",
            category: "Trend Analysis",
            currentValue: "Above 200MA",
            change: "+2.5%",
            trend: "up",
            description: "Position relative to key moving averages",
            data: [
                { date: "2024-01-02", value: 98.5 },
                { date: "2024-02-01", value: 100.2 },
                { date: "2024-03-01", value: 101.8 },
                { date: "2024-04-01", value: 102.1 },
                { date: "2024-05-01", value: 102.3 },
                { date: "2024-06-01", value: 102.5 },
            ],
            source: "Market Data",
            benchmark: ">200MA = Bullish, <200MA = Bearish, 50MA Cross = Signal"
        }
    ]

    // Calculate overall score
    const overallScore = (marketInternalsFactors.reduce((sum, factor) => sum + (factor.score || 7), 0) / marketInternalsFactors.length).toFixed(1)

    const getScoreColor = (score) => {
        if (score >= 8) return "text-green-600"
        if (score >= 6) return "text-yellow-600"
        return "text-red-600"
    }

    const getScoreBadge = (score) => {
        if (score >= 8) return { label: "Strong", color: "bg-green-100 text-green-800" }
        if (score >= 6) return { label: "Moderate", color: "bg-yellow-100 text-yellow-800" }
        return { label: "Weak", color: "bg-red-100 text-red-800" }
    }

    const getTrendIcon = (trend) => {
        switch (trend) {
            case "up":
                return <TrendingUp className="h-4 w-4 text-green-500" />
            case "down":
                return <TrendingDown className="h-4 w-4 text-red-500" />
            default:
                return <Activity className="h-4 w-4 text-gray-400" />
        }
    }

    const getTrendColor = (trend) => {
        switch (trend) {
            case "up":
                return "text-green-600 dark:text-green-400"
            case "down":
                return "text-red-600 dark:text-red-400"
            default:
                return "text-gray-600 dark:text-gray-400"
        }
    }

    const handleFactorClick = (factor) => {
        setSelectedFactor(factor.id)
    }

    // Get selected factor data
    const getSelectedFactor = () => {
        return marketInternalsFactors.find(factor => factor.id === selectedFactor) || marketInternalsFactors[0]
    }

    const selectedFactorObject = getSelectedFactor()
    const selectedFactorData = selectedFactorObject && Array.isArray(selectedFactorObject.data) && selectedFactorObject.data.length > 0 ?
        [selectedFactorObject.data] : []

    // Add source details for each factor
    const getSourceDetails = (factorId) => {
        switch (factorId) {
            case "breadth-ratio":
                return {
                    title: "Market Breadth (Advance/Decline)",
                    description: "Ratio of advancing stocks to declining stocks, measuring the breadth of market participation and underlying strength.",
                    provider: "NYSE",
                    frequency: "Daily",
                    availability: "1960 to Present",
                    methodology: "Number of advancing stocks divided by number of declining stocks across NYSE-listed securities.",
                    url: "https://www.nyse.com/market-data",
                    lastUpdated: "Updated daily after market close"
                }
            case "volume":
                return {
                    title: "Trading Volume",
                    description: "Total number of shares traded across major exchanges, indicating market activity and liquidity levels.",
                    provider: "NYSE/NASDAQ",
                    frequency: "Real-time",
                    availability: "1980 to Present",
                    methodology: "Aggregate daily trading volume across NYSE, NASDAQ, and other major US equity exchanges.",
                    url: "https://www.nasdaq.com/market-activity",
                    lastUpdated: "Updated real-time during market hours"
                }
            case "rsi-macd":
                return {
                    title: "RSI & MACD Indicators",
                    description: "Relative Strength Index and Moving Average Convergence Divergence, measuring momentum and trend strength.",
                    provider: "Technical Analysis",
                    frequency: "Daily",
                    availability: "Market data dependent",
                    methodology: "RSI: 14-period momentum oscillator. MACD: 12-day EMA minus 26-day EMA with 9-day signal line.",
                    url: "https://www.investopedia.com/terms/r/rsi.asp",
                    lastUpdated: "Updated daily with market close"
                }
            case "moving-averages":
                return {
                    title: "Moving Averages Analysis",
                    description: "Position of market indices relative to key moving averages (50-day, 200-day), indicating trend direction and strength.",
                    provider: "Market Data",
                    frequency: "Daily",
                    availability: "Historical data",
                    methodology: "Comparison of current price levels to simple moving averages over various time periods.",
                    url: "https://www.marketwatch.com/",
                    lastUpdated: "Updated daily with market data"
                }
            default:
                return {
                    title: "Data Source",
                    description: "Market internals data source information",
                    provider: "Financial Data Providers",
                    frequency: "Varies",
                    availability: "Historical data",
                    methodology: "Standard market internals measurement techniques",
                    url: "#",
                    lastUpdated: "Regular updates"
                }
        }
    }

    const getIconComponent = (factorId) => {
        switch (factorId) {
            case "breadth-ratio":
                return BarChart3
            case "volume":
                return Activity
            case "rsi-macd":
                return TrendingUp
            case "moving-averages":
                return PieChart
            default:
                return Zap
        }
    }

    return (
        <AnalysisPageShell className="fade-in">
            <AnalysisPageHeader page="market-internals" title="Market Internals Analysis" />

            {/* Top Section: Corporate Earnings Factor + Main Chart */}
            <AnalysisOverviewGrid className="mb-8">
                {/* Left: Selected Market Internals Factor (1/4 width) */}
                <Card className="lg:col-span-2 slide-in-left stagger-1 hover:shadow-lg transition-all duration-200 cursor-pointer group border border-gray-200 dark:border-[#2B2B30] shadow-sm bg-white dark:bg-[#1F1F23] card-glow">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 group-hover:text-orange-600 transition-all duration-200 text-base font-semibold">
                            <div className="p-1.5 bg-gradient-to-br from-orange-600 to-amber-600 rounded-lg shadow-md group-hover:scale-105 transition-transform duration-200">
                                <Activity className="h-4 w-4 text-white" />
                            </div>
                            Market Health
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="text-center group-hover:scale-105 transition-transform duration-300 p-3 bg-gray-50 dark:bg-[#0F0F12] rounded-xl border border-gray-200 dark:border-[#2B2B30]">
                            <div className={`text-4xl font-black ${getScoreColor(parseFloat(overallScore))} drop-shadow-lg mb-2 tracking-tight`}>
                                {overallScore}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-2">out of 10</div>
                            <Badge className={`mt-1 px-3 py-1 text-xs font-semibold ${getScoreBadge(parseFloat(overallScore)).color} group-hover:shadow-md transition-all duration-300 hover:scale-105`}>
                                {getScoreBadge(parseFloat(overallScore)).label}
                            </Badge>
                        </div>

                        {/* Key Insights */}
                        <div className="space-y-2">
                            <h4 className="font-semibold text-gray-900 dark:text-white text-xs">Key Insights</h4>
                            <div className="space-y-1 text-xs">
                                <div className="flex items-start gap-2 hover:bg-gray-50 dark:hover:bg-[#0F0F12] p-1.5 rounded-lg transition-all duration-200 cursor-pointer">
                                    <div className="w-1.5 h-1.5 bg-orange-500 rounded-full mt-1.5 flex-shrink-0"></div>
                                    <span className="leading-tight">Breadth improving</span>
                                </div>
                                <div className="flex items-start gap-2 hover:bg-gray-50 dark:hover:bg-[#0F0F12] p-1.5 rounded-lg transition-all duration-200 cursor-pointer">
                                    <div className="w-1.5 h-1.5 bg-amber-500 rounded-full mt-1.5 flex-shrink-0"></div>
                                    <span className="leading-tight">Volume elevated</span>
                                </div>
                                <div className="flex items-start gap-2 hover:bg-gray-50 dark:hover:bg-[#0F0F12] p-1.5 rounded-lg transition-all duration-200 cursor-pointer">
                                    <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full mt-1.5 flex-shrink-0"></div>
                                    <span className="leading-tight">Momentum bullish</span>
                                </div>
                            </div>
                        </div>

                        {/* Market Outlook */}
                        <div className="space-y-2">
                            <h4 className="font-semibold text-gray-900 dark:text-white text-xs">Market Outlook</h4>
                            <div className="space-y-1 text-xs">
                                <div className="flex items-center justify-between hover:bg-gray-50 dark:hover:bg-[#0F0F12] p-1.5 rounded-lg transition-all duration-200 cursor-pointer">
                                    <span>Breadth</span>
                                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs hover:shadow-md transition-all duration-200 hover:scale-105">Healthy</Badge>
                                </div>
                                <div className="flex items-center justify-between hover:bg-gray-50 dark:hover:bg-[#0F0F12] p-1.5 rounded-lg transition-all duration-200 cursor-pointer">
                                    <span>Momentum</span>
                                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs hover:shadow-md transition-all duration-200 hover:scale-105">Bullish</Badge>
                                </div>
                                <div className="flex items-center justify-between hover:bg-gray-50 dark:hover:bg-[#0F0F12] p-1.5 rounded-lg transition-all duration-200 cursor-pointer">
                                    <span>Trend</span>
                                    <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs hover:shadow-md transition-all duration-200 hover:scale-105">Uptrend</Badge>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Right: Main Chart (3/4 width) */}
                <Card className="lg:col-span-5 slide-in-right stagger-2 hover:shadow-lg transition-all duration-200 border border-gray-200 dark:border-[#2B2B30] shadow-sm bg-white dark:bg-[#1F1F23] card-glow">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center justify-between text-lg font-semibold">
                            <div className="flex items-center gap-3">
                                {selectedFactorObject ? (
                                    <div className="flex items-center gap-2">
                                        {(() => {
                                            const IconComponent = getIconComponent(selectedFactorObject.id)
                                            return <IconComponent className="h-5 w-5 text-orange-600" />
                                        })()}
                                        {selectedFactorObject.title}
                                    </div>
                                ) : (
                                    <span>Select a factor to view detailed chart</span>
                                )}
                                {selectedFactorObject && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setIsFullScreen(true)}
                                        className="h-8 w-8 p-0 ml-2 hover:bg-orange-50 dark:hover:bg-orange-900 hover:scale-105 transition-all duration-200 hover:shadow-md"
                                        title="Full Screen"
                                    >
                                        <Maximize2 className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                            <div className="flex gap-2">
                                {['1M', '6M', '1Y', '5Y', '10Y', '25Y', 'MAX'].map((period) => (
                                    <Button
                                        key={period}
                                        variant={selectedPeriod === period ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => setSelectedPeriod(period)}
                                        className="transition-all  text-xs duration-200 hover:scale-105 hover:shadow-md"
                                    >
                                        {period}
                                    </Button>
                                ))}
                            </div>
                        </CardTitle>
                        <CardDescription className="flex flex-wrap items-center gap-4 text-sm mt-2">
                            <span>
                                Current: {selectedFactorObject.currentValue} |
                                <span className={`ml-1 ${getTrendColor(selectedFactorObject.trend)}`}>
                                    {selectedFactorObject.change}
                                </span>
                            </span>
                            <span className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                                <span>Source: {selectedFactorObject.source}</span>
                            </span>
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div className="h-80 w-full">
                            {selectedFactorObject ? (
                                <MultiLineChart dataSets={selectedFactorData} />
                            ) : (
                                <div className="flex items-center justify-center h-full text-gray-500 text-base">
                                    Click on any factor below to view its detailed chart
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </AnalysisOverviewGrid>

            {/* Bottom Section: Market Internals Factors Grid */}
            <AnalysisFactorGrid title="Market Internals Factors" className="gap-6 slide-in-up">
                    {marketInternalsFactors.map((factor, index) => {
                        const IconComponent = getIconComponent(factor.id)
                        return (
                            <Card
                                key={factor.id}
                                className={`cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] hover:-translate-y-1 ${selectedFactor === factor.id ? 'ring-2 ring-orange-500 shadow-lg scale-[1.02] bg-orange-50 dark:bg-orange-950/30' : ''
                                    } slide-in-up stagger-${(index % 6) + 1} border border-gray-200 dark:border-[#2B2B30] shadow-sm bg-white dark:bg-[#1F1F23] group card-glow`}
                                onClick={() => handleFactorClick(factor)}
                            >
                                <CardHeader className="pb-3">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                                            <IconComponent className="h-4 w-4" />
                                            {factor.title}
                                        </CardTitle>
                                        <div className="flex items-center gap-2">
                                            {getTrendIcon(factor.trend)}
                                            <Dialog>
                                                <DialogTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-6 w-6 p-0 hover:bg-gray-100 dark:hover:bg-[#0F0F12]"
                                                        title="View Source Details"
                                                    >
                                                        <Info className="h-3 w-3" />
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent className="max-w-lg bg-white dark:bg-[#1F1F23] border border-gray-200 dark:border-[#2B2B30]">
                                                    <DialogHeader>
                                                        <DialogTitle className="flex items-center gap-2">
                                                            {(() => {
                                                                const IconComponent = getIconComponent(factor.id)
                                                                return <IconComponent className="h-5 w-5 text-orange-600" />
                                                            })()}
                                                            {getSourceDetails(factor.id).title}
                                                        </DialogTitle>
                                                        <DialogDescription asChild>
                                                            <div className="space-y-4 text-left">
                                                                <p className="text-sm text-gray-700 dark:text-gray-300">
                                                                    {getSourceDetails(factor.id).description}
                                                                </p>
                                                                <div className="space-y-3 text-sm">
                                                                    <div className="grid grid-cols-2 gap-4">
                                                                        <div>
                                                                            <div className="font-semibold text-gray-900 dark:text-white">Provider</div>
                                                                            <div className="text-gray-600 dark:text-gray-400">{getSourceDetails(factor.id).provider}</div>
                                                                        </div>
                                                                        <div>
                                                                            <div className="font-semibold text-gray-900 dark:text-white">Frequency</div>
                                                                            <div className="text-gray-600 dark:text-gray-400">{getSourceDetails(factor.id).frequency}</div>
                                                                        </div>
                                                                    </div>
                                                                    <div className="grid grid-cols-2 gap-4">
                                                                        <div>
                                                                            <div className="font-semibold text-gray-900 dark:text-white">Data Range</div>
                                                                            <div className="text-gray-600 dark:text-gray-400">{getSourceDetails(factor.id).availability}</div>
                                                                        </div>
                                                                        <div>
                                                                            <div className="font-semibold text-gray-900 dark:text-white">Updates</div>
                                                                            <div className="text-gray-600 dark:text-gray-400">{getSourceDetails(factor.id).lastUpdated}</div>
                                                                        </div>
                                                                    </div>
                                                                    <div>
                                                                        <div className="font-semibold text-gray-900 dark:text-white">Methodology</div>
                                                                        <div className="text-gray-600 dark:text-gray-400 text-xs leading-relaxed">{getSourceDetails(factor.id).methodology}</div>
                                                                    </div>
                                                                    <div className="pt-2 border-t border-gray-200 dark:border-[#2B2B30]">
                                                                        <a
                                                                            href={getSourceDetails(factor.id).url}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 hover:underline text-sm font-medium"
                                                                        >
                                                                            <ExternalLink className="h-4 w-4" />
                                                                            View Original Data Source
                                                                        </a>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </DialogDescription>
                                                    </DialogHeader>
                                                </DialogContent>
                                            </Dialog>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between mt-2">
                                        <span className="text-2xl font-bold text-gray-900 dark:text-white">
                                            {factor.currentValue}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-base font-medium ${getTrendColor(factor.trend)}`}>
                                                {factor.change}
                                            </span>
                                            <Badge className="text-sm bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 px-2 py-1">
                                                {factor.category}
                                            </Badge>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-0">
                                    <div className="h-20 mb-4 p-2 bg-transparent rounded-lg transition-all duration-300">
                                        <MiniChart
                                            data={factor.data}
                                            trend={factor.trend}
                                        />
                                    </div>
                                    <p className="text-base text-gray-600 dark:text-gray-400 line-clamp-3 mb-3 group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors duration-300 leading-relaxed">
                                        {factor.description}
                                    </p>
                                    <div className="flex items-center justify-between text-sm text-gray-500">
                                        <div className="flex items-center gap-1">
                                            <Badge className={`text-xs transition-all duration-300 hover:scale-105 ${
                                                factor.trend === 'up' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 hover:bg-green-200' : 
                                                factor.trend === 'down' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 hover:bg-red-200' : 
                                                'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200 hover:bg-gray-200'
                                            } px-2 py-1`}>
                                                {factor.trend === 'up' ? 'Bullish' : factor.trend === 'down' ? 'Bearish' : 'Neutral'}
                                            </Badge>
                                            <span className="text-xs">Signal</span>
                                        </div>
                                        <span className="truncate text-sm group-hover:text-gray-600 dark:group-hover:text-gray-400 transition-colors duration-300">{factor.source}</span>
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })}
            </AnalysisFactorGrid>

            {/* Full Screen Chart Modal */}
            {isFullScreen && <FullScreenChart
                isOpen={isFullScreen}
                onClose={() => setIsFullScreen(false)}
                selectedFactor={selectedFactorObject}
            />}
        </AnalysisPageShell>
    )
}
