import { AlertCircle } from 'lucide-react'

export default function StatsBanner() {
  return (
    <div className="stats-banner" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'var(--bg-card)', padding: '24px 32px', textAlign: 'center', position: 'relative' }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
        background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))'
      }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
        <AlertCircle size={22} style={{ color: 'var(--yellow)' }} />
        <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', fontFamily: 'var(--font-display)' }}>
          Coston2 Testnet Demo
        </span>
      </div>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', maxWidth: '600px', lineHeight: 1.6 }}>
        SynthX is running in testnet demonstration mode on the <strong>Flare Coston2 Testnet</strong>. All volume, prices, and assets are simulated or powered by Coston2 testnet smart contracts.
      </p>
    </div>
  )
}
