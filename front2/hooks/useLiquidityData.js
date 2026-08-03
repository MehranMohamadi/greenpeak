import { useEffect, useState } from 'react';
import { endpoints } from '../api/api';

export default function useLiquidityData() {
    const [data, setData] = useState({
        m2: [],
        reverseRepo: [],
        etfInflows: []
    });
    const [metadata, setMetadata] = useState({
        m2: null,
        reverseRepo: null,
        etfInflows: null
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchLiquidityData = async () => {
            setLoading(true);
            setError(null);

            try {
                // Fetch M2, Reverse Repo, and ETF Inflows data
                const [m2Res, reverseRepoRes, etfInflowsRes] = await Promise.allSettled([
                    fetch(endpoints.liquidity.m2),
                    fetch(endpoints.liquidity.reverseRepo),
                    fetch(endpoints.liquidity.etfInflows)
                ]);

                // Process M2 data
                let processedM2 = [];
                let m2Metadata = null;
                if (m2Res.status === 'fulfilled' && m2Res.value.ok) {
                    const m2Json = await m2Res.value.json();
                    console.log('Raw M2 API response:', m2Json); // Debug log
                    
                    processedM2 = m2Json.data?.map(item => {
                        // Validate and convert timestamp
                        let timestamp = item.time;
                        if (typeof timestamp === 'string') {
                            timestamp = parseInt(timestamp);
                        }
                        
                        // Validate and convert value (M2 is in billions)
                        let m2Value = item.value || item.rate;
                        if (typeof m2Value === 'string') {
                            m2Value = parseFloat(m2Value);
                        }
                        
                        // Ensure timestamp is in seconds (not milliseconds)
                        if (timestamp > 10000000000) {
                            timestamp = Math.floor(timestamp / 1000);
                        }
                        
                        return {
                            time: timestamp,
                            value: m2Value,
                            date: item.date,
                        };
                    }).filter(item => !isNaN(item.time) && !isNaN(item.value)) || [];
                    
                    m2Metadata = m2Json.metadata;
                    console.log('Processed M2 data sample:', processedM2.slice(0, 3)); // Debug log
                }

                // Process Reverse Repo data
                let processedReverseRepo = [];
                let reverseRepoMetadata = null;
                if (reverseRepoRes.status === 'fulfilled' && reverseRepoRes.value.ok) {
                    const reverseRepoJson = await reverseRepoRes.value.json();
                    console.log('Raw Reverse Repo API response:', reverseRepoJson); // Debug log
                    
                    processedReverseRepo = reverseRepoJson.data?.map(item => {
                        // Validate and convert timestamp
                        let timestamp = item.time;
                        if (typeof timestamp === 'string') {
                            timestamp = parseInt(timestamp);
                        }
                        
                        // Validate and convert value (Reverse Repo is in billions)
                        let reverseRepoValue = item.value || item.rate;
                        if (typeof reverseRepoValue === 'string') {
                            reverseRepoValue = parseFloat(reverseRepoValue);
                        }
                        
                        // Ensure timestamp is in seconds (not milliseconds)
                        if (timestamp > 10000000000) {
                            timestamp = Math.floor(timestamp / 1000);
                        }
                        
                        return {
                            time: timestamp,
                            value: reverseRepoValue,
                            date: item.date,
                        };
                    }).filter(item => !isNaN(item.time) && !isNaN(item.value)) || [];
                    
                    reverseRepoMetadata = reverseRepoJson.metadata;
                    console.log('Processed Reverse Repo data sample:', processedReverseRepo.slice(0, 3)); // Debug log
                }

                // Process ETF Inflows data
                let processedEtfInflows = [];
                let etfInflowsMetadata = null;
                if (etfInflowsRes.status === 'fulfilled' && etfInflowsRes.value.ok) {
                    const etfInflowsJson = await etfInflowsRes.value.json();
                    console.log('Raw ETF Inflows API response:', etfInflowsJson); // Debug log
                    
                    processedEtfInflows = etfInflowsJson.data?.map(item => {
                        // Validate and convert timestamp
                        let timestamp = item.time;
                        if (typeof timestamp === 'string') {
                            timestamp = parseInt(timestamp);
                        }
                        
                        // Validate and convert value (ETF Inflows is in millions)
                        let etfInflowsValue = item.value || item.rate;
                        if (typeof etfInflowsValue === 'string') {
                            etfInflowsValue = parseFloat(etfInflowsValue);
                        }
                        
                        // Ensure timestamp is in seconds (not milliseconds)
                        if (timestamp > 10000000000) {
                            timestamp = Math.floor(timestamp / 1000);
                        }
                        
                        return {
                            time: timestamp,
                            value: etfInflowsValue,
                            date: item.date,
                        };
                    }).filter(item => !isNaN(item.time) && !isNaN(item.value)) || [];
                    
                    etfInflowsMetadata = etfInflowsJson.metadata;
                    console.log('Processed ETF Inflows data sample:', processedEtfInflows.slice(0, 3)); // Debug log
                }

                // Only use real data, no fallbacks
                setData({
                    m2: processedM2,
                    reverseRepo: processedReverseRepo,
                    etfInflows: processedEtfInflows
                });

                setMetadata({
                    m2: m2Metadata,
                    reverseRepo: reverseRepoMetadata,
                    etfInflows: etfInflowsMetadata
                });
                
            } catch (err) {
                console.error("Liquidity data fetch error:", err);
                setError(err.message);
                setData({
                    m2: [],
                    reverseRepo: [],
                    etfInflows: []
                });
                setMetadata({
                    m2: null,
                    reverseRepo: null,
                    etfInflows: null
                });
            } finally {
                setLoading(false);
            }
        };

        fetchLiquidityData();
    }, []);

    return { data, metadata, loading, error };
}
