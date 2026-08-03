import { useMemo } from 'react';

/**
 * Hook to calculate update information for financial data factors
 */
export default function useUpdateInfo() {
  
  // Get next release date based on frequency and last update
  const getNextReleaseDate = (lastUpdateDate, frequency) => {
    if (!lastUpdateDate) return null;
    
    const lastDate = new Date(lastUpdateDate);
    const nextDate = new Date(lastDate);
    
    switch (frequency?.toLowerCase()) {
      case 'daily':
        // Next business day (skip weekends)
        nextDate.setDate(lastDate.getDate() + 1);
        // Skip weekends
        if (nextDate.getDay() === 0) nextDate.setDate(nextDate.getDate() + 1); // Sunday -> Monday
        if (nextDate.getDay() === 6) nextDate.setDate(nextDate.getDate() + 2); // Saturday -> Monday
        break;
        
      case 'weekly':
        // Next Thursday (Fed balance sheet updates on Thursdays)
        nextDate.setDate(lastDate.getDate() + 7);
        break;
        
      case 'monthly':
        // Next month, same day
        nextDate.setMonth(lastDate.getMonth() + 1);
        break;
        
      case 'quarterly':
        // Next quarter
        nextDate.setMonth(lastDate.getMonth() + 3);
        break;
        
      default:
        // Default to next business day
        nextDate.setDate(lastDate.getDate() + 1);
        if (nextDate.getDay() === 0) nextDate.setDate(nextDate.getDate() + 1);
        if (nextDate.getDay() === 6) nextDate.setDate(nextDate.getDate() + 2);
    }
    
    return nextDate;
  };

  // Format date for display
  const formatUpdateDate = (dateString) => {
    if (!dateString) return 'Unknown';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short'
      });
    } catch {
      return dateString;
    }
  };

  // Format next release date
  const formatNextRelease = (nextDate) => {
    if (!nextDate) return 'TBD';
    
    const now = new Date();
    const diffTime = nextDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return 'Overdue';
    } else if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Tomorrow';
    } else if (diffDays <= 7) {
      return `In ${diffDays} days`;
    } else {
      return nextDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: nextDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      });
    }
  };

  // Get update status (current, stale, error)
  const getUpdateStatus = (lastUpdateDate, frequency) => {
    if (!lastUpdateDate) return 'error';
    
    const lastDate = new Date(lastUpdateDate);
    const now = new Date();
    const diffTime = now - lastDate;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    switch (frequency?.toLowerCase()) {
      case 'daily':
        return diffDays <= 1 ? 'current' : diffDays <= 3 ? 'stale' : 'error';
      case 'weekly':
        return diffDays <= 7 ? 'current' : diffDays <= 14 ? 'stale' : 'error';
      case 'monthly':
        return diffDays <= 31 ? 'current' : diffDays <= 45 ? 'stale' : 'error';
      case 'quarterly':
        return diffDays <= 92 ? 'current' : diffDays <= 120 ? 'stale' : 'error';
      default:
        return diffDays <= 1 ? 'current' : 'stale';
    }
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'current':
        return 'text-green-600 dark:text-green-400';
      case 'stale':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'error':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  // Process metadata to get update info
  const processUpdateInfo = (metadata) => {
    if (!metadata) return null;
    
    const lastUpdate = metadata.latest_date;
    const frequency = metadata.frequency;
    const nextRelease = getNextReleaseDate(lastUpdate, frequency);
    const status = getUpdateStatus(lastUpdate, frequency);
    
    return {
      lastUpdate: formatUpdateDate(lastUpdate),
      nextRelease: formatNextRelease(nextRelease),
      status,
      statusColor: getStatusColor(status),
      frequency: frequency || 'Unknown',
      source: metadata.source || 'Unknown',
      totalRecords: metadata.total_records || 0
    };
  };

  return {
    processUpdateInfo,
    formatUpdateDate,
    formatNextRelease,
    getUpdateStatus,
    getStatusColor,
    getNextReleaseDate
  };
}
