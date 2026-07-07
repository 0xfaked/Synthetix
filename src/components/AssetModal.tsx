import { useState } from 'react'
import { X, Search } from 'lucide-react'
import type { Asset, AssetCategory } from '../data/assets'
import { ASSETS, CRYPTO_TOKENS, CATEGORIES } from '../data/assets'

type ModalMode = 'pay' | 'receive'

interface AssetModalProps {
  mode: ModalMode
  onSelect: (asset: Asset | typeof CRYPTO_TOKENS[number]) => void
  onClose: () => void
}

function formatPrice(price: number): string {
  if (price >= 1000) return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  if (price >= 1) return `$${price.toFixed(4)}`
  return `$${price.toFixed(6)}`
}

export default function AssetModal({ mode, onSelect, onClose }: AssetModalProps) {
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<AssetCategory | 'all'>('all')

  const filteredAssets = ASSETS.filter(a => {
    const matchQuery = a.symbol.toLowerCase().includes(query.toLowerCase()) ||
      a.name.toLowerCase().includes(query.toLowerCase())
    const matchCat = activeCategory === 'all' || a.category === activeCategory
    return matchQuery && matchCat
  })

  const groupedByCategory = CATEGORIES.slice(1).reduce((acc, cat) => {
    const items = filteredAssets.filter(a => a.category === cat.id)
    if (items.length) acc[cat.id as AssetCategory] = items
    return acc
  }, {} as Record<AssetCategory, Asset[]>)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">
            {mode === 'pay' ? 'Select Pay Token' : 'Select Synthetic Asset'}
          </span>
          <button className="modal-close" onClick={onClose}><X size={14} /></button>
        </div>

        <div className="modal-search" style={{ position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: 34, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="modal-search-input"
            placeholder="Search assets..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
            style={{ paddingLeft: '40px' }}
          />
        </div>

        {mode === 'receive' && (
          <div style={{ padding: '8px 12px', display: 'flex', gap: '6px', flexWrap: 'wrap', borderBottom: '1px solid var(--border-subtle)' }}>
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                className={`filter-tab${activeCategory === cat.id ? ' active' : ''}`}
                style={{ padding: '4px 12px', fontSize: '0.75rem' }}
                onClick={() => setActiveCategory(cat.id as AssetCategory | 'all')}
              >
                {cat.icon} {cat.label}
              </button>
            ))}
          </div>
        )}

        <div className="modal-list">
          {mode === 'pay' ? (
            <>
              <div className="modal-list-section">Crypto Tokens</div>
              {CRYPTO_TOKENS.map(token => (
                <div key={token.symbol} className="modal-item" onClick={() => { onSelect(token); onClose() }}>
                  <span className="modal-item-icon">{token.icon}</span>
                  <div>
                    <div className="modal-item-symbol">{token.symbol}</div>
                    <div className="modal-item-name">{token.name}</div>
                  </div>
                  <span className="modal-item-price">{formatPrice(token.price)}</span>
                </div>
              ))}
            </>
          ) : (
            activeCategory === 'all' ? (
              Object.entries(groupedByCategory).map(([cat, items]) => {
                const catInfo = CATEGORIES.find(c => c.id === cat)
                return (
                  <div key={cat}>
                    <div className="modal-list-section">{catInfo?.icon} {catInfo?.label}</div>
                    {items.map(asset => (
                      <div key={asset.id} className="modal-item" onClick={() => { onSelect(asset); onClose() }}>
                        <span className="modal-item-icon">{asset.icon}</span>
                        <div>
                          <div className="modal-item-symbol">{asset.symbol}</div>
                          <div className="modal-item-name">{asset.name}</div>
                        </div>
                        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                          <div className="modal-item-price">{formatPrice(asset.price)}</div>
                          <div style={{ fontSize: '0.7rem', color: asset.changePercent24h >= 0 ? 'var(--green)' : 'var(--red)' }}>
                            {asset.changePercent24h >= 0 ? '+' : ''}{asset.changePercent24h.toFixed(2)}%
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })
            ) : (
              filteredAssets.map(asset => (
                <div key={asset.id} className="modal-item" onClick={() => { onSelect(asset); onClose() }}>
                  <span className="modal-item-icon">{asset.icon}</span>
                  <div>
                    <div className="modal-item-symbol">{asset.symbol}</div>
                    <div className="modal-item-name">{asset.name}</div>
                  </div>
                  <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                    <div className="modal-item-price">{formatPrice(asset.price)}</div>
                    <div style={{ fontSize: '0.7rem', color: asset.changePercent24h >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      {asset.changePercent24h >= 0 ? '+' : ''}{asset.changePercent24h.toFixed(2)}%
                    </div>
                  </div>
                </div>
              ))
            )
          )}

          {mode === 'receive' && filteredAssets.length === 0 && (
            <div className="no-results">
              <div className="no-results-icon">🔍</div>
              No assets found for "{query}"
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
