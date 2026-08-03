"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import MultiLineChart from "../charts/multi-line-chart"
import MiniChart from "./mini-chart"
import FullScreenChart from './fullscreen-chart'
import useSectorPerformanceData from "../../hooks/useSectorPerformanceData"
import { 
    BarChart3, TrendingUp, TrendingDown, Activity, AlertTriangle, 
    CheckCircle, XCircle, ChevronLeft, ChevronRight, Info, 
    ExternalLink, Calendar, Database, Zap, Layers, Cpu, Heart, 
    Maximize2, Building2, Home, Target, RefreshCw, Grid3X3
} from "lucide-react"
import { analyticsCategories, getCategoryByName, getCategoryIndex } from "../../lib/analytics-utils"
import useUpdateInfo from "../../hooks/useUpdateInfo"
import '../../styles/analytics-animations.css'

export default function SectorPerformance() {
    const router = useRouter()
    const { data, loading, error, metadata, getAllSectorsLatest, getLatestSectorValue } = useSectorPerformanceData();
    const [selectedFactor, setSelectedFactor] = useState('technology')
    const [selectedPeriod, setSelectedPeriod] = useState('5Y')
    const [isFullScreen, setIsFullScreen] = useState(false)
    const [selectedCategory, setSelectedCategory] = useState('Sector Performance')
    const [showCategoryGrid, setShowCategoryGrid] = useState(false)
    const [isTransitioning, setIsTransitioning] = useState(false)
    const [prevPeriod, setPrevPeriod] = useState('MAX')

    // Use imported categories from utils
    const categories = analyticsCategories
    
    // Use update info hook
    const { processUpdateInfo } = useUpdateInfo()

    // Smooth transition handler for period changes
    const handlePeriodChange = (newPeriod) => {
        if (newPeriod === selectedPeriod) return
        
        setIsTransitioning(true)
        setPrevPeriod(selectedPeriod)
        
        // Faster, more seamless transition
        setTimeout(() => {
            setSelectedPeriod(newPeriod)
            setTimeout(() => {
                setIsTransitioning(false)
            }, 200) // Reduced from 400ms for faster response
        }, 50) // Reduced from 100ms for immediate response
    }

    // Effect to handle smooth data transitions
    React.useEffect(() => {
        if (isTransitioning) {
            // Add any additional logic needed during transitions
            const timer = setTimeout(() => {
                // Ensure transition state is cleared even if something goes wrong
                setIsTransitioning(false)
            }, 1000) // Fallback timeout
            
            return () => clearTimeout(timer)
        }
    }, [isTransitioning])

    // Helper function to format percentage values
    const formatPercentage = (value) => {
        if (value === null || value === undefined || isNaN(value)) return "N/A";
        const num = Number(value);
        return `${num >= 0 ? '+' : ''}${num.toFixed(1)}%`;
    }

    // Helper function to format sector names
    const formatSectorName = (sector) => {
        return sector?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'N/A';
    }

    // Build sector factors from real data
    const getSectorFactors = () => {
        if (loading || !data) return [];

        const sectorNames = [
            { id: "technology", title: "Technology", category: "Growth Sectors" },
            { id: "financials", title: "Financials", category: "Value Sectors" },
            { id: "healthcare", title: "Healthcare", category: "Defensive Sectors" },
            { id: "energy", title: "Energy", category: "Commodity Sectors" },
            { id: "utilities", title: "Utilities", category: "Defensive Sectors" },
            { id: "consumer_discretionary", title: "Consumer Discretionary", category: "Cyclical Sectors" },
            { id: "consumer_staples", title: "Consumer Staples", category: "Defensive Sectors" },
            { id: "industrials", title: "Industrials", category: "Cyclical Sectors" },
            { id: "materials", title: "Materials", category: "Commodity Sectors" },
            { id: "real_estate", title: "Real Estate", category: "Interest Rate Sensitive" },
            { id: "communication_services", title: "Communication Services", category: "Growth Sectors" }
        ];

        return sectorNames.map(sector => {
            // Get latest data for this sector
            const pricePerf = getLatestSectorValue('price_performance', sector.id);
            const relativePerf = getLatestSectorValue('relative_performance', sector.id);
            const momentum = getLatestSectorValue('momentum_score', sector.id);
            const rotation = getLatestSectorValue('sector_rotation_signal', sector.id);

            // Use relative performance as current value and determine trend
            const currentValue = relativePerf?.value || 0;
            const priceValue = pricePerf?.value || 0;

            // Determine trend based on momentum score
            const momentumValue = momentum?.value || 50;
            const trend = momentumValue > 55 ? "up" : momentumValue < 45 ? "down" : "neutral";
            const severity = currentValue > 5 ? "positive" : currentValue < -5 ? "negative" : "neutral";

            // Calculate change (mock for now, would need historical data)
            const change = currentValue * 0.1; // Mock 10% of current as change

            // Get historical data for chart - temporarily disabled as time series data needs restructuring
            // const chartData = data.relativePerformance?.filter(item => item.sector === sector.id) || [];
            // const formattedChartData = chartData.slice(-6).map(item => ({
            //     date: item.date.substring(0, 7), // YYYY-MM format
            //     value: item.value
            // }));

            // For now, generate trend data based on current values (this is temporary until time series is fixed)
            const generateTrendData = (currentVal) => {
                const baseDate = new Date();
                const months = [];
                for (let i = 5; i >= 0; i--) {
                    const date = new Date(baseDate.getFullYear(), baseDate.getMonth() - i, 1);
                    const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    // Generate realistic trend based on momentum and current value
                    const trend = (momentumValue - 50) * 0.1; // Convert momentum to trend
                    const noise = (Math.random() - 0.5) * 2; // Add some random variation
                    const value = currentVal * (0.85 + (i * 0.03) + trend + noise);
                    // Convert date to timestamp for chart compatibility
                    const timestamp = Math.floor(date.getTime() / 1000);
                    months.push({ 
                        time: timestamp,
                        date: monthStr, 
                        value: value 
                    });
                }
                return months;
            };

            return {
                id: sector.id,
                title: sector.title,
                category: sector.category,
                currentValue: formatPercentage(currentValue),
                change: formatPercentage(change),
                trend,
                severity,
                description: `${sector.title} sector performance vs S&P 500`,
                data: generateTrendData(currentValue),
                source: "Real-time: Yahoo Finance via SPDR ETFs (Charts: Generated trends)",
                benchmark: "Relative to S&P 500 performance",
                // Additional real data
                pricePerformance: priceValue,
                relativePerformance: currentValue,
                momentumScore: momentumValue,
                rotationSignal: rotation?.value || 50,
                // Add update info based on available metadata
                updateInfo: metadata?.relativePerformance ? processUpdateInfo({
                    ...metadata.relativePerformance,
                    frequency: 'daily'
                }) : null
            };
        });
    };

    const sectorFactors = getSectorFactors();
    console.log('Sector factors loaded:', sectorFactors.length, sectorFactors);

    if (loading) {
        return (
            <div className="p-6 space-y-6 bg-white dark:bg-[#0F0F12]">
                <div className="animate-pulse">
                    {/* Header */}
                    <div className="flex items-center gap-3 mb-4">
                        <div className="h-10 w-10 bg-gray-200 dark:bg-gray-600 rounded-xl animate-pulse"></div>
                        <div className="h-8 bg-gray-200 dark:bg-gray-600 rounded-lg w-64 animate-pulse"></div>
                    </div>
                    <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded-lg w-96 mb-8 animate-pulse"></div>

                    {/* Top Section: Score + Main Chart */}
                    <div className="grid grid-cols-1 lg:grid-cols-7 gap-6 mb-8">
                        {/* Score Card Loading */}
                        <div className="bg-white dark:bg-[#1F1F23] border border-gray-200 dark:border-[#2B2B30] rounded-xl shadow-lg lg:col-span-2 p-6 space-y-4">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="h-6 w-6 bg-gray-200 dark:bg-gray-600 rounded-lg animate-pulse"></div>
                                <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-24 animate-pulse"></div>
                            </div>
                            <div className="text-center space-y-3 p-4 bg-gray-50 dark:bg-[#0F0F12] rounded-xl">
                                <div className="h-16 w-16 bg-gray-200 dark:bg-gray-600 rounded-full mx-auto animate-pulse"></div>
                                <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-16 mx-auto animate-pulse"></div>
                                <div className="h-6 bg-gray-200 dark:bg-gray-600 rounded w-20 mx-auto animate-pulse"></div>
                            </div>
                            <div className="space-y-2">
                                <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-20 animate-pulse"></div>
                                <div className="space-y-1">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-[#0F0F12] rounded-lg">
                                            <div className="h-2 w-2 bg-gray-300 dark:bg-gray-600 rounded-full animate-pulse"></div>
                                            <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded flex-1 animate-pulse"></div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Main Chart Loading */}
                        <div className="bg-white dark:bg-[#1F1F23] border border-gray-200 dark:border-[#2B2B30] rounded-xl shadow-lg lg:col-span-5 p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="h-6 bg-gray-200 dark:bg-gray-600 rounded w-48 animate-pulse"></div>
                                <div className="flex gap-2">
                                    {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                                        <div key={i} className="h-8 w-12 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>
                                    ))}
                                </div>
                            </div>
                            <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-64 mb-4 animate-pulse"></div>
                            <div className="h-80 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse"></div>
                            
                            {/* Updated info section loading */}
                            <div className="flex justify-between items-center mt-4">
                                <div className="flex gap-2">
                                    <div className="h-6 bg-gray-100 dark:bg-gray-700 rounded w-40 animate-pulse"></div>
                                    <div className="h-6 bg-gray-100 dark:bg-gray-700 rounded w-32 animate-pulse"></div>
                                </div>
                                <div className="flex gap-1">
                                    <div className="h-8 w-8 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>
                                    <div className="h-8 w-8 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Section: Factor Grid */}
                    <div className="space-y-4">
                        <div className="h-6 bg-gray-200 dark:bg-gray-600 rounded-lg w-48 animate-pulse"></div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {[1, 2, 3, 4, 5, 6].map((i) => (
                                <div key={i} className="bg-white dark:bg-[#1F1F23] border border-gray-200 dark:border-[#2B2B30] rounded-xl shadow-lg p-6 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="h-4 w-4 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>
                                            <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-32 animate-pulse"></div>
                                        </div>
                                        <div className="flex gap-2">
                                            <div className="h-4 w-4 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>
                                            <div className="h-4 w-4 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="h-8 bg-gray-200 dark:bg-gray-600 rounded w-20 animate-pulse"></div>
                                        <div className="flex items-center gap-2">
                                            <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-12 animate-pulse"></div>
                                            <div className="h-6 bg-gray-200 dark:bg-gray-600 rounded w-12 animate-pulse"></div>
                                        </div>
                                    </div>
                                    <div className="h-20 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse"></div>
                                    <div className="space-y-2">
                                        <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-full animate-pulse"></div>
                                        <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-3/4 animate-pulse"></div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="h-6 bg-gray-200 dark:bg-gray-600 rounded w-16 animate-pulse"></div>
                                        <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-24 animate-pulse"></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // Show error state if there's an error
    if (error) {
        return (
            <div className="p-6 space-y-6 bg-white dark:bg-[#0F0F12]">
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
                    <div className="text-red-600 dark:text-red-400 text-lg font-semibold mb-2">
                        Unable to load Sector Performance data
                    </div>
                    <p className="text-red-600 dark:text-red-400">
                        Please check your internet connection and try again.
                    </p>
                </div>
            </div>
        )
    }


    // Calculate overall score
    const overallScore = sectorFactors.length > 0 ? 
        (sectorFactors.reduce((sum, factor) => sum + (factor.score || 7), 0) / sectorFactors.length).toFixed(1) :
        "N/A"

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
        return sectorFactors.find(factor => factor.id === selectedFactor) || sectorFactors[0]
    }

    // Navigation functions for factor switching
    const navigateToNextFactor = () => {
        const currentIndex = sectorFactors.findIndex(factor => factor.id === selectedFactor)
        const nextIndex = (currentIndex + 1) % sectorFactors.length
        setSelectedFactor(sectorFactors[nextIndex].id)
    }

    const navigateToPrevFactor = () => {
        const currentIndex = sectorFactors.findIndex(factor => factor.id === selectedFactor)
        const prevIndex = currentIndex === 0 ? sectorFactors.length - 1 : currentIndex - 1
        setSelectedFactor(sectorFactors[prevIndex].id)
    }

    // Category navigation functions
    const navigateToNextCategory = () => {
        const currentIndex = categories.findIndex(cat => cat.name === selectedCategory)
        const nextIndex = (currentIndex + 1) % categories.length
        const nextCategory = categories[nextIndex]
        router.push(`/analytics/${nextCategory.page}`)
    }

    const navigateToPrevCategory = () => {
        const currentIndex = categories.findIndex(cat => cat.name === selectedCategory)
        const prevIndex = currentIndex === 0 ? categories.length - 1 : currentIndex - 1
        const prevCategory = categories[prevIndex]
        router.push(`/analytics/${prevCategory.page}`)
    }

    // Get category info for display
    const getCurrentCategory = () => {
        return categories.find(cat => cat.page === 'sector-performance') || categories[0]
    }

    const currentCategory = getCurrentCategory()
    const currentCategoryIndex = categories.findIndex(cat => cat.name === selectedCategory)
    const totalCategories = categories.length

    const selectedFactorObject = getSelectedFactor()
    console.log('selectedFactorObject:', selectedFactorObject);
    
    const selectedFactorData = selectedFactorObject && Array.isArray(selectedFactorObject.data) && selectedFactorObject.data.length > 0 ?
        [selectedFactorObject.data] : []
    
    console.log('selectedFactorData for chart:', selectedFactorData);

    // Add source details for each factor
    const getSourceDetails = (factorId) => {
        switch (factorId) {
            case "technology":
                return {
                    title: "Technology Sector",
                    description: "Technology sector performance relative to S&P 500, including software, hardware, semiconductors, and technology services companies.",
                    provider: "S&P Dow Jones Indices",
                    frequency: "Daily",
                    availability: "1989 to Present",
                    methodology: "Market-cap weighted index of technology companies within S&P 500, measured relative to overall index performance.",
                    url: "https://www.spglobal.com/spdji/en/indices/equity/sp-500-information-technology/",
                    lastUpdated: "Updated daily at market close"
                }
            case "financials":
                return {
                    title: "Financial Services Sector",
                    description: "Financial sector performance including banks, insurance companies, real estate, and other financial services relative to S&P 500.",
                    provider: "S&P Dow Jones Indices",
                    frequency: "Daily",
                    availability: "1989 to Present",
                    methodology: "Market-cap weighted index of financial companies within S&P 500, sensitive to interest rate changes and economic cycles.",
                    url: "https://www.spglobal.com/spdji/en/indices/equity/sp-500-financials/",
                    lastUpdated: "Updated daily at market close"
                }
            case "healthcare":
                return {
                    title: "Healthcare Sector",
                    description: "Healthcare sector performance including pharmaceuticals, biotechnology, medical devices, and healthcare services relative to S&P 500.",
                    provider: "S&P Dow Jones Indices",
                    frequency: "Daily",
                    availability: "1989 to Present",
                    methodology: "Market-cap weighted index of healthcare companies within S&P 500, typically considered a defensive sector with steady growth.",
                    url: "https://www.spglobal.com/spdji/en/indices/equity/sp-500-health-care/",
                    lastUpdated: "Updated daily at market close"
                }
            case "energy":
                return {
                    title: "Energy Sector",
                    description: "Energy sector performance including oil & gas exploration, refining, and renewable energy companies relative to S&P 500.",
                    provider: "S&P Dow Jones Indices",
                    frequency: "Daily",
                    availability: "1989 to Present",
                    methodology: "Market-cap weighted index of energy companies within S&P 500, highly correlated with commodity prices, particularly oil.",
                    url: "https://www.spglobal.com/spdji/en/indices/equity/sp-500-energy/",
                    lastUpdated: "Updated daily at market close"
                }
            case "utilities":
                return {
                    title: "Utilities Sector",
                    description: "Utilities sector performance including electric, gas, and water utilities, typically offering steady dividends and defensive characteristics.",
                    provider: "S&P Dow Jones Indices",
                    frequency: "Daily",
                    availability: "1989 to Present",
                    methodology: "Market-cap weighted index of utility companies within S&P 500, sensitive to interest rates due to high dividend yields.",
                    url: "https://www.spglobal.com/spdji/en/indices/equity/sp-500-utilities/",
                    lastUpdated: "Updated daily at market close"
                }
            case "consumer_discretionary":
                return {
                    title: "Consumer Discretionary Sector",
                    description: "Consumer discretionary sector performance including retail, automotive, hotels, and other non-essential consumer goods and services.",
                    provider: "S&P Dow Jones Indices",
                    frequency: "Daily",
                    availability: "1989 to Present",
                    methodology: "Market-cap weighted index of consumer discretionary companies within S&P 500, sensitive to economic cycles and consumer spending.",
                    url: "https://www.spglobal.com/spdji/en/indices/equity/sp-500-consumer-discretionary/",
                    lastUpdated: "Updated daily at market close"
                }
            case "consumer_staples":
                return {
                    title: "Consumer Staples Sector",
                    description: "Consumer staples sector performance including food, beverages, household goods, and other essential consumer products.",
                    provider: "S&P Dow Jones Indices",
                    frequency: "Daily",
                    availability: "1989 to Present",
                    methodology: "Market-cap weighted index of consumer staples companies within S&P 500, typically considered defensive with stable demand.",
                    url: "https://www.spglobal.com/spdji/en/indices/equity/sp-500-consumer-staples/",
                    lastUpdated: "Updated daily at market close"
                }
            case "industrials":
                return {
                    title: "Industrials Sector",
                    description: "Industrials sector performance including aerospace, defense, machinery, transportation, and infrastructure companies.",
                    provider: "S&P Dow Jones Indices",
                    frequency: "Daily",
                    availability: "1989 to Present",
                    methodology: "Market-cap weighted index of industrial companies within S&P 500, sensitive to economic growth and capital investment cycles.",
                    url: "https://www.spglobal.com/spdji/en/indices/equity/sp-500-industrials/",
                    lastUpdated: "Updated daily at market close"
                }
            case "materials":
                return {
                    title: "Materials Sector",
                    description: "Materials sector performance including chemicals, metals, mining, forestry, and packaging companies.",
                    provider: "S&P Dow Jones Indices",
                    frequency: "Daily",
                    availability: "1989 to Present",
                    methodology: "Market-cap weighted index of materials companies within S&P 500, highly correlated with commodity prices and economic cycles.",
                    url: "https://www.spglobal.com/spdji/en/indices/equity/sp-500-materials/",
                    lastUpdated: "Updated daily at market close"
                }
            case "real_estate":
                return {
                    title: "Real Estate Sector",
                    description: "Real estate sector performance including REITs and real estate management companies.",
                    provider: "S&P Dow Jones Indices",
                    frequency: "Daily",
                    availability: "2016 to Present",
                    methodology: "Market-cap weighted index of real estate companies within S&P 500, sensitive to interest rates and economic conditions.",
                    url: "https://www.spglobal.com/spdji/en/indices/equity/sp-500-real-estate/",
                    lastUpdated: "Updated daily at market close"
                }
            case "communication_services":
                return {
                    title: "Communication Services Sector",
                    description: "Communication services sector performance including telecommunications, media, entertainment, and interactive media companies.",
                    provider: "S&P Dow Jones Indices",
                    frequency: "Daily",
                    availability: "2018 to Present",
                    methodology: "Market-cap weighted index of communication services companies within S&P 500, includes traditional telecom and modern digital platforms.",
                    url: "https://www.spglobal.com/spdji/en/indices/equity/sp-500-communication-services/",
                    lastUpdated: "Updated daily at market close"
                }
            case "sector-rotation":
                return {
                    title: "Sector Rotation Signal",
                    description: "Proprietary indicator measuring market preference between growth and value styles, indicating risk appetite and sector rotation trends.",
                    provider: "Fidelity Research",
                    frequency: "Weekly",
                    availability: "2000 to Present",
                    methodology: "Composite score based on relative performance of growth vs value sectors, momentum indicators, and market breadth metrics.",
                    url: "https://www.fidelity.com/",
                    lastUpdated: "Updated weekly on market days"
                }
            default:
                return {
                    title: "Data Source",
                    description: "Sector performance data source information",
                    provider: "Financial Data Providers",
                    frequency: "Varies",
                    availability: "Historical data",
                    methodology: "Standard sector performance measurement techniques",
                    url: "#",
                    lastUpdated: "Updates vary by data source"
                }
        }
    }

    const getIconComponent = (factorId) => {
        switch (factorId) {
            case "technology":
                return Cpu
            case "financials":
                return Building2
            case "healthcare":
                return Heart
            case "energy":
                return Zap
            case "utilities":
                return Home
            case "sector-rotation":
                return Activity
            default:
                return Zap
        }
    }

    return (
        <div className="p-6 space-y-6 fade-in bg-white dark:bg-[#0F0F12]">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-green-600 to-emerald-600 rounded-xl shadow-lg">
                        <Layers className="h-6 w-6 text-white" />
                    </div>
                    Sector Performance Analysis
                </h1>
                <div className="flex flex-wrap justify-between items-center gap-4">
                    <p className="text-gray-600 dark:text-gray-400">
                        Sector rotation trends, relative performance metrics, and market leadership indicators
                    </p>
                    
                    {/* Minimal Category Navigation */}
                    <div className="flex items-center gap-2">

                        <div className="flex items-center gap-1">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={navigateToPrevCategory}
                                className="h-15 w-15 p-0 hover:bg-gray-100 dark:hover:bg-gray-800"
                                title="Previous"
                            >
                                <ChevronLeft className="h-5 w-5" />
                            </Button>
                            
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowCategoryGrid(!showCategoryGrid)}
                                className={`h-6 w-6 p-0 ${showCategoryGrid ? 'bg-gray-100 dark:bg-gray-800' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                                title="All Categories"
                            >
                                <Grid3X3 className="h-4 w-4" />
                            </Button>
                            
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={navigateToNextCategory}
                                className="h-15 w-15 p-0 hover:bg-gray-100 dark:hover:bg-gray-800"
                                title="Next"
                            >
                                <ChevronRight className="h-5 w-5" />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Minimal Category Grid */}
            {showCategoryGrid && (
                <div className="mb-6 animate-in slide-in-from-top-2 duration-200">
                    <Card className="border border-gray-200 dark:border-[#2B2B30] bg-white dark:bg-[#1F1F23]">
                        <CardContent className="p-4">
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                                {categories.map((category, index) => (
                                    <Button
                                        key={category.page}
                                        variant={index === currentCategoryIndex ? "secondary" : "ghost"}
                                        size="sm"
                                        className={`h-auto p-2 justify-start gap-2 ${
                                            index === currentCategoryIndex ? 'bg-blue-50 dark:bg-blue-950/20' : ''
                                        }`}
                                        onClick={() => {
                                            router.push(`/analytics/${category.page}`)
                                            setShowCategoryGrid(false)
                                        }}
                                    >
                                        <div className={`p-1 bg-gradient-to-r ${category.color} rounded`}>
                                            <category.icon className="h-3 w-3 text-white" />
                                        </div>
                                        <span className="text-xs font-medium truncate">{category.name}</span>
                                    </Button>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Top Section: Corporate Earnings Factor + Main Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-7 gap-6 mb-8">
                {/* Left: Selected Corporate Earnings Factor (1/4 width) */}
                <Card className="lg:col-span-2 slide-in-left stagger-1 hover:shadow-lg transition-all duration-200 cursor-pointer group border border-gray-200 dark:border-[#2B2B30] shadow-sm bg-white dark:bg-[#1F1F23] card-glow">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 group-hover:text-green-600 transition-all duration-200 text-base font-semibold">
                            <div className="p-1.5 bg-gradient-to-br from-green-600 to-emerald-600 rounded-lg shadow-md group-hover:scale-105 transition-transform duration-200">
                                <Layers className="h-4 w-4 text-white" />
                            </div>
                            Sector Health
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
                                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-1.5 flex-shrink-0"></div>
                                    <span className="leading-tight">Tech leading performance</span>
                                </div>
                                <div className="flex items-start gap-2 hover:bg-gray-50 dark:hover:bg-[#0F0F12] p-1.5 rounded-lg transition-all duration-200 cursor-pointer">
                                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-1.5 flex-shrink-0"></div>
                                    <span className="leading-tight">Growth rotation active</span>
                                </div>
                                <div className="flex items-start gap-2 hover:bg-gray-50 dark:hover:bg-[#0F0F12] p-1.5 rounded-lg transition-all duration-200 cursor-pointer">
                                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1.5 flex-shrink-0"></div>
                                    <span className="leading-tight">Defensive lagging</span>
                                </div>
                            </div>
                        </div>

                        {/* Sector Outlook */}
                        <div className="space-y-2">
                            <h4 className="font-semibold text-gray-900 dark:text-white text-xs">Sector Outlook</h4>
                            <div className="space-y-1 text-xs">
                                <div className="flex items-center justify-between hover:bg-gray-50 dark:hover:bg-[#0F0F12] p-1.5 rounded-lg transition-all duration-200 cursor-pointer">
                                    <span>Market Regime</span>
                                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs hover:shadow-md transition-all duration-200 hover:scale-105">Risk-On</Badge>
                                </div>
                                <div className="flex items-center justify-between hover:bg-gray-50 dark:hover:bg-[#0F0F12] p-1.5 rounded-lg transition-all duration-200 cursor-pointer">
                                    <span>Rotation</span>
                                    <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs hover:shadow-md transition-all duration-200 hover:scale-105">Growth</Badge>
                                </div>
                                <div className="flex items-center justify-between hover:bg-gray-50 dark:hover:bg-[#0F0F12] p-1.5 rounded-lg transition-all duration-200 cursor-pointer">
                                    <span>Breadth</span>
                                    <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 text-xs hover:shadow-md transition-all duration-200 hover:scale-105">Moderate</Badge>
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
                                            return <IconComponent className="h-5 w-5 text-green-600" />
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
                                        className="h-8 w-8 p-0 ml-2 hover:bg-green-50 dark:hover:bg-green-900 hover:scale-105 transition-all duration-200 hover:shadow-md"
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
                                        onClick={() => handlePeriodChange(period)}
                                        className={`timeframe-button  text-xs transition-all duration-200 hover:scale-105 hover:shadow-md ${
                                            selectedPeriod === period ? 'bg-green-600 text-white shadow-lg' : ''
                                        } ${isTransitioning ? 'pointer-events-none opacity-70' : ''}`}
                                        disabled={isTransitioning}
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
                        
                        {/* Updated info with navigation buttons - same as monetary policy */}
                        <div className="flex justify-between items-center mt-4">
                            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                {selectedFactorObject?.updateInfo && (
                                    <>
                                        <span className={`flex items-center gap-1 px-2 py-1 bg-gray-50 dark:bg-[#1A1A1A] rounded-md border border-gray-200 dark:border-[#2B2B30] ${selectedFactorObject.updateInfo.statusColor}`}>
                                            <Info className="h-4 w-4" />
                                            Updated: {selectedFactorObject.updateInfo.lastUpdate}
                                        </span>
                                        <span className="flex items-center gap-1 px-2 py-1 bg-gray-50 dark:bg-[#1A1A1A] rounded-md border border-gray-200 dark:border-[#2B2B30]">
                                            <Target className="h-4 w-4" />
                                            Next Release: {selectedFactorObject.updateInfo.nextRelease}
                                        </span>
                                    </>
                                )}
                                {!selectedFactorObject?.updateInfo && (
                                    <>
                                        <span className="flex items-center gap-1 px-2 py-1 bg-gray-50 dark:bg-[#1A1A1A] rounded-md border border-gray-200 dark:border-[#2B2B30]">
                                            <Info className="h-4 w-4" />
                                            Updated: Market Close Daily
                                        </span>
                                        <span className="flex items-center gap-1 px-2 py-1 bg-gray-50 dark:bg-[#1A1A1A] rounded-md border border-gray-200 dark:border-[#2B2B30]">
                                            <Target className="h-4 w-4" />
                                            Next Release: Next Trading Day
                                        </span>
                                    </>
                                )}
                            </div>
                            
                            {/* Factor Navigation Buttons */}
                            <div className="flex items-center gap-1">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        const currentIndex = sectorFactors.findIndex(factor => factor.id === selectedFactor)
                                        const prevIndex = currentIndex === 0 ? sectorFactors.length - 1 : currentIndex - 1
                                        setSelectedFactor(sectorFactors[prevIndex].id)
                                    }}
                                    className="h-8 w-8 p-0 hover:bg-green-50 dark:hover:bg-green-950/30"
                                    title="Previous Factor"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        const currentIndex = sectorFactors.findIndex(factor => factor.id === selectedFactor)
                                        const nextIndex = (currentIndex + 1) % sectorFactors.length
                                        setSelectedFactor(sectorFactors[nextIndex].id)
                                    }}
                                    className="h-8 w-8 p-0 hover:bg-green-50 dark:hover:bg-green-950/30"
                                    title="Next Factor"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Bottom Section: Risk Factors Grid */}
            <div className="slide-in-up">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Sector Performance Factors</h3>
                {sectorFactors.length === 0 ? (
                    <div className="text-center py-8">
                        <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-gray-400" />
                        <p className="text-gray-500">Loading sector performance data...</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {sectorFactors.map((factor, index) => {
                            const IconComponent = getIconComponent(factor.id)
                            return (
                                <Card
                                    key={factor.id}
                                    className={`cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] hover:-translate-y-1 ${selectedFactor === factor.id ? 'ring-2 ring-green-500 shadow-lg scale-[1.02] bg-green-50 dark:bg-green-950/30' : ''
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
                                                                    return <IconComponent className="h-5 w-5 text-green-600" />
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
                                                <Badge className="text-sm bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-2 py-1">
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
                                                    {factor.trend === 'up' ? 'Outperforming' : factor.trend === 'down' ? 'Underperforming' : 'Neutral'}
                                                </Badge>
                                                <span className="text-xs">vs S&P 500</span>
                                            </div>
                                            <span className="truncate text-sm group-hover:text-gray-600 dark:group-hover:text-gray-400 transition-colors duration-300">{factor.source}</span>
                                        </div>
                                    </CardContent>
                                </Card>
                            )
                        })}
                    </div>
                )}
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
