import { NavLink } from 'react-router-dom'
import { useState } from 'react'
import { Zap, Menu, X, ChevronDown } from 'lucide-react'
import { useWallet } from '../context/WalletContext'
import WalletModal from './WalletModal'

const NAV_LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/trade', label: 'Trade' },
  { to: '/markets', label: 'Markets' },
  { to: '/portfolio', label: 'Portfolio' },
  { to: '/stake', label: 'Stake' },
]

export default function Navbar() {
  const [walletOpen, setWalletOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { isConnected, shortAddress, balance, chainName, chainId } = useWallet()

  // Chain color indicator
  const chainColor = chainId === 1 ? '#627EEA' : chainId === 137 ? '#8247E5' : chainId === 10 ? '#FF0420' : chainId === 42161 ? '#28A0F0' : '#10b981'

  return (
    <>
      <nav className="navbar">
        <div className="navbar-inner">
          {/* Logo */}
          <NavLink to="/" className="navbar-logo">
            <div className="logo-icon">
              <Zap size={18} color="white" fill="white" />
            </div>
            <span className="logo-text">
              <span>Synth</span>X
            </span>
          </NavLink>

          {/* Desktop Nav */}
          <ul className="navbar-nav">
            {NAV_LINKS.map(link => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  end={link.end}
                  className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                >
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>

          {/* Actions */}
          <div className="navbar-actions">
            {/* Network badge */}
            <div className="network-badge" style={{ cursor: 'default' }}>
              <div className="live-dot" style={{ background: chainColor, boxShadow: `0 0 6px ${chainColor}` }} />
              {isConnected && chainName ? chainName : 'Ethereum'}
            </div>

            {/* Connect / Account button */}
            {isConnected ? (
              <button
                className="btn-connect"
                onClick={() => setWalletOpen(true)}
                id="wallet-account-btn"
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  background: 'rgba(99,102,241,0.12)',
                  border: '1px solid rgba(99,102,241,0.35)',
                  padding: '7px 14px',
                }}
              >
                {/* Avatar dot */}
                <div style={{
                  width: 20, height: 20, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  flexShrink: 0,
                }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>
                  {shortAddress}
                </span>
                {balance && (
                  <span style={{
                    fontSize: '0.72rem', color: 'var(--text-muted)',
                    borderLeft: '1px solid rgba(255,255,255,0.1)',
                    paddingLeft: '8px',
                  }}>
                    {balance} ETH
                  </span>
                )}
                <ChevronDown size={12} style={{ color: 'var(--text-muted)' }} />
              </button>
            ) : (
              <button
                className="btn-connect"
                onClick={() => setWalletOpen(true)}
                id="connect-wallet-btn"
              >
                Connect Wallet
              </button>
            )}

            {/* Mobile hamburger */}
            <button
              className="btn-ghost btn"
              style={{ padding: '8px', width: 36, height: 36 }}
              onClick={() => setMobileOpen(!mobileOpen)}
              id="mobile-menu-btn"
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {/* Mobile nav drawer */}
        {mobileOpen && (
          <div style={{
            position: 'fixed', top: 72, left: 0, right: 0, bottom: 0,
            background: 'rgba(8,10,15,0.98)', zIndex: 99,
            display: 'flex', flexDirection: 'column', padding: '24px',
            gap: '8px', borderTop: '1px solid var(--border-subtle)'
          }}>
            {NAV_LINKS.map(link => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                style={{ fontSize: '1.1rem', padding: '14px 16px' }}
              >
                {link.label}
              </NavLink>
            ))}
            <div style={{ marginTop: '16px' }}>
              <button
                className="btn btn-primary btn-full"
                onClick={() => { setMobileOpen(false); setWalletOpen(true) }}
              >
                {isConnected ? shortAddress : 'Connect Wallet'}
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* Wallet Modal */}
      <WalletModal open={walletOpen} onClose={() => setWalletOpen(false)} />
    </>
  )
}
