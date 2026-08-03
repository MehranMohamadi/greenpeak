import { 
  DollarSign, 
  Activity, 
  LineChart, 
  PieChart, 
  BarChart3, 
  Brain, 
  Building2, 
  Zap, 
  Shield, 
  AlertTriangle, 
  Clock, 
  Users, 
  Eye 
} from 'lucide-react'

// Analytics categories configuration
export const analyticsCategories = [
  { 
    name: 'Monetary Policy', 
    page: 'monetary-policy', 
    icon: DollarSign, 
    color: 'from-blue-500 to-indigo-600',
    description: 'Federal Reserve policy analysis',
    completed: true
  },
  { 
    name: 'Systemic Risk', 
    page: 'systemic-risk', 
    icon: Shield, 
    color: 'from-red-500 to-rose-600',
    description: 'Financial stability indicators',
    completed: false
  },
  {
    name: 'Liquidity Flows',
    page: 'liquidity-flows',
    icon: Shield,
    color: 'from-red-500 to-rose-600',
    description: 'Financial stability indicators',
    completed: false
  },
  { 
    name: 'Macro Economic', 
    page: 'macroeconomic', 
    icon: BarChart3, 
    color: 'from-indigo-500 to-purple-600',
    description: 'Price patterns & indicators',
    completed: false
  },
  { 
    name: 'Corporate Earnings', 
    page: 'corporate-earnings', 
    icon: Users, 
    color: 'from-pink-500 to-rose-600',
    description: 'Institutional trading patterns',
    completed: false
  },
  { 
    name: 'Market Valuation', 
    page: 'valuation', 
    icon: Clock, 
    color: 'from-gray-500 to-slate-600',
    description: 'Economic events & announcements',
    completed: false
  },
  { 
    name: 'Intermarket Analysis', 
    page: 'intermarket', 
    icon: Eye, 
    color: 'from-emerald-500 to-teal-600',
    description: 'Cross-market relationships',
    completed: false
  },
  { 
    name: 'Liquidity Flows', 
    page: 'liquidity-flows', 
    icon: Activity, 
    color: 'from-blue-500 to-cyan-600',
    description: 'Market liquidity analysis',
    completed: false
  },
  { 
    name: 'Macroeconomic', 
    page: 'macro-calendar', 
    icon: AlertTriangle, 
    color: 'from-purple-500 to-violet-600',
    description: 'Economic indicators',
    completed: false
  },
  { 
    name: 'Corporate Earnings', 
    page: 'corporate-earnings', 
    icon: Building2, 
    color: 'from-orange-500 to-amber-600',
    description: 'Earnings & fundamentals',
    completed: false
  },
  { 
    name: 'Valuation', 
    page: 'valuation', 
    icon: LineChart, 
    color: 'from-cyan-500 to-blue-600',
    description: 'Market valuation metrics',
    completed: false
  },
  { 
    name: 'Sector Performance', 
    page: 'sector-performance', 
    icon: PieChart, 
    color: 'from-teal-500 to-green-600',
    description: 'Sector rotation analysis',
    completed: false
  },
  { 
    name: 'Derivatives', 
    page: 'derivatives', 
    icon: Zap, 
    color: 'from-yellow-500 to-orange-600',
    description: 'Options & futures analysis',
    completed: false
  },
  { 
    name: 'Market Internals', 
    page: 'market-internals', 
    icon: Zap, 
    color: 'from-yellow-500 to-orange-600',
    description: 'Options & futures analysis',
    completed: false
  },
  { 
    name: 'Intermarket', 
    page: 'intermarket', 
    icon: Zap, 
    color: 'from-yellow-500 to-orange-600',
    description: 'Options & futures analysis',
    completed: false
  },
  { 
    name: 'Sentiment', 
    page: 'sentiment', 
    icon: Zap, 
    color: 'from-yellow-500 to-orange-600',
    description: 'Options & futures analysis',
    completed: false
  },
  { 
    name: 'Macro Calendar', 
    page: 'macro-calendar', 
    icon: Zap, 
    color: 'from-yellow-500 to-orange-600',
    description: 'Options & futures analysis',
    completed: false
  },
  { 
    name: 'Institutional', 
    page: 'institutional', 
    icon: Zap, 
    color: 'from-yellow-500 to-orange-600',
    description: 'Options & futures analysis',
    completed: false
  },
]

// Helper function to get category by name
export const getCategoryByName = (name) => {
  return analyticsCategories.find(cat => cat.name === name)
}

// Helper function to get category by page
export const getCategoryByPage = (page) => {
  return analyticsCategories.find(cat => cat.page === page)
}

// Helper function to get current category index
export const getCategoryIndex = (name) => {
  return analyticsCategories.findIndex(cat => cat.name === name)
}
