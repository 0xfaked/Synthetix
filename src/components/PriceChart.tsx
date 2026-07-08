import { useState, useEffect } from 'react'
import type { Asset } from '../data/assets'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts'

interface PriceChartProps {
  asset: Asset
}

const TIME_RANGES = ['1H', '24H', '7D', '1M', '1Y']

function generateHistoricalData(basePrice: number, points: number, volatility: number) {
  const data = []
  let price = basePrice * (1 - Math.random() * 0.1)
  const now = Date.now()
  for (let i = points; i >= 0; i--) {
    price = price * (1 + (Math.random() - 0.48) * volatility)
    data.push({
      time: new Date(now - i * (86400000 / points * 24)).toLocaleDateString(),
      price: parseFloat(price.toFixed(4)),
    })
  }
  return data
}

function formatPrice(price: number): string {
  if (price >= 1000) return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  if (price >= 1) return `$${price.toFixed(4)}`
  return `$${price.toFixed(6)}`
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-default)',
        borderRadius: '10px',
        padding: '10px 14px',
        fontSize: '0.8rem',
      }}>
        <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
        <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
          {formatPrice(payload[0].value)}
        </div>
      </div>
    )
  }
  return null
}

export default function PriceChart({ asset }: PriceChartProps) {
  const [activeRange, setActiveRange] = useState('24H')
  const [data, setData] = useState<{ time: string; price: number }[]>([])

  useEffect(() => {
    const pts = { '1H': 30, '24H': 48, '7D': 84, '1M': 60, '1Y': 120 }
    const vol = { '1H': 0.001, '24H': 0.003, '7D': 0.01, '1M': 0.02, '1Y': 0.04 }
    setData(generateHistoricalData(asset.price, pts[activeRange as keyof typeof pts], vol[activeRange as keyof typeof vol]))
  }, [asset.id, activeRange])

  const isPositive = asset.changePercent24h >= 0
  const chartColor = isPositive ? '#10b981' : '#ef4444'

  const firstPrice = data[0]?.price ?? asset.price
  const lastPrice = data[data.length - 1]?.price ?? asset.price
  const rangeChange = ((lastPrice - firstPrice) / firstPrice * 100)

  return (
    <div className="chart-container">
      <div className="chart-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <span style={{ fontSize: '1.5rem' }}>{asset.icon}</span>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.1rem' }}>
              {asset.name}
            </span>
            <span className="badge badge-purple" style={{ fontSize: '0.72rem' }}>{asset.symbol}</span>
          </div>
          <div className="chart-price-large">{formatPrice(lastPrice)}</div>
          <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className={rangeChange >= 0 ? 'change-positive' : 'change-negative'} style={{ fontWeight: 600, fontSize: '0.9rem' }}>
              {rangeChange >= 0 ? '▲' : '▼'} {Math.abs(rangeChange).toFixed(2)}%
            </span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{activeRange} change</span>
          </div>
        </div>
        <div className="chart-time-tabs">
          {TIME_RANGES.map(r => (
            <button
              key={r}
              className={`chart-time-btn${activeRange === r ? ' active' : ''}`}
              onClick={() => setActiveRange(r)}
              id={`chart-range-${r}`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="price-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={chartColor} stopOpacity={0.25} />
                <stop offset="100%" stopColor={chartColor} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis
              dataKey="time"
              tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              tickCount={5}
            />
            <YAxis
              domain={['auto', 'auto']}
              tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={v => formatPrice(v)}
              width={80}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="price"
              stroke={chartColor}
              strokeWidth={2}
              fill="url(#price-gradient)"
              dot={false}
              activeDot={{ r: 4, fill: chartColor, stroke: 'var(--bg-card)', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Market Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '1px',
        background: 'var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        marginTop: '20px',
      }}>
        {[
          { label: '24h Volume', value: `$${(asset.volume24h / 1_000_000).toFixed(1)}M` },
          { label: 'Market Cap', value: `$${(asset.marketCap / 1_000_000).toFixed(0)}M` },
          { label: 'Oracle', value: 'Flare FTSO' },
        ].map((stat, i) => (
          <div key={i} style={{
            background: 'var(--bg-elevated)',
            padding: '12px 16px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {stat.label}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', fontWeight: 600 }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
