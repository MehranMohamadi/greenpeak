// Utility functions for processing monetary policy data

/**
 * Downsample data intelligently based on data size and time range
 * @param {Array} data - Processed data array
 * @param {number} maxPoints - Maximum number of points to display
 * @returns {Array} Downsampled data
 */
export const downsampleData = (data, maxPoints = 2000) => {
  if (!data || data.length <= maxPoints) return data;
  
  const step = Math.ceil(data.length / maxPoints);
  const downsampled = [];
  
  for (let i = 0; i < data.length; i += step) {
    // Take every nth point, but always include the last point
    downsampled.push(data[i]);
  }
  
  // Always include the last data point
  if (downsampled[downsampled.length - 1] !== data[data.length - 1]) {
    downsampled.push(data[data.length - 1]);
  }
  
  return downsampled;
};

/**
 * Process DFF data for chart display - Option for daily or monthly data with smart filtering
 * @param {Array} data - Raw DFF data array
 * @param {boolean} useDaily - Whether to use daily data (default: true for full resolution)
 * @param {string} period - Time period for smart downsampling
 * @returns {Array} Processed data for chart
 */
export const processDFFData = (data, useDaily = true, period = 'MAX') => {
  if (!data || data.length === 0) return [];
  
  if (useDaily) {
    // Return all daily data points for full resolution with duplicate removal
    const processedData = data
      .map(item => ({
        time: new Date(item.time * 1000).toISOString().split('T')[0],
        value: item.value || item.rate || 0
      }))
      .filter(item => item.value !== null && item.value !== undefined && !isNaN(item.value))
      .sort((a, b) => new Date(a.time) - new Date(b.time));
    
    // Remove duplicates by keeping the last value for each date
    const uniqueData = {};
    processedData.forEach(item => {
      uniqueData[item.time] = item;
    });
    
    const finalData = Object.values(uniqueData).sort((a, b) => new Date(a.time) - new Date(b.time));
    
    // Smart downsampling based on period and data size
    if (period === 'MAX' && finalData.length > 5000) {
      // For MAX view with lots of data, downsample intelligently
      return downsampleData(finalData, 3000);
    } else if (period === '25Y' && finalData.length > 3000) {
      return downsampleData(finalData, 2000);
    } else if (period === '10Y' && finalData.length > 2000) {
      return downsampleData(finalData, 1500);
    } else if (period === '5Y' && finalData.length > 1000) {
      return downsampleData(finalData, 1000);
    }
    
    return finalData;
  } else {
    // Group data by month and calculate monthly averages (legacy behavior)
    const monthlyData = {};
    
    data.forEach(item => {
      const unixTime = item.time * 1000;
      const d = new Date(unixTime);
      const year = d.getUTCFullYear();
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      const monthKey = `${year}-${month}`;
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          sum: 0,
          count: 0,
          date: `${monthKey}-15`
        };
      }
      
      monthlyData[monthKey].sum += (item.value || item.rate || 0);
      monthlyData[monthKey].count += 1;
    });
    
    return Object.keys(monthlyData)
      .map(monthKey => ({
        time: monthlyData[monthKey].date,
        value: monthlyData[monthKey].sum / monthlyData[monthKey].count
      }))
      .sort((a, b) => new Date(a.time) - new Date(b.time));
  }
};

/**
 * Process 10-Year Treasury data for chart display
 * @param {Array} data - Raw 10-Year Treasury data array
 * @returns {Array} Processed data for chart
 */
export const processTenYearData = (data) => {
  if (!data || data.length === 0) return [];
  
  const processedData = data
    .map(item => ({
      time: new Date(item.time * 1000).toISOString().split('T')[0], // Convert back to YYYY-MM-DD format for LightWeight Charts
      value: item.value || item.rate || item.yield || 0
    }))
    .filter(item => item.value !== null && item.value !== undefined && !isNaN(item.value))
    .sort((a, b) => new Date(a.time) - new Date(b.time));
  
  // Remove duplicates by keeping the last value for each date
  const uniqueData = {};
  processedData.forEach(item => {
    uniqueData[item.time] = item;
  });
  
  return Object.values(uniqueData).sort((a, b) => new Date(a.time) - new Date(b.time));
};

/**
 * Process WALCL (Federal Reserve Balance Sheet) data for chart display
 * @param {Array} data - Raw WALCL data array
 * @returns {Array} Processed data for chart (converted from millions to trillions)
 */
export const processWALCLData = (data) => {
  if (!data || data.length === 0) return [];
  
  const processedData = data
    .map(item => ({
      time: new Date(item.time * 1000).toISOString().split('T')[0], // Convert back to YYYY-MM-DD format for LightWeight Charts
      value: (item.value || item.walcl || item.balance_sheet || 0) / 1000000 // Convert millions to trillions
    }))
    .filter(item => item.value !== null && item.value !== undefined && !isNaN(item.value))
    .sort((a, b) => new Date(a.time) - new Date(b.time));
  
  // Remove duplicates by keeping the last value for each date
  const uniqueData = {};
  processedData.forEach(item => {
    uniqueData[item.time] = item;
  });
  
  return Object.values(uniqueData).sort((a, b) => new Date(a.time) - new Date(b.time));
};

/**
 * Get the latest value from a dataset
 * @param {Array} data - Data array
 * @returns {number} Latest value or 0 if no data
 */
