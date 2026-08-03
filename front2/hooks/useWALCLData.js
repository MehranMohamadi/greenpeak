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
                const cleaned = responseData
                    .map(item => {
                        const time = Number(item.time);
                        if (isNaN(time)) return null;
                        return {
                            time,
                            date: item.date,
                            value: Number(item.value || item.walcl || item.balance_sheet),
                            walcl: Number(item.walcl || item.value),
                            balance_sheet: Number(item.balance_sheet || item.value),
                        };
                    })
                    .filter(Boolean)
                    .sort((a, b) => a.time - b.time);
                
                setData(cleaned);
                setMetadata(json.metadata || null);
                setError(null);
            })
            .catch(err => {
                console.error("WALCL fetch error:", err);
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
