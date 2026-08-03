import { useState, useEffect } from 'react';
import { endpoints } from '../api/api.js';

const useCorporateEarningsData = () => {
  const [data, setData] = useState({
    sp500eps: [],
    revenue: [],
    margins: [], 
    peRatio: [],
    dividendYield: [],
    roi: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [metadata, setMetadata] = useState({
    sp500eps: null,
    revenue: null,
    margins: null,
    peRatio: null,
    dividendYield: null,
    roi: null
  });

  useEffect(() => {
    const fetchCorporateData = async () => {
      try {
        setLoading(true);
        
        // Fetch data from all corporate earnings endpoints using configured URLs
        const endpointMappings = [
          { key: 'sp500eps', url: endpoints.corporate.epsSp500 },
          { key: 'revenue', url: endpoints.corporate.revenueGrowth },
          { key: 'margins', url: endpoints.corporate.profitMargins },
          { key: 'peRatio', url: endpoints.corporate.peRatio },
          { key: 'dividendYield', url: endpoints.corporate.dividendYield },
          { key: 'roi', url: endpoints.corporate.returnOnAssets }
        ];

        const fetchPromises = endpointMappings.map(async (endpoint) => {
          try {
            console.log(`Fetching ${endpoint.key} from:`, endpoint.url);
            const response = await fetch(endpoint.url);
            if (!response.ok) {
              throw new Error(`Failed to fetch ${endpoint.key}: ${response.status}`);
            }
            const result = await response.json();
            console.log(`Successfully fetched ${endpoint.key}:`, result);
            return {
              key: endpoint.key,
              data: result.data || [],
              metadata: result.metadata || null
            };
          } catch (err) {
            console.error(`Error fetching ${endpoint.key}:`, err);
            return {
              key: endpoint.key,
              data: [],
              metadata: null,
              error: err.message
            };
          }
        });

        const results = await Promise.all(fetchPromises);
        
        // Process results with data cleaning like valuation hook
        const newData = {};
        const newMetadata = {};
        let hasErrors = false;

        results.forEach(result => {
          // Process the data like valuation hook does
          if (result.data && Array.isArray(result.data)) {
            const cleaned = result.data
              .map(item => {
                const time = Number(item.time);
                const value = Number(item.rate || item.value);
                
                // More robust validation
                if (isNaN(time) || isNaN(value) || !item.date) {
                  console.warn(`Invalid data point in ${result.key}:`, item);
                  return null;
                }
                
                return {
                  time,
                  date: item.date,
                  value,
                  rate: value,
                };
              })
              .filter(Boolean)
              .sort((a, b) => a.time - b.time)
              // Remove duplicates by keeping only the first occurrence of each timestamp
              .reduce((acc, current) => {
                const existingIndex = acc.findIndex(item => item.time === current.time);
                if (existingIndex === -1) {
                  acc.push(current);
                } else {
                  // If duplicate timestamp, keep the first one
                  console.warn(`Duplicate timestamp ${current.time} in ${result.key}, keeping first occurrence`);
                }
                return acc;
              }, []);
            
            console.log(`Processed ${result.key}: ${result.data.length} -> ${cleaned.length} records`);
            newData[result.key] = cleaned;
          } else {
            console.warn(`No valid data for ${result.key}:`, result.data);
            newData[result.key] = [];
          }
          
          newMetadata[result.key] = result.metadata;
          if (result.error) {
            hasErrors = true;
          }
        });

        console.log('Final corporate earnings data:', newData);
        console.log('Final corporate earnings metadata:', newMetadata);

        setData(newData);
        setMetadata(newMetadata);
        
        // Only set error if all endpoints failed
        const allEndpointsFailed = results.every(result => result.error);
        if (allEndpointsFailed) {
          setError('Failed to fetch corporate earnings data from all sources');
        } else if (hasErrors) {
          console.warn('Some corporate earnings endpoints failed, but continuing with available data');
        }
        
      } catch (err) {
        console.error('Error fetching corporate earnings data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchCorporateData();
  }, []);

  return { data, loading, error, metadata };
};

export default useCorporateEarningsData;
