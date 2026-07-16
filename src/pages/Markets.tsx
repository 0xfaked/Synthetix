import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  TrendingUp, TrendingDown, Search, Globe, BarChart2, Landmark,
  PieChart, RefreshCw, Wifi, WifiOff, Coins,
} from 'lucide-react'
import type { Asset, AssetCategory } from '../data/assets'
import { ASSETS } from '../data/assets'
import { useForexPrices } from '../hooks/useForexPrices'
import { useFtsoPrice } from '../hooks/useFtsoPrice'

// ─── Formatters ──────────────────────────────────────────────────────────────

function fmtPrice(price: number): string {
  if (price >= 10_000) return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  if (price >= 100)    return `$${price.toFixed(2)}`
  if (price >= 1)      return `$${price.toFixed(4)}`
  return `$${price.toFixed(6)}`
}

function fmtPriceRaw(price: number): string {
  if (price >= 10_000) return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (price >= 100)    return price.toFixed(2)
  if (price >= 1)      return price.toFixed(4)
  return price.toFixed(6)
}

function fmtVol(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`
  if (n >= 1_000_000)     return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)         return `$${(n / 1_000).toFixed(0)}K`
  return `$${n}`
}

function fmtTime(d: Date | null): string {
  if (!d) return '—'
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

// ─── Subpage config ───────────────────────────────────────────────────────────

type SubPage = 'forex' | 'commodities' | 'bonds' | 'etfs' | 'metals'

interface SubPageConfig {
  id: SubPage
  label: string
  icon: React.ReactNode
  category: AssetCategory
  heroTitle: string
  heroSubtitle: string
  accentColor: string
  gradientFrom: string
  gradientTo: string
  description: string
}

const SUBPAGES: SubPageConfig[] = [
  {
    id: 'forex',
    label: 'Forex',
    icon: <Globe size={16} />,
    category: 'forex',
    heroTitle: 'Foreign Exchange',
    heroSubtitle: 'FX Markets · Live Prices',
    accentColor: '#3b82f6',
    gradientFrom: 'rgba(59,130,246,0.18)',
    gradientTo: 'rgba(139,92,246,0.06)',
    description: 'Real-time synthetic currency pairs powered by live market data. 24/7 global FX access on-chain.',
  },
  {
    id: 'commodities',
    label: 'Commodities',
    icon: <BarChart2 size={16} />,
    category: 'commodities',
    heroTitle: 'Commodities',
    heroSubtitle: 'Raw Materials & Energy',
    accentColor: '#f59e0b',
    gradientFrom: 'rgba(245,158,11,0.18)',
    gradientTo: 'rgba(239,68,68,0.06)',
    description: 'Trade synthetic gold, oil, agricultural goods and energy markets. Hedge real-world commodity exposure on-chain.',
  },
  {
    id: 'bonds',
    label: 'Bonds',
    icon: <Landmark size={16} />,
    category: 'bonds',
    heroTitle: 'Government Bonds',
    heroSubtitle: 'Fixed Income',
    accentColor: '#10b981',
    gradientFrom: 'rgba(16,185,129,0.16)',
    gradientTo: 'rgba(6,182,212,0.06)',
    description: 'Access US Treasury and global sovereign debt synthetics. Gain fixed-income exposure without custody friction.',
  },
  {
    id: 'etfs',
    label: 'ETFs',
    icon: <PieChart size={16} />,
    category: 'etfs',
    heroTitle: 'Exchange-Traded Funds',
    heroSubtitle: 'Index & Thematic',
    accentColor: '#8b5cf6',
    gradientFrom: 'rgba(139,92,246,0.18)',
    gradientTo: 'rgba(236,72,153,0.06)',
    description: 'Diversified exposure to global indices. Trade synthetic S&P 500, NASDAQ, and sector ETFs on-chain.',
  },
  {
    id: 'metals',
    label: 'Metals',
    icon: <Coins size={16} />,
    category: 'metals',
    heroTitle: 'Precious Metals',
    heroSubtitle: 'Commodities & Metals',
    accentColor: '#fbbf24',
    gradientFrom: 'rgba(251,191,36,0.18)',
    gradientTo: 'rgba(251,191,36,0.06)',
    description: 'Trade synthetic precious metals on-chain with instant pricing and deep liquidity.',
  },
]

// ─── Mini Sparkline ───────────────────────────────────────────────────────────

function Sparkline({ data, positive }: { data: number[]; positive: boolean }) {
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const w = 80, h = 28
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w
      const y = h - ((v - min) / range) * h
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  const stroke = positive ? '#10b981' : '#ef4444'
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <polyline points={points} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

// ─── Live Price Badge ─────────────────────────────────────────────────────────

function LiveBadge({
  isLive, loading, lastUpdated, onRefresh,
  ftsoPrice, ftsoLoading, ftsoError, ftsoLastUpdated
}: {
  isLive: boolean
  loading: boolean
  lastUpdated: Date | null
  onRefresh: () => void
  ftsoPrice: number | null
  ftsoLoading: boolean
  ftsoError: string | null
  ftsoLastUpdated: Date | null
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
      fontSize: '0.72rem', color: 'var(--text-muted)',
    }}>
      {/* Forex API Status */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '5px',
        padding: '4px 10px', borderRadius: '20px',
        background: isLive ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.1)',
        border: `1px solid ${isLive ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.25)'}`,
      }}>
        {loading
          ? <RefreshCw size={10} style={{ animation: 'spin 1s linear infinite', color: '#f59e0b' }} />
          : isLive
            ? <Wifi size={10} color="#10b981" />
            : <WifiOff size={10} color="#ef4444" />
        }
        <span style={{ fontWeight: 700, color: loading ? '#f59e0b' : isLive ? '#10b981' : '#ef4444' }}>
          {loading ? 'API Fetching…' : isLive ? 'API LIVE' : 'API CACHED'}
        </span>
      </div>
      {lastUpdated && !loading && (
        <span>API Updated {fmtTime(lastUpdated)}</span>
      )}

      {/* FTSO Oracle Status */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '5px',
        padding: '4px 10px', borderRadius: '20px',
        background: ftsoError ? 'rgba(239,68,68,0.1)' : ftsoPrice ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.05)',
        border: `1px solid ${ftsoError ? 'rgba(239,68,68,0.25)' : ftsoPrice ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.1)'}`,
      }}>
        {ftsoLoading
          ? <RefreshCw size={10} style={{ animation: 'spin 1s linear infinite', color: '#3b82f6' }} />
          : ftsoPrice
            ? <Wifi size={10} color="#3b82f6" />
            : <WifiOff size={10} color="#ef4444" />
        }
        <span style={{ fontWeight: 700, color: ftsoLoading ? '#3b82f6' : ftsoPrice ? '#3b82f6' : '#ef4444' }}>
          {ftsoLoading ? 'FTSO Fetching…' : ftsoPrice ? 'FTSO V2 ACTIVE' : 'FTSO OFFLINE'}
        </span>
      </div>
      {ftsoLastUpdated && !ftsoLoading && (
        <span>FTSO Updated {fmtTime(ftsoLastUpdated)}</span>
      )}

      <button
        onClick={onRefresh}
        disabled={loading || ftsoLoading}
        style={{
          display: 'flex', alignItems: 'center', gap: '4px',
          padding: '3px 9px', borderRadius: '20px',
          background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)',
          color: 'var(--text-muted)', fontSize: '0.68rem', fontWeight: 600,
          cursor: (loading || ftsoLoading) ? 'not-allowed' : 'pointer',
        }}
      >
        <RefreshCw size={9} /> Refresh
      </button>
    </div>
  )
}

