/**
 * Finnhub REST client — free tier (60 calls/min, no cost).
 *
 * API key: set EXPO_PUBLIC_FINNHUB_API_KEY in `apps/mobile/.env` (or repo root `.env.local`
 * if your Expo env loader picks it up). Legacy alias: EXPO_PUBLIC_FINNHUB_KEY.
 * https://finnhub.io
 *
 * All functions return null gracefully when the key is missing,
 * the ticker is not found, or the network call fails.
 */

const BASE = 'https://finnhub.io/api/v1'

function key(): string | null {
  return (
    process.env.EXPO_PUBLIC_FINNHUB_API_KEY?.trim() ||
    process.env.EXPO_PUBLIC_FINNHUB_KEY?.trim() ||
    null
  )
}

export type StockQuote = {
  price: number          // current price
  change: number         // day change ($)
  changePct: number      // day change (%)
  high: number           // day high
  low: number            // day low
  prevClose: number      // previous close
}

export type BasicFinancials = {
  marketCap: number | null    // USD millions
  peRatio: number | null      // trailing P/E
  week52High: number | null
  week52Low: number | null
}

export type MarketData = StockQuote & BasicFinancials

async function get<T>(path: string): Promise<T | null> {
  const k = key()
  if (!k) return null
  try {
    const res = await fetch(`${BASE}${path}&token=${k}`, {
      headers: { 'User-Agent': 'Verity/1.0' },
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

export async function fetchQuote(ticker: string): Promise<StockQuote | null> {
  const data = await get<{
    c: number; d: number; dp: number; h: number; l: number; pc: number; t: number
  }>(`/quote?symbol=${encodeURIComponent(ticker)}`)

  if (!data || !data.c) return null  // c === 0 means ticker not found

  return {
    price:     data.c,
    change:    data.d,
    changePct: data.dp,
    high:      data.h,
    low:       data.l,
    prevClose: data.pc,
  }
}

export async function fetchBasicFinancials(ticker: string): Promise<BasicFinancials | null> {
  const data = await get<{ metric: Record<string, number | null> }>(
    `/stock/metric?symbol=${encodeURIComponent(ticker)}&metric=all`,
  )
  if (!data?.metric) return null

  const m = data.metric
  return {
    marketCap:  (m['marketCapitalization'] as number | null) ?? null,
    peRatio:    (m['peNormalizedAnnual'] as number | null) ?? null,
    week52High: (m['52WeekHigh'] as number | null) ?? null,
    week52Low:  (m['52WeekLow'] as number | null) ?? null,
  }
}

export async function fetchMarketData(ticker: string): Promise<MarketData | null> {
  const [quote, fins] = await Promise.all([fetchQuote(ticker), fetchBasicFinancials(ticker)])
  if (!quote) return null
  return {
    ...quote,
    marketCap:  fins?.marketCap  ?? null,
    peRatio:    fins?.peRatio    ?? null,
    week52High: fins?.week52High ?? null,
    week52Low:  fins?.week52Low  ?? null,
  }
}

/** "$1.23T", "$456B", "$78M" */
export function formatMarketCap(mcMillions: number | null): string | null {
  if (!mcMillions) return null
  const mc = mcMillions * 1_000_000  // convert from millions
  if (mc >= 1e12) return `$${(mc / 1e12).toFixed(2)}T`
  if (mc >= 1e9)  return `$${(mc / 1e9).toFixed(1)}B`
  return `$${(mc / 1e6).toFixed(0)}M`
}

/** "+1.23%" green, "-0.45%" red */
export function changeColor(pct: number, positive: string, negative: string, neutral: string): string {
  if (pct > 0) return positive
  if (pct < 0) return negative
  return neutral
}
