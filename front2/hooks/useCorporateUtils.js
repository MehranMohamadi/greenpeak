import { useEffect, useState } from 'react';
import { endpoints } from '../api/api';

// Modular data processor for time series
function processTimeSeriesData(json, valueKey = 'value') {
    return (json.data?.map(item => {
        let timestamp = typeof item.time === 'string' ? parseInt(item.time) : item.time;
        let value = typeof item[valueKey] === 'string' ? parseFloat(item[valueKey]) : item[valueKey];

        if (timestamp > 10000000000) timestamp = Math.floor(timestamp / 1000);

        return {
            time: timestamp,
            value,
            date: item.date,
        };
    }).filter(item => !isNaN(item.time) && !isNaN(item.value))) || [];
}

export default function useEconomicData() {
    const [data, setData] = useState({
        unemployment: [],
        cpi: [],
        eps: []
    });
    const [metadata, setMetadata] = useState({
        unemployment: null,
        cpi: null,
        eps: null
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchEconomicData = async () => {
            setLoading(true);
            setError(null);

            try {
                const [unemploymentRes, cpiRes, epsRes] = await Promise.allSettled([
                    fetch(endpoints.economics.unemployment),
                    fetch(endpoints.economics.cpi),
                    fetch(endpoints.corporate.eps)
                ]);

                // Unemployment
                let processedUnemployment = [];
                let unemploymentMetadata = null;
                if (unemploymentRes.status === 'fulfilled' && unemploymentRes.value.ok) {
                    const json = await unemploymentRes.value.json();
                    processedUnemployment = processTimeSeriesData(json, 'value');
                    unemploymentMetadata = json.metadata;
                }

                // CPI
                let processedCPI = [];
                let cpiMetadata = null;
                if (cpiRes.status === 'fulfilled' && cpiRes.value.ok) {
                    const json = await cpiRes.value.json();
                    processedCPI = processTimeSeriesData(json, 'value');
                    cpiMetadata = json.metadata;
                }

                // EPS
                let processedEPS = [];
                let epsMetadata = null;
                if (epsRes.status === 'fulfilled' && epsRes.value.ok) {
                    const json = await epsRes.value.json();
                    processedEPS = processTimeSeriesData(json, 'eps');
                    epsMetadata = json.metadata;
                }

                // Only use real data, no fallbacks
                setData({
                    unemployment: processedUnemployment,
                    cpi: processedCPI,
                    eps: processedEPS
                });

                setMetadata({
                    unemployment: unemploymentMetadata,
                    cpi: cpiMetadata,
                    eps: epsMetadata
                });

            } catch (err) {
                console.error("Economic data fetch error:", err);
                setError(err.message);
                setData({
                    unemployment: [],
                    cpi: [],
                    eps: []
                });
                setMetadata({
                    unemployment: null,
                    cpi: null,
                    eps: null
                });
            } finally {
                setLoading(false);
            }
        };

        fetchEconomicData();
    }, []);

    return { data, metadata, loading, error };
}
