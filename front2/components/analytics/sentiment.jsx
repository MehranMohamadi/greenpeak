"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { MessageSquare, ChevronUp, ChevronDown, Info, ExternalLink, Users, Brain, Target, Gauge, TrendingUp, Activity, Calendar, Clock, Database } from "lucide-react"
import dynamic from 'next/dynamic'

const MultiLineChart = dynamic(() => import('../charts/multi-line-chart'), { ssr: false })
const FullScreenChart = dynamic(() => import('./fullscreen-chart'), { ssr: false })

export default function SentimentAnalysis() {
    const [selectedFactor, setSelectedFactor] = useState('fear-greed-index')
    const [selectedPeriod, setSelectedPeriod] = useState('5Y')
    const [isFullScreen, setIsFullScreen] = useState(false)

    // Sentiment factors with mock data
    const sentimentFactors = [
        {
            id: "fear-greed-index",
            name: "Fear & Greed Index",
            value: "72",
            change: "+8",
            changePercent: "+12.5%",
            trend: "up",
            description: "CNN Fear & Greed Index measuring market sentiment",
            category: "Composite Sentiment"
        },
        {
            id: "vix-sentiment",
            name: "VIX Sentiment",
            value: "18.5",
            change: "-2.3",
            changePercent: "-11.0%",
            trend: "down",
            description: "Volatility index reflecting market fear and uncertainty",
            category: "Volatility"
        },
        {
            id: "put-call-ratio",
            name: "Put/Call Ratio",
            value: "0.85",
            change: "-0.12",
            changePercent: "-12.4%",
            trend: "down",
            description: "Ratio of put options to call options traded",
            category: "Options Flow"
        },
        {
            id: "aaii-sentiment",
            name: "AAII Sentiment",
            value: "42%",
            change: "+5%",
            changePercent: "+13.5%",
            trend: "up",
            description: "American Association of Individual Investors bullish sentiment",
            category: "Retail Sentiment"
        },
        {
            id: "margin-debt",
            name: "Margin Debt",
            value: "$912B",
            change: "+$23B",
            changePercent: "+2.6%",
            trend: "up",
            description: "NYSE margin debt indicating investor leverage and confidence",
            category: "Leverage"
        },
        {
            id: "social-sentiment",
            name: "Social Media Sentiment",
            value: "68",
            change: "+12",
            changePercent: "+21.4%",
            trend: "up",
            description: "Aggregate social media sentiment score from Twitter/Reddit",
            category: "Social Media"
        }
    ]

    const currentFactor = sentimentFactors.find(factor => factor.id === selectedFactor) || sentimentFactors[0]
    const selectedFactorObject = currentFactor

    // Mock chart data for the selected factor
    const chartData = [
        { date: '2023-01', value: 35, category: 'Fear & Greed' },
        { date: '2023-02', value: 42, category: 'Fear & Greed' },
        { date: '2023-03', value: 38, category: 'Fear & Greed' },
        { date: '2023-04', value: 55, category: 'Fear & Greed' },
        { date: '2023-05', value: 61, category: 'Fear & Greed' },
        { date: '2023-06', value: 58, category: 'Fear & Greed' },
        { date: '2023-07', value: 65, category: 'Fear & Greed' },
        { date: '2023-08', value: 72, category: 'Fear & Greed' },
        { date: '2023-09', value: 69, category: 'Fear & Greed' },
        { date: '2023-10', value: 74, category: 'Fear & Greed' },
        { date: '2023-11', value: 71, category: 'Fear & Greed' },
        { date: '2023-12', value: 72, category: 'Fear & Greed' }
    ]

    // Add source details for each factor
    const getSourceDetails = (factorId) => {
        switch (factorId) {
            case "fear-greed-index":
                return {
                    title: "CNN Fear & Greed Index",
                    description: "Composite sentiment indicator measuring market emotions through seven key metrics including volatility, momentum, safe haven demand, and options activity.",
                    provider: "CNN Business",
                    frequency: "Daily",
                    availability: "2012 to Present",
                    methodology: "Weighted average of seven indicators: stock price momentum, stock price strength, stock price breadth, put/call options, junk bond demand, market volatility, and safe haven demand.",
                    url: "https://www.cnn.com/markets/fear-and-greed",
                    lastUpdated: "Updated daily during market hours"
                }
            case "vix-sentiment":
                return {
                    title: "VIX Volatility Index",
                    description: "CBOE Volatility Index measuring expected 30-day volatility of S&P 500 based on option prices, often called the 'fear gauge' of the market.",
                    provider: "CBOE (Chicago Board Options Exchange)",
                    frequency: "Real-time",
                    availability: "1990 to Present",
                    methodology: "Calculated using SPX option prices across multiple strikes and expirations, representing market's expectation of 30-day volatility.",
                    url: "https://www.cboe.com/tradable_products/vix/",
                    lastUpdated: "Updated continuously during market hours"
                }
            case "put-call-ratio":
                return {
                    title: "Put/Call Ratio",
                    description: "Ratio of put option volume to call option volume, serving as a contrarian sentiment indicator where high ratios suggest bearish sentiment.",
                    provider: "CBOE",
                    frequency: "Daily",
                    availability: "1995 to Present",
                    methodology: "Total put option volume divided by total call option volume across all equity options, calculated on a rolling basis.",
                    url: "https://www.cboe.com/us/options/market_statistics/",
                    lastUpdated: "Updated daily after market close"
                }
            case "aaii-sentiment":
                return {
                    title: "AAII Investor Sentiment Survey",
                    description: "Weekly survey of individual investors asking whether they think the stock market will be higher, lower, or unchanged in six months.",
                    provider: "American Association of Individual Investors",
                    frequency: "Weekly",
                    availability: "1987 to Present",
                    methodology: "Survey of AAII members asking for market direction over next 6 months, with responses categorized as bullish, bearish, or neutral.",
                    url: "https://www.aaii.com/sentimentsurvey",
                    lastUpdated: "Updated weekly on Thursday"
                }
            case "margin-debt":
                return {
                    title: "NYSE Margin Debt",
                    description: "Total margin debt outstanding on the New York Stock Exchange, indicating investor leverage and risk appetite in the market.",
                    provider: "NYSE (New York Stock Exchange)",
                    frequency: "Monthly",
                    availability: "1959 to Present",
                    methodology: "Total dollar amount of margin loans outstanding from NYSE member firms to customers for stock purchases.",
                    url: "https://www.nyse.com/publicdocs/nyse/data/NYSE_margin_debt.pdf",
                    lastUpdated: "Updated monthly, typically mid-month"
                }
            case "social-sentiment":
                return {
                    title: "Social Media Sentiment",
                    description: "Aggregate sentiment score derived from social media platforms including Twitter, Reddit, and financial forums using natural language processing.",
                    provider: "Various Social Media APIs",
                    frequency: "Real-time",
                    availability: "2015 to Present",
                    methodology: "NLP analysis of financial discussions on social media platforms, weighted by user engagement and platform influence.",
                    url: "https://www.socialmediasentiment.com/",
                    lastUpdated: "Updated in real-time"
                }
            default:
                return {
                    title: "Data Source",
                    description: "Sentiment data source information",
                    provider: "Financial Data Providers",
                    frequency: "Varies",
                    availability: "Historical data",
                    methodology: "Standard sentiment measurement techniques",
                    url: "#",
                    lastUpdated: "Regular updates"
                }
        }
    }

    const getIconComponent = (factorId) => {
        switch (factorId) {
            case "fear-greed-index":
                return Gauge
            case "vix-sentiment":
                return Activity
            case "put-call-ratio":
                return Target
            case "aaii-sentiment":
                return Users
            case "margin-debt":
                return TrendingUp
            case "social-sentiment":
                return MessageSquare
            default:
                return Brain
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
                <div className="flex items-center gap-3">
                    <MessageSquare className="h-8 w-8 text-purple-600" />
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                            Sentiment Analysis
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">
                            Market psychology, investor sentiment, and behavioral indicators
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Score Card - 1/4 width */}
                <div className="lg:col-span-1">
                    <Card className="border-purple-200 dark:border-purple-800">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg text-purple-700 dark:text-purple-300 flex items-center gap-2">
                                <MessageSquare className="h-5 w-5" />
                                Sentiment Health
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600 dark:text-gray-400">Fear & Greed</span>
                                    <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                        Greed
                                    </Badge>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600 dark:text-gray-400">Volatility</span>
                                    <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                        Low
                                    </Badge>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600 dark:text-gray-400">Social Media</span>
                                    <Badge variant="secondary" className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                                        Bullish
                                    </Badge>
                                </div>
                            </div>
                            
                            <Separator className="my-4" />
                            
                            <div className="space-y-2">
                                <h4 className="font-medium text-gray-900 dark:text-white">Key Insights</h4>
                                <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                                    <div className="flex items-start gap-2">
                                        <ChevronUp className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0" />
                                        <span>Fear & Greed showing excessive optimism</span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <ChevronDown className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0" />
                                        <span>Put/call ratio declining, bullish signal</span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <ChevronUp className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0" />
                                        <span>Social sentiment reaching euphoric levels</span>
                                    </div>
                                </div>
                            </div>
                            
                            <Separator className="my-4" />
                            
                            <div className="space-y-2">
                                <h4 className="font-medium text-gray-900 dark:text-white">Outlook</h4>
                                <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                                        <span>Sentiment extremely bullish</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                                        <span>Contrarian warning signals</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                                        <span>Monitor for sentiment reversal</span>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Main Chart - 3/4 width */}
                <div className="lg:col-span-3">
                    <Card>
                        <CardHeader>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                <div>
                                    <CardTitle className="flex items-center gap-2">
                                        <MessageSquare className="h-5 w-5 text-purple-600" />
                                        {currentFactor?.name || 'Sentiment Factor'}
                                    </CardTitle>
                                    <CardDescription className="mt-1">
                                        {currentFactor?.description || 'Sentiment analysis data'}
                                    </CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button 
                                        variant="outline" 
                                        size="sm"
                                        onClick={() => setIsFullScreen(true)}
                                        className="hover:bg-purple-50 hover:border-purple-300 dark:hover:bg-purple-950"
                                    >
                                        <ExternalLink className="h-4 w-4" />
                                    </Button>
                                    <Tabs value={selectedPeriod} onValueChange={setSelectedPeriod}>
                                        <TabsList className="grid w-full grid-cols-5">
                                            <TabsTrigger value="1Y">1Y</TabsTrigger>
                                            <TabsTrigger value="3Y">3Y</TabsTrigger>
                                            <TabsTrigger value="5Y">5Y</TabsTrigger>
                                            <TabsTrigger value="10Y">10Y</TabsTrigger>
                                            <TabsTrigger value="MAX">MAX</TabsTrigger>
                                        </TabsList>
                                    </Tabs>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="h-96 w-full">
                                <MultiLineChart
                                    data={chartData}
                                    selectedFactors={[selectedFactor]}
                                    height={384}
                                />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Factors Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card className="md:col-span-2 lg:col-span-3">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <MessageSquare className="h-5 w-5 text-purple-600" />
                            Sentiment Factors
                        </CardTitle>
                        <CardDescription>
                            Select a factor to analyze market psychology and investor behavior
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {sentimentFactors.map((factor) => {
                                const IconComponent = getIconComponent(factor.id)
                                const sourceDetails = getSourceDetails(factor.id)
                                const isSelected = selectedFactor === factor.id
                                
                                return (
                                    <div
                                        key={factor.id}
                                        className={`p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                                            isSelected 
                                                ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' 
                                                : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600'
                                        }`}
                                        onClick={() => setSelectedFactor(factor.id)}
                                    >
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg ${
                                                    isSelected 
                                                        ? 'bg-purple-100 dark:bg-purple-800' 
                                                        : 'bg-gray-100 dark:bg-gray-800'
                                                }`}>
                                                    <IconComponent className={`h-5 w-5 ${
                                                        isSelected 
                                                            ? 'text-purple-600 dark:text-purple-400' 
                                                            : 'text-gray-600 dark:text-gray-400'
                                                    }`} />
                                                </div>
                                                <div className="flex-1">
                                                    <h3 className="font-medium text-gray-900 dark:text-white text-sm">
                                                        {factor.name}
                                                    </h3>
                                                    <Badge variant="outline" className="text-xs mt-1">
                                                        {factor.category}
                                                    </Badge>
                                                </div>
                                            </div>
                                            <Dialog>
                                                <DialogTrigger asChild>
                                                    <Button variant="ghost" size="sm" className="p-1 h-8 w-8">
                                                        <Info className={`h-4 w-4 ${
                                                            isSelected 
                                                                ? 'text-purple-600 dark:text-purple-400' 
                                                                : 'text-gray-500'
                                                        }`} />
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent className="max-w-2xl">
                                                    <DialogHeader>
                                                        <DialogTitle className="flex items-center gap-2">
                                                            <IconComponent className="h-5 w-5 text-purple-600" />
                                                            {sourceDetails.title}
                                                        </DialogTitle>
                                                        <DialogDescription className="text-left space-y-4">
                                                            <p className="text-gray-600 dark:text-gray-400">
                                                                {sourceDetails.description}
                                                            </p>
                                                            
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                                                <div className="space-y-3">
                                                                    <div className="flex items-center gap-2">
                                                                        <Database className="h-4 w-4 text-gray-500" />
                                                                        <div>
                                                                            <div className="font-medium text-gray-900 dark:text-white">Provider</div>
                                                                            <div className="text-gray-600 dark:text-gray-400">{sourceDetails.provider}</div>
                                                                        </div>
                                                                    </div>
                                                                    
                                                                    <div className="flex items-center gap-2">
                                                                        <Clock className="h-4 w-4 text-gray-500" />
                                                                        <div>
                                                                            <div className="font-medium text-gray-900 dark:text-white">Frequency</div>
                                                                            <div className="text-gray-600 dark:text-gray-400">{sourceDetails.frequency}</div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                
                                                                <div className="space-y-3">
                                                                    <div className="flex items-center gap-2">
                                                                        <Calendar className="h-4 w-4 text-gray-500" />
                                                                        <div>
                                                                            <div className="font-medium text-gray-900 dark:text-white">Availability</div>
                                                                            <div className="text-gray-600 dark:text-gray-400">{sourceDetails.availability}</div>
                                                                        </div>
                                                                    </div>
                                                                    
                                                                    <div className="flex items-center gap-2">
                                                                        <Activity className="h-4 w-4 text-gray-500" />
                                                                        <div>
                                                                            <div className="font-medium text-gray-900 dark:text-white">Last Updated</div>
                                                                            <div className="text-gray-600 dark:text-gray-400">{sourceDetails.lastUpdated}</div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            
                                                            <div className="border-t pt-4">
                                                                <div className="font-medium text-gray-900 dark:text-white mb-2">Methodology</div>
                                                                <p className="text-gray-600 dark:text-gray-400 text-sm">
                                                                    {sourceDetails.methodology}
                                                                </p>
                                                            </div>
                                                            
                                                            <div className="flex items-center gap-2 pt-2">
                                                                <ExternalLink className="h-4 w-4 text-blue-600" />
                                                                <a 
                                                                    href={sourceDetails.url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-blue-600 hover:text-blue-800 hover:underline text-sm"
                                                                >
                                                                    View Official Source
                                                                </a>
                                                            </div>
                                                        </DialogDescription>
                                                    </DialogHeader>
                                                </DialogContent>
                                            </Dialog>
                                        </div>
                                        
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xl font-bold text-gray-900 dark:text-white">
                                                    {factor.value}
                                                </span>
                                                <div className="flex items-center gap-1">
                                                    {factor.trend === 'up' ? (
                                                        <ChevronUp className="h-4 w-4 text-green-600" />
                                                    ) : (
                                                        <ChevronDown className="h-4 w-4 text-red-600" />
                                                    )}
                                                    <span className={`text-sm font-medium ${
                                                        factor.trend === 'up' ? 'text-green-600' : 'text-red-600'
                                                    }`}>
                                                        {factor.change}
                                                    </span>
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-gray-600 dark:text-gray-400">
                                                    {factor.description}
                                                </span>
                                                <Badge 
                                                    variant={factor.trend === 'up' ? 'default' : 'destructive'}
                                                    className="text-xs"
                                                >
                                                    {factor.trend === 'up' ? 'Bullish Signal' : 'Bearish Signal'}
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Full Screen Chart Modal */}
            <FullScreenChart
                isOpen={isFullScreen}
                onClose={() => setIsFullScreen(false)}
                selectedFactor={selectedFactorObject}
            />
        </div>
    )
}
