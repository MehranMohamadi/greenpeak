import { useEffect, useState } from "react";

export default function useSP500Data() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

useEffect(() => {
  fetch("/api/market/sp500")
    .then(res => res.json())
    .then(json => {
      if (!Array.isArray(json)) {
        throw new Error(json?.error || "Invalid API response")
      }
      setData(json)
    })
    .catch(err => setError(err.message))
    .finally(() => setLoading(false))
}, [])
  return { data, loading, error };
}