// Helper function to convert various date formats to yyyy-mm-dd format for charts
export const formatDateForChart = (dateStr, index = 0) => {
  // Convert "2023" to "2023-06-15" format (year only)
  if (dateStr.match(/^\d{4}$/)) {
    const day = Math.min(15 + index, 28).toString().padStart(2, '0')
    return `${dateStr}-06-${day}` // Use June as middle of year
  }
  
  // Convert "2023-03" to "2023-03-01" format
  if (dateStr.match(/^\d{4}-\d{2}$/)) {
    // For monthly data, use day 15 to avoid month-end issues, then add small offset
    const day = Math.min(15 + index, 28).toString().padStart(2, '0')
    return `${dateStr}-${day}`
  }
  
  // Convert "Q1 2023" to "2023-03-01" format
  if (dateStr.match(/^Q\d \d{4}$/)) {
    const [quarter, year] = dateStr.split(' ')
    const monthMap = { 'Q1': '03', 'Q2': '06', 'Q3': '09', 'Q4': '12' }
    const day = Math.min(15 + index, 28).toString().padStart(2, '0')
    return `${year}-${monthMap[quarter]}-${day}`
  }
  
  // Convert "Week 1" to approximate date
  if (dateStr.match(/^Week \d+$/)) {
    const weekNum = parseInt(dateStr.split(' ')[1])
    const month = Math.ceil(weekNum / 4).toString().padStart(2, '0')
    const day = Math.min((weekNum % 4) * 7 + index + 1, 28).toString().padStart(2, '0')
    const currentYear = new Date().getFullYear()
    return `${currentYear}-${month}-${day}`
  }
  
  // Convert month names to dates
  const monthMap = {
    'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06',
    'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
  }
  
  if (monthMap[dateStr]) {
    const currentYear = new Date().getFullYear()
    const day = Math.min(15 + index, 28).toString().padStart(2, '0')
    return `${currentYear}-${monthMap[dateStr]}-${day}`
  }
  
  // If already in correct format, return as is
  return dateStr
}

// Helper function to prepare and sort chart data
export const prepareChartData = (data) => {
  return data
    .map((d, i) => ({ 
      time: formatDateForChart(d.date, i), 
      value: d.value 
    }))
    .sort((a, b) => new Date(a.time) - new Date(b.time))
}
