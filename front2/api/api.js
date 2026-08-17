// Use environment variable or fallback to production URL
// Check multiple conditions to ensure proper environment detection
const isProduction = process.env.NODE_ENV === 'production' || 
                     typeof window !== 'undefined' && window.location.hostname !== 'localhost';

// For production with nginx proxy, use relative paths

// For development, use localhost directly
const API_BASE = isProduction
    ? "https://greenpeak.tech/api/v1"  // Use production domain
    : "http://localhost:8000/api/v1";

export { API_BASE };

export const endpoints = {
    system: {
        health: `${API_BASE}/system/health`,
        session: `${API_BASE}/system/session`,
        updateData: `${API_BASE}/system/update-data`,
        updateSchedule: `${API_BASE}/system/update-schedule`,
    },
    indicatorFeatures: {
        latest: (indicatorId, debug = false) => `${API_BASE}/indicators/${indicatorId}/features/latest${debug ? "?mode=debug" : ""}`,
        pipelineDebug: (indicatorId) => `${API_BASE}/indicators/${indicatorId}/features/pipeline-debug`,
        pipelinePreview: `${API_BASE}/indicators/features/pipeline-preview`,
    },
    analysis: {
        indicatorLatest: (indicatorId) => `${API_BASE}/indicators/${indicatorId}/analysis/latest`,
        domainLatest: (domainId) => `${API_BASE}/domains/${domainId}/analysis/latest`,
        marketLatest: `${API_BASE}/market/analysis/latest`,
        ruleLatest: (level, subjectId) => `${API_BASE}/rules/${level}/${subjectId}/latest`,
    },
    market: {
        sp500: `${API_BASE}/market/sp500`,
        sp500Performance: `${API_BASE}/market/sp500/performance`,
        vix: `${API_BASE}/market/vix`,
        treasury: `${API_BASE}/market/treasury`,
    },
    generalData: {
        sp500: `${API_BASE}/market/sp500`,
        vix: `${API_BASE}/market/vix`,
        treasury: `${API_BASE}/market/treasury`,
        dff: `${API_BASE}/market/dff`,
    },
    monetaryPolicy: {
        dff: `${API_BASE}/monetary/dff`,
        tenYear: `${API_BASE}/monetary/10year`,
        fedBalanceSheet: `${API_BASE}/monetary/fed-balance-sheet`,
        sofr: `${API_BASE}/monetary/sofr`,
        realInterestRate: `${API_BASE}/monetary/real-interest-rate`,
        vix: `${API_BASE}/monetary/vix`,
        treasury: `${API_BASE}/monetary/treasury`,
    },
    economic: {
        gdp: `${API_BASE}/economic/gdp`,
        cpi: `${API_BASE}/economic/cpi`,
        unemployment: `${API_BASE}/economic/unemployment`,
    },
    systemicRisk: {
        vix: `${API_BASE}/systemrisk/vix`,
        credit: `${API_BASE}/systemrisk/credit`,
        twoyteny: `${API_BASE}/systemrisk/2y10y`,
        cds: `${API_BASE}/systemrisk/cds`,
        stress: `${API_BASE}/systemrisk/stress`,
    },
    liquidity: {
        m2: `${API_BASE}/liquidity/m2`,
        reverseRepo: `${API_BASE}/liquidity/reverse_repo`,
        etfInflows: `${API_BASE}/liquidity/etf-inflows`,
        equityFundFlows: `${API_BASE}/liquidity/equity-fund-flows`,
        marginDebt: `${API_BASE}/liquidity/margin-debt`,
        institutionalFlows: `${API_BASE}/liquidity/institutional-flows`,
    },
    macroeco: {
        gdp: `${API_BASE}/macroeco/gdp`,
        unemployment: `${API_BASE}/macroeco/unemployment`,
        employment: `${API_BASE}/macroeco/employment`,
        payroll: `${API_BASE}/macroeco/payroll`,
        confidence: `${API_BASE}/macroeco/confidence`,
        cpi: `${API_BASE}/macroeco/cpi`,
        retailSales: `${API_BASE}/macroeco/retail-sales`,
    },
    corporate: {
        epsSp500: `${API_BASE}/corporate/eps/sp500`,
        revenueGrowth: `${API_BASE}/corporate/revenue-growth`,
        profitMargins: `${API_BASE}/corporate/profit-margins`,
        peRatio: `${API_BASE}/corporate/pe-ratio`,
        dividendYield: `${API_BASE}/corporate/dividend-yield`,
        returnOnAssets: `${API_BASE}/corporate/return-on-assets`,
        cpi: `${API_BASE}/corporate/cpi`,
        unemployment: `${API_BASE}/corporate/unemployment`,
    },
    valuation: {
        peRatio: `${API_BASE}/valuation/pe-ratio`,
        forwardPe: `${API_BASE}/valuation/forward-pe`,
        priceToBook: `${API_BASE}/valuation/price-to-book`,
        priceToSales: `${API_BASE}/valuation/price-to-sales`,
        pegRatio: `${API_BASE}/valuation/peg-ratio`,
        dividendYield: `${API_BASE}/valuation/dividend-yield`,
    },
    sectors: {
        pricePerformance: `${API_BASE}/sectors/price-performance`,
        relativePerformance: `${API_BASE}/sectors/relative-performance`,
        momentumScores: `${API_BASE}/sectors/momentum-scores`,
        rotationSignals: `${API_BASE}/sectors/rotation-signals`,
        latest: `${API_BASE}/sectors/latest`,
        grouped: `${API_BASE}/sectors/grouped`,
        allSectors: `${API_BASE}/sectors/all-sectors`,
        allMetrics: `${API_BASE}/sectors/all-metrics`,
        technology: `${API_BASE}/sectors/technology`,
        financials: `${API_BASE}/sectors/financials`,
        healthcare: `${API_BASE}/sectors/healthcare`,
    },
    intermarket: {
        dxy: `/api/intermarket/DXY`,
        gold: `/api/intermarket/GC=F`,
        oil: `/api/intermarket/CL=F`,
        copper: `/api/intermarket/HG=F`,
        hyg: `/api/intermarket/HYG`,
        tlt: `/api/intermarket/TLT`,
        creditSpread: `/api/intermarket/credit-spread`,
        copperGold: `/api/intermarket/copper-gold`,
        symbol: (s) => `/api/intermarket/${s}`,
    },
};

export const intermarketEndpoints = {
    dxy: `/api/intermarket/DXY`,
    gold: `/api/intermarket/GC=F`,
    oil: `/api/intermarket/CL=F`,
    copper: `/api/intermarket/HG=F`,
    hyg: `/api/intermarket/HYG`,
    tlt: `/api/intermarket/TLT`,
    creditSpread: `/api/intermarket/credit-spread`,
    copperGold: `/api/intermarket/copper-gold`,
    symbol: (s) => `/api/intermarket/${s}`,
};
