import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { ExternalLink, Wallet } from 'lucide-react'
import { ASSETS } from '../data/assets'
import { useWallet } from '../context/WalletContext'
import WalletModal from '../components/WalletModal'

// Mock portfolio data
const HOLDINGS = [
  { assetId: 'sxau', amount: 0.4521, entryPrice: 2210.00 },
  { assetId: 'seur', amount: 450.00, entryPrice: 1.0780 },
  { assetId: 'sxag', amount: 12.500, entryPrice: 28.40 },
]

const TX_HISTORY = [
  { type: 'MINT', symbol: 'sXAU', amount: '0.4521', value: '$1,060.17', time: '2h ago', hash: '0x4f2a...' },
  { type: 'MINT', symbol: 'sEUR', amount: '450.00', value: '$486.30', time: '5d ago', hash: '0x9f7a...' },
  { type: 'MINT', symbol: 'sXAG', amount: '12.500', value: '$355.00', time: '1w ago', hash: '0x3e2c...' },
]

const PIE_COLORS = ['#FFD700', '#003399', '#C0C0C0']

function formatPrice(price: number): string {
  if (price >= 1000) return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  if (price >= 1) return `$${price.toFixed(4)}`
  return `$${price.toFixed(6)}`
}

export default function Portfolio() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'holdings' | 'history'>('holdings')
  const [walletOpen, setWalletOpen] = useState(false)
  const { isConnected, shortAddress, address } = useWallet()

  const holdings = HOLDINGS.map(h => {
    const asset = ASSETS.find(a => a.id === h.assetId)!
    const currentValue = h.amount * asset.price
    const costBasis = h.amount * h.entryPrice
    const pnl = currentValue - costBasis
    const pnlPct = (pnl / costBasis) * 100
    return { ...h, asset, currentValue, pnl, pnlPct }
  })

  const totalValue = holdings.reduce((s, h) => s + h.currentValue, 0)
  const totalPnl = holdings.reduce((s, h) => s + h.pnl, 0)
  const totalPnlPct = (totalPnl / (totalValue - totalPnl)) * 100

  const pieData = holdings.map(h => ({
    name: h.asset.symbol,
    value: parseFloat(h.currentValue.toFixed(2)),
  }))

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload?.length) {
      return (
        <div style={{
          background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
          borderRadius: '10px', padding: '10px 14px', fontSize: '0.8rem',
        }}>
          <div style={{ fontWeight: 700 }}>{payload[0].name}</div>
          <div style={{ color: 'var(--text-secondary)' }}>${payload[0].value.toLocaleString()}</div>
          <div style={{ color: 'var(--text-muted)' }}>{((payload[0].value / totalValue) * 100).toFixed(1)}%</div>
        </div>
      )
    }
    return null
  }

  return (
    <>
      <title>Portfolio — SynthX</title>
      <WalletModal open={walletOpen} onClose={() => setWalletOpen(false)} />

      <div className="container" style={{ paddingBottom: '80px' }}>
        <div className="page-header">
          <div>
            <h1>My Portfolio</h1>
            <p>
              {isConnected && address
                ? <>Connected as <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-secondary)', fontSize: '0.85rem' }}>{shortAddress}</span></>
                : 'Track your synthetic asset holdings and performance.'}
            </p>
          </div>
          {!isConnected && (
            <button
              className="btn btn-primary"
              onClick={() => setWalletOpen(true)}
              id="portfolio-connect-btn"
            >
              <Wallet size={15} /> Connect Wallet
            </button>
          )}
        </div>

        {/* ── WALLET GATE ── */}
        {!isConnected ? (
          <div className="card wallet-gate" style={{ marginTop: '16px' }}>
            <div className="wallet-gate-icon">🔐</div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>
              Connect Your Wallet
            </h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: '380px', lineHeight: 1.6, margin: 0 }}>
              Connect your wallet to view your synthetic asset holdings, track P&amp;L, and manage your positions.
            </p>
            <button
              className="btn btn-primary btn-lg"
              onClick={() => setWalletOpen(true)}
              id="portfolio-gate-connect-btn"
            >
              <Wallet size={16} /> Connect Wallet to Continue
            </button>
            <div style={{ display: 'flex', gap: '24px', marginTop: '8px' }}>
              {[
                { icon: '📊', label: 'Real-time P&L tracking' },
                { icon: '🔒', label: 'Non-custodial' },
                { icon: '⚡', label: 'Instant settlement' },
              ].map(f => (
                <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <span>{f.icon}</span> {f.label}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>

        {/* Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '28px' }}>
          <div className="card" style={{ padding: '24px', borderTop: '2px solid var(--accent-primary)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Portfolio Value</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 700 }}>
              ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="card" style={{ padding: '24px', borderTop: `2px solid ${totalPnl >= 0 ? 'var(--green)' : 'var(--red)'}` }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Total P&L</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 700, color: totalPnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {totalPnl >= 0 ? '+' : ''}${totalPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '0.85rem', color: totalPnl >= 0 ? 'var(--green)' : 'var(--red)', marginTop: '4px' }}>
              {totalPnlPct >= 0 ? '+' : ''}{totalPnlPct.toFixed(2)}% all-time
            </div>
          </div>
          <div className="card" style={{ padding: '24px', borderTop: '2px solid var(--cyan)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Positions</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 700, color: 'var(--cyan)' }}>
              {holdings.length}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>Open positions</div>
          </div>
        </div>

        {/* Main Layout */}
        <div className="portfolio-grid">
          {/* Pie Chart */}
          <div className="chart-container" style={{ position: 'sticky', top: 90 }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: '20px', fontSize: '1rem' }}>
              Allocation
            </h3>
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    dataKey="value"
                    strokeWidth={2}
                    stroke="var(--bg-card)"
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
              {holdings.map((h, i) => (
                <div key={h.assetId} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                  <span style={{ fontSize: '0.8rem', flex: 1 }}>{h.asset.symbol}</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {((h.currentValue / totalValue) * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Holdings / History */}
          <div>
            <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: 'var(--bg-card)', padding: '4px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border-subtle)', width: 'fit-content' }}>
              {(['holdings', 'history'] as const).map(tab => (
                <button
                  key={tab}
                  className={`filter-tab${activeTab === tab ? ' active' : ''}`}
                  onClick={() => setActiveTab(tab)}
                  id={`portfolio-tab-${tab}`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {activeTab === 'holdings' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {holdings.map(h => (
                  <div
                    key={h.assetId}
                    className="holding-item"
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/trade?asset=${h.assetId}`)}
                    id={`holding-${h.assetId}`}
                  >
                    <span style={{ fontSize: '1.4rem' }}>{h.asset.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{h.asset.symbol}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                          ${h.currentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          {h.amount.toFixed(4)} @ {formatPrice(h.entryPrice)}
                        </span>
                        <span style={{
                          fontSize: '0.78rem', fontWeight: 600,
                          color: h.pnl >= 0 ? 'var(--green)' : 'var(--red)',
                        }}>
                          {h.pnl >= 0 ? '+' : ''}${h.pnl.toFixed(2)} ({h.pnlPct >= 0 ? '+' : ''}{h.pnlPct.toFixed(2)}%)
                        </span>
                      </div>
                      <div className="progress-bar" style={{ marginTop: '8px' }}>
                        <div
                          className="progress-fill"
                          style={{
                            width: `${(h.currentValue / totalValue) * 100}%`,
                            background: PIE_COLORS[holdings.indexOf(h) % PIE_COLORS.length],
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
                <button
                  className="btn btn-primary btn-full"
                  style={{ marginTop: '8px' }}
                  onClick={() => navigate('/trade')}
                  id="add-position-btn"
                >
                  + Add Position
                </button>
              </div>
            )}

            {activeTab === 'history' && (
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                {TX_HISTORY.map((tx, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '14px',
                      padding: '14px 20px',
                      borderBottom: i < TX_HISTORY.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                    }}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: 'var(--radius-sm)',
                      background: tx.type === 'MINT' ? 'var(--green-dim)' : 'var(--red-dim)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.65rem', fontWeight: 700,
                      color: tx.type === 'MINT' ? 'var(--green)' : 'var(--red)',
                    }}>
                      {tx.type}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{tx.symbol}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{tx.amount} • {tx.time}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', fontWeight: 600 }}>{tx.value}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--accent-secondary)', display: 'flex', alignItems: 'center', gap: 3, justifyContent: 'flex-end', marginTop: 2 }}>
                        {tx.hash} <ExternalLink size={10} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
          </>
        )}
      </div>
    </>
  )
}
