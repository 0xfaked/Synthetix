import { NavLink } from 'react-router-dom'
import { useState } from 'react'
import { Zap, ChevronDown } from 'lucide-react'
import { useWallet } from '../context/WalletContext'
import WalletModal from './WalletModal'

const NAV_LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/trade', label: 'Trade' },
  { to: '/markets', label: 'Markets' },
  { to: '/portfolio', label: 'Portfolio' },
]

export default function Navbar() {
  const [walletOpen, setWalletOpen] = useState(false)
  const { isConnected, shortAddress, balance, chainName, chainId, chainSymbol } = useWallet()

  // Chain color indicator
  const chainColor = chainId === 114 ? '#E31937' : chainId === 1 ? '#627EEA' : chainId === 137 ? '#8247E5' : chainId === 10 ? '#FF0420' : chainId === 42161 ? '#28A0F0' : '#10b981'

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
            <div className="network-badge" style={{ cursor: 'default', background: 'transparent', border: 'none', padding: '4px 8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              <div className="live-dot" style={{ background: chainColor, width: 6, height: 6, boxShadow: 'none' }} />
              {isConnected && chainName ? chainName.replace('Flare Testnet Coston2', 'Coston2').replace(' Testnet', '') : 'Flare'}
            </div>

            {/* Connect / Account button */}
            {isConnected ? (
              <button
                className="btn-connect"
                onClick={() => setWalletOpen(true)}
                id="wallet-account-btn"
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  padding: '5px 10px',
                  borderRadius: 'var(--radius-pill)',
                  color: 'var(--text-secondary)',
                }}
              >
                {/* Avatar dot */}
                <div style={{
                  width: 16, height: 16, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  flexShrink: 0,
                }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 500 }}>
                  {shortAddress}
                </span>
                <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
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

          </div>
        </div>
      </nav>

      {/* Wallet Modal */}
      <WalletModal open={walletOpen} onClose={() => setWalletOpen(false)} />
    </>
  )
}
