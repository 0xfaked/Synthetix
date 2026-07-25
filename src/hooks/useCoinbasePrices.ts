import { useState, useEffect } from 'react'

export interface CoinbasePricesState {
  prices: Record<string, number>
  loading: boolean
  error: string | null
  lastUpdated: Date | null
  isLive: boolean
}

export function useCoinbasePrices(): CoinbasePricesState & { refresh: () => Promise<void> } {
  const [prices, setPrices] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [isLive, setIsLive] = useState(false)

  const fetchPrices = async () => {
    setLoading(true)
    setError(null)
    try {
      const url = 'https://api.coinbase.com/v2/exchange-rates?currency=USD'
      const response = await fetch(url)
      const data = await response.json()
      
      if (data && data.data && data.data.rates) {
        const rates = data.data.rates
        setPrices({
          seur: 1 / parseFloat(rates.EUR),
          sgbp: 1 / parseFloat(rates.GBP),
          sjpy: 1 / parseFloat(rates.JPY),
          schf: 1 / parseFloat(rates.CHF),
          saud: 1 / parseFloat(rates.AUD),
          scad: 1 / parseFloat(rates.CAD),
          snzd: 1 / parseFloat(rates.NZD),
          scny: 1 / parseFloat(rates.CNY),
          sxau: 1 / parseFloat(rates.PAXG || rates.XAU),
          sxag: rates.XAG ? 1 / parseFloat(rates.XAG) : 30.15
        })
        setLastUpdated(new Date())
        setIsLive(true)
      } else {
        throw new Error("Invalid format from Coinbase API")
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch Coinbase prices")
      setIsLive(false)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPrices()
    const interval = setInterval(fetchPrices, 30_000)
    return () => clearInterval(interval)
  }, [])

  return {
    prices,
    loading,
    error,
    lastUpdated,
    isLive,
    refresh: fetchPrices,
  }
}
