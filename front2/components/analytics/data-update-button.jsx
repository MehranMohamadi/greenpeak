import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { endpoints } from '../../api/api';

export default function DataUpdateButton({ updateType = "all", size = "sm", variant = "outline" }) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [error, setError] = useState(null);

  const triggerUpdate = async () => {
    setIsUpdating(true);
    setError(null);
    
    try {
      const response = await fetch(`${endpoints.system.updateData}?update_type=${updateType}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Update failed: ${response.status}`);
      }
      
      const result = await response.json();
      setLastUpdate(new Date());
      console.log('Data update result:', result);
      
      // Optionally reload the page or trigger a data refresh
      setTimeout(() => {
        window.location.reload();
      }, 2000);
      
    } catch (err) {
      console.error('Data update error:', err);
      setError(err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const getStatusIcon = () => {
    if (isUpdating) {
      return <RefreshCw className="h-4 w-4 animate-spin" />;
    }
    if (error) {
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
    if (lastUpdate) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    return <RefreshCw className="h-4 w-4" />;
  };

  const getButtonText = () => {
    if (isUpdating) return "Updating...";
    if (error) return "Retry";
    if (lastUpdate) return "Updated!";
    return "Update Data";
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant={variant}
        size={size}
        onClick={triggerUpdate}
        disabled={isUpdating}
        className="flex items-center gap-2"
        title={`Manually trigger ${updateType} data update`}
      >
        {getStatusIcon()}
        {getButtonText()}
      </Button>
      
      {error && (
        <span className="text-xs text-red-500">
          {error}
        </span>
      )}
      
      {lastUpdate && !error && (
        <span className="text-xs text-green-600">
          Updated at {lastUpdate.toLocaleTimeString()}
        </span>
      )}
    </div>
  );
}