// ─── Subpage Hero ─────────────────────────────────────────────────────────────

function SubpageHero({
  config, assets,
  livePrices, isLive, loading, lastUpdated, onRefresh,
  ftsoPrice, ftsoLoading, ftsoError, ftsoLastUpdated,
}: {
  config: SubPageConfig
  assets: Asset[]
  livePrices?: Record<string, number>
  isLive?: boolean
  loading?: boolean
  lastUpdated?: Date | null
  onRefresh?: () => void
  ftsoPrice: number | null
  ftsoLoading: boolean
  ftsoError: string | null
  ftsoLastUpdated: Date | null
}) {
  const isForex = config.id === 'forex'

  // Use live prices for forex if available, with FTSO override for sEUR/USD
  const enriched = assets.map(a => {
    let price = a.price
    if (isForex) {
      if (a.id === 'seur') {
        price = ftsoPrice !== null ? ftsoPrice : (livePrices?.[a.id] ?? a.price)
      } else {
        price = livePrices?.[a.id] ?? a.price
      }
    }
    return {
      ...a,
      price,
    }
  })

  const totalVol = enriched.reduce((s, a) => s + a.volume24h, 0)
  const gainers = enriched.filter(a => a.changePercent24h >= 0).length
  const avgChange = enriched.length
    ? enriched.reduce((s, a) => s + a.changePercent24h, 0) / enriched.length
    : 0

  return (
    <div style={{
      borderRadius: 'var(--radius-lg)',
      border: `1px solid ${config.accentColor}33`,
      background: `linear-gradient(135deg, ${config.gradientFrom}, ${config.gradientTo})`,
      padding: '28px 32px', marginBottom: '24px',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', right: '-60px', top: '-60px',
        width: '260px', height: '260px', borderRadius: '50%',
        background: `radial-gradient(circle, ${config.accentColor}22 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.12em', color: config.accentColor, textTransform: 'uppercase', marginBottom: '5px' }}>
          {config.heroSubtitle}
        </div>
        <h2 style={{ fontSize: '1.7rem', fontWeight: 800, margin: '0 0 8px', lineHeight: 1.1 }}>
          {config.heroTitle}
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', maxWidth: '560px', lineHeight: 1.6, margin: '0 0 20px' }}>
          {config.description}
        </p>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            {[
              { label: 'Pairs', value: enriched.length.toString() },
              { label: '24h Volume', value: fmtVol(totalVol) },
              { label: 'Gainers', value: `${gainers}/${enriched.length}` },
              { label: 'Avg Δ 24h', value: `${avgChange >= 0 ? '+' : ''}${avgChange.toFixed(2)}%`, colored: true, pos: avgChange >= 0 },
            ].map(s => (
              <div key={s.label}>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.label}</div>
                <div style={{
                  fontSize: '1rem', fontWeight: 700,
                  color: 'colored' in s ? (s.pos ? 'var(--green)' : 'var(--red)') : 'var(--text-primary)',
                  fontFamily: 'var(--font-mono)',
                }}>
                  {s.value}
                </div>
              </div>
            ))}
          </div>

          {/* Live badge — only for forex */}
          {isForex && onRefresh && (
            <LiveBadge
              isLive={isLive ?? false}
              loading={loading ?? false}
              lastUpdated={lastUpdated ?? null}
              onRefresh={onRefresh}
              ftsoPrice={ftsoPrice}
              ftsoLoading={ftsoLoading}
              ftsoError={ftsoError}
              ftsoLastUpdated={ftsoLastUpdated}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Asset Table ──────────────────────────────────────────────────────────────

function AssetTable({
  assets, accentColor, isForex, livePrices,
  ftsoPrice, ftsoLoading, ftsoError
}: {
  assets: Asset[]
  accentColor: string
  isForex?: boolean
  livePrices?: Record<string, number>
  ftsoPrice: number | null
  ftsoLoading: boolean
  ftsoError: string | null
}) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'change' | 'volume'>('volume')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  // Build enriched assets (inject live price for forex)
  const enriched = useMemo(() =>
    assets.map(a => {
      let price = a.price
      let isLivePrice = false
      let isFtso = false

      if (isForex) {
        price = livePrices?.[a.id] ?? a.price
        isLivePrice = !!livePrices?.[a.id]
        isFtso = isLivePrice
      }

      return {
        ...a,
        price,
        isLivePrice,
        isFtso,
      }
    }),
    [assets, isForex, livePrices]
  )

  const filtered = useMemo(() => {
    let list = enriched.filter(a =>
      a.symbol.toLowerCase().includes(query.toLowerCase()) ||
      a.name.toLowerCase().includes(query.toLowerCase())
    )
    list = [...list].sort((a, b) => {
      if (sortBy === 'name') return sortDir === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
      const map: Record<string, (x: typeof a) => number> = {
        price: x => x.price,
        change: x => x.changePercent24h,
        volume: x => x.volume24h,
      }
      const fn = map[sortBy]
      return sortDir === 'desc' ? fn(b) - fn(a) : fn(a) - fn(b)
    })
    return list
  }, [enriched, query, sortBy, sortDir])

  const handleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('desc') }
  }

  const SortIcon = ({ col }: { col: typeof sortBy }) => (
    <span style={{ marginLeft: '4px', opacity: sortBy === col ? 1 : 0.28, fontSize: '0.65rem' }}>
      {sortBy === col ? (sortDir === 'desc' ? '▼' : '▲') : '▼'}
    </span>
  )

  return (
    <div>
      {/* Search & count bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          Showing <strong style={{ color: 'var(--text-primary)' }}>{filtered.length}</strong> of {assets.length} assets
          {isForex && livePrices && Object.keys(livePrices).length > 0 && (
            <span style={{ marginLeft: '8px', fontSize: '0.68rem', color: '#10b981', fontWeight: 600 }}>
              · {Object.keys(livePrices).length} live prices
            </span>
          )}
        </div>
        <div className="search-wrapper">
          <Search size={13} className="search-icon" />
          <input
            className="search-input"
            placeholder="Search pair or currency…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{ width: '220px' }}
          />
        </div>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'rgba(255,255,255,0.02)' }}>
              {[
                { label: '#',         col: null,     align: 'center' },
                { label: 'Asset',     col: 'name',   align: 'left'   },
                { label: 'Price',     col: 'price',  align: 'right'  },
                { label: '24h Change',col: 'change', align: 'right'  },
                { label: '7-Day',     col: null,     align: 'center' },
                { label: '24h Volume',col: 'volume', align: 'right'  },
                { label: 'Mkt Cap',   col: null,     align: 'right'  },
                { label: '',          col: null,     align: 'center' },
              ].map(({ label, col, align }) => (
                <th
                  key={label}
                  onClick={col ? () => handleSort(col as typeof sortBy) : undefined}
                  style={{
                    padding: '11px 15px', textAlign: align as any,
                    fontSize: '0.68rem', fontWeight: 700,
                    color: 'var(--text-muted)', textTransform: 'uppercase',
                    letterSpacing: '0.06em', cursor: col ? 'pointer' : 'default',
                    userSelect: 'none', whiteSpace: 'nowrap',
                  }}
                >
                  {label}{col && <SortIcon col={col as typeof sortBy} />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((asset, i) => {
              const pos = asset.changePercent24h >= 0
              const hasLive = (asset as any).isLivePrice
              return (
                <tr
                  key={asset.id}
                  style={{
                    borderBottom: i < filtered.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                    cursor: 'pointer', transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.025)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  onClick={() => navigate(`/trade?asset=${asset.id}`)}
                >
                  {/* rank */}
                  <td style={{ padding: '13px 15px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>
                    {i + 1}
                  </td>

                  {/* asset info */}
                  <td style={{ padding: '13px 15px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%',
                        background: `${asset.color}22`, border: `1.5px solid ${asset.color}44`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1rem', flexShrink: 0,
                      }}>
                        {asset.icon}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.87rem' }}>{asset.symbol}</span>
                          {hasLive && !(asset as any).isFtso && (
                            <span style={{
                              fontSize: '0.55rem', fontWeight: 700, padding: '1px 5px',
                              borderRadius: '20px', background: 'rgba(16,185,129,0.15)',
                              color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.05em',
                            }}>LIVE</span>
                          )}
                          {(asset as any).isFtso && (
                            <span style={{
                              fontSize: '0.55rem', fontWeight: 700, padding: '1px 5px',
                              borderRadius: '4px', background: 'rgba(59,130,246,0.15)',
                              color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.05em',
                              border: '1px solid rgba(59,130,246,0.3)',
                            }}>FTSO</span>
                          )}
                          {asset.id !== 'seur' && (
                            <span style={{
                              fontSize: '0.55rem', fontWeight: 700, padding: '1px 5px',
                              borderRadius: '4px', background: 'rgba(255,255,255,0.04)',
                              color: 'var(--text-muted)', border: '1px solid var(--border-subtle)',
                              letterSpacing: '0.05em',
                            }}>SOON</span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '1px' }}>{asset.name}</div>
                        {asset.description && (
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '1px', opacity: 0.65 }}>{asset.description}</div>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* price */}
                  <td style={{ padding: '13px 15px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.87rem' }}>
                    {asset.id === 'seur' && ftsoLoading && ftsoPrice === null ? (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                        <RefreshCw size={12} className="animate-spin" style={{ animation: 'spin 1.5s linear infinite', color: '#3b82f6' }} />
                        <span style={{ color: 'var(--text-muted)' }}>Fetching...</span>
                      </div>
                    ) : (
                      <>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                          {asset.id === 'seur' && ftsoError && (
                            <span
                              title={`FTSO Oracle Offline: ${ftsoError}. Showing API fallback.`}
                              style={{ color: '#ef4444', display: 'inline-flex', alignItems: 'center', cursor: 'help' }}
                            >
                              <WifiOff size={12} style={{ marginRight: '2px' }} />
                            </span>
                          )}
                          <span style={{ color: hasLive ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                            {fmtPrice(asset.price)}
                          </span>
                        </div>
                        {asset.unit && (
                          <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontFamily: 'inherit', fontWeight: 400 }}>{asset.unit}</div>
                        )}
                      </>
                    )}
                  </td>

                  {/* 24h change */}
                  <td style={{ padding: '13px 15px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                      <span className={`badge ${pos ? 'badge-green' : 'badge-red'}`}>
                        {pos ? '+' : ''}{asset.changePercent24h.toFixed(2)}%
                      </span>
                      <span style={{ fontSize: '0.65rem', color: pos ? 'var(--green)' : 'var(--red)', fontFamily: 'var(--font-mono)' }}>
                        {pos ? '+' : ''}{fmtPriceRaw(asset.change24h)}
                      </span>
                    </div>
                  </td>

                  {/* sparkline */}
                  <td style={{ padding: '13px 15px', textAlign: 'center' }}>
                    <Sparkline data={asset.sparkline} positive={pos} />
                  </td>

                  {/* volume */}
                  <td style={{ padding: '13px 15px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                    {fmtVol(asset.volume24h)}
                  </td>

                  {/* market cap */}
                  <td style={{ padding: '13px 15px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                    {fmtVol(asset.marketCap)}
                  </td>

                  {/* trade button */}
                  <td style={{ padding: '13px 15px', textAlign: 'center' }}>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '5px 13px', fontSize: '0.73rem', whiteSpace: 'nowrap' }}
                      onClick={e => { e.stopPropagation(); navigate(`/trade?asset=${asset.id}`) }}
                      id={`trade-btn-${asset.id}`}
                    >
                      Trade
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🔍</div>
            No assets match "{query}"
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Markets Page ─────────────────────────────────────────────────────────────

export default function Markets() {
  const [activePage, setActivePage] = useState<SubPage>('forex')
  const navigate = useNavigate()

  // Live forex prices hook — always fetched, only used when on Forex tab
  const { prices: forexPrices, loading: fxLoading, isLive: fxLive, lastUpdated: fxUpdated, refresh: fxRefresh, error: fxError } = useForexPrices()

  // Live FTSO price hook
  const { price: ftsoPrice, loading: ftsoLoading, error: ftsoError, lastUpdated: ftsoLastUpdated, refresh: ftsoRefresh } = useFtsoPrice()

  const config = SUBPAGES.find(s => s.id === activePage)!
  
  // Combined refresh that handles both API and FTSO updates
  const handleRefresh = async () => {
    if (activePage === 'forex') {
      await Promise.allSettled([fxRefresh(), ftsoRefresh()])
    } else {
      fxRefresh()
    }
  }

  const isForex = activePage === 'forex'

  // Memoize assets, using live FTSOv2 prices for forex assets
  const assets = useMemo(() => {
    const list = ASSETS.filter(a => a.category === config.category)
    return list.map(a => {
      return {
        ...a,
        price: (isForex && forexPrices[a.id]) ? forexPrices[a.id] : a.price,
      }
    })
  }, [config, isForex, forexPrices])

  const topGainers = useMemo(() => {
    return [...ASSETS].map(a => {
      if (a.category === 'forex') {
        return {
          ...a,
          price: forexPrices[a.id] ?? a.price,
        }
      }
      return a
    }).sort((a, b) => b.changePercent24h - a.changePercent24h).slice(0, 3)
  }, [forexPrices])

  const topLosers = useMemo(() => {
    return [...ASSETS].map(a => {
      if (a.category === 'forex') {
        return {
          ...a,
          price: forexPrices[a.id] ?? a.price,
        }
      }
      return a
    }).sort((a, b) => a.changePercent24h - b.changePercent24h).slice(0, 3)
  }, [forexPrices])

  return (
    <>
      <title>Markets — SynthX</title>

      <div className="container" style={{ paddingBottom: '80px' }}>

        {/* Page Header */}
        <div className="page-header">
          <h1>Global Synthetic Markets</h1>
          <p>
            {isForex
              ? 'Forex prices sourced live from global exchange rate feeds and Flare FTSO V2 — updated in real-time.'
              : 'Real-world asset prices tracked on-chain via Flare FTSO in real-time.'}
          </p>
        </div>

        {/* FX error banner */}
        {isForex && (fxError || ftsoError) && !fxLoading && !ftsoLoading && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            background: 'rgba(245,158,11,0.08)',
            border: '1px solid rgba(245,158,11,0.25)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            marginBottom: '20px',
            fontSize: '0.78rem',
            color: '#f59e0b',
          }}>
            {fxError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <WifiOff size={14} /> API Feeds: {fxError}
              </div>
            )}
            {ftsoError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <WifiOff size={14} /> Flare FTSO V2 Oracle: {ftsoError} (using API fallback)
              </div>
            )}
          </div>
        )}

        {/* Top Movers Banner */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '28px' }}>
          {[
            { title: 'Top Gainers 24h', data: topGainers, positive: true },
            { title: 'Top Losers 24h',  data: topLosers,  positive: false },
          ].map(({ title, data, positive }) => (
            <div className="card" key={title} style={{ padding: '18px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '12px' }}>
                {positive ? <TrendingUp size={14} color="var(--green)" /> : <TrendingDown size={14} color="var(--red)" />}
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: positive ? 'var(--green)' : 'var(--red)' }}>{title}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {data.map(a => {
                  return (
                    <div key={a.id}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
                      onClick={() => navigate(`/trade?asset=${a.id}`)}>
                      <span style={{ fontSize: '1rem' }}>{a.icon}</span>
                      <span style={{ fontWeight: 600, fontSize: '0.8rem', flex: 1 }}>{a.symbol}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>{fmtPrice(a.price)}</span>
                      <span className={`badge ${positive ? 'badge-green' : 'badge-red'}`}>
                        {positive ? '+' : ''}{a.changePercent24h.toFixed(2)}%
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Subpage Tab Nav */}
        <div style={{
          display: 'flex', gap: '6px', marginBottom: '22px',
          background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)', padding: '6px',
        }}>
          {SUBPAGES.map(sp => {
            const isActive = activePage === sp.id
            return (
              <button
                key={sp.id}
                id={`subpage-tab-${sp.id}`}
                onClick={() => setActivePage(sp.id)}
                style={{
                  flex: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                  padding: '9px 14px',
                  borderRadius: 'calc(var(--radius-lg) - 4px)',
                  border: isActive ? `1px solid ${sp.accentColor}55` : '1px solid transparent',
                  background: isActive ? `${sp.accentColor}18` : 'none',
                  color: isActive ? sp.accentColor : 'var(--text-muted)',
                  fontWeight: 700, fontSize: '0.8rem',
                  cursor: 'pointer', transition: 'all 0.2s ease', whiteSpace: 'nowrap',
                }}
              >
                {sp.icon}
                {sp.label}
                {sp.id === 'forex' && (fxLive || ftsoPrice) && (
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981', flexShrink: 0 }} />
                )}
                <span style={{
                  fontSize: '0.65rem', padding: '1px 6px', borderRadius: '20px',
                  background: isActive ? `${sp.accentColor}30` : 'rgba(255,255,255,0.06)',
                  color: isActive ? sp.accentColor : 'var(--text-muted)', fontWeight: 600,
                }}>
                  {ASSETS.filter(a => a.category === sp.category).length}
                </span>
              </button>
            )
          })}
        </div>

        {/* Subpage Hero */}
        <SubpageHero
          config={config}
          assets={assets}
          livePrices={isForex ? forexPrices : undefined}
          isLive={fxLive}
          loading={fxLoading}
          lastUpdated={fxUpdated}
          onRefresh={handleRefresh}
          ftsoPrice={ftsoPrice}
          ftsoLoading={ftsoLoading}
          ftsoError={ftsoError}
          ftsoLastUpdated={ftsoLastUpdated}
        />

        {/* Asset Table */}
        <AssetTable
          assets={assets}
          accentColor={config.accentColor}
          isForex={isForex}
          livePrices={isForex ? forexPrices : undefined}
          ftsoPrice={ftsoPrice}
          ftsoLoading={ftsoLoading}
          ftsoError={ftsoError}
        />

      </div>
    </>
  )
}
