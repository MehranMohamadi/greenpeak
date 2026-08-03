import { useState, useEffect } from 'react'
import { endpoints } from '../api/api'

export default function useGDPData() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [metadata, setMetadata] = useState(null)

  useEffect(() => {
    const fetchGDPData = async () => {
      try {
        setLoading(true)
        const response = await fetch(endpoints.macroeco.gdp)
        
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
        console.error('Error fetching GDP data:', err)
        setError(err.message)
        setData([])
      } finally {
        setLoading(false)
      }
    }

    fetchGDPData()
  }, [])

  return { data, loading, error, metadata }
}
