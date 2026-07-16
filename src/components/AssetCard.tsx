import { useNavigate } from 'react-router-dom'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { Area, AreaChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { Asset } from '../data/assets'

interface AssetCardProps {
  asset: Asset
  onClick?: () => void
}

function formatPrice(price: number): string {
  if (price >= 1000) return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  if (price >= 1) return `$${price.toFixed(4)}`
  return `$${price.toFixed(6)}`
}

function formatVolume(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n}`
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload?.length) {
    return (
      <div className="custom-tooltip" style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-default)',
        borderRadius: '8px',
        padding: '6px 10px',
        fontSize: '0.75rem',
      }}>
        {formatPrice(payload[0].value)}
      </div>
    )
  }
  return null
}

export default function AssetCard({ asset, onClick }: AssetCardProps) {
  const navigate = useNavigate()
  const isPositive = asset.changePercent24h >= 0
  const chartColor = isPositive ? '#10b981' : '#ef4444'
  const chartFill = isPositive ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)'

  const chartData = asset.sparkline.map((v, i) => ({ i, v }))

  const handleClick = () => {
    if (onClick) onClick()
    else navigate(`/trade?asset=${asset.id}`)
  }

  return (
    <div className="asset-card" onClick={handleClick} id={`asset-card-${asset.id}`}>
      {/* Header */}
      <div className="asset-card-header">
        <div className="asset-info">
          <div className="asset-icon">{asset.icon}</div>
          <div>
            <div className="asset-symbol">{asset.symbol}</div>
            <div className="asset-name">{asset.name}</div>
          </div>
        </div>
        <span className={`badge ${isPositive ? 'badge-green' : 'badge-red'}`}>
          {isPositive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
          {isPositive ? '+' : ''}{asset.changePercent24h.toFixed(2)}%
        </span>
      </div>

      {/* Sparkline Chart */}
      <div style={{ height: 56, margin: '12px -4px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 2, right: 4, bottom: 2, left: 4 }}>
            <defs>
              <linearGradient id={`grad-${asset.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={chartColor} stopOpacity={0.3} />
                <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="v"
              stroke={chartColor}
              strokeWidth={1.5}
              fill={`url(#grad-${asset.id})`}
              dot={false}
              activeDot={{ r: 3, fill: chartColor }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Price */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div className="asset-price">{formatPrice(asset.price)}</div>
          <div className={`asset-change ${isPositive ? 'change-positive' : 'change-negative'}`}>
            {isPositive ? '▲' : '▼'} {formatPrice(Math.abs(asset.change24h))}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>24h Vol</div>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
            {formatVolume(asset.volume24h)}
          </div>
        </div>
      </div>

      {/* Trade Button */}
      <button
        className="btn btn-secondary"
        style={{ marginTop: '14px', width: '100%', padding: '9px', borderRadius: 'var(--radius-md)' }}
        onClick={e => { e.stopPropagation(); navigate(`/trade?asset=${asset.id}`) }}
        id={`trade-btn-${asset.id}`}
      >
        Trade {asset.symbol}
      </button>
    </div>
  )
}
