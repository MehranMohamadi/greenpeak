"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Calendar, ChevronUp, ChevronDown, Info, ExternalLink, Clock, AlertTriangle, TrendingUp, BarChart3, Activity, Database } from "lucide-react"
import dynamic from 'next/dynamic'
import EconomicCalendarWidget from "./economic-calendar-widget"

const MultiLineChart = dynamic(() => import('../charts/multi-line-chart'), { ssr: false })
const FullScreenChart = dynamic(() => import('./fullscreen-chart'), { ssr: false })

export default function MacroCalendar() {
    const [selectedFactor, setSelectedFactor] = useState('nonfarm-payrolls')
    const [selectedPeriod, setSelectedPeriod] = useState('5Y')
    const [isFullScreen, setIsFullScreen] = useState(false)

    // Macro economic indicators with release schedule
    const macroFactors = [
        {
            id: "nonfarm-payrolls",
            name: "Nonfarm Payrolls",
            value: "275K",
            change: "+25K",
            changePercent: "+10.0%",
            trend: "up",
            description: "Monthly change in US employment excluding farm workers",
            category: "Employment",
            nextRelease: "2025-01-10",
            importance: "High"
        },
        {
            id: "cpi-inflation",
            name: "CPI Inflation",
            value: "3.2%",
            change: "-0.1%",
            changePercent: "-3.0%",
            trend: "down",
            description: "Consumer Price Index year-over-year inflation rate",
            category: "Inflation",
            nextRelease: "2025-01-15",
            importance: "Critical"
        },
        {
            id: "gdp-growth",
            name: "GDP Growth",
            value: "2.8%",
            change: "+0.3%",
            changePercent: "+12.0%",
            trend: "up",
            description: "Quarterly GDP growth rate annualized",
            category: "Growth",
            nextRelease: "2025-01-25",
            importance: "High"
        },
        {
            id: "fed-interest-rates",
            name: "Fed Interest Rates",
            value: "5.25%",
            change: "0.0%",
            changePercent: "0.0%",
            trend: "neutral",
            description: "Federal Reserve federal funds rate",
            category: "Monetary Policy",
            nextRelease: "2025-01-31",
            importance: "Critical"
        },
        {
            id: "retail-sales",
            name: "Retail Sales",
            value: "0.8%",
            change: "+0.3%",
            changePercent: "+60.0%",
            trend: "up",
            description: "Monthly retail sales growth rate",
            category: "Consumer",
            nextRelease: "2025-02-14",
            importance: "Medium"
        },
        {
            id: "ism-manufacturing",
            name: "ISM Manufacturing",
            value: "52.4",
            change: "+1.2",
            changePercent: "+2.3%",
            trend: "up",
            description: "Institute for Supply Management Manufacturing PMI",
            category: "Manufacturing",
            nextRelease: "2025-02-01",
            importance: "Medium"
        }
    ]

    const currentFactor = macroFactors.find(factor => factor.id === selectedFactor) || macroFactors[0]
    const selectedFactorObject = currentFactor

    // Mock chart data for the selected factor
    const chartData = [
        { date: '2023-01', value: 250000, category: 'Employment' },
        { date: '2023-02', value: 275000, category: 'Employment' },
        { date: '2023-03', value: 230000, category: 'Employment' },
        { date: '2023-04', value: 290000, category: 'Employment' },
        { date: '2023-05', value: 245000, category: 'Employment' },
        { date: '2023-06', value: 310000, category: 'Employment' },
        { date: '2023-07', value: 285000, category: 'Employment' },
        { date: '2023-08', value: 265000, category: 'Employment' },
        { date: '2023-09', value: 295000, category: 'Employment' },
        { date: '2023-10', value: 280000, category: 'Employment' },
        { date: '2023-11', value: 275000, category: 'Employment' },
        { date: '2023-12', value: 275000, category: 'Employment' }
    ]

    // Add source details for each factor
    const getSourceDetails = (factorId) => {
        switch (factorId) {
            case "nonfarm-payrolls":
                return {
                    title: "Nonfarm Payrolls",
                    description: "Monthly measurement of employment change in the United States, excluding farm workers, government employees, private household employees, and employees of nonprofit organizations.",
                    provider: "U.S. Bureau of Labor Statistics",
                    frequency: "Monthly",
                    availability: "1939 to Present",
                    methodology: "Survey-based estimate of payroll employment from the Current Employment Statistics program, covering approximately 697,000 worksites.",
                    url: "https://www.bls.gov/ces/",
                    lastUpdated: "First Friday of each month at 8:30 AM ET"
                }
            case "cpi-inflation":
                return {
                    title: "Consumer Price Index (CPI)",
                    description: "Measure of average change over time in prices paid by urban consumers for a market basket of consumer goods and services, primary inflation gauge.",
                    provider: "U.S. Bureau of Labor Statistics",
                    frequency: "Monthly",
                    availability: "1913 to Present",
                    methodology: "Price data collected monthly from approximately 6,000 housing units and 22,000 retail establishments across 75 urban areas throughout the U.S.",
                    url: "https://www.bls.gov/cpi/",
                    lastUpdated: "Mid-month following reference month at 8:30 AM ET"
                }
            case "gdp-growth":
                return {
                    title: "Gross Domestic Product (GDP)",
                    description: "Total monetary value of all finished goods and services produced within the United States, key measure of economic activity and growth.",
                    provider: "U.S. Bureau of Economic Analysis",
                    frequency: "Quarterly",
                    availability: "1947 to Present",
                    methodology: "Expenditure approach summing consumption, investment, government spending, and net exports, seasonally adjusted at annual rates.",
                    url: "https://www.bea.gov/data/gdp/gross-domestic-product",
                    lastUpdated: "Last week of each quarter at 8:30 AM ET"
                }
            case "fed-interest-rates":
                return {
                    title: "Federal Funds Rate",
                    description: "Interest rate at which depository institutions trade federal funds with each other overnight, primary tool of U.S. monetary policy.",
                    provider: "Federal Reserve System",
                    frequency: "8 times per year",
                    availability: "1954 to Present",
                    methodology: "Set by Federal Open Market Committee (FOMC) based on economic conditions, inflation targets, and employment mandates.",
                    url: "https://www.federalreserve.gov/monetarypolicy/fomc.htm",
                    lastUpdated: "FOMC meeting dates, typically 8 times per year"
                }
            case "retail-sales":
                return {
                    title: "Retail Sales",
                    description: "Monthly measurement of sales receipts from retail and food services stores, indicator of consumer spending and economic health.",
                    provider: "U.S. Census Bureau",
                    frequency: "Monthly",
                    availability: "1992 to Present",
                    methodology: "Survey of approximately 4,700 retail and food service firms selected from larger universe of employer firms in retail trade sector.",
                    url: "https://www.census.gov/retail/",
                    lastUpdated: "Mid-month following reference month at 8:30 AM ET"
                }
            case "ism-manufacturing":
                return {
                    title: "ISM Manufacturing PMI",
                    description: "Purchasing Managers' Index measuring manufacturing activity based on new orders, production, employment, supplier deliveries, and inventories.",
                    provider: "Institute for Supply Management",
                    frequency: "Monthly",
                    availability: "1948 to Present",
                    methodology: "Survey of purchasing and supply executives across manufacturing companies, with readings above 50 indicating expansion.",
                    url: "https://www.ismworld.org/supply-management-news-and-reports/reports/ism-report-on-business/pmi/",
                    lastUpdated: "First business day of each month at 10:00 AM ET"
                }
            default:
                return {
                    title: "Data Source",
                    description: "Macroeconomic data source information",
                    provider: "Economic Data Providers",
                    frequency: "Varies",
                    availability: "Historical data",
                    methodology: "Standard economic measurement techniques",
                    url: "#",
                    lastUpdated: "Regular updates"
                }
        }
    }

    const getIconComponent = (factorId) => {
        switch (factorId) {
            case "nonfarm-payrolls":
                return TrendingUp
            case "cpi-inflation":
                return AlertTriangle
            case "gdp-growth":
                return BarChart3
            case "fed-interest-rates":
                return Activity
            case "retail-sales":
                return TrendingUp
            case "ism-manufacturing":
                return BarChart3
            default:
                return Calendar
        }
    }

    const getImportanceColor = (importance) => {
        switch (importance) {
            case "Critical":
                return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
            case "High":
                return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
            case "Medium":
                return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
            default:
                return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
                <div className="flex items-center gap-3">
                    <Calendar className="h-8 w-8 text-slate-600" />
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                            Macro Calendar
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">
                            Economic indicators, release schedules, and market impact analysis
                        </p>
                    </div>
                </div>
            </div>

            <Card className="overflow-hidden border-slate-200 dark:border-slate-800">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-slate-600" />
                        Live Economic Calendar
                    </CardTitle>
                    <CardDescription>
                        Real-time economic releases, forecasts, previous values, and market impact
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0 sm:p-6 sm:pt-0">
                    <EconomicCalendarWidget />
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Score Card - 1/4 width */}
                <div className="lg:col-span-1">
                    <Card className="border-slate-200 dark:border-slate-800">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                <Calendar className="h-5 w-5" />
                                Economic Health
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600 dark:text-gray-400">Employment</span>
                                    <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                        Strong
                                    </Badge>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600 dark:text-gray-400">Inflation</span>
                                    <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                                        Moderate
                                    </Badge>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600 dark:text-gray-400">Growth</span>
                                    <Badge variant="secondary" className="bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200">
                                        Healthy
                                    </Badge>
                                </div>
                            </div>
                            
                            <Separator className="my-4" />
                            
                            <div className="space-y-2">
                                <h4 className="font-medium text-gray-900 dark:text-white">Key Insights</h4>
                                <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                                    <div className="flex items-start gap-2">
                                        <ChevronUp className="h-4 w-4 text-slate-600 mt-0.5 flex-shrink-0" />
                                        <span>Employment data showing resilience</span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <ChevronDown className="h-4 w-4 text-slate-600 mt-0.5 flex-shrink-0" />
                                        <span>Inflation pressures moderating</span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <ChevronUp className="h-4 w-4 text-slate-600 mt-0.5 flex-shrink-0" />
                                        <span>GDP growth maintaining momentum</span>
                                    </div>
                                </div>
                            </div>
                            
                            <Separator className="my-4" />
                            
                            <div className="space-y-2">
                                <h4 className="font-medium text-gray-900 dark:text-white">Upcoming Releases</h4>
                                <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                        <span>CPI - Jan 15 (Critical)</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                                        <span>GDP - Jan 25 (High)</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                        <span>FOMC - Jan 31 (Critical)</span>
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
                                        <Calendar className="h-5 w-5 text-slate-600" />
                                        {currentFactor?.name || 'Economic Indicator'}
                                    </CardTitle>
                                    <CardDescription className="mt-1">
                                        {currentFactor?.description || 'Economic data analysis'}
                                    </CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button 
                                        variant="outline" 
                                        size="sm"
                                        onClick={() => setIsFullScreen(true)}
                                        className="hover:bg-slate-50 hover:border-slate-300 dark:hover:bg-slate-950"
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
                            <Calendar className="h-5 w-5 text-slate-600" />
                            Economic Indicators
                        </CardTitle>
                        <CardDescription>
                            Select an indicator to view release schedule and historical data
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {macroFactors.map((factor) => {
                                const IconComponent = getIconComponent(factor.id)
                                const sourceDetails = getSourceDetails(factor.id)
                                const isSelected = selectedFactor === factor.id
                                
                                return (
                                    <div
                                        key={factor.id}
                                        className={`p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                                            isSelected 
                                                ? 'border-slate-500 bg-slate-50 dark:bg-slate-900/20' 
                                                : 'border-gray-200 dark:border-gray-700 hover:border-slate-300 dark:hover:border-slate-600'
                                        }`}
                                        onClick={() => setSelectedFactor(factor.id)}
                                    >
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg ${
                                                    isSelected 
                                                        ? 'bg-slate-100 dark:bg-slate-800' 
                                                        : 'bg-gray-100 dark:bg-gray-800'
                                                }`}>
                                                    <IconComponent className={`h-5 w-5 ${
                                                        isSelected 
                                                            ? 'text-slate-600 dark:text-slate-400' 
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
                                                                ? 'text-slate-600 dark:text-slate-400' 
                                                                : 'text-gray-500'
                                                        }`} />
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent className="max-w-2xl">
                                                    <DialogHeader>
                                                        <DialogTitle className="flex items-center gap-2">
                                                            <IconComponent className="h-5 w-5 text-slate-600" />
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
                                                                            <div className="font-medium text-gray-900 dark:text-white">Release Schedule</div>
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
                                                    ) : factor.trend === 'down' ? (
                                                        <ChevronDown className="h-4 w-4 text-red-600" />
                                                    ) : (
                                                        <div className="h-4 w-4" />
                                                    )}
                                                    <span className={`text-sm font-medium ${
                                                        factor.trend === 'up' ? 'text-green-600' : 
                                                        factor.trend === 'down' ? 'text-red-600' : 'text-gray-600'
                                                    }`}>
                                                        {factor.change}
                                                    </span>
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-gray-600 dark:text-gray-400">
                                                    Next: {factor.nextRelease}
                                                </span>
                                                <Badge 
                                                    variant="secondary"
                                                    className={`text-xs ${getImportanceColor(factor.importance)}`}
                                                >
                                                    {factor.importance}
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