export const getLatestValue = (data) => {
  if (!data || data.length === 0) return 0;
  return data[data.length - 1]?.value || 0;
};

/**
 * Calculate percentage change from previous value with improved logic
 * @param {Array} data - Data array
 * @returns {Object} Object with change value and direction
 */
export const calculateChange = (data) => {
  if (!data || data.length < 2) return { change: 0, direction: 'neutral' };
  
  const latest = data[data.length - 1]?.value || 0;
  
  // Look for the last meaningful change (within the last 7 days, then 30 days)
  let previous = null;
  let changeFound = false;
  
  // First try to find a change within the last 7 days (1 week)
  for (let i = data.length - 2; i >= Math.max(0, data.length - 8); i--) {
    const prevValue = data[i]?.value || 0;
    if (Math.abs(latest - prevValue) > 0.001) { // 0.001% threshold
      previous = prevValue;
      changeFound = true;
      break;
    }
  }
  
  // If no change in last week, look for change in last 30 days
  if (!changeFound) {
    for (let i = data.length - 2; i >= Math.max(0, data.length - 31); i--) {
      const prevValue = data[i]?.value || 0;
      if (Math.abs(latest - prevValue) > 0.001) { // 0.001% threshold
        previous = prevValue;
        changeFound = true;
        break;
      }
    }
  }
  
  // If still no change, use the value from 30 days ago or the earliest available
  if (!changeFound) {
    previous = data[Math.max(0, data.length - 31)]?.value || data[0]?.value || 0;
  }
  
  if (!previous || previous === 0) {
    return { change: 0, direction: 'neutral' };
  }
  
  const change = ((latest - previous) / previous) * 100;
  const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'neutral';
  
  return { change: Math.abs(change), direction };
};

/**
 * Calculate percentage change within a specific timeframe
 * @param {Array} data - Data array (already filtered for the timeframe)
 * @param {string} period - Time period ('1M', '3M', '6M', '1Y', '5Y', '10Y', '25Y', 'MAX')
 * @returns {Object} Object with change value and direction
 */
export const calculateChangeForPeriod = (data, period) => {
  if (!data || data.length < 2) return { change: 0, direction: 'neutral' };
  
  const latest = data[data.length - 1]?.value || 0;
  const earliest = data[0]?.value || 0;
  
  if (!earliest || earliest === 0) {
    return { change: 0, direction: 'neutral' };
  }
  
  const change = ((latest - earliest) / earliest) * 100;
  const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'neutral';
  
  return { change: Math.abs(change), direction, period };
};

/**
 * Process SOFR data for chart display
 * @param {Array} data - Raw SOFR data array
 * @returns {Array} Processed data for chart
 */
export const processSOFRData = (data) => {
  if (!data || !Array.isArray(data) || data.length === 0) return [];
  
  return data
    .filter(item => {
      // Filter out items with null, undefined, or zero values
      const rate = item.rate || item.sofr;
      return rate !== null && rate !== undefined && rate !== 0;
    })
    .map(item => ({
      time: item.date,
      value: item.rate || item.sofr
    }))
    .sort((a, b) => new Date(a.time) - new Date(b.time));
};

/**
 * Process Real Interest Rate data for chart display
 * @param {Array} data - Raw Real Interest Rate data array
 * @returns {Array} Processed data for chart
 */
export const processRealInterestRateData = (data) => {
  if (!data || !Array.isArray(data) || data.length === 0) return [];
  
  return data
    .filter(item => {
      // Filter out items with null, undefined values (but allow negative values for real rates)
      const rate = item.rate;
      return rate !== null && rate !== undefined;
    })
    .map(item => ({
      time: item.date,
      value: item.rate
    }))
    .sort((a, b) => new Date(a.time) - new Date(b.time));
};

/**
 * Get data for specific time period
 * @param {Array} data - Data array
 * @param {string} period - Period ('1M', '3M', '6M', '1Y', '5Y', '10Y', '25Y', 'MAX')
 * @returns {Array} Filtered data
 */
export const getDataForPeriod = (data, period) => {
  if (!data || data.length === 0) return [];
  
  // For MAX, always return all data
  if (period === 'MAX') {
    return data;
  }
  
  const now = new Date();
  let startDate;
  
  switch (period) {
    case '1M':
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      break;
    case '3M':
      startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      break;
    case '6M':
      startDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
      break;
    case '1Y':
      startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      break;
    case '5Y':
      startDate = new Date(now.getFullYear() - 5, now.getMonth(), now.getDate());
      break;
    case '10Y':
      startDate = new Date(now.getFullYear() - 10, now.getMonth(), now.getDate());
      break;
    case '25Y':
      startDate = new Date(now.getFullYear() - 25, now.getMonth(), now.getDate());
      break;
    default:
      return data;
  }
  
  const startTimeString = startDate.toISOString().split('T')[0]; // YYYY-MM-DD format
  
  return data.filter(item => {
    if (!item.time) return false;
    
    // Handle different time formats
    let itemTimeString;
    
    if (typeof item.time === 'number') {
      // Unix timestamp (convert to YYYY-MM-DD)
      itemTimeString = new Date(item.time * 1000).toISOString().split('T')[0];
    } else if (typeof item.time === 'string') {
      // Already in YYYY-MM-DD format
      itemTimeString = item.time.split('T')[0]; // Remove time part if present
    } else {
      return false;
    }
    
    return itemTimeString >= startTimeString;
  });
};
