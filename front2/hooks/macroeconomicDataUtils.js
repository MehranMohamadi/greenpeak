// Utility functions for processing macroeconomic data

// Process data for different time periods
export const getDataForPeriod = (data, period) => {
  if (!data || data.length === 0) return []
  
  const now = new Date()
  let startDate
  
  switch (period) {
    case '1M':
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
      break
    case '3M':
      startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())
      break
    case '6M':
      startDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate())
      break
    case '1Y':
      startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
      break
    case '5Y':
      startDate = new Date(now.getFullYear() - 5, now.getMonth(), now.getDate())
      break
    case '10Y':
      startDate = new Date(now.getFullYear() - 10, now.getMonth(), now.getDate())
      break
    case '25Y':
      startDate = new Date(now.getFullYear() - 25, now.getMonth(), now.getDate())
      break
    case 'MAX':
    default:
      return data
  }
  
  return data.filter(item => {
    const itemDate = new Date(item.date) // Use date field from API
    return itemDate >= startDate
  })
}

// Process GDP data for charts
export const processGDPData = (data) => {
  if (!data || data.length === 0) return []
  
  return data.map(item => ({
    time: item.date, // Use date field from API
    value: parseFloat(item.value || item.gdp) || 0 // Use value or gdp field
  }))
}

// Process UNRATE data for charts
export const processUNRATEData = (data) => {
  if (!data || data.length === 0) return []
  
  return data.map(item => ({
    time: item.date, // Use date field from API
    value: parseFloat(item.value || item.rate || item.unrate) || 0 // Use value, rate, or unrate field
  }))
}

// Process valuation data for charts
export const processValuationData = (data) => {
  if (!data || data.length === 0) return []
  
  return data.map(item => ({
    time: item.date, // Use date string directly (YYYY-MM-DD format supported by lightweight-charts)
    value: parseFloat(item.value || item.rate) || 0 // Use value or rate field
  }))
}

// Get latest value from data
export const getLatestValue = (data) => {
  if (!data || data.length === 0) return 0
  const latest = data[data.length - 1]
  return parseFloat(latest?.value || latest?.gdp || latest?.rate || latest?.unrate) || 0
}

// Calculate percentage change
export const calculateChange = (data) => {
  if (!data || data.length < 2) return { direction: 'neutral', change: 0 }
  
  const latest = parseFloat(data[data.length - 1]?.value || data[data.length - 1]?.gdp || data[data.length - 1]?.rate || data[data.length - 1]?.unrate) || 0
  const previous = parseFloat(data[data.length - 2]?.value || data[data.length - 2]?.gdp || data[data.length - 2]?.rate || data[data.length - 2]?.unrate) || 0
  
  if (previous === 0) return { direction: 'neutral', change: 0 }
  
  const changePercent = ((latest - previous) / previous) * 100
  
  return {
    direction: changePercent > 0 ? 'up' : changePercent < 0 ? 'down' : 'neutral',
    change: Math.abs(changePercent)
  }
}

// Calculate year-over-year change
export const calculateYoYChange = (data) => {
  if (!data || data.length === 0) return { direction: 'neutral', change: 0 }
  
  const latest = data[data.length - 1]
  if (!latest) return { direction: 'neutral', change: 0 }
  
  // Find data point from approximately one year ago
  const latestDate = new Date(latest.date)
  const yearAgo = new Date(latestDate.getFullYear() - 1, latestDate.getMonth(), latestDate.getDate())
  
  // Find the closest data point to one year ago
  let yearAgoData = null
  let minDiff = Infinity
  
  for (const item of data) {
    const itemDate = new Date(item.date)
    const diff = Math.abs(itemDate.getTime() - yearAgo.getTime())
    if (diff < minDiff) {
      minDiff = diff
      yearAgoData = item
    }
  }
  
  if (!yearAgoData) return { direction: 'neutral', change: 0 }
  
  const latestValue = parseFloat(latest.value || latest.gdp || latest.rate || latest.unrate) || 0
  const yearAgoValue = parseFloat(yearAgoData.value || yearAgoData.gdp || yearAgoData.rate || yearAgoData.unrate) || 0
  
  if (yearAgoValue === 0) return { direction: 'neutral', change: 0 }
  
  const changePercent = ((latestValue - yearAgoValue) / yearAgoValue) * 100
  
  return {
    direction: changePercent > 0 ? 'up' : changePercent < 0 ? 'down' : 'neutral',
    change: Math.abs(changePercent)
  }
}

// Calculate percentage change for a specific time period
export const calculateChangeForPeriod = (data, period) => {
  if (!data || data.length === 0) return { direction: 'neutral', change: 0 }
  
  const filteredData = getDataForPeriod(data, period)
  if (filteredData.length < 2) return { direction: 'neutral', change: 0 }
  
  const latest = parseFloat(filteredData[filteredData.length - 1]?.value || filteredData[filteredData.length - 1]?.gdp || filteredData[filteredData.length - 1]?.rate || filteredData[filteredData.length - 1]?.unrate) || 0
  const earliest = parseFloat(filteredData[0]?.value || filteredData[0]?.gdp || filteredData[0]?.rate || filteredData[0]?.unrate) || 0
  
  if (earliest === 0) return { direction: 'neutral', change: 0 }
  
  const changePercent = ((latest - earliest) / earliest) * 100
  
  return {
    direction: changePercent > 0 ? 'up' : changePercent < 0 ? 'down' : 'neutral',
    change: Math.abs(changePercent)
  }
}
