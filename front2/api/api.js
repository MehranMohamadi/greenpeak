const isProduction = process.env.NODE_ENV === "production" ||
                     typeof window !== "undefined" && !["localhost", "127.0.0.1"].includes(window.location.hostname);

const configuredApiBase = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");

// Production deployments should set NEXT_PUBLIC_API_BASE_URL explicitly.
const API_BASE = configuredApiBase || (isProduction
    ? "https://greenpeak.ir/api/v1"
    : "http://localhost:8000/api/v1");

export { API_BASE };

export const endpoints = {
    news: {
        bootstrap: `${API_BASE}/news/bootstrap`,
        source: (sourceId, limit = 20) => `${API_BASE}/news/sources/${sourceId}?limit=${limit}`,
    },
    system: {
        health: `${API_BASE}/system/health`,
        session: `${API_BASE}/system/session`,
        updateData: `${API_BASE}/system/update-data`,
        updateSchedule: `${API_BASE}/system/update-schedule`,
    },
    mt5: {
        latestSnapshot: `${API_BASE}/mt5/snapshots/latest`,
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
        runManual: `${API_BASE}/admin/analysis/run`,
        manualRunStatus: (runId) => `${API_BASE}/admin/analysis/runs/${runId}`,
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
        sentiment: (indicatorId) => `${API_BASE}/systemrisk/sentiment/${indicatorId}`,
        credit: `${API_BASE}/systemrisk/credit`,
        twoyteny: `${API_BASE}/systemrisk/2y10y`,
        cds: `${API_BASE}/systemrisk/cds`,
        stress: `${API_BASE}/systemrisk/stress`,
    },
    liquidity: {
        m2: `${API_BASE}/liquidity/m2`,
        reverseRepo: `${API_BASE}/liquidity/reverse_repo`,
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
        returnOnAssets: `${API_BASE}/corporate/return-on-assets`,
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
        latest: `${API_BASE}/sectors/latest`,
        grouped: `${API_BASE}/sectors/grouped`,
        allSectors: `${API_BASE}/sectors/all-sectors`,
        allMetrics: `${API_BASE}/sectors/all-metrics`,
        technology: `${API_BASE}/sectors/technology`,
        financials: `${API_BASE}/sectors/financials`,
        healthcare: `${API_BASE}/sectors/healthcare`,
    },
    intermarket: {
        symbol: (series) => `/api/intermarket?series=${encodeURIComponent(series)}`,
    },
};
