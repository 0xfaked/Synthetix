import { useState, useEffect } from 'react'
import type { Asset } from '../data/assets'
import {
  ComposedChart, Area, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts'
import { CandlestickChart, LineChart, Maximize, Minimize } from 'lucide-react'

const CandlestickShape = (props: any) => {
  const { x, y, width, height, payload } = props;
  const { open, close, high, low } = payload;
  if (high == null || low == null || open == null || close == null) return null;

  const isGrowing = close >= open;
  const color = isGrowing ? '#10b981' : '#ef4444';
  
  const unit = height / Math.max(high - low, 0.000001);
  const openY = y + (high - Math.max(open, close)) * unit;
  const closeY = y + (high - Math.min(open, close)) * unit;
  const bodyHeight = Math.max(Math.abs(closeY - openY), 2);
  
  const lineX = x + width / 2;
  
  return (
    <g stroke={color} fill={color}>
      <line x1={lineX} y1={y} x2={lineX} y2={y + height} />
      <rect x={x} y={openY} width={width} height={bodyHeight} stroke="none" />
    </g>
  );
};

interface PriceChartProps {
  asset: Asset
}

const TIME_RANGES = ['1H', '24H', '7D', '1M', '1Y', '5Y', 'MAX']

function generateHistoricalData(basePrice: number, points: number, volatility: number) {
  const data = []
  let price = basePrice * (1 - Math.random() * 0.1)
  const now = Date.now()
  for (let i = points; i >= 0; i--) {
    const open = price
    const move = (Math.random() - 0.48) * volatility
    price = price * (1 + move)
    const close = price
    const high = Math.max(open, close) * (1 + Math.random() * volatility * 0.5)
    const low = Math.min(open, close) * (1 - Math.random() * volatility * 0.5)
    data.push({
      time: new Date(now - i * (86400000 / points * 24)).toLocaleDateString(),
      price: parseFloat(close.toFixed(4)),
      open: parseFloat(open.toFixed(4)),
      high: parseFloat(high.toFixed(4)),
      low: parseFloat(low.toFixed(4)),
      close: parseFloat(close.toFixed(4)),
      range: [parseFloat(low.toFixed(4)), parseFloat(high.toFixed(4))]
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
    const data = payload[0].payload;
    return (
      <div style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-default)',
        borderRadius: '10px',
        padding: '10px 14px',
        fontSize: '0.8rem',
      }}>
        <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
        {data.open !== undefined ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
            <div style={{ color: 'var(--text-muted)' }}>O: <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{formatPrice(data.open)}</span></div>
            <div style={{ color: 'var(--text-muted)' }}>C: <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{formatPrice(data.close)}</span></div>
            <div style={{ color: 'var(--text-muted)' }}>H: <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{formatPrice(data.high)}</span></div>
            <div style={{ color: 'var(--text-muted)' }}>L: <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{formatPrice(data.low)}</span></div>
          </div>
        ) : (
          <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
            {formatPrice(payload[0].value || payload[0].value?.[1] || 0)}
          </div>
        )}
      </div>
    )
  }
  return null
}

