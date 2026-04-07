import { useEffect, useState } from 'react'
import { fetchMarketData, type MarketData } from '@/lib/finnhub'

const REFRESH_MS = 60_000  // refresh every 60s

export type UseMarketDataResult = {
  data: MarketData | null
  loading: boolean
}

/**
 * Fetches Finnhub quote + basic financials for a ticker.
 * Returns null silently if the key is missing or the ticker isn't found.
 * Refreshes every 60 seconds while the component is mounted.
 */
export function useMarketData(ticker: string | null | undefined): UseMarketDataResult {
  const [data, setData]       = useState<MarketData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!ticker) return

    let cancelled = false

    const fetch = async () => {
      setLoading(true)
      const result = await fetchMarketData(ticker)
      if (!cancelled) {
        setData(result)
        setLoading(false)
      }
    }

    void fetch()
    const interval = setInterval(() => void fetch(), REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [ticker])

  return { data, loading }
}
