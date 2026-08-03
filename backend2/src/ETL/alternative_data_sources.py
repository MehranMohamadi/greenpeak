#!/usr/bin/env python3
"""
Alternative Data Sources Configuration

This file documents alternative data sources to replace Yahoo Finance
when it becomes rate-limited or unavailable.

Yahoo Finance Issues:
- HTTP 429 rate limiting
- JSON parsing errors ("Expecting value: line 1 column 1")
- Aggressive anti-bot measures

Alternative Sources:
"""

# =============================================================================
# CORPORATE EARNINGS ALTERNATIVES
# =============================================================================

CORPORATE_EARNINGS_ALTERNATIVES = {
    "free_sources": {
        "SEC EDGAR API": {
            "url": "https://data.sec.gov/api/xbrl/companyconcept/CIK{cik}/us-gaap/Revenues.json",
            "description": "Official SEC filings data",
            "data_available": ["revenues", "net_income", "eps"],
            "rate_limit": "10 requests/second",
            "implementation": "Direct API calls"
        },
        "FRED Corporate Data": {
            "series": {
                "corporate_profits": "CP",
                "corporate_debt": "NCBCMDPMVCE", 
                "business_inventories": "BUSINV"
            },
            "description": "Aggregate corporate metrics from Federal Reserve",
            "implementation": "Already integrated via fredapi"
        }
    },
    "paid_sources": {
        "Alpha Vantage": {
            "endpoints": ["INCOME_STATEMENT", "BALANCE_SHEET", "CASH_FLOW"],
            "free_tier": "5 API calls per minute, 500 per day",
            "paid_tier": "$49.99/month for 1200 calls/minute"
        },
        "Financial Modeling Prep": {
            "endpoints": ["income-statement", "balance-sheet-statement"],
            "free_tier": "250 calls/day",
            "paid_tier": "$14/month for 10k calls/month"
        }
    }
}

# =============================================================================
# SECTOR PERFORMANCE ALTERNATIVES  
# =============================================================================

SECTOR_PERFORMANCE_ALTERNATIVES = {
    "free_sources": {
        "FRED Sector Indices": {
            "series": {
                "technology": "SP500#40",  # Technology sector
                "healthcare": "SP500#35",  # Healthcare sector
                "financials": "SP500#40",  # Financials sector
                "energy": "SP500#10",      # Energy sector
                "industrials": "SP500#20", # Industrials sector
                "materials": "SP500#15",   # Materials sector
                "utilities": "SP500#55",   # Utilities sector
                "real_estate": "SP500#60", # Real Estate sector
                "consumer_disc": "SP500#25", # Consumer Discretionary
                "consumer_staples": "SP500#30", # Consumer Staples
                "communication": "SP500#50"  # Communication Services
            },
            "implementation": "FRED API calls for sector indices"
        },
        "Public Sector ETF Data": {
            "description": "Use ETF NAV data as sector proxies",
            "etfs": {
                "XLK": "Technology",
                "XLV": "Healthcare", 
                "XLF": "Financials",
                "XLE": "Energy",
                "XLI": "Industrials",
                "XLB": "Materials",
                "XLU": "Utilities",
                "XLRE": "Real Estate",
                "XLY": "Consumer Discretionary",
                "XLP": "Consumer Staples"
            },
            "source": "Direct ETF provider APIs (Vanguard, iShares)"
        }
    }
}

# =============================================================================
# SYSTEMIC RISK ALTERNATIVES
# =============================================================================

SYSTEMIC_RISK_ALTERNATIVES = {
    "free_sources": {
        "FRED Risk Indicators": {
            "series": {
                "vix_alternative": "VIXCLS",  # CBOE VIX - if available
                "treasury_spread": "T10Y2Y",  # 10Y-2Y Treasury spread
                "credit_spread": "BAA10Y",    # BAA-10Y Treasury spread  
                "high_yield_spread": "BAMLH0A0HYM2", # High yield spread
                "term_structure": "THREEFYTP10", # 3M-10Y spread
                "real_rates": "DFII10",       # 10Y TIPS rate
                "dollar_index": "DTWEXBGS",   # Dollar index
                "financial_stress": "NFCI"    # National Financial Conditions Index
            },
            "implementation": "Extend existing FRED integration"
        }
    },
    "alternative_calculations": {
        "volatility_proxy": {
            "description": "Calculate VIX-like indicator from S&P 500 data",
            "method": "Rolling standard deviation of daily returns",
            "period": "30-day rolling window"
        },
        "risk_composite": {
            "description": "Create composite risk score from multiple FRED indicators",
            "components": ["credit_spreads", "treasury_curve", "dollar_strength"]
        }
    }
}

# =============================================================================
# IMPLEMENTATION PRIORITIES
# =============================================================================

IMPLEMENTATION_PLAN = {
    "phase_1_immediate": {
        "description": "Replace with FRED-only alternatives",
        "tasks": [
            "Extend systemic_risk_fetcher with FRED VIX and spread data",
            "Create sector_performance using FRED sector indices", 
            "Add SEC EDGAR API for major corporate earnings"
        ],
        "timeline": "1-2 days",
        "effort": "Low - reuse existing FRED integration"
    },
    "phase_2_enhanced": {
        "description": "Add free tier APIs for better data",
        "tasks": [
            "Integrate Alpha Vantage free tier for earnings",
            "Add ETF provider APIs for sector data",
            "Implement composite risk indicators"
        ],
        "timeline": "1 week", 
        "effort": "Medium - new API integrations"
    },
    "phase_3_premium": {
        "description": "Paid API integration for production",
        "tasks": [
            "Upgrade to paid Alpha Vantage for real-time earnings",
            "Professional data vendor for sector performance",
            "Real-time market data feeds"
        ],
        "timeline": "2-4 weeks",
        "effort": "High - requires budget and extensive testing"
    }
}

if __name__ == "__main__":
    print("📊 SP500 Dashboard - Alternative Data Sources")
    print("=" * 50)
    print(f"Corporate Earnings alternatives: {len(CORPORATE_EARNINGS_ALTERNATIVES['free_sources'])}")
    print(f"Sector Performance alternatives: {len(SECTOR_PERFORMANCE_ALTERNATIVES['free_sources'])}")  
    print(f"Systemic Risk alternatives: {len(SYSTEMIC_RISK_ALTERNATIVES['free_sources'])}")
    print("\n🚀 Recommended: Start with Phase 1 - FRED-only alternatives")
