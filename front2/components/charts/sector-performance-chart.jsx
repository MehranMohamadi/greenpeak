import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  TrendingUp, 
  TrendingDown,
  BarChart3, 
  Activity, 
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  Timer
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const SectorPerformanceChart = ({ data, metadata, loading, error }) => {
  const [selectedMetric, setSelectedMetric] = useState("relative_performance");
  const [selectedTimeframe, setSelectedTimeframe] = useState("1M");

  // Sector mappings with colors and icons
  const sectorConfig = {
    technology: { 
      name: "Technology", 
      color: "#3B82F6", 
      bgColor: "bg-blue-50 dark:bg-blue-900/20",
      icon: "💻",
      etf: "XLK"
    },
    financials: { 
      name: "Financials", 
      color: "#10B981", 
      bgColor: "bg-green-50 dark:bg-green-900/20",
      icon: "🏦",
      etf: "XLF"
    },
    healthcare: { 
      name: "Healthcare", 
      color: "#F59E0B", 
      bgColor: "bg-amber-50 dark:bg-amber-900/20",
      icon: "🏥",
      etf: "XLV"
    },
    energy: { 
      name: "Energy", 
      color: "#EF4444", 
      bgColor: "bg-red-50 dark:bg-red-900/20",
      icon: "⚡",
      etf: "XLE"
    },
    utilities: { 
      name: "Utilities", 
      color: "#8B5CF6", 
      bgColor: "bg-purple-50 dark:bg-purple-900/20",
      icon: "🔌",
      etf: "XLU"
    },
    consumer_discretionary: { 
      name: "Consumer Discretionary", 
      color: "#EC4899", 
      bgColor: "bg-pink-50 dark:bg-pink-900/20",
      icon: "🛍️",
      etf: "XLY"
    },
    consumer_staples: { 
      name: "Consumer Staples", 
      color: "#06B6D4", 
      bgColor: "bg-cyan-50 dark:bg-cyan-900/20",
      icon: "🛒",
      etf: "XLP"
    },
    industrials: { 
      name: "Industrials", 
      color: "#84CC16", 
      bgColor: "bg-lime-50 dark:bg-lime-900/20",
      icon: "🏭",
      etf: "XLI"
    },
    materials: { 
      name: "Materials", 
      color: "#F97316", 
      bgColor: "bg-orange-50 dark:bg-orange-900/20",
      icon: "⛏️",
      etf: "XLB"
    },
    real_estate: { 
      name: "Real Estate", 
      color: "#6366F1", 
      bgColor: "bg-indigo-50 dark:bg-indigo-900/20",
      icon: "🏠",
      etf: "XLRE"
    },
    communication_services: { 
      name: "Communication Services", 
      color: "#14B8A6", 
      bgColor: "bg-teal-50 dark:bg-teal-900/20",
      icon: "📡",
      etf: "XLC"
    }
  };

  // Process latest sector data for the heatmap
  const sectorPerformanceData = useMemo(() => {
    if (!data?.allSectorsLatest || !data.allSectorsLatest[selectedMetric]) {
      return [];
    }

    const latestData = data.allSectorsLatest[selectedMetric];
    
    return Object.entries(latestData).map(([sector, sectorData]) => ({
      sector,
      value: sectorData.value,
      date: sectorData.date,
      config: sectorConfig[sector] || { 
        name: sector, 
        color: "#6B7280", 
        bgColor: "bg-gray-50 dark:bg-gray-900/20",
        icon: "📊",
        etf: "N/A"
      }
    })).sort((a, b) => b.value - a.value);
  }, [data, selectedMetric]);

  // Format value based on metric type
  const formatValue = (value, metric) => {
    if (!value) return "N/A";
    
    switch (metric) {
      case "relative_performance":
        return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
      case "momentum_score":
      case "sector_rotation_signal":
        return value.toFixed(1);
      case "price_performance":
        return `$${value.toFixed(2)}`;
      default:
        return value.toFixed(2);
    }
  };

  // Get metric description
  const getMetricDescription = (metric) => {
    const descriptions = {
      price_performance: "Absolute price performance of sector ETFs",
      relative_performance: "Performance relative to S&P 500 (SPY)",
      momentum_score: "Technical momentum scores (0-100 scale)",
      sector_rotation_signal: "Sector rotation signals (0-100 scale)"
    };
    return descriptions[metric] || "Sector performance metric";
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };

  const cardVariants = {
    hidden: { y: 20, opacity: 0, scale: 0.95 },
    visible: {
      y: 0,
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.4,
        ease: [0.16, 1, 0.3, 1]
      }
    }
  };

  if (loading) {
    return (
      <Card className="border-2 border-gray-200 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            Sector Performance
          </CardTitle>
          <CardDescription>Loading sector performance data...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] flex items-center justify-center">
            <motion.div 
              className="space-y-4 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"
              />
              <p className="text-gray-600 dark:text-gray-400 font-medium">
                Loading sector data...
              </p>
            </motion.div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-2 border-red-200 dark:border-red-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <BarChart3 className="h-5 w-5" />
            Sector Performance - Error
          </CardTitle>
          <CardDescription>Failed to load sector performance data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] flex items-center justify-center">
            <div className="text-center space-y-4">
              <div className="p-6 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-700">
                <p className="text-red-600 dark:text-red-400 font-medium">Error: {error}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              Sector Performance Heatmap
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-2 h-2 bg-green-400 rounded-full"
              />
            </CardTitle>
            <CardDescription className="mt-1">
              {getMetricDescription(selectedMetric)} • Live sector rotation analysis
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">
              <Timer className="h-3 w-3 mr-1" />
              Live
            </Badge>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Metric Selection */}
        <Tabs value={selectedMetric} onValueChange={setSelectedMetric}>
          <TabsList className="grid w-full grid-cols-4 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
            <TabsTrigger 
              value="relative_performance" 
              className="text-xs data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700"
            >
              Relative %
            </TabsTrigger>
            <TabsTrigger 
              value="momentum_score" 
              className="text-xs data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700"
            >
              Momentum
            </TabsTrigger>
            <TabsTrigger 
              value="sector_rotation_signal" 
              className="text-xs data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700"
            >
              Rotation
            </TabsTrigger>
            <TabsTrigger 
              value="price_performance" 
              className="text-xs data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700"
            >
              Price
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Sector Performance Grid */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {sectorPerformanceData.map((item, index) => {
            const isPositive = item.value > 0;
            const isTopPerformer = index < 3;
            const isBottomPerformer = index >= sectorPerformanceData.length - 3;
            
            return (
              <motion.div
                key={item.sector}
                variants={cardVariants}
                whileHover={{ 
                  scale: 1.05,
                  y: -4,
                  transition: { duration: 0.2 }
                }}
                whileTap={{ scale: 0.98 }}
              >
                <Card 
                  className={`relative overflow-hidden transition-all duration-300 border-2 ${
                    isTopPerformer 
                      ? "border-green-200 dark:border-green-700 bg-green-50/50 dark:bg-green-900/10" 
                      : isBottomPerformer 
                      ? "border-red-200 dark:border-red-700 bg-red-50/50 dark:bg-red-900/10"
                      : "border-gray-200 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-700"
                  }`}
                >
                  {/* Performance indicator */}
                  {isTopPerformer && (
                    <div className="absolute top-2 right-2">
                      <Badge className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300">
                        ⭐ Top
                      </Badge>
                    </div>
                  )}
                  {isBottomPerformer && (
                    <div className="absolute top-2 right-2">
                      <Badge variant="outline" className="bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300">
                        📉 Low
                      </Badge>
                    </div>
                  )}

                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div 
                        className={`p-2 rounded-lg ${item.config.bgColor}`}
                        style={{ backgroundColor: `${item.config.color}20` }}
                      >
                        <span className="text-lg">{item.config.icon}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                          {item.config.name}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          ETF: {item.config.etf}
                        </p>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-600 dark:text-gray-400">
                          {selectedMetric.replace('_', ' ').toUpperCase()}
                        </span>
                        <div className={`flex items-center gap-1 text-sm font-bold ${
                          isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                        }`}>
                          {isPositive ? (
                            <ArrowUpRight className="h-3 w-3" />
                          ) : (
                            <ArrowDownRight className="h-3 w-3" />
                          )}
                          {formatValue(item.value, selectedMetric)}
                        </div>
                      </div>
                      
                      {/* Performance bar */}
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <motion.div
                          className={`h-2 rounded-full ${
                            isPositive ? 'bg-green-500' : 'bg-red-500'
                          }`}
                          initial={{ width: 0 }}
                          animate={{ 
                            width: `${Math.min(Math.abs(item.value) * 2, 100)}%` 
                          }}
                          transition={{ duration: 0.8, delay: index * 0.1 }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Summary Stats */}
        {sectorPerformanceData.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700"
          >
            <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="text-xs text-green-600 dark:text-green-400 font-medium">BEST PERFORMER</div>
              <div className="text-sm font-bold text-green-700 dark:text-green-300 mt-1">
                {sectorPerformanceData[0]?.config.name}
              </div>
              <div className="text-xs text-green-600 dark:text-green-400">
                {formatValue(sectorPerformanceData[0]?.value, selectedMetric)}
              </div>
            </div>
            
            <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <div className="text-xs text-red-600 dark:text-red-400 font-medium">WORST PERFORMER</div>
              <div className="text-sm font-bold text-red-700 dark:text-red-300 mt-1">
                {sectorPerformanceData[sectorPerformanceData.length - 1]?.config.name}
              </div>
              <div className="text-xs text-red-600 dark:text-red-400">
                {formatValue(sectorPerformanceData[sectorPerformanceData.length - 1]?.value, selectedMetric)}
              </div>
            </div>
            
            <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">SECTORS TRACKED</div>
              <div className="text-lg font-bold text-blue-700 dark:text-blue-300 mt-1">
                {sectorPerformanceData.length}
              </div>
              <div className="text-xs text-blue-600 dark:text-blue-400">
                Live ETFs
              </div>
            </div>
            
            <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <div className="text-xs text-purple-600 dark:text-purple-400 font-medium">AVG PERFORMANCE</div>
              <div className="text-sm font-bold text-purple-700 dark:text-purple-300 mt-1">
                {formatValue(
                  sectorPerformanceData.reduce((sum, item) => sum + item.value, 0) / sectorPerformanceData.length,
                  selectedMetric
                )}
              </div>
              <div className="text-xs text-purple-600 dark:text-purple-400">
                All Sectors
              </div>
            </div>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
};

export default SectorPerformanceChart;
