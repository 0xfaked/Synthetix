import { useState } from 'react'
import { ArrowDown, Settings, ChevronDown, Info } from 'lucide-react'
import type { Asset } from '../data/assets'
import { CRYPTO_TOKENS } from '../data/assets'
import AssetModal from './AssetModal'

type TokenType = Asset | typeof CRYPTO_TOKENS[number]

function formatPrice(price: number): string {
  if (price >= 1000) return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  if (price >= 1) return `$${price.toFixed(4)}`
  return `$${price.toFixed(6)}`
}

function isAsset(token: TokenType): token is Asset {
  return 'changePercent24h' in token
}

interface SwapBoxProps {
  defaultReceive?: Asset
}

export default function SwapBox({ defaultReceive }: SwapBoxProps) {
  const [payToken, setPayToken] = useState<TokenType>(CRYPTO_TOKENS[0])
  const [receiveToken, setReceiveToken] = useState<TokenType>(defaultReceive ?? {
    id: 'sxau', symbol: 'sXAU', name: 'Synthetic Gold', category: 'metals',
    price: 2345.60, change24h: 12.40, changePercent24h: 0.53,
    volume24h: 42_100_000, marketCap: 920_000_000, icon: '🥇', color: '#FFD700',
    sparkline: [],
  } as Asset)
  const [payAmount, setPayAmount] = useState('')
  const [showPayModal, setShowPayModal] = useState(false)
  const [showReceiveModal, setShowReceiveModal] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [slippage, setSlippage] = useState('0.5')

  const receiveAmount = payAmount
    ? ((parseFloat(payAmount) * payToken.price) / receiveToken.price).toFixed(6)
    : ''

  const usdValue = payAmount
    ? `≈ $${(parseFloat(payAmount) * payToken.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : ''

  const exchangeRate = `1 ${payToken.symbol} = ${(payToken.price / receiveToken.price).toFixed(6)} ${receiveToken.symbol}`

  const handleSwapTokens = () => {
    const tempPay = payToken
    setPayToken(receiveToken)
    setReceiveToken(tempPay as Asset)
    if (payAmount) {
      setPayAmount(receiveAmount)
    }
  }

  const parsedSlippage = parseFloat(slippage) || 0.5
  const minReceivedVal = receiveAmount
    ? (parseFloat(receiveAmount) * (1 - parsedSlippage / 100)).toFixed(6)
    : '0.000000'

  const protocolFeeVal = payAmount
    ? (parseFloat(payAmount) * 0.003).toFixed(6)
    : '0.000000'

  return (
    <div className="swap-container">
      <div className="swap-box" style={{ padding: '16px' }}>
        {/* Header */}
        <div className="swap-header" style={{ marginBottom: '12px' }}>
          <span className="swap-title" style={{ fontSize: '1rem', fontWeight: 600 }}>Swap / Mint</span>
          <button 
            className="swap-settings-btn" 
            onClick={() => setShowSettings(!showSettings)} 
            id="swap-settings-btn"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: showSettings ? 'rgba(124,58,237,0.15)' : 'var(--bg-elevated)',
              color: showSettings ? 'var(--accent-secondary)' : 'var(--text-muted)',
              border: `1px solid ${showSettings ? 'var(--border-accent)' : 'var(--border-subtle)'}`,
            }}
          >
            <Settings size={15} />
          </button>
        </div>

        {/* Stacked Inputs Area with absolute overlapping circular button */}
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {/* You Pay Box */}
          <div className="swap-field" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '14px 18px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>You pay</span>
              <span className="swap-max-btn" onClick={() => setPayAmount('1000')} style={{ cursor: 'pointer' }}>MAX</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <input
                className="swap-amount-input"
                placeholder="0"
                value={payAmount}
                onChange={e => setPayAmount(e.target.value)}
                type="number"
                id="pay-amount-input"
                style={{ fontSize: '1.8rem', fontWeight: 600, flex: 1, border: 'none', background: 'none', outline: 'none', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}
              />
              <button
                className="token-selector"
                onClick={() => setShowPayModal(true)}
                id="pay-token-selector"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-pill)', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
              >
                <span style={{ fontSize: '1.1rem' }}>{payToken.icon}</span>
                <span style={{ fontWeight: 700, fontSize: '0.85rem', fontFamily: 'var(--font-display)' }}>{payToken.symbol}</span>
                <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
              </button>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {usdValue || '≈ $0.00'}
            </div>
          </div>

          {/* Centered Circular Swap Button */}
          <div style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 10,
          }}>
            <button
              onClick={handleSwapTokens}
              id="swap-direction-btn"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'var(--bg-elevated)',
                border: '4px solid var(--bg-card)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = 'var(--accent-secondary)'
                e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1.08)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = 'var(--text-secondary)'
                e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1)'
              }}
            >
              <ArrowDown size={16} />
            </button>
          </div>

          {/* You Receive Box */}
          <div className="swap-field" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '14px 18px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>You receive</span>
              {isAsset(receiveToken) && (
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  color: receiveToken.changePercent24h >= 0 ? 'var(--green)' : 'var(--red)',
                }}>
                  {receiveToken.changePercent24h >= 0 ? '▲' : '▼'} {Math.abs(receiveToken.changePercent24h).toFixed(2)}%
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <input
                className="swap-amount-input"
                placeholder="0"
                value={receiveAmount}
                readOnly
                style={{ fontSize: '1.8rem', fontWeight: 600, flex: 1, border: 'none', background: 'none', outline: 'none', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}
              />
              <button
                className="token-selector"
                onClick={() => setShowReceiveModal(true)}
                id="receive-token-selector"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-pill)', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
              >
                <span style={{ fontSize: '1.1rem' }}>{receiveToken.icon}</span>
                <span style={{ fontWeight: 700, fontSize: '0.85rem', fontFamily: 'var(--font-display)' }}>{receiveToken.symbol}</span>
                <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
              </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              <span>{receiveAmount ? `≈ $${(parseFloat(receiveAmount) * receiveToken.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '≈ $0.00'}</span>
              <span>{formatPrice(receiveToken.price)}</span>
            </div>
          </div>
        </div>

        {/* Embedded Slippage Presets Row */}
        {showSettings && (
          <div style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 14px',
            marginTop: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Slippage Tolerance</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--accent-secondary)', fontWeight: 700 }}>{slippage}%</span>
            </div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {['0.1', '0.5', '1.0'].map(s => (
                <button
                  key={s}
                  style={{
                    flex: 1,
                    padding: '6px',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    background: slippage === s ? 'var(--accent-primary)' : 'rgba(255,255,255,0.03)',
                    color: slippage === s ? 'var(--text-primary)' : 'var(--text-secondary)',
                    border: `1px solid ${slippage === s ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onClick={() => setSlippage(s)}
                >
                  {s}%
                </button>
              ))}
              <input
                type="number"
                placeholder="Custom"
                value={['0.1','0.5','1.0'].includes(slippage) ? '' : slippage}
                onChange={e => setSlippage(e.target.value)}
                style={{
                  width: '70px',
                  padding: '6px 8px',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  fontSize: '0.72rem',
                  outline: 'none',
                  textAlign: 'right'
                }}
              />
            </div>
          </div>
        )}

        {/* Swap Info Details Section */}
        <div style={{
          marginTop: '12px',
          padding: '8px 4px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          fontSize: '0.75rem',
          color: 'var(--text-secondary)',
        }}>
          {payAmount && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Rate</span>
              <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{exchangeRate}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)' }}>Price Impact</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>&lt; 0.05%</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)' }}>Fee (0.3%)</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 500, fontFamily: 'var(--font-mono)' }}>
              {payAmount ? `${parseFloat(protocolFeeVal).toFixed(4)} ${payToken.symbol}` : '—'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)' }}>Slippage Tolerance</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{slippage}%</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)' }}>Minimum Received</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 500, fontFamily: 'var(--font-mono)' }}>
              {receiveAmount ? `${parseFloat(minReceivedVal).toFixed(4)} ${receiveToken.symbol}` : '—'}
            </span>
          </div>
        </div>

        {/* Action Button */}
        <button
          className="btn btn-primary btn-full btn-lg"
          style={{ marginTop: '14px', borderRadius: 'var(--radius-lg)' }}
          id="mint-btn"
          onClick={() => alert('Connect wallet to mint synthetic assets')}
        >
          {payAmount && parseFloat(payAmount) > 0
            ? `Mint ${receiveAmount ? parseFloat(receiveAmount).toFixed(4) : '0'} ${receiveToken.symbol}`
            : 'Enter an Amount'}
        </button>

        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '10px', lineHeight: 1.4 }}>
          Synthetic assets are backed by crypto collateral and track real-world prices via Flare FTSO.
        </p>
      </div>

      {/* Modals */}
      {showPayModal && (
        <AssetModal
          mode="pay"
          onSelect={t => setPayToken(t)}
          onClose={() => setShowPayModal(false)}
        />
      )}
      {showReceiveModal && (
        <AssetModal
          mode="receive"
          onSelect={t => setReceiveToken(t)}
          onClose={() => setShowReceiveModal(false)}
        />
      )}
    </div>
  )
}
