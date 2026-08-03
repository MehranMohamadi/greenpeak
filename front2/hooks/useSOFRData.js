import { useState, useEffect } from 'react'
import { endpoints } from '../api/api'

const useSOFRData = () => {
  const [data, setData] = useState(null)
  const [metadata, setMetadata] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchSOFRData = async () => {
      try {
        setLoading(true)
        const response = await fetch(endpoints.monetaryPolicy.sofr)
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        
        const result = await response.json()
        // Handle both old array format and new object format with metadata
        let arr, meta;
        if (Array.isArray(result)) {
          arr = result;
          meta = null;
        } else if (result.data && result.metadata) {
          arr = result.data;
          meta = result.metadata;
        } else {
          arr = result.data || result;
          meta = result.metadata || null;
        }
        
        setData(arr)
        setMetadata(meta)
        setError(null)
      } catch (err) {
        console.error('Error fetching SOFR data:', err)
        setError(err.message)
        setData(null)
        setMetadata(null)
      } finally {
        setLoading(false)
      }
    }

    fetchSOFRData()
  }, [])

  return { data, metadata, loading, error }
}

export default useSOFRData
