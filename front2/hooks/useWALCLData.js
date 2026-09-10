import { normalizeChartData } from "@/lib/chart-data";
import { useEffect, useState } from 'react';
import { endpoints } from '../api/api';

export default function useWALCLData() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [metadata, setMetadata] = useState(null);

    useEffect(() => {
        setLoading(true);
        fetch(endpoints.monetaryPolicy.fedBalanceSheet)
            .then(res => {
                if (!res.ok) {
                    throw new Error(`HTTP error! status: ${res.status}`);
                }   
                return res.json();
            })
            .then(json => {
                // Handle nested response structure
                const responseData = json.data || json;
                const cleaned = normalizeChartData(responseData, ["value", "walcl", "balance_sheet"]).map(point => ({
                        time: Date.parse(point.time + 'T00:00:00Z') / 1000,
                        date: point.time,
                        value: point.value,
                        walcl: point.value,
                        balance_sheet: point.value,
                    }));
                
                setData(cleaned);
                setMetadata(json.metadata || null);
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

    return { data, loading, error, metadata };
}
