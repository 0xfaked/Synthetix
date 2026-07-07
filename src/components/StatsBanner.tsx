import { PLATFORM_STATS } from '../data/assets'

function formatNum(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

const STATS = [
  { label: 'Total Value Locked', value: formatNum(PLATFORM_STATS.tvl), icon: '🏦', color: '#a855f7' },
  { label: '24h Volume', value: formatNum(PLATFORM_STATS.volume24h), icon: '📊', color: '#06b6d4' },
  { label: 'Synthetic Assets', value: `${PLATFORM_STATS.totalAssets}`, icon: '⚗️', color: '#10b981' },
  { label: 'Total Users', value: PLATFORM_STATS.totalUsers.toLocaleString(), icon: '👥', color: '#f59e0b' },
]

export default function StatsBanner() {
  return (
    <div className="stats-banner">
      {STATS.map((s, i) => (
        <div className="stat-item" key={i} style={{ position: 'relative', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
            background: `linear-gradient(90deg, transparent, ${s.color}, transparent)`
          }} />
          <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>{s.icon}</div>
          <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
          <div className="stat-label">{s.label}</div>
        </div>
      ))}
    </div>
  )
}
