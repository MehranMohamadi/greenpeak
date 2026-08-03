import { useEffect, useState } from 'react';
import { endpoints } from '../api/api';

export default function usePerformanceGraphData(limit = null, startDate = null, endDate = null) {
    const [data, setData] = useState([]);
    const [metadata, setMetadata] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchPerformanceData = async () => {
            setLoading(true);
            setError(null);

            try {
                // Build query parameters
                const params = new URLSearchParams();
                if (limit) params.append('limit', limit);
                if (startDate) params.append('start_date', startDate);
                if (endDate) params.append('end_date', endDate);
                
                const queryString = params.toString();
                const url = queryString 
                    ? `${endpoints.market.sp500Performance}?${queryString}`
                    : endpoints.market.sp500Performance;

                const response = await fetch(url);
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const result = await response.json();
                
                // Process the performance data
                const processedData = result.data?.map(item => ({
                    time: item.time, // Use timestamp for chart consistency
                    value: item.value,
                    change: item.change,
                    changePercent: item.change_percent,
                    // For chart compatibility (OHLC format)
                    close: item.value,
                    open: item.value, // Since this is daily close data
                    high: item.value,
                    low: item.value,
                    // Keep date as additional info if needed
                    date: item.date,
                })) || [];

                setData(processedData);
                setMetadata(result.metadata);
                
            } catch (err) {
                console.error("Performance Graph data fetch error:", err);
                setError(err.message);
                setData([]);
                setMetadata(null);
            } finally {
                setLoading(false);
            }
        };

        fetchPerformanceData();
    }, [limit, startDate, endDate]);

    return { data, metadata, loading, error };
}
