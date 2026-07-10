import { useState, useEffect } from 'react'
import { TrendingDown, RefreshCw, AlertTriangle, Sparkles } from 'lucide-react'

export default function JpyErosionTracker() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<{
    historicalRate: number
    currentRate: number
    oneYearAgoDate: string
    currentDate: string
    beforeUsd: number
    afterUsd: number
    lossAmount: number
    lossPercent: number
    isCached: boolean
  } | null>(null)

  const fetchRates = async () => {
    setLoading(true)
    setError(null)
    try {
      const today = new Date()
      const oneYearAgo = new Date(today)
      oneYearAgo.setFullYear(today.getFullYear() - 1)
      const dateString = oneYearAgo.toISOString().split('T')[0]

      let historicalRate = 146.72
      let currentRate = 162.41
      let oneYearAgoDate = '2025-07-09'
      let currentDate = '2026-07-09'
      let isCached = false

      try {
        const [resHist, resLatest] = await Promise.all([
          fetch(`https://api.frankfurter.app/${dateString}?from=USD&to=JPY`),
          fetch(`https://api.frankfurter.app/latest?from=USD&to=JPY`)
        ])

        if (resHist.ok && resLatest.ok) {
          const dataHist = await resHist.json()
          const dataLatest = await resLatest.json()

          if (dataHist.rates?.JPY && dataLatest.rates?.JPY) {
            historicalRate = dataHist.rates.JPY
            currentRate = dataLatest.rates.JPY
            oneYearAgoDate = dataHist.date
            currentDate = dataLatest.date
          } else {
            isCached = true
          }
        } else {
          isCached = true
        }
      } catch (apiErr) {
        console.warn('Frankfurter API failed, using cached JPY rates:', apiErr)
        isCached = true
      }

      const amountJpy = 100000
      const beforeUsd = amountJpy / historicalRate
      const afterUsd = amountJpy / currentRate
      const lossAmount = beforeUsd - afterUsd
      const lossPercent = (lossAmount / beforeUsd) * 100

      setData({
        historicalRate,
        currentRate,
        oneYearAgoDate,
        currentDate,
        beforeUsd,
        afterUsd,
        lossAmount,
        lossPercent,
        isCached
      })
    } catch (err: any) {
      setError(err.message || 'An error occurred while fetching currency data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRates()
  }, [])

  if (loading) {
    return (
      <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '180px', marginTop: '16px' }}>
        <RefreshCw size={24} className="animate-spin" style={{ animation: 'spin 1.5s linear infinite', color: 'var(--accent-secondary)', marginBottom: '12px' }} />
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Calculating Yen Erosion...</span>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="card" style={{ padding: '20px', borderTop: '2px solid var(--red)', marginTop: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--red)' }}>
          <AlertTriangle size={16} />
          <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Erosion Tracker Error</span>
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5, margin: '0 0 12px' }}>
          Unable to fetch JPY exchange rates from Frankfurter API.
        </p>
        <button className="btn btn-secondary" style={{ width: '100%', padding: '6px', fontSize: '0.75rem' }} onClick={fetchRates}>
          Retry Fetch
        </button>
      </div>
    )
  }

  return (
    <div className="card" style={{ padding: '20px', marginTop: '16px', position: 'relative', overflow: 'hidden' }}>
      {/* Background glow */}
      <div style={{
        position: 'absolute', right: '-40px', bottom: '-40px',
        width: '120px', height: '120px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(239,68,68,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.9rem', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>📉</span> JPY Value Tracker
          {data.isCached && (
            <span style={{ fontSize: '0.58rem', color: 'var(--text-muted)', fontWeight: 400, background: 'rgba(255,255,255,0.04)', padding: '1px 5px', borderRadius: '4px', border: '1px solid var(--border-subtle)', verticalAlign: 'middle' }}>
              Offline
            </span>
          )}
        </h3>
        <span className="badge badge-red" style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.68rem', padding: '2px 6px' }}>
          <TrendingDown size={10} /> -{data.lossPercent.toFixed(2)}%
        </span>
      </div>

      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '14px' }}>
        See how JPY purchasing power eroded against the USD over the past year.
      </p>

      {/* Before / After */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '12px', marginBottom: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>¥100,000 One Year Ago ({data.oneYearAgoDate})</span>
          <span style={{ fontSize: '0.82rem', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
            ${data.beforeUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
          </span>
        </div>
        <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '8px 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>¥100,000 Today ({data.currentDate})</span>
          <span style={{ fontSize: '0.82rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
            ${data.afterUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
          </span>
        </div>
      </div>

      {/* Total Loss */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', padding: '0 4px' }}>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Value Loss (in USD)</span>
        <span style={{ fontSize: '0.88rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--red)' }}>
          -${data.lossAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>

      {/* AI Insight */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(124,58,237,0.08) 0%, rgba(6,182,212,0.04) 100%)',
        border: '1px solid rgba(124,58,237,0.2)',
        borderRadius: 'var(--radius-md)',
        padding: '12px',
        fontSize: '0.72rem',
        lineHeight: 1.6,
        color: 'var(--text-secondary)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px', color: 'var(--accent-secondary)', fontWeight: 700 }}>
          <Sparkles size={11} /> AI INSIGHT
        </div>
        "Even a highly developed and stable economy like Japan is not immune to currency erosion, as JPY's depreciation against USD over the past year has silently reduced JPY-holders' global purchasing power."
      </div>
    </div>
  )
}

