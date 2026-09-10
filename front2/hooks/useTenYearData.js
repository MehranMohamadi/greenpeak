import { normalizeChartData } from "@/lib/chart-data";
import { useEffect, useState } from 'react';
import { endpoints } from '../api/api';

export default function useTenYearData() {
    const [data, setData] = useState([]);
    const [metadata, setMetadata] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        setLoading(true);
        fetch(endpoints.monetaryPolicy.tenYear)
            .then(res => {
                if (!res.ok) {
                    throw new Error(`HTTP error! status: ${res.status}`);
                }
                return res.json();
            })
            .then(json => {
                // Handle both old array format and new object format with metadata
                let arr, meta;
                if (Array.isArray(json)) {
                    arr = json;
                    meta = null;
                } else if (json.data && json.metadata) {
                    arr = json.data;
                    meta = json.metadata;
                } else {
                    arr = json.data || [];
                    meta = json.metadata || null;
                }
                
                const cleaned = normalizeChartData(arr, ["rate", "yield", "value"]).map(point => ({
                        time: Date.parse(point.time + 'T00:00:00Z') / 1000,
                        date: point.time,
                        value: point.value,
                        rate: point.value,
                        yield: point.value,
                    }));
                    
                setData(cleaned);
                setMetadata(meta);
                setError(null);
            })
            .catch(err => {
                setError(err.message);
                setData([]);
                setMetadata(null);
            })
            .finally(() => {
                setLoading(false);
            });
    }, []);

    return { data, metadata, loading, error };
}
