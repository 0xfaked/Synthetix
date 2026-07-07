import { useState, useEffect, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ForexPriceMap {
  [assetId: string]: number
}

export interface ForexPricesState {
  prices: ForexPriceMap
  loading: boolean
  error: string | null
  lastUpdated: Date | null
  isLive: boolean
}

// ─── Pair calculators ─────────────────────────────────────────────────────────
// The fawazahmed0 API returns rates as: 1 USD = X of that currency.
// We convert to the displayed direction of each pair.

type RateMap = Record<string, number>

const PAIR_CALCULATORS: Record<string, (r: RateMap) => number | null> = {
  // Quote currencies (how many USD per 1 EUR) → EUR/USD = 1/rates['eur']
  seur: r => r.eur  ? parseFloat((1 / r.eur).toFixed(5))  : null,   // EUR/USD
  sgbp: r => r.gbp  ? parseFloat((1 / r.gbp).toFixed(5))  : null,   // GBP/USD
  saud: r => r.aud  ? parseFloat((1 / r.aud).toFixed(5))  : null,   // AUD/USD
  snzd: r => r.nzd  ? parseFloat((1 / r.nzd).toFixed(5))  : null,   // NZD/USD

  // Base currencies (how many X per 1 USD) → USD/XXX = rates['xxx']
  sjpy: r => r.jpy  ? parseFloat(r.jpy.toFixed(3))         : null,   // USD/JPY
  schf: r => r.chf  ? parseFloat(r.chf.toFixed(5))         : null,   // USD/CHF
  scad: r => r.cad  ? parseFloat(r.cad.toFixed(5))         : null,   // USD/CAD
  ssgd: r => r.sgd  ? parseFloat(r.sgd.toFixed(5))         : null,   // USD/SGD
  scny: r => r.cny  ? parseFloat(r.cny.toFixed(4))         : null,   // USD/CNY
  sinr: r => r.inr  ? parseFloat(r.inr.toFixed(2))         : null,   // USD/INR
  smxn: r => r.mxn  ? parseFloat(r.mxn.toFixed(4))         : null,   // USD/MXN
  // 'try' is a JS reserved word but valid object key via bracket notation
  stry: r => r['try'] ? parseFloat(r['try'].toFixed(4))    : null,   // USD/TRY
  szar: r => r.zar  ? parseFloat(r.zar.toFixed(4))         : null,   // USD/ZAR
  skrw: r => r.krw  ? parseFloat(r.krw.toFixed(1))         : null,   // USD/KRW
  sbrl: r => r.brl  ? parseFloat(r.brl.toFixed(4))         : null,   // USD/BRL
}

// ─── API endpoints (in priority order) ───────────────────────────────────────
// fawazahmed0/exchange-api → new npm package, free, CORS-enabled, CDN-hosted

const ENDPOINTS = [
  // Primary: npm jsDelivr mirror (recommended, no 404s)
  'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json',
  // Fallback: Cloudflare Pages mirror from the same project
  'https://latest.currency-api.pages.dev/v1/currencies/usd.json',
  // Second fallback: frankfurter.app (ECB-based, covers G10 pairs)
  'https://api.frankfurter.app/latest?from=USD',
]

async function fetchWithTimeout(url: string, ms = 6000): Promise<RateMap> {
  const ctrl = new AbortController()
  const tid = setTimeout(() => ctrl.abort(), ms)

  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()

    // Normalise the two different response shapes
    if (json.usd) return json.usd as RateMap          // fawazahmed0 shape
    if (json.rates) return json.rates as RateMap      // frankfurter.app shape (already USD-based)
    throw new Error('Unknown response shape')
  } finally {
    clearTimeout(tid)
  }
}

async function fetchRates(): Promise<{ rates: RateMap; source: string }> {
  for (const url of ENDPOINTS) {
    try {
      const rates = await fetchWithTimeout(url)
      return { rates, source: url }
    } catch {
      // try next endpoint
    }
  }
  throw new Error('All forex endpoints failed')
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

const REFRESH_INTERVAL_MS = 60_000   // refresh every 60 s

export function useForexPrices(): ForexPricesState & { refresh: () => void } {
  const [state, setState] = useState<ForexPricesState>({
    prices: {},
    loading: true,
    error: null,
    lastUpdated: null,
    isLive: false,
  })

  const load = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }))
    try {
      const { rates } = await fetchRates()

      const prices: ForexPriceMap = {}
      for (const [id, calc] of Object.entries(PAIR_CALCULATORS)) {
        const v = calc(rates)
        if (v !== null && v > 0) prices[id] = v
      }

      setState({
        prices,
        loading: false,
        error: null,
        lastUpdated: new Date(),
        isLive: true,
      })
    } catch {
      setState(prev => ({
        ...prev,
        loading: false,
        isLive: false,
        error: 'Live rates unavailable — showing cached data',
      }))
    }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [load])

  return { ...state, refresh: load }
}