export default function PriceChart({ asset }: PriceChartProps) {
  const [activeRange, setActiveRange] = useState('24H')
  const [chartType, setChartType] = useState<'line' | 'candle'>('line')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [data, setData] = useState<{ time: string; price: number }[]>([])

  useEffect(() => {
    async function fetchRealData() {
      try {
        const params = {
          '1H': { range: '1d', interval: '2m', slice: 30 },
          '24H': { range: '1d', interval: '30m', slice: 48 },
          '7D': { range: '1mo', interval: '1h', slice: 168 },
          '1M': { range: '1mo', interval: '1d', slice: 30 },
          '1Y': { range: '1y', interval: '1wk', slice: 52 },
          '5Y': { range: '5y', interval: '1wk', slice: 260 },
          'MAX': { range: 'max', interval: '1mo', slice: 1000 }
        }[activeRange] || { range: '1d', interval: '30m', slice: 48 }

        const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${asset.yahooSymbol}?interval=${params.interval}&range=${params.range}`
        const url = `https://api.allorigins.win/raw?url=${encodeURIComponent(yahooUrl)}`
        const res = await fetch(url)
        if (!res.ok) throw new Error('Network error')
        const json = await res.json()
        const result = json.chart?.result?.[0]
        if (!result) throw new Error('No data')
        
        const timestamps = result.timestamp || []
        const closes = result.indicators?.quote?.[0]?.close || []
        const opens = result.indicators?.quote?.[0]?.open || []
        const highs = result.indicators?.quote?.[0]?.high || []
        const lows = result.indicators?.quote?.[0]?.low || []
        
        let parsedData = []
        for (let i = 0; i < timestamps.length; i++) {
          if (closes[i] !== null && closes[i] !== undefined) {
            const date = new Date(timestamps[i] * 1000)
            const timeStr = ['1H', '24H', '7D'].includes(activeRange)
              ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : (['5Y', 'MAX'].includes(activeRange)
                 ? date.toLocaleDateString([], { year: 'numeric', month: 'short' })
                 : date.toLocaleDateString([], { month: 'short', day: 'numeric' }))
            parsedData.push({ 
              time: timeStr, 
              price: closes[i],
              open: opens[i] ?? closes[i],
              high: highs[i] ?? closes[i],
              low: lows[i] ?? closes[i],
              close: closes[i],
              range: [lows[i] ?? closes[i], highs[i] ?? closes[i]]
            })
          }
        }
        
        if (parsedData.length > params.slice) {
          parsedData = parsedData.slice(-params.slice)
        }
        
        if (parsedData.length > 0) {
          setData(parsedData)
        } else {
          throw new Error('Empty parsed data')
        }
      } catch (err) {
        console.warn('Failed to fetch real data, falling back to dummy data', err)
        const pts = { '1H': 30, '24H': 48, '7D': 84, '1M': 60, '1Y': 120, '5Y': 120, 'MAX': 120 }
        const vol = { '1H': 0.001, '24H': 0.003, '7D': 0.01, '1M': 0.02, '1Y': 0.04, '5Y': 0.08, 'MAX': 0.15 }
        setData(generateHistoricalData(asset.price, pts[activeRange as keyof typeof pts], vol[activeRange as keyof typeof vol]))
      }
    }
    
    fetchRealData()
  }, [asset.id, asset.yahooSymbol, asset.price, activeRange])

  const isPositive = asset.changePercent24h >= 0
  const chartColor = isPositive ? '#10b981' : '#ef4444'

  const firstPrice = data[0]?.price ?? asset.price
  const lastPrice = data[data.length - 1]?.price ?? asset.price
  const rangeChange = ((lastPrice - firstPrice) / firstPrice * 100)

  return (
    <div 
      className="chart-container"
      style={isFullscreen ? {
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'var(--bg-card)',
        overflowY: 'auto',
        borderRadius: 0,
        border: 'none',
        padding: '32px 5vw',
      } : undefined}
    >
      <div className="chart-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '1.5rem' }}>{asset.icon}</span>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.1rem', whiteSpace: 'nowrap' }}>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
          <button 
            style={{ 
              background: 'var(--bg-elevated)', 
              border: '1px solid var(--border-subtle)', 
              borderRadius: 'var(--radius-md)',
              padding: '0 10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              height: '32px',
              transition: 'all 0.2s'
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--border-default)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-subtle)' }}
            onClick={() => setChartType(chartType === 'line' ? 'candle' : 'line')}
            title={`Switch to ${chartType === 'line' ? 'Candlestick' : 'Line'} view`}
          >
            {chartType === 'line' ? <CandlestickChart size={18} /> : <LineChart size={18} />}
          </button>
          <button 
            style={{ 
              background: 'var(--bg-elevated)', 
              border: '1px solid var(--border-subtle)', 
              borderRadius: 'var(--radius-md)',
              padding: '0 10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              height: '32px',
              transition: 'all 0.2s'
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--border-default)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-subtle)' }}
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
          </button>
        </div>
      </div>

      <div style={{ height: isFullscreen ? 'calc(100vh - 220px)' : 260, minHeight: 260, transition: 'height 0.3s ease' }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
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
            {chartType === 'line' ? (
              <Area
                type="monotone"
                dataKey="price"
                stroke={chartColor}
                strokeWidth={2}
                fill="url(#price-gradient)"
                dot={false}
                activeDot={{ r: 4, fill: chartColor, stroke: 'var(--bg-card)', strokeWidth: 2 }}
              />
            ) : (
              <Bar
                dataKey="range"
                shape={<CandlestickShape />}
              />
            )}
          </ComposedChart>
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
