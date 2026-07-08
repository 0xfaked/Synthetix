import { useEffect, useRef } from 'react'
import {
  X, AlertCircle, Loader2, Copy, ExternalLink, LogOut,
  CheckCircle2, ScanLine, RefreshCw,
} from 'lucide-react'
import { useWallet } from '../context/WalletContext'
import { useDetectedWallets } from '../hooks/useDetectedWallets'

// ─── Popular / fallback wallets (shown if not auto-detected) ─────────────────

const POPULAR_WALLETS = [
  {
    id: 'metamask' as const,
    name: 'MetaMask',
    icon: '🦊',
    description: 'Browser extension wallet',
    installUrl: 'https://metamask.io/download/',
  },
  {
    id: 'coinbase' as const,
    name: 'Coinbase Wallet',
    icon: '🔵',
    description: 'Coinbase mobile or extension',
    installUrl: 'https://www.coinbase.com/wallet',
  },
  {
    id: 'injected' as const,
    name: 'Browser Wallet',
    icon: '🌐',
    description: 'Any injected EIP-1193 wallet',
    installUrl: 'https://metamask.io/download/',
  },
]

// ─── Helper: render a wallet icon (data URI or emoji) ────────────────────────

function WalletIcon({ icon, size = 42 }: { icon: string; size?: number }) {
  const isImg = icon.startsWith('data:') || icon.startsWith('http') || icon.startsWith('/')
  return (
    <div style={{
      width: size, height: size, borderRadius: '10px',
      background: 'rgba(255,255,255,0.06)',
      border: '1px solid var(--border-subtle)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden', flexShrink: 0,
    }}>
      {isImg
        ? <img src={icon} alt="" style={{ width: size - 14, height: size - 14, objectFit: 'contain' }} />
        : <span style={{ fontSize: size * 0.55 }}>{icon}</span>
      }
    </div>
  )
}

// ─── Single wallet row ────────────────────────────────────────────────────────

