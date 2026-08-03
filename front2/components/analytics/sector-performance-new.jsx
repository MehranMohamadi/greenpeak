"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import MultiLineChart from "../charts/multi-line-chart"
import SectorPerformanceChart from "../charts/sector-performance-chart"
import MiniChart from "./mini-chart"
import FullScreenChart from './fullscreen-chart'
import useSectorPerformanceData from "../../hooks/useSectorPerformanceData"
import { 
    BarChart3, TrendingUp, TrendingDown, Activity, AlertTriangle, 
    CheckCircle, XCircle, ChevronLeft, ChevronRight, Info, 
    ExternalLink, Calendar, Database, Zap, Layers, Cpu, Heart, 
    Maximize2, Building2, Home, Target, Timer, RefreshCw
} from "lucide-react"

export default function SectorPerformance() {
    const { data, loading, error, metadata, getAllSectorsLatest, getLatestSectorValue } = useSectorPerformanceData();
    const [selectedFactor, setSelectedFactor] = useState('technology')
    const [selectedPeriod, setSelectedPeriod] = useState('5Y')
    const [isFullScreen, setIsFullScreen] = useState(false)

    // Helper function to format percentage
    const formatPercentage = (value) => {
        if (value === null || value === undefined || isNaN(value)) return "N/A";
        return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
    };

    // Get real sector performance data
    const getSectorFactors = () => {
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

            // Generate trend data based on current values (temporary until time series is fixed)
            const generateTrendData = (currentVal) => {
                const baseDate = new Date();
                const months = [];
                for (let i = 5; i >= 0; i--) {
                    const date = new Date(baseDate.getFullYear(), baseDate.getMonth() - i, 1);
                    const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    // Generate realistic trend based on momentum and current value
                    const trendFactor = (momentumValue - 50) * 0.1; // Convert momentum to trend
                    const noise = (Math.random() - 0.5) * 2; // Add some random variation
                    const value = currentVal * (0.85 + (i * 0.03) + trendFactor + noise);
                    months.push({ date: monthStr, value: value });
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
                rotationSignal: rotation?.value || 50
            };
        });
    };

    const sectorFactors = getSectorFactors();

    // Helper functions
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
            default:
                return Activity
        }
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

    const handleFactorClick = (factor) => {
        setSelectedFactor(factor.id)
    }

    const getSelectedFactor = () => {
        return sectorFactors.find(factor => factor.id === selectedFactor) || sectorFactors[0]
    }

    const selectedFactorObject = getSelectedFactor()

    if (loading) {
        return (
            <div className="p-6 space-y-6">
                <div className="text-center">
                    <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
                    <p>Loading sector performance data...</p>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="p-6 space-y-6">
                <div className="text-center text-red-500">
                    <AlertTriangle className="h-8 w-8 mx-auto mb-4" />
                    <p>Error loading sector data: {error}</p>
                </div>
            </div>
        )
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
                <p className="text-gray-600 dark:text-gray-400">
                    Sector rotation trends, relative performance metrics, and market leadership indicators
                </p>
            </div>

            {/* Sector Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sectorFactors.map((factor) => {
                    const IconComponent = getIconComponent(factor.id)
                    const isSelected = selectedFactor === factor.id
                    
                    return (
                        <Card 
                            key={factor.id}
                            className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
                                isSelected ? 'ring-2 ring-blue-500 shadow-lg' : ''
                            }`}
                            onClick={() => handleFactorClick(factor)}
                        >
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                        <div className="p-2 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg">
                                            <IconComponent className="h-5 w-5 text-white" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-lg">{factor.title}</CardTitle>
                                            <CardDescription className="text-sm">{factor.category}</CardDescription>
                                        </div>
                                    </div>
                                    {getTrendIcon(factor.trend)}
                                </div>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-2xl font-bold text-gray-900 dark:text-white">
                                            {factor.currentValue}
                                        </span>
                                        <Badge variant={factor.severity === 'positive' ? 'default' : 'secondary'}>
                                            {factor.change}
                                        </Badge>
                                    </div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        {factor.description}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    )
                })}
            </div>

            {/* Selected Factor Details */}
            {selectedFactorObject && (
                <Card className="mt-8">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-3">
                            <div className="p-2 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg">
                                {React.createElement(getIconComponent(selectedFactorObject.id), {
                                    className: "h-5 w-5 text-white"
                                })}
                            </div>
                            {selectedFactorObject.title} Performance
                        </CardTitle>
                        <CardDescription>
                            Detailed performance analysis and trends
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-80">
                            <SectorPerformanceChart
                                data={selectedFactorObject.data}
                                title={selectedFactorObject.title}
                                color="#3B82F6"
                            />
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Full Screen Chart Modal */}
            <FullScreenChart
                isOpen={isFullScreen}
                onClose={() => setIsFullScreen(false)}
                selectedFactor={selectedFactorObject}
            />
        </div>
    )
}
