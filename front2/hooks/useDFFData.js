import { useEffect, useState } from 'react';
import { endpoints } from '../api/api';

export default function useDFFData() {
    const [data, setData] = useState([]);
    const [metadata, setMetadata] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        setLoading(true);
        fetch(endpoints.monetaryPolicy.dff)
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
                    // Old format - just array
                    arr = json;
                    meta = null;
                } else if (json.data && json.metadata) {
                    // New format - object with data and metadata
                    arr = json.data;
                    meta = json.metadata;
                } else {
                    // Fallback
                    arr = json.data || [];
                    meta = json.metadata || null;
                }
                
                const cleaned = arr
                    .map(item => {
                        const time = Number(item.time);
                        if (isNaN(time)) return null;
                        return {
                            time,
                            date: item.date,
                            value: Number(item.rate || item.value),
                            rate: Number(item.rate || item.value),
                        };
                    })
                    .filter(Boolean)
                    .sort((a, b) => a.time - b.time);
                    
                setData(cleaned);
                setMetadata(meta);
                setError(null);
            })
            .catch(err => {
                console.error("DFF fetch error:", err);
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
