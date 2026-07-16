import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Asset } from '../data/assets'
import { ASSETS } from '../data/assets'
import PriceChart from '../components/PriceChart'
import SwapBox from '../components/SwapBox'

export default function Trade() {
  const [searchParams] = useSearchParams()
  const assetId = searchParams.get('asset') ?? 'seur'
  const [selectedAsset, setSelectedAsset] = useState<Asset>(
    ASSETS.find(a => a.id === assetId) ?? ASSETS.find(a => a.id === 'seur')!
  )

  useEffect(() => {
    const found = ASSETS.find(a => a.id === assetId)
    if (found) setSelectedAsset(found)
  }, [assetId])

  return (
    <>
      <title>Trade — SynthX</title>
      <div style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)', padding: '12px 0' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', display: 'flex', gap: '8px', overflowX: 'auto' }}>
          {ASSETS.map(asset => (
            <button
              key={asset.id}
              onClick={() => setSelectedAsset(asset)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '6px 14px',
                background: selectedAsset.id === asset.id ? 'rgba(124,58,237,0.15)' : 'var(--bg-card)',
                border: `1px solid ${selectedAsset.id === asset.id ? 'var(--border-accent)' : 'var(--border-subtle)'}`,
                borderRadius: 'var(--radius-pill)',
                color: selectedAsset.id === asset.id ? 'var(--text-accent)' : 'var(--text-secondary)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                fontSize: '0.8rem',
                fontWeight: 600,
                transition: 'all 0.15s ease',
              }}
              id={`quick-select-${asset.id}`}
            >
              <span>{asset.icon}</span>
              <span>{asset.symbol}</span>
              <span style={{
                color: asset.changePercent24h >= 0 ? 'var(--green)' : 'var(--red)',
                fontSize: '0.7rem',
              }}>
                {asset.changePercent24h >= 0 ? '+' : ''}{asset.changePercent24h.toFixed(2)}%
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="container" style={{ paddingTop: '32px', paddingBottom: '80px' }}>
        <div className="trade-layout">
          {/* Left: Chart + Info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <PriceChart asset={selectedAsset} />

            {/* Asset Info */}
            <div className="card" style={{ padding: '24px' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: '16px', fontSize: '1rem' }}>
                About {selectedAsset.symbol}
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.8, marginBottom: '16px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>{selectedAsset.symbol}</strong> is a synthetic token
                that tracks the real-time price of <strong style={{ color: 'var(--text-primary)' }}>{selectedAsset.name}</strong>.
                Backed by over-collateralized SNX tokens and powered by Flare FTSO, it enables trustless exposure
                to {selectedAsset.category} markets without leaving the blockchain.
              </p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {['Flare FTSO', 'ERC-20', 'Flare', selectedAsset.category.toUpperCase()].map(tag => (
                  <span key={tag} className="badge badge-purple">{tag}</span>
                ))}
              </div>
            </div>

            {/* How It Works */}
            <div className="card" style={{ padding: '24px' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: '16px', fontSize: '1rem' }}>
                How Minting Works
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[
                  { n: '1', title: 'Choose Your Asset', desc: 'Select any synthetic from our global asset catalog' },
                  { n: '2', title: 'Pay with Crypto', desc: 'Use USDC, USDT, ETH or WBTC as your collateral' },
                  { n: '3', title: 'Receive Synthetic', desc: 'Instantly receive the synthetic token in your wallet' },
                  { n: '4', title: 'Track & Redeem', desc: 'Monitor P&L and redeem anytime for underlying value' },
                ].map(step => (
                  <div key={step.n} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                    <div style={{
                      minWidth: 28, height: 28, borderRadius: '50%',
                      background: 'rgba(124,58,237,0.15)',
                      border: '1px solid var(--border-accent)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-secondary)',
                    }}>{step.n}</div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '2px' }}>{step.title}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{step.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Swap Box */}
          <div style={{ position: 'sticky', top: '90px' }}>
            <SwapBox defaultReceive={selectedAsset} />
          </div>
        </div>
      </div>
    </>
  )
}
