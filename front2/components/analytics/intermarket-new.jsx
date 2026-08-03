"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Globe, ChevronUp, ChevronDown, Info, ExternalLink, DollarSign, TrendingUp, Zap, PieChart, BarChart3, Activity, Calendar, Clock, Database } from "lucide-react"
import dynamic from 'next/dynamic'

const MultiLineChart = dynamic(() => import('../charts/multi-line-chart'), { ssr: false })
const FullScreenChart = dynamic(() => import('./fullscreen-chart'), { ssr: false })

export default function Intermarket() {
    const [selectedFactor, setSelectedFactor] = useState('dxy')
    const [selectedPeriod, setSelectedPeriod] = useState('5Y')
    const [isFullScreen, setIsFullScreen] = useState(false)

    // Intermarket factors with mock data
    const intermarketFactors = [
        {
            id: "dxy",
            name: "DXY (Dollar Index)",
            value: "103.2",
            change: "+0.8",
            changePercent: "+0.8%",
            trend: "up",
            description: "U.S. Dollar Index vs basket of major currencies",
            category: "Currency"
        },
        {
            id: "ten-year-yield",
            name: "10Y Treasury Yield",
            value: "4.35%",
            change: "+0.12%",
            changePercent: "+2.8%",
            trend: "up",
            description: "10-Year U.S. Treasury constant maturity rate",
            category: "Bonds"
        },
        {
            id: "gold",
            name: "Gold",
            value: "$2,085",
            change: "+$25",
            changePercent: "+1.2%",
            trend: "up",
            description: "Gold spot price per troy ounce",
            category: "Precious Metals"
        },
        {
            id: "oil",
            name: "WTI Crude Oil",
            value: "$82.50",
            change: "+$3.20",
            changePercent: "+4.0%",
            trend: "up",
            description: "West Texas Intermediate crude oil price per barrel",
            category: "Energy"
        },
        {
            id: "credit-spreads",
            name: "Credit Spreads",
            value: "185 bps",
            change: "+15 bps",
            changePercent: "+8.8%",
            trend: "up",
            description: "High Yield ETF vs Treasury spread (HYG-TLT)",
            category: "Credit"
        },
        {
            id: "copper-gold-ratio",
            name: "Copper/Gold Ratio",
            value: "0.0018",
            change: "+0.0001",
            changePercent: "+5.9%",
            trend: "up",
            description: "Copper price divided by gold price (economic growth indicator)",
            category: "Economic Indicator"
        }
    ]

    const currentFactor = intermarketFactors.find(factor => factor.id === selectedFactor) || intermarketFactors[0]
    const selectedFactorObject = currentFactor

    // Mock chart data for the selected factor
    const chartData = [
        { date: '2023-01', value: 95.2, category: 'DXY' },
        { date: '2023-02', value: 96.8, category: 'DXY' },
        { date: '2023-03', value: 98.1, category: 'DXY' },
        { date: '2023-04', value: 99.5, category: 'DXY' },
        { date: '2023-05', value: 100.9, category: 'DXY' },
        { date: '2023-06', value: 102.2, category: 'DXY' },
        { date: '2023-07', value: 101.8, category: 'DXY' },
        { date: '2023-08', value: 102.5, category: 'DXY' },
        { date: '2023-09', value: 103.1, category: 'DXY' },
        { date: '2023-10', value: 102.9, category: 'DXY' },
        { date: '2023-11', value: 103.2, category: 'DXY' },
        { date: '2023-12', value: 103.2, category: 'DXY' }
    ]

    // Add source details for each factor
    const getSourceDetails = (factorId) => {
        switch (factorId) {
            case "dxy":
                return {
                    title: "DXY (Dollar Index)",
                    description: "U.S. Dollar Index measuring the value of USD against a basket of major foreign currencies including EUR, JPY, GBP, CAD, SEK, and CHF.",
                    provider: "ICE (Intercontinental Exchange)",
                    frequency: "Real-time",
                    availability: "1973 to Present",
                    methodology: "Geometric weighted average of six major currencies: EUR (57.6%), JPY (13.6%), GBP (11.9%), CAD (9.1%), SEK (4.2%), CHF (3.6%).",
                    url: "https://www.theice.com/products/194/US-Dollar-Index-Futures",
                    lastUpdated: "Updated continuously during market hours"
                }
            case "ten-year-yield":
                return {
                    title: "10Y Treasury Yield",
                    description: "10-Year U.S. Treasury constant maturity rate, serving as benchmark for long-term interest rates and discount rate for equity valuations.",
                    provider: "U.S. Department of Treasury",
                    frequency: "Daily",
                    availability: "1962 to Present",
                    methodology: "Yield on actively traded Treasury securities adjusted to constant maturity of 10 years, interpolated by Treasury from daily yield curve.",
                    url: "https://www.treasury.gov/resource-center/data-chart-center/interest-rates/",
                    lastUpdated: "Updated daily by 6:00 PM ET"
                }
            case "gold":
                return {
                    title: "Gold Spot Price",
                    description: "Gold spot price per troy ounce, serving as safe haven asset and hedge against currency debasement and inflation.",
                    provider: "COMEX/CME Group",
                    frequency: "Real-time",
                    availability: "1975 to Present",
                    methodology: "Spot price based on most active COMEX gold futures contract, adjusted for time to expiration and storage costs.",
                    url: "https://www.cmegroup.com/markets/metals/precious/gold.html",
                    lastUpdated: "Updated continuously during trading hours"
                }
            case "oil":
                return {
                    title: "WTI Crude Oil",
                    description: "West Texas Intermediate crude oil price per barrel, key benchmark for North American crude oil and important inflation indicator.",
                    provider: "NYMEX/CME Group",
                    frequency: "Real-time",
                    availability: "1983 to Present",
                    methodology: "Price of light, sweet crude oil delivered to Cushing, Oklahoma, based on most active NYMEX futures contract.",
                    url: "https://www.cmegroup.com/markets/energy/crude-oil/light-sweet-crude.html",
                    lastUpdated: "Updated continuously during trading hours"
                }
            case "credit-spreads":
                return {
                    title: "Credit Spreads (HYG-TLT)",
                    description: "High Yield corporate bond ETF vs Treasury bond ETF spread, measuring credit risk premium and risk appetite in fixed income markets.",
                    provider: "iShares/BlackRock",
                    frequency: "Real-time",
                    availability: "2007 to Present",
                    methodology: "Yield difference between iShares iBoxx High Yield Corporate Bond ETF (HYG) and iShares 20+ Year Treasury Bond ETF (TLT).",
                    url: "https://www.ishares.com/us/products/239565/ishares-iboxx-high-yield-corporate-bond-etf",
                    lastUpdated: "Updated during market hours"
                }
            case "copper-gold-ratio":
                return {
                    title: "Copper/Gold Ratio",
                    description: "Ratio of copper price to gold price, serving as leading indicator of global economic growth and risk appetite.",
                    provider: "LME/COMEX",
                    frequency: "Daily",
                    availability: "1988 to Present",
                    methodology: "London Metal Exchange copper price divided by COMEX gold price, both in USD per ounce equivalent.",
                    url: "https://www.lme.com/en/metals/non-ferrous/copper",
                    lastUpdated: "Updated daily after market close"
                }
            default:
                return {
                    title: "Data Source",
                    description: "Intermarket data source information",
                    provider: "Financial Data Providers",
                    frequency: "Varies",
                    availability: "Historical data",
                    methodology: "Standard intermarket measurement techniques",
                    url: "#",
                    lastUpdated: "Regular updates"
                }
        }
    }

    const getIconComponent = (factorId) => {
        switch (factorId) {
            case "dxy":
                return DollarSign
            case "ten-year-yield":
                return TrendingUp
            case "gold":
                return Zap
            case "oil":
                return Activity
            case "credit-spreads":
                return BarChart3
            case "copper-gold-ratio":
                return PieChart
            default:
                return Globe
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
                <div className="flex items-center gap-3">
                    <Globe className="h-8 w-8 text-teal-600" />
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                            Intermarket Analysis
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">
                            Cross-asset relationships, currencies, bonds, and commodities
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Score Card - 1/4 width */}
                <div className="lg:col-span-1">
                    <Card className="border-teal-200 dark:border-teal-800">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg text-teal-700 dark:text-teal-300 flex items-center gap-2">
                                <Globe className="h-5 w-5" />
                                Intermarket Health
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600 dark:text-gray-400">Currency</span>
                                    <Badge variant="secondary" className="bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200">
                                        Strong
                                    </Badge>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600 dark:text-gray-400">Bonds</span>
                                    <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                                        Rising
                                    </Badge>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600 dark:text-gray-400">Commodities</span>
                                    <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                        Bullish
                                    </Badge>
                                </div>
                            </div>
                            
                            <Separator className="my-4" />
                            
                            <div className="space-y-2">
                                <h4 className="font-medium text-gray-900 dark:text-white">Key Insights</h4>
                                <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                                    <div className="flex items-start gap-2">
                                        <ChevronUp className="h-4 w-4 text-teal-600 mt-0.5 flex-shrink-0" />
                                        <span>Dollar strength supporting risk-off sentiment</span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <ChevronUp className="h-4 w-4 text-teal-600 mt-0.5 flex-shrink-0" />
                                        <span>Rising yields pressuring equity valuations</span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <ChevronUp className="h-4 w-4 text-teal-600 mt-0.5 flex-shrink-0" />
                                        <span>Gold resilience suggests inflation concerns</span>
                                    </div>
                                </div>
                            </div>
                            
                            <Separator className="my-4" />
                            
                            <div className="space-y-2">
                                <h4 className="font-medium text-gray-900 dark:text-white">Outlook</h4>
                                <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-teal-500 rounded-full"></div>
                                        <span>Cross-asset correlations elevated</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-teal-500 rounded-full"></div>
                                        <span>Currency volatility increasing</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-teal-500 rounded-full"></div>
                                        <span>Regime shift probability rising</span>
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
                                        <Globe className="h-5 w-5 text-teal-600" />
                                        {currentFactor?.name || 'Intermarket Factor'}
                                    </CardTitle>
                                    <CardDescription className="mt-1">
                                        {currentFactor?.description || 'Intermarket analysis data'}
                                    </CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button 
                                        variant="outline" 
                                        size="sm"
                                        onClick={() => setIsFullScreen(true)}
                                        className="hover:bg-teal-50 hover:border-teal-300 dark:hover:bg-teal-950"
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
                            <Globe className="h-5 w-5 text-teal-600" />
                            Intermarket Factors
                        </CardTitle>
                        <CardDescription>
                            Select a factor to analyze cross-asset relationships
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {intermarketFactors.map((factor) => {
                                const IconComponent = getIconComponent(factor.id)
                                const sourceDetails = getSourceDetails(factor.id)
                                const isSelected = selectedFactor === factor.id
                                
                                return (
                                    <div
                                        key={factor.id}
                                        className={`p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                                            isSelected 
                                                ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20' 
                                                : 'border-gray-200 dark:border-gray-700 hover:border-teal-300 dark:hover:border-teal-600'
                                        }`}
                                        onClick={() => setSelectedFactor(factor.id)}
                                    >
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg ${
                                                    isSelected 
                                                        ? 'bg-teal-100 dark:bg-teal-800' 
                                                        : 'bg-gray-100 dark:bg-gray-800'
                                                }`}>
                                                    <IconComponent className={`h-5 w-5 ${
                                                        isSelected 
                                                            ? 'text-teal-600 dark:text-teal-400' 
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
                                                                ? 'text-teal-600 dark:text-teal-400' 
                                                                : 'text-gray-500'
                                                        }`} />
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent className="max-w-2xl">
                                                    <DialogHeader>
                                                        <DialogTitle className="flex items-center gap-2">
                                                            <IconComponent className="h-5 w-5 text-teal-600" />
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
