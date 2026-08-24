"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Building2, ChevronUp, ChevronDown, Info, ExternalLink, Users, Briefcase, Shield, TrendingUp, BarChart3, Activity, Calendar, Clock, Database } from "lucide-react"
import dynamic from 'next/dynamic'

const MultiLineChart = dynamic(() => import('../charts/multi-line-chart'), { ssr: false })
const FullScreenChart = dynamic(() => import('./fullscreen-chart'), { ssr: false })

export default function Institutional() {
    const [selectedFactor, setSelectedFactor] = useState('fund-flows')
    const [selectedPeriod, setSelectedPeriod] = useState('5Y')
    const [isFullScreen, setIsFullScreen] = useState(false)

    // Institutional factors with mock data
    const institutionalFactors = [
        {
            id: "fund-flows",
            name: "Fund Flows",
            value: "$12.8B",
            change: "+$2.4B",
            changePercent: "+23.1%",
            trend: "up",
            description: "Net institutional fund flows into equity markets",
            category: "Capital Flows"
        },
        {
            id: "13f-holdings",
            name: "13F Holdings",
            value: "$4.2T",
            change: "+$180B",
            changePercent: "+4.5%",
            trend: "up",
            description: "Aggregate 13F institutional holdings value",
            category: "Holdings"
        },
        {
            id: "insider-trading",
            name: "Insider Trading",
            value: "2.8:1",
            change: "-0.4",
            changePercent: "-12.5%",
            trend: "down",
            description: "Insider buy/sell ratio across S&P 500",
            category: "Insider Activity"
        },
        {
            id: "institutional-ownership",
            name: "Institutional Ownership",
            value: "78.5%",
            change: "+1.2%",
            changePercent: "+1.6%",
            trend: "up",
            description: "Percentage of S&P 500 owned by institutions",
            category: "Ownership"
        },
        {
            id: "hedge-fund-exposure",
            name: "Hedge Fund Exposure",
            value: "52%",
            change: "-3%",
            changePercent: "-5.4%",
            trend: "down",
            description: "Hedge fund long equity exposure percentage",
            category: "Hedge Funds"
        },
        {
            id: "pension-allocation",
            name: "Pension Allocation",
            value: "41%",
            change: "+2%",
            changePercent: "+5.1%",
            trend: "up",
            description: "Pension fund equity allocation percentage",
            category: "Pension Funds"
        }
    ]

    const currentFactor = institutionalFactors.find(factor => factor.id === selectedFactor) || institutionalFactors[0]
    const selectedFactorObject = currentFactor

    // Mock chart data for the selected factor
    const chartData = [
        { date: '2023-01', value: 8.5, category: 'Fund Flows' },
        { date: '2023-02', value: 12.2, category: 'Fund Flows' },
        { date: '2023-03', value: 6.8, category: 'Fund Flows' },
        { date: '2023-04', value: 15.4, category: 'Fund Flows' },
        { date: '2023-05', value: 9.7, category: 'Fund Flows' },
        { date: '2023-06', value: 18.1, category: 'Fund Flows' },
        { date: '2023-07', value: 14.3, category: 'Fund Flows' },
        { date: '2023-08', value: 11.2, category: 'Fund Flows' },
        { date: '2023-09', value: 16.8, category: 'Fund Flows' },
        { date: '2023-10', value: 13.5, category: 'Fund Flows' },
        { date: '2023-11', value: 10.4, category: 'Fund Flows' },
        { date: '2023-12', value: 12.8, category: 'Fund Flows' }
    ]

    // Add source details for each factor
    const getSourceDetails = (factorId) => {
        switch (factorId) {
            case "fund-flows":
                return {
                    title: "Institutional Fund Flows",
                    description: "Net flows of institutional money into and out of equity markets, including mutual funds, ETFs, and institutional separate accounts.",
                    provider: "Investment Company Institute / Morningstar",
                    frequency: "Weekly",
                    availability: "1984 to Present",
                    methodology: "Net new cash flow calculated as new sales minus redemptions plus net exchanges, adjusted for dividend reinvestments.",
                    url: "https://www.ici.org/research/stats",
                    lastUpdated: "Updated weekly on Wednesday"
                }
            case "13f-holdings":
                return {
                    title: "13F Institutional Holdings",
                    description: "Quarterly filings by institutional investment managers with over $100M in assets under management, disclosing equity holdings.",
                    provider: "U.S. Securities and Exchange Commission",
                    frequency: "Quarterly",
                    availability: "1978 to Present",
                    methodology: "Aggregate market value of equity securities held by institutions filing Form 13F, reported 45 days after quarter end.",
                    url: "https://www.sec.gov/forms/form-13f",
                    lastUpdated: "45 days after quarter end"
                }
            case "insider-trading":
                return {
                    title: "Insider Trading Activity",
                    description: "Trading activity by corporate insiders including officers, directors, and significant shareholders, filed with Form 4 disclosures.",
                    provider: "SEC / InsiderInsights",
                    frequency: "Real-time",
                    availability: "1988 to Present",
                    methodology: "Ratio of insider buying transactions to selling transactions, weighted by dollar value and insider significance.",
                    url: "https://www.sec.gov/forms/form-4",
                    lastUpdated: "Updated within 2 business days of trade"
                }
            case "institutional-ownership":
                return {
                    title: "Institutional Ownership Percentage",
                    description: "Percentage of total market capitalization owned by institutional investors including mutual funds, pension funds, and hedge funds.",
                    provider: "FactSet / S&P Capital IQ",
                    frequency: "Quarterly",
                    availability: "1980 to Present",
                    methodology: "Aggregate institutional holdings divided by total shares outstanding for S&P 500 constituents, based on 13F filings.",
                    url: "https://www.factset.com/",
                    lastUpdated: "Updated quarterly following 13F deadline"
                }
            case "hedge-fund-exposure":
                return {
                    title: "Hedge Fund Equity Exposure",
                    description: "Percentage of hedge fund capital allocated to long equity positions, indicating institutional risk appetite and market sentiment.",
                    provider: "Goldman Sachs Prime Services / AIMA",
                    frequency: "Monthly",
                    availability: "2000 to Present",
                    methodology: "Survey-based aggregate long equity exposure as percentage of total hedge fund assets under management.",
                    url: "https://www.goldmansachs.com/what-we-do/securities/prime-brokerage/",
                    lastUpdated: "Updated monthly, typically mid-month"
                }
            case "pension-allocation":
                return {
                    title: "Pension Fund Equity Allocation",
                    description: "Percentage of pension fund assets allocated to equity investments, reflecting long-term institutional investment trends.",
                    provider: "Federal Reserve Z.1 Report / Pension Benefits",
                    frequency: "Quarterly",
                    availability: "1952 to Present",
                    methodology: "Aggregate equity allocation across private and public pension funds, based on Federal Reserve flow of funds data.",
                    url: "https://www.federalreserve.gov/releases/z1/",
                    lastUpdated: "Updated quarterly with Z.1 release"
                }
            default:
                return {
                    title: "Data Source",
                    description: "Institutional data source information",
                    provider: "Financial Data Providers",
                    frequency: "Varies",
                    availability: "Historical data",
                    methodology: "Standard institutional measurement techniques",
                    url: "#",
                    lastUpdated: "Regular updates"
                }
        }
    }

    const getIconComponent = (factorId) => {
        switch (factorId) {
            case "fund-flows":
                return TrendingUp
            case "13f-holdings":
                return Shield
            case "insider-trading":
                return Users
            case "institutional-ownership":
                return Building2
            case "hedge-fund-exposure":
                return Briefcase
            case "pension-allocation":
                return BarChart3
            default:
                return Building2
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
                <div className="flex items-center gap-3">
                    <Building2 className="h-8 w-8 text-emerald-600" />
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                            Institutional Analysis
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">
                            Institutional flows, holdings, and large investor behavior
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Score Card - 1/4 width */}
                <div className="lg:col-span-1">
                    <Card className="border-emerald-200 dark:border-emerald-800">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                                <Building2 className="h-5 w-5" />
                                Institutional Health
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600 dark:text-gray-400">Fund Flows</span>
                                    <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                        Positive
                                    </Badge>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600 dark:text-gray-400">Holdings</span>
                                    <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                                        Growing
                                    </Badge>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600 dark:text-gray-400">Exposure</span>
                                    <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                        Moderate
                                    </Badge>
                                </div>
                            </div>
                            
                            <Separator className="my-4" />
                            
                            <div className="space-y-2">
                                <h4 className="font-medium text-gray-900 dark:text-white">Key Insights</h4>
                                <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                                    <div className="flex items-start gap-2">
                                        <ChevronUp className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                                        <span>Institutional flows turning positive</span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <ChevronUp className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                                        <span>13F holdings at record levels</span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <ChevronDown className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                                        <span>Hedge fund exposure moderating</span>
                                    </div>
                                </div>
                            </div>
                            
                            <Separator className="my-4" />
                            
                            <div className="space-y-2">
                                <h4 className="font-medium text-gray-900 dark:text-white">Outlook</h4>
                                <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                                        <span>Institutional sentiment improving</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                                        <span>Long-term allocation trends positive</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                                        <span>Smart money showing confidence</span>
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
                                        <Building2 className="h-5 w-5 text-emerald-600" />
                                        {currentFactor?.name || 'Institutional Factor'}
                                    </CardTitle>
                                    <CardDescription className="mt-1">
                                        {currentFactor?.description || 'Institutional analysis data'}
                                    </CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button 
                                        variant="outline" 
                                        size="sm"
                                        onClick={() => setIsFullScreen(true)}
                                        className="hover:bg-emerald-50 hover:border-emerald-300 dark:hover:bg-emerald-950"
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
                            <Building2 className="h-5 w-5 text-emerald-600" />
                            Institutional Factors
                        </CardTitle>
                        <CardDescription>
                            Select a factor to analyze institutional investor behavior
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {institutionalFactors.map((factor) => {
                                const IconComponent = getIconComponent(factor.id)
                                const sourceDetails = getSourceDetails(factor.id)
                                const isSelected = selectedFactor === factor.id
                                
                                return (
                                    <div
                                        key={factor.id}
                                        className={`p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                                            isSelected 
                                                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' 
                                                : 'border-gray-200 dark:border-gray-700 hover:border-emerald-300 dark:hover:border-emerald-600'
                                        }`}
                                        onClick={() => setSelectedFactor(factor.id)}
                                    >
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg ${
                                                    isSelected 
                                                        ? 'bg-emerald-100 dark:bg-emerald-800' 
                                                        : 'bg-gray-100 dark:bg-gray-800'
                                                }`}>
                                                    <IconComponent className={`h-5 w-5 ${
                                                        isSelected 
                                                            ? 'text-emerald-600 dark:text-emerald-400' 
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
                                                                ? 'text-emerald-600 dark:text-emerald-400' 
                                                                : 'text-gray-500'
                                                        }`} />
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent className="max-w-2xl">
                                                    <DialogHeader>
                                                        <DialogTitle className="flex items-center gap-2">
                                                            <IconComponent className="h-5 w-5 text-emerald-600" />
                                                            {sourceDetails.title}
                                                        </DialogTitle>
                                                        <DialogDescription asChild>
                                                          <div className="text-left space-y-4">
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
