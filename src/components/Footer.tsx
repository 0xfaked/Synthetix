import { NavLink } from 'react-router-dom'
import { Zap, Share2, Code2, MessageSquare, ExternalLink } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-grid">
          <div className="footer-brand">
            <NavLink to="/" className="navbar-logo" style={{ display: 'inline-flex' }}>
              <div className="logo-icon">
                <Zap size={16} color="white" fill="white" />
              </div>
              <span className="logo-text">
                <span>Synth</span>X
              </span>
            </NavLink>
            <p>
              The premier protocol for trading synthetic versions of real-world assets on-chain.
              Powered by decentralized oracles and overcollateralized smart contracts.
            </p>
            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              {[
              { icon: <Share2 size={16} />, label: 'Twitter' },
              { icon: <Code2 size={16} />, label: 'Github' },
              { icon: <MessageSquare size={16} />, label: 'Discord' },
              ].map(s => (
                <button
                  key={s.label}
                  className="btn-ghost btn"
                  style={{ width: 36, height: 36, padding: 0 }}
                  title={s.label}
                >
                  {s.icon}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="footer-col-title">Protocol</p>
            <ul className="footer-links">
              <li><a href="#">Trade</a></li>
              <li><a href="#">Markets</a></li>
              <li><a href="#">Stake SNX</a></li>
              <li><a href="#">Governance</a></li>
            </ul>
          </div>

          <div>
            <p className="footer-col-title">Resources</p>
            <ul className="footer-links">
              <li><a href="#" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Docs <ExternalLink size={11} /></a></li>
              <li><a href="#">Blog</a></li>
              <li><a href="#">Audit Reports</a></li>
              <li><a href="#">Bug Bounty</a></li>
            </ul>
          </div>

          <div>
            <p className="footer-col-title">Legal</p>
            <ul className="footer-links">
              <li><a href="#">Terms of Service</a></li>
              <li><a href="#">Privacy Policy</a></li>
              <li><a href="#">Risk Disclosure</a></li>
              <li><a href="#">Cookie Policy</a></li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© 2025 SynthX Protocol. All rights reserved.</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div className="live-dot" />
            All systems operational
          </span>
        </div>
      </div>
    </footer>
  )
}
