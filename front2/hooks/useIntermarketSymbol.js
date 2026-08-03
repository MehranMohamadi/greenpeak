import { useState, useEffect } from "react"


export default function useIntermarketSymbol(series) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!series) return

    setLoading(true)

    fetch(`/api/intermarket?series=${series}`)
      .then(res => res.json())
      .then(json => {
        if (json.error) throw new Error(json.error)
        setData(json.data)
        setLoading(false)
      })
      .catch(err => {
        console.error("FRED Error:", err)
        setError(err)
        setLoading(false)
      })
  }, [series])

  return { data, loading, error }
}