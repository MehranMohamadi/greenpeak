import { useState, useEffect } from 'react';
import { endpoints } from '../api/api.js';

const useSectorPerformanceData = () => {
  const [data, setData] = useState({
    pricePerformance: [],
    relativePerformance: [],
    momentumScores: [],
    rotationSignals: [],
    allSectorsLatest: {}
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [metadata, setMetadata] = useState({
    pricePerformance: null,
    relativePerformance: null,
    momentumScores: null,
    rotationSignals: null
  });

  useEffect(() => {
    const fetchSectorData = async () => {
      try {
        setLoading(true);
        
        // Fetch data from all sector performance endpoints
        const endpointMappings = [
          { key: 'pricePerformance', url: endpoints.sectors.pricePerformance },
          { key: 'relativePerformance', url: endpoints.sectors.relativePerformance },
          { key: 'momentumScores', url: endpoints.sectors.momentumScores },
          { key: 'rotationSignals', url: endpoints.sectors.rotationSignals }
        ];

        const fetchPromises = endpointMappings.map(async (endpoint) => {
          try {
            console.log(`Fetching ${endpoint.key} from:`, endpoint.url);
            const response = await fetch(endpoint.url);
            console.log(`Response status for ${endpoint.key}:`, response.status);
            if (!response.ok) {
              const errorText = await response.text();
              console.error(`Failed to fetch ${endpoint.key}: ${response.status} - ${errorText}`);
              throw new Error(`Failed to fetch ${endpoint.key}: ${response.status} - ${errorText}`);
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

        // Also fetch latest data for all sectors for each metric
        const latestDataPromises = ['price_performance', 'relative_performance', 'momentum_score', 'sector_rotation_signal'].map(async (metric) => {
          try {
            console.log(`Fetching latest ${metric} for all sectors`);
            const response = await fetch(`${endpoints.sectors.latest}/${metric}`);
            console.log(`Response status for latest ${metric}:`, response.status);
            if (!response.ok) {
              const errorText = await response.text();
              console.error(`Failed to fetch latest ${metric}: ${response.status} - ${errorText}`);
              throw new Error(`Failed to fetch latest ${metric}: ${response.status} - ${errorText}`);
            }
            const result = await response.json();
            console.log(`Successfully fetched latest ${metric}:`, result);
            return {
              metric,
              data: result.sectors || {}
            };
          } catch (err) {
            console.error(`Error fetching latest ${metric}:`, err);
            return {
              metric,
              data: {},
              error: err.message
            };
          }
        });

        const [timeSeriesResults, latestResults] = await Promise.all([
          Promise.all(fetchPromises),
          Promise.all(latestDataPromises)
        ]);
        
        // Process time series results
        const newData = {};
        const newMetadata = {};
        let hasErrors = false;

        timeSeriesResults.forEach(result => {
          if (result.data && Array.isArray(result.data)) {
            const cleaned = result.data
              .map(item => {
                const time = Number(item.time);
                const value = Number(item.rate || item.value);
                
                // Validation
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
              // Remove duplicates by timestamp
              .reduce((acc, current) => {
                const existingIndex = acc.findIndex(item => item.time === current.time);
                if (existingIndex === -1) {
                  acc.push(current);
                } else {
                  // Only log first few duplicates to avoid console spam
                  if (acc.duplicateCount === undefined) acc.duplicateCount = 0;
                  if (acc.duplicateCount < 3) {
                    console.warn(`Duplicate timestamp ${current.time} in ${result.key}, keeping first occurrence`);
                  }
                  acc.duplicateCount++;
                }
                return acc;
              }, []);
            
            // Report duplicate count if any
            if (cleaned.duplicateCount > 0) {
              console.log(`Removed ${cleaned.duplicateCount} duplicate timestamps in ${result.key}`);
            }
            
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

        // Process latest data for all sectors
        const allSectorsLatest = {};
        latestResults.forEach(result => {
          allSectorsLatest[result.metric] = result.data;
        });
        newData.allSectorsLatest = allSectorsLatest;

        console.log('Final sector performance data:', newData);
        console.log('Final sector performance metadata:', newMetadata);

        setData(newData);
        setMetadata(newMetadata);
        
        // Only set error if all endpoints failed
        const allEndpointsFailed = timeSeriesResults.every(result => result.error);
        if (allEndpointsFailed) {
          setError('Failed to fetch sector performance data from all sources');
        } else if (hasErrors) {
          console.warn('Some sector performance endpoints failed, but continuing with available data');
        }
        
      } catch (err) {
        console.error('Error fetching sector performance data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchSectorData();
  }, []);

  // Helper function to get data for a specific sector
  const getSectorData = (metric, sectorName) => {
    if (!data[metric] || !Array.isArray(data[metric])) {
      return [];
    }
    
    // Since our API returns all sectors in one endpoint, we need to filter by sector
    // This would need to be adjusted based on how the backend actually returns the data
    return data[metric].filter(item => item.sector === sectorName);
  };

  // Helper function to get latest value for a specific sector and metric
  const getLatestSectorValue = (metric, sectorName) => {
    if (!data.allSectorsLatest[metric] || !data.allSectorsLatest[metric][sectorName]) {
      return null;
    }
    return data.allSectorsLatest[metric][sectorName];
  };

  // Helper function to get all sectors for latest data
  const getAllSectorsLatest = (metric) => {
    return data.allSectorsLatest[metric] || {};
  };

  return { 
    data, 
    loading, 
    error, 
    metadata,
    getSectorData,
    getLatestSectorValue,
    getAllSectorsLatest
  };
};

export default useSectorPerformanceData;
