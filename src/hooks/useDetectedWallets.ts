import { useState, useEffect } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DetectedWallet {
  id: string          // unique id (uuid from EIP-6963 or 'legacy-xxx')
  name: string
  icon: string        // data URI (EIP-6963) or emoji (legacy)
  rdns?: string       // reverse-DNS identifier (EIP-6963)
  provider: any       // EIP-1193 provider object
  source: 'eip6963' | 'legacy'
}

// ─── Known legacy wallet fingerprints ────────────────────────────────────────

interface LegacyCheck {
  id: string
  name: string
  icon: string
  installUrl: string
  check: (eth: any, win: any) => boolean
}

const LEGACY_CHECKS: LegacyCheck[] = [
  {
    id: 'metamask',
    name: 'MetaMask',
    icon: '🦊',
    installUrl: 'https://metamask.io/download/',
    check: (eth) => !!(eth?.isMetaMask && !eth?.isBraveWallet && !eth?.isCoinbaseWallet && !eth?.isRabby),
  },
  {
    id: 'coinbase',
    name: 'Coinbase Wallet',
    icon: '🔵',
    installUrl: 'https://www.coinbase.com/wallet',
    check: (eth) => !!(eth?.isCoinbaseWallet || eth?.isCoinbaseBrowser),
  },
  {
    id: 'brave',
    name: 'Brave Wallet',
    icon: '🦁',
    installUrl: 'https://brave.com',
    check: (eth) => !!(eth?.isBraveWallet),
  },
  {
    id: 'rabby',
    name: 'Rabby Wallet',
    icon: '🐰',
    installUrl: 'https://rabby.io',
    check: (eth) => !!(eth?.isRabby),
  },
  {
    id: 'trust',
    name: 'Trust Wallet',
    icon: '🛡️',
    installUrl: 'https://trustwallet.com',
    check: (eth) => !!(eth?.isTrust || eth?.isTrustWallet),
  },
  {
    id: 'okx',
    name: 'OKX Wallet',
    icon: '⭕',
    installUrl: 'https://www.okx.com/web3',
    check: (eth, win) => !!(eth?.isOkxWallet || win?.okxwallet),
  },
  {
    id: 'phantom',
    name: 'Phantom',
    icon: '👻',
    installUrl: 'https://phantom.app',
    check: (eth, win) => !!(eth?.isPhantom || win?.phantom?.ethereum),
  },
  {
    id: 'frame',
    name: 'Frame',
    icon: '🖼️',
    installUrl: 'https://frame.sh',
    check: (eth) => !!(eth?.isFrame),
  },
  {
    id: 'taho',
    name: 'Taho',
    icon: '🟡',
    installUrl: 'https://taho.xyz',
    check: (eth) => !!(eth?.isTaho),
  },
]

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDetectedWallets() {
  const [detected, setDetected] = useState<DetectedWallet[]>([])
  const [scanning, setScanning] = useState(true)

  useEffect(() => {
    const wallets: Map<string, DetectedWallet> = new Map()

    const flush = () => setDetected(Array.from(wallets.values()))

    // ── EIP-6963: Modern standard ──────────────────────────────────────────
    const handleAnnounce = (event: Event) => {
      const e = event as CustomEvent
      const { info, provider } = e.detail ?? {}
      if (!info?.uuid || !provider) return
      if (wallets.has(info.uuid)) return   // deduplicate

      wallets.set(info.uuid, {
        id: info.uuid,
        name: info.name,
        icon: info.icon,     // data: URI or SVG from the wallet
        rdns: info.rdns,
        provider,
        source: 'eip6963',
      })
      flush()
    }

    window.addEventListener('eip6963:announceProvider', handleAnnounce)
    // Fire the request — EIP-6963 wallets will respond asynchronously
    window.dispatchEvent(new Event('eip6963:requestProvider'))

    // ── Legacy: window.ethereum & providers array ──────────────────────────
    const win = window as any
    const eth = win.ethereum

    if (eth) {
      // Some wallet managers (e.g. MetaMask Flask) expose multiple providers
      const providers: any[] = Array.isArray(eth.providers) ? eth.providers : [eth]

      for (const p of providers) {
        for (const { id, name, icon, check } of LEGACY_CHECKS) {
          if (check(p, win)) {
            const key = `legacy-${id}`
            if (!wallets.has(key)) {
              wallets.set(key, { id: key, name, icon, provider: p, source: 'legacy' })
              flush()
            }
            break   // a provider matches at most one legacy type
          }
        }
      }

      // If nothing matched but window.ethereum exists → generic fallback
      if (wallets.size === 0) {
        wallets.set('legacy-injected', {
          id: 'legacy-injected',
          name: 'Browser Wallet',
          icon: '🌐',
          provider: eth,
          source: 'legacy',
        })
        flush()
      }
    }

    // Give EIP-6963 wallets 400 ms to respond before we call scanning done
    const timer = setTimeout(() => setScanning(false), 400)

    return () => {
      window.removeEventListener('eip6963:announceProvider', handleAnnounce)
      clearTimeout(timer)
    }
  }, [])

  return { detected, scanning }
}