function WalletRow({
  icon, name, description, badge, onClick, loading, disabled,
}: {
  icon: string
  name: string
  description?: string
  badge?: string
  onClick: () => void
  loading?: boolean
  disabled?: boolean
}) {
  return (
    <button
      disabled={disabled || loading}
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '14px',
        padding: '13px 15px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '12px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        textAlign: 'left', transition: 'all 0.15s',
        width: '100%',
      }}
      onMouseEnter={e => {
        if (!disabled && !loading) {
          (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'
          ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(99,102,241,0.45)'
        }
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'
        ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)'
      }}
    >
      {loading
        ? <div style={{
            width: 42, height: 42, borderRadius: '10px',
            background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-subtle)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Loader2 size={18} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent-primary)' }} />
          </div>
        : <WalletIcon icon={icon} />
      }

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: 700, fontSize: '0.87rem' }}>{name}</span>
          {badge && (
            <span style={{
              fontSize: '0.58rem', fontWeight: 700, padding: '2px 7px', borderRadius: '20px',
              background: badge === 'Installed' ? 'rgba(16,185,129,0.15)' :
                          badge === 'Popular'   ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.08)',
              color:      badge === 'Installed' ? '#10b981' :
                          badge === 'Popular'   ? '#818cf8' : 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              {badge}
            </span>
          )}
        </div>
        {description && (
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>{description}</div>
        )}
      </div>

      <span style={{ color: 'var(--text-muted)', fontSize: '1rem', flexShrink: 0 }}>›</span>
    </button>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function WalletModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const {
    isConnected, isConnecting, address, shortAddress, balance,
    chainId, chainName, connectedWalletName, error,
    connect, connectProvider, disconnect, clearError,
  } = useWallet()

  const { detected, scanning } = useDetectedWallets()
  const overlayRef = useRef<HTMLDivElement>(null)

  // Close on ESC
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Freeze body scroll
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  // IDs of wallets we already detected via EIP-6963/legacy
  const detectedRdns = new Set(detected.map(w => w.rdns ?? w.id))

  // Popular wallets not already shown in detected list
  const notDetectedPopular = POPULAR_WALLETS.filter(w => {
    if (!window.ethereum) return true  // show all if no wallet installed at all
    // If detected list has wallets, only show popular ones not already found
    return detected.length === 0
  })

  const handleDisconnect = () => { disconnect(); onClose() }

  const handleDetectedConnect = async (w: ReturnType<typeof useDetectedWallets>['detected'][number]) => {
    clearError()
    await connectProvider(w.provider, w.name)
  }

  const handlePopularConnect = async (id: typeof POPULAR_WALLETS[number]['id']) => {
    clearError()
    await connect(id)
  }

  // Copy address to clipboard
  const copyAddress = () => {
    if (address) navigator.clipboard.writeText(address).catch(() => {})
  }

  return (
    <div
      ref={overlayRef}
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px', animation: 'fadeIn 0.18s ease',
      }}
    >
      <div style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-default)',
        borderRadius: '20px', width: '100%', maxWidth: '460px',
        boxShadow: '0 28px 80px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.04) inset',
        animation: 'slideUp 0.22s cubic-bezier(0.16,1,0.3,1)',
        overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column',
      }}>

        {/* ── Header ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 22px 16px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'rgba(255,255,255,0.015)',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>
              {isConnected ? 'Wallet Connected' : 'Connect Wallet'}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              {isConnected
                ? `${connectedWalletName ?? 'Wallet'} · ${chainName ?? 'Unknown network'}`
                : scanning
                  ? 'Scanning for installed wallets…'
                  : detected.length > 0
                    ? `${detected.length} wallet${detected.length > 1 ? 's' : ''} detected`
                    : 'Choose your preferred wallet'}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: '50%',
              border: '1px solid var(--border-subtle)', background: 'rgba(255,255,255,0.04)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--text-muted)',
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div style={{ padding: '18px 22px 22px', overflowY: 'auto', flex: 1 }}>

          {/* ══════════ CONNECTED STATE ══════════ */}
          {isConnected && address ? (
            <div>
              {/* Address card */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(139,92,246,0.06))',
                border: '1px solid rgba(99,102,241,0.25)',
                borderRadius: '14px', padding: '18px', marginBottom: '14px',
                position: 'relative', overflow: 'hidden',
              }}>
                <div style={{
                  position: 'absolute', right: -30, top: -30, width: 120, height: 120,
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(99,102,241,0.15), transparent 70%)',
                  pointerEvents: 'none',
                }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '12px' }}>
                  <CheckCircle2 size={14} color="#10b981" />
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Connected · {connectedWalletName ?? 'Wallet'}
                  </span>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', fontWeight: 600, marginBottom: '14px', wordBreak: 'break-all', lineHeight: 1.5 }}>
                  {address}
                </div>
                <div style={{ display: 'flex', gap: '20px' }}>
                  <div>
                    <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '3px' }}>Balance</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.92rem', fontWeight: 700 }}>{balance} {chainId === 114 ? 'FLR' : 'ETH'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '3px' }}>Network</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981' }} />
                      <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{chainName}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                {[
                  { label: 'Copy Address', icon: <Copy size={13} />, onClick: copyAddress },
                  { label: chainId === 114 ? 'Coston2 Explorer' : 'Etherscan', icon: <ExternalLink size={13} />, onClick: () => window.open(chainId === 114 ? `https://coston2-explorer.flare.network/address/${address}` : `https://etherscan.io/address/${address}`, '_blank') },
                ].map(btn => (
                  <button
                    key={btn.label}
                    onClick={btn.onClick}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                      padding: '10px', background: 'rgba(255,255,255,0.04)',
                      border: '1px solid var(--border-subtle)', borderRadius: '10px',
                      color: 'var(--text-secondary)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)' }}
                  >
                    {btn.icon} {btn.label}
                  </button>
                ))}
              </div>

              <button
                onClick={handleDisconnect}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  padding: '11px', background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.25)', borderRadius: '10px',
                  color: '#ef4444', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.14)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.08)' }}
              >
                <LogOut size={14} /> Disconnect Wallet
              </button>
            </div>

          ) : (
            /* ══════════ CONNECT STATE ══════════ */
            <div>

              {/* Error banner */}
              {error && (
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: '10px',
                  background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.22)',
                  borderRadius: '10px', padding: '11px 13px', marginBottom: '14px',
                }}>
                  <AlertCircle size={14} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: '0.77rem', color: '#ef4444', lineHeight: 1.5 }}>{error}</span>
                </div>
              )}

              {/* ── Detected wallets section ── */}
              {(scanning || detected.length > 0) && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '7px',
                    marginBottom: '10px',
                  }}>
                    {scanning
                      ? <RefreshCw size={12} style={{ animation: 'spin 1.2s linear infinite', color: 'var(--accent-primary)' }} />
                      : <ScanLine size={12} color="#10b981" />
                    }
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: scanning ? 'var(--text-muted)' : '#10b981', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      {scanning ? 'Scanning your browser…' : `Detected (${detected.length})`}
                    </span>
                  </div>

                  {/* Scanning skeleton */}
                  {scanning && detected.length === 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {[1, 2].map(i => (
                        <div key={i} style={{
                          height: 64, borderRadius: '12px',
                          background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 75%)',
                          backgroundSize: '200% 100%',
                          animation: 'shimmer 1.4s ease-in-out infinite',
                        }} />
                      ))}
                    </div>
                  )}

                  {/* Detected wallet list */}
                  {detected.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                      {detected.map(w => (
                        <WalletRow
                          key={w.id}
                          icon={w.icon}
                          name={w.name}
                          description={w.rdns ?? (w.source === 'legacy' ? 'Legacy injected wallet' : undefined)}
                          badge="Installed"
                          onClick={() => handleDetectedConnect(w)}
                          loading={isConnecting}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── Divider ── */}
              {detected.length > 0 && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px',
                }}>
                  <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Other options
                  </span>
                  <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
                </div>
              )}

              {/* ── Popular wallets (shown when none detected OR always as "other options") ── */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                {POPULAR_WALLETS.map(w => (
                  <WalletRow
                    key={w.id}
                    icon={w.icon}
                    name={w.name}
                    description={w.description}
                    badge={detected.length === 0 ? 'Popular' : undefined}
                    onClick={() => handlePopularConnect(w.id)}
                    loading={isConnecting}
                    disabled={isConnecting}
                  />
                ))}
                {/* WalletConnect (coming soon) */}
                <WalletRow
                  icon="📱"
                  name="WalletConnect"
                  description="Scan with your mobile wallet"
                  badge="Soon"
                  onClick={() => {}}
                  disabled
                />
              </div>

              {/* Security note */}
              <div style={{
                marginTop: '16px', padding: '11px 13px',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '10px', fontSize: '0.68rem',
                color: 'var(--text-muted)', lineHeight: 1.6,
                display: 'flex', gap: '8px', alignItems: 'flex-start',
              }}>
                <span>🔒</span>
                <span>By connecting you agree to our Terms of Service. We never store your private keys or seed phrases.</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
