import { useNavigate } from 'react-router-dom'
import { ArrowRight, Shield, Zap, Globe } from 'lucide-react'
import { ASSETS, CATEGORIES } from '../data/assets'
import StatsBanner from '../components/StatsBanner'
import AssetCard from '../components/AssetCard'

const TICKER_ASSETS = [...ASSETS, ...ASSETS] // doubled for seamless loop

function formatPrice(price: number): string {
  if (price >= 1000) return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  if (price >= 1) return `$${price.toFixed(4)}`
  return `$${price.toFixed(6)}`
}

const FEATURES = [
  {
    icon: <Shield size={24} />,
    title: 'Overcollateralized',
    desc: 'Every synthetic asset is backed by 750%+ crypto collateral, ensuring stability and trust.',
    color: '#a855f7',
  },
  {
    icon: <Zap size={24} />,
    title: 'Flare FTSO',
    desc: 'Real-time price feeds powered by the Flare Fast Transparent Oracle System (FTSO).',
    color: '#06b6d4',
  },
  {
    icon: <Globe size={24} />,
    title: 'Global Access',
    desc: 'Trade any real-world asset from anywhere on Earth, 24/7, without intermediaries.',
    color: '#10b981',
  },
]

const FEATURED_ASSETS = ASSETS.filter(a =>
  ['sxau', 'sxag', 'seur'].includes(a.id)
)

export default function Home() {
  const navigate = useNavigate()

  return (
    <>
      <title>SynthX — Trade Synthetic Real-World Assets On-Chain</title>

      {/* Ticker Tape */}
      <div className="ticker-wrap">
        <div className="ticker-inner">
          {TICKER_ASSETS.map((asset, i) => (
            <div key={`${asset.id}-${i}`} className="ticker-item">
              <span>{asset.icon}</span>
              <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{asset.symbol}</span>
              <span style={{ color: 'var(--text-secondary)' }}>{formatPrice(asset.price)}</span>
              <span className={asset.changePercent24h >= 0 ? 'change-positive' : 'change-negative'}>
                {asset.changePercent24h >= 0 ? '+' : ''}{asset.changePercent24h.toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Hero */}
      <section className="hero">
        <div className="hero-bg" />
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <div className="hero-badge">
            <div className="live-dot" style={{ background: '#10b981' }} />
            Live on Flare Testnet (Coston2)
          </div>

          <h1 className="hero-title">
            Trade Real-World Assets<br />
            <span className="gradient-text">On-Chain, Instantly</span>
          </h1>

          <p className="hero-subtitle">
            Gain exposure to Forex, Stocks, Bonds, ETFs and Precious Metals using crypto.
            No brokers, no borders, no KYC. Just pure DeFi.
          </p>

          <div className="hero-actions">
            <button className="btn btn-primary btn-lg" onClick={() => navigate('/trade')} id="hero-trade-btn">
              Start Trading <ArrowRight size={18} />
            </button>
            <button className="btn btn-ghost btn-lg" onClick={() => navigate('/markets')} id="hero-markets-btn">
              Explore Markets
            </button>
          </div>
        </div>
      </section>

      {/* Stats */}
      <div className="container">
        <StatsBanner />
      </div>

      {/* Featured Assets */}
      <section className="container" style={{ marginBottom: '80px' }}>
        <div className="section-header">
          <h2 className="section-title">🔥 Featured Assets</h2>
          <button className="btn btn-ghost" onClick={() => navigate('/markets')} id="view-all-btn">
            View All Markets <ArrowRight size={14} />
          </button>
        </div>
        <div className="asset-grid">
          {FEATURED_ASSETS.map(asset => (
            <AssetCard key={asset.id} asset={asset} />
          ))}
        </div>
      </section>

      {/* Features */}
      <section style={{ background: 'var(--bg-surface)', padding: '80px 0', borderTop: '1px solid var(--border-subtle)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <h2 className="section-title" style={{ fontSize: '2rem', marginBottom: '12px' }}>
              Why SynthX?
            </h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto' }}>
              Built with DeFi's best infrastructure. No compromises on security, decentralization, or accessibility.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            {FEATURES.map((f, i) => (
              <div key={i} className="card" style={{ padding: '28px' }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 'var(--radius-md)',
                  background: `${f.color}18`, border: `1px solid ${f.color}30`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: f.color, marginBottom: '16px',
                }}>
                  {f.icon}
                </div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700, marginBottom: '8px' }}>
                  {f.title}
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.7 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Category Overview */}
      <section className="container" style={{ marginTop: '80px', marginBottom: '80px' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h2 className="section-title" style={{ fontSize: '2rem', marginBottom: '12px' }}>
            Every Asset Class. One Protocol.
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          {CATEGORIES.slice(1).map(cat => {
            const count = ASSETS.filter(a => a.category === cat.id).length
            return (
              <div
                key={cat.id}
                className="card"
                style={{ textAlign: 'center', cursor: 'pointer' }}
                onClick={() => navigate(`/markets?category=${cat.id}`)}
                id={`category-${cat.id}`}
              >
                <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>{cat.icon}</div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: '4px' }}>{cat.label}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{count} assets</div>
              </div>
            )
          })}
        </div>
      </section>

      {/* CTA Banner */}
      <section style={{
        background: 'linear-gradient(135deg, rgba(124,58,237,0.15) 0%, rgba(6,182,212,0.08) 100%)',
        border: '1px solid var(--border-accent)',
        borderRadius: 'var(--radius-xl)',
        margin: '0 24px 80px',
        padding: '60px 40px',
        textAlign: 'center',
      }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 700, marginBottom: '16px' }}>
          Ready to trade the world?
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', maxWidth: '480px', margin: '0 auto 32px' }}>
          Join 147,000+ traders accessing global markets through DeFi's most liquid synthetic asset protocol.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <button className="btn btn-primary btn-lg" onClick={() => navigate('/trade')} id="cta-trade-btn">
            Launch App <ArrowRight size={18} />
          </button>
          <button className="btn btn-secondary btn-lg" onClick={() => navigate('/stake')} id="cta-stake-btn">
            Stake & Earn
          </button>
        </div>
      </section>
    </>
  )
}
