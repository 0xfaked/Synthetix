import { useState } from 'react'
import { ArrowDownUp, Settings, ChevronDown, Info } from 'lucide-react'
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
    if (isAsset(receiveToken)) {
      setPayToken(receiveToken)
      setReceiveToken(payToken as Asset)
      setPayAmount(receiveAmount)
    }
  }

  const priceImpact = payAmount ? (Math.random() * 0.08 + 0.01).toFixed(3) : null

  return (
    <div className="swap-container">
      {/* Settings Panel */}
      {showSettings && (
        <div className="card" style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Transaction Settings</span>
            <button onClick={() => setShowSettings(false)} style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>✕ Close</button>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Slippage Tolerance</p>
          <div style={{ display: 'flex', gap: '8px' }}>
            {['0.1', '0.5', '1.0'].map(s => (
              <button
                key={s}
                className={`filter-tab${slippage === s ? ' active' : ''}`}
                style={{ padding: '6px 14px', fontSize: '0.78rem' }}
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
                width: 80, padding: '6px 10px', background: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)', fontSize: '0.78rem', outline: 'none'
              }}
            />
          </div>
        </div>
      )}

      <div className="swap-box">
        {/* Header */}
        <div className="swap-header">
          <span className="swap-title">Mint Synthetic Asset</span>
          <button className="swap-settings-btn" onClick={() => setShowSettings(!showSettings)} id="swap-settings-btn">
            <Settings size={16} />
          </button>
        </div>

        {/* Pay Field */}
        <div className="swap-field" id="pay-field">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span className="swap-field-label">You Pay</span>
            <span className="swap-max-btn" onClick={() => setPayAmount('1000')}>MAX</span>
          </div>
          <div className="swap-field-row">
            <input
              className="swap-amount-input"
              placeholder="0.0"
              value={payAmount}
              onChange={e => setPayAmount(e.target.value)}
              type="number"
              id="pay-amount-input"
            />
            <button
              className="token-selector"
              onClick={() => setShowPayModal(true)}
              id="pay-token-selector"
            >
              <span className="token-selector-icon">{payToken.icon}</span>
              <span className="token-selector-symbol">{payToken.symbol}</span>
              <ChevronDown size={14} className="token-selector-chevron" />
            </button>
          </div>
          {usdValue && <div className="swap-usd-value">{usdValue}</div>}
        </div>

        {/* Arrow */}
        <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0' }}>
          <button className="swap-arrow-btn" onClick={handleSwapTokens} id="swap-direction-btn">
            <ArrowDownUp size={16} />
          </button>
        </div>

        {/* Receive Field */}
        <div className="swap-field" id="receive-field">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span className="swap-field-label">You Receive</span>
            {isAsset(receiveToken) && (
              <span
                className={`badge ${receiveToken.changePercent24h >= 0 ? 'badge-green' : 'badge-red'}`}
                style={{ fontSize: '0.7rem' }}
              >
                {receiveToken.changePercent24h >= 0 ? '▲' : '▼'} {Math.abs(receiveToken.changePercent24h).toFixed(2)}% 24h
              </span>
            )}
          </div>
          <div className="swap-field-row">
            <input
              className="swap-amount-input"
              placeholder="0.0"
              value={receiveAmount}
              readOnly
              style={{ color: 'var(--text-secondary)' }}
            />
            <button
              className="token-selector"
              onClick={() => setShowReceiveModal(true)}
              id="receive-token-selector"
            >
              <span className="token-selector-icon">{receiveToken.icon}</span>
              <span className="token-selector-symbol">{receiveToken.symbol}</span>
              <ChevronDown size={14} className="token-selector-chevron" />
            </button>
          </div>
          <div className="swap-usd-value" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{formatPrice(receiveToken.price)}</span>
            {receiveAmount && <span>≈ ${(parseFloat(receiveAmount) * receiveToken.price).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>}
          </div>
        </div>

        {/* Trade Details */}
        {payAmount && parseFloat(payAmount) > 0 && (
          <div className="swap-details">
            <div className="swap-detail-row">
              <span className="swap-detail-label">Exchange Rate</span>
              <span className="swap-detail-value" style={{ fontSize: '0.75rem' }}>{exchangeRate}</span>
            </div>
            <div className="swap-detail-row">
              <span className="swap-detail-label">Price Impact</span>
              <span className="swap-detail-value" style={{ color: parseFloat(priceImpact || '0') > 1 ? 'var(--yellow)' : 'var(--green)' }}>
                {priceImpact}%
              </span>
            </div>
            <div className="swap-detail-row">
              <span className="swap-detail-label">Slippage Tolerance</span>
              <span className="swap-detail-value">{slippage}%</span>
            </div>
            <div className="swap-detail-row">
              <span className="swap-detail-label">Network Fee</span>
              <span className="swap-detail-value">~$2.40</span>
            </div>
            <div className="swap-detail-row">
              <span className="swap-detail-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                Collateral Ratio <Info size={11} />
              </span>
              <span className="swap-detail-value" style={{ color: 'var(--green)' }}>750%</span>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button
          className="btn btn-primary btn-full btn-lg"
          style={{ marginTop: '16px', borderRadius: 'var(--radius-lg)' }}
          id="mint-btn"
          onClick={() => alert('Connect wallet to mint synthetic assets')}
        >
          {payAmount && parseFloat(payAmount) > 0
            ? `Mint ${receiveAmount ? parseFloat(receiveAmount).toFixed(4) : '0'} ${receiveToken.symbol}`
            : 'Enter an Amount'}
        </button>

        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '12px', lineHeight: 1.5 }}>
          Synthetic assets are backed by crypto collateral and track real-world prices via Chainlink oracles.
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
