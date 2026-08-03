import { useEffect, useState } from 'react';
import { endpoints } from '../api/api';

// Map hook keys to endpoints and expected field names
const ENDPOINT_MAP = {
    vix: endpoints.systemicRisk.vix,
    creditSpreads: endpoints.systemicRisk.credit,
    yieldCurve: endpoints.systemicRisk.twoyteny,
    cdsSpreads: endpoints.systemicRisk.cds,
    financialStress: endpoints.systemicRisk.stress,
};

function normalizeSeries(json) {
    // Accept either array of {time,value,date,...} or {data:[], metadata: {}}
    let arr = [];
    let meta = null;

    if (!json) return { arr: [], meta: null };

    if (Array.isArray(json)) {
        arr = json;
    } else if (json.data) {
        arr = json.data;
        meta = json.metadata || null;
    } else {
        // attempt to detect wrapper
        arr = json.series || json.values || [];
        meta = json.metadata || null;
    }

    const cleaned = arr
        .map(item => {
            // support time as number or string or date
            const time = Number(item.time ?? item.timestamp ?? (item.date ? Date.parse(item.date) : NaN));
            if (isNaN(time)) return null;
            const val = Number(item.value ?? item.rate ?? item.close ?? item.y);
            if (isNaN(val)) return null;
            return {
                time,
                date: item.date || item.datetime || new Date(time).toISOString(),
                value: val,
            };
        })
        .filter(Boolean)
        .sort((a, b) => a.time - b.time);

    return { arr: cleaned, meta };
}

export default function useSystemicRiskData() {
    const [data, setData] = useState({});
    const [metadata, setMetadata] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        setLoading(true);
        setError(null);

        // Fetch all endpoints in parallel
        const entries = Object.entries(ENDPOINT_MAP);
        const promises = entries.map(([key, url]) =>
            fetch(url)
                .then(res => {
                    if (!res.ok) throw new Error(`${key} HTTP ${res.status}`);
                    return res.json();
                })
                .then(json => {
                    const { arr, meta } = normalizeSeries(json);
                    return { key, arr, meta };
                })
                .catch(err => {
                    console.warn(`Error fetching ${key}:`, err);
                    return { key, arr: [], meta: null, error: err.message };
                })
        );

        Promise.all(promises)
            .then(results => {
                const outData = {};
                const outMeta = {};
                results.forEach(r => {
                    outData[r.key] = r.arr || [];
                    outMeta[r.key] = r.meta || null;
                });

                // Backwards compatibility: if consumer expects array, provide a merged array under `data`
                setData(outData);
                setMetadata(outMeta);
                setError(null);
            })
            .catch(err => {
                console.error('useSystemicRiskData: unexpected error', err);
                setError(err.message || 'Unknown error');
                setData({});
                setMetadata({});
            })
            .finally(() => setLoading(false));
    }, []);

    return { data, metadata, loading, error };
}
