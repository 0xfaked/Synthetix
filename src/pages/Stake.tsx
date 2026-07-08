import { useState } from 'react'
import { Shield, Zap, TrendingUp, Lock } from 'lucide-react'

const POOLS = [
  {
    id: 'snx-eth',
    name: 'SNX/ETH Pool',
    icon: '🟣',
    apy: 42.8,
    tvl: 124_000_000,
    rewards: ['SNX', 'Fees'],
    lockPeriod: '7 days',
    risk: 'Medium',
    riskColor: '#f59e0b',
  },
  {
    id: 'snx-staking',
    name: 'SNX Staking',
    icon: '⚗️',
    apy: 18.4,
    tvl: 840_000_000,
    rewards: ['SNX', 'sUSD'],
    lockPeriod: '1 year',
    risk: 'Low',
    riskColor: '#10b981',
  },
  {
    id: 'slp-farming',
    name: 'sUSD Yield Farm',
    icon: '🌾',
    apy: 67.2,
    tvl: 38_000_000,
    rewards: ['SNX', 'CRV'],
    lockPeriod: 'None',
    risk: 'High',
    riskColor: '#ef4444',
  },
]

const STATS = [
  { label: 'Your SNX Balance', value: '0.00 SNX', icon: '🟣' },
  { label: 'Staked SNX', value: '0.00 SNX', icon: '🔒' },
  { label: 'Claimable Rewards', value: '$0.00', icon: '💰' },
  { label: 'Collateral Ratio', value: '--', icon: '📊' },
]

export default function Stake() {
  const [stakeAmount, setStakeAmount] = useState('')
  const [activePool, setActivePool] = useState('snx-staking')

  const pool = POOLS.find(p => p.id === activePool)!

  return (
    <>
      <title>Stake — SynthX</title>
      <div className="container" style={{ paddingBottom: '80px' }}>
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1>Stake & Earn</h1>
            <span className="badge" style={{ background: 'rgba(245,158,11,0.15)', color: 'var(--yellow)', border: '1px solid rgba(245,158,11,0.3)', padding: '4px 8px', fontSize: '0.75rem', fontWeight: 700, borderRadius: '6px' }}>Coming Soon</span>
          </div>
          <p>Stake SNX to back the protocol, earn trading fees, and receive staking rewards.</p>
        </div>

        {/* User Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '32px' }}>
          {STATS.map((s, i) => (
            <div key={i} className="card" style={{ padding: '20px' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>{s.icon}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>{s.label}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 700 }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Pools + Stake Form */}
        <div className="stake-grid">
          {/* Pool Selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: '4px' }}>Staking Pools</h3>
            {POOLS.map(p => (
              <div
                key={p.id}
                className="stake-card"
                style={{
                  cursor: 'pointer',
                  border: `1px solid ${activePool === p.id ? 'var(--border-accent)' : 'var(--border-subtle)'}`,
                  background: activePool === p.id ? 'rgba(124,58,237,0.06)' : 'var(--bg-card)',
                  padding: '20px',
                  transition: 'all 0.2s',
                }}
                onClick={() => setActivePool(p.id)}
                id={`pool-${p.id}`}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '1.5rem' }}>{p.icon}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{p.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Lock: {p.lockPeriod}</div>
                    </div>
                  </div>
                  <span className="stake-apy" style={{ fontSize: '1.5rem' }}>{p.apy}%</span>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                  <span className="badge badge-purple">TVL: ${(p.tvl / 1_000_000).toFixed(0)}M</span>
                  {p.rewards.map(r => (
                    <span key={r} className="badge" style={{ background: 'rgba(6,182,212,0.1)', color: 'var(--cyan)', border: '1px solid rgba(6,182,212,0.2)' }}>{r}</span>
                  ))}
                  <span className="badge" style={{ background: `${p.riskColor}15`, color: p.riskColor, border: `1px solid ${p.riskColor}30` }}>
                    {p.risk} Risk
                  </span>
                </div>

                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${(p.tvl / 900_000_000) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>

          {/* Stake Action */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="stake-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>{pool.name}</h3>
                <span className="stake-apy">{pool.apy}% APY</span>
              </div>

              {/* APY Breakdown */}
              <div style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid var(--border-accent)', borderRadius: 'var(--radius-md)', padding: '16px', marginBottom: '20px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Reward Breakdown</div>
                {[
                  { label: 'SNX Inflation', value: `${(pool.apy * 0.6).toFixed(1)}%` },
                  { label: 'Trading Fees', value: `${(pool.apy * 0.3).toFixed(1)}%` },
                  { label: 'Bonus Rewards', value: `${(pool.apy * 0.1).toFixed(1)}%` },
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{item.label}</span>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--green)' }}>{item.value}</span>
                  </div>
                ))}
              </div>

              {/* Stake Input */}
              <div className="swap-field" style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span className="swap-field-label">Amount to Stake</span>
                  <span className="swap-max-btn" onClick={() => setStakeAmount('1000')}>MAX</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <input
                    className="swap-amount-input"
                    placeholder="0.00"
                    value={stakeAmount}
                    onChange={e => setStakeAmount(e.target.value)}
                    type="number"
                    id="stake-amount-input"
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-pill)', whiteSpace: 'nowrap' }}>
                    <span>🟣</span>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>SNX</span>
                  </div>
                </div>
              </div>

              {stakeAmount && parseFloat(stakeAmount) > 0 && (
                <div className="swap-details" style={{ marginBottom: '12px' }}>
                  <div className="swap-detail-row">
                    <span className="swap-detail-label">Est. Daily Rewards</span>
                    <span className="swap-detail-value" style={{ color: 'var(--green)' }}>
                      ${((parseFloat(stakeAmount) * 3.24 * pool.apy / 100) / 365).toFixed(4)}
                    </span>
                  </div>
                  <div className="swap-detail-row">
                    <span className="swap-detail-label">Est. Monthly Rewards</span>
                    <span className="swap-detail-value" style={{ color: 'var(--green)' }}>
                      ${((parseFloat(stakeAmount) * 3.24 * pool.apy / 100) / 12).toFixed(2)}
                    </span>
                  </div>
                  <div className="swap-detail-row">
                    <span className="swap-detail-label">Lock Period</span>
                    <span className="swap-detail-value">{pool.lockPeriod}</span>
                  </div>
                </div>
              )}

              <button
                className="btn btn-primary btn-full btn-lg"
                style={{ borderRadius: 'var(--radius-lg)' }}
                id="stake-btn"
                onClick={() => alert('Connect wallet to stake SNX')}
              >
                <Lock size={16} />
                {stakeAmount && parseFloat(stakeAmount) > 0 ? `Stake ${stakeAmount} SNX` : 'Enter Amount'}
              </button>
            </div>

            {/* Info Cards */}
            {[
              { icon: <Shield size={18} color="#a855f7" />, title: 'Protocol Security', desc: 'Stakers act as backstop for the protocol. SNX is locked as collateral to mint synthetic assets.', color: '#a855f7' },
              { icon: <TrendingUp size={18} color="#10b981" />, title: 'Fee Distribution', desc: 'Weekly trading fees from all synths are distributed proportionally to active stakers.', color: '#10b981' },
            ].map((item, i) => (
              <div key={i} className="card" style={{ padding: '20px', display: 'flex', gap: '14px' }}>
                <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: `${item.color}15`, border: `1px solid ${item.color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {item.icon}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '4px' }}>{item.title}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
