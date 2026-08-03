import { useState, useEffect } from 'react'
import { endpoints } from '../api/api'

export default function useUNRATEData() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [metadata, setMetadata] = useState(null)

  useEffect(() => {
    const fetchUNRATEData = async () => {
      try {
        setLoading(true)
        const response = await fetch(endpoints.economic.unemployment)
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        
        const result = await response.json()
        
        if (result.error) {
          throw new Error(result.error)
        }
        
        setData(result.data || [])
        setMetadata(result.metadata || {})
        setError(null)
      } catch (err) {
        console.error('Error fetching UNRATE data:', err)
        setError(err.message)
        setData([])
      } finally {
        setLoading(false)
      }
    }

    fetchUNRATEData()
  }, [])

  return { data, loading, error, metadata }
}
