import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WalletState {
  address: string | null
  shortAddress: string | null
  balance: string | null
  chainId: number | null
  chainName: string | null
  connectedWalletName: string | null   // name of the connected wallet (e.g. "MetaMask")
  isConnecting: boolean
  isConnected: boolean
  error: string | null
}

interface WalletContextValue extends WalletState {
  /** Connect using a detected EIP-6963 / legacy provider directly */
  connectProvider: (provider: any, walletName: string) => Promise<void>
  /** Connect by wallet type name (legacy fallback) */
  connect: (walletType: WalletType) => Promise<void>
  disconnect: () => void
  clearError: () => void
}

export type WalletType = 'metamask' | 'coinbase' | 'walletconnect' | 'injected'

// ─── Chain name map ───────────────────────────────────────────────────────────

const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum',
  5: 'Goerli',
  10: 'Optimism',
  56: 'BNB Chain',
  137: 'Polygon',
  42161: 'Arbitrum',
  43114: 'Avalanche',
  8453: 'Base',
  11155111: 'Sepolia',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

async function getEthBalance(address: string, provider: any): Promise<string> {
  try {
    const hex: string = await provider.request({
      method: 'eth_getBalance',
      params: [address, 'latest'],
    })
    const eth = Number(BigInt(hex)) / 1e18
    return eth.toFixed(4)
  } catch {
    return '0.0000'
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

const WalletContext = createContext<WalletContextValue | null>(null)

const EMPTY_STATE: WalletState = {
  address: null, shortAddress: null, balance: null,
  chainId: null, chainName: null, connectedWalletName: null,
  isConnecting: false, isConnected: false, error: null,
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WalletState>(EMPTY_STATE)

  // Active provider reference (for event listeners after connection)
  const [activeProvider, setActiveProvider] = useState<any>(null)

  // ── Event listeners on active provider ───────────────────────────────────
  useEffect(() => {
    const eth = activeProvider ?? (window as any).ethereum
    if (!eth) return

    const onAccountsChanged = async (accounts: string[]) => {
      if (accounts.length === 0) {
        setState(EMPTY_STATE)
        setActiveProvider(null)
      } else {
        const address = accounts[0]
        const balance = await getEthBalance(address, eth)
        setState(prev => ({ ...prev, address, shortAddress: shortAddr(address), balance, isConnected: true }))
      }
    }

    const onChainChanged = (hex: string) => {
      const chainId = parseInt(hex, 16)
      setState(prev => ({ ...prev, chainId, chainName: CHAIN_NAMES[chainId] ?? `Chain ${chainId}` }))
    }

    eth.on?.('accountsChanged', onAccountsChanged)
    eth.on?.('chainChanged', onChainChanged)

    return () => {
      eth.removeListener?.('accountsChanged', onAccountsChanged)
      eth.removeListener?.('chainChanged', onChainChanged)
    }
  }, [activeProvider])

  // ── Auto-reconnect on page load ───────────────────────────────────────────
  useEffect(() => {
    const eth = (window as any).ethereum
    if (!eth) return
    eth.request?.({ method: 'eth_accounts' })
      .then(async (accounts: string[]) => {
        if (accounts.length > 0) {
          const address = accounts[0]
          const chainIdHex: string = await eth.request({ method: 'eth_chainId' })
          const chainId = parseInt(chainIdHex, 16)
          const balance = await getEthBalance(address, eth)
          setState({
            ...EMPTY_STATE,
            address, shortAddress: shortAddr(address), balance,
            chainId, chainName: CHAIN_NAMES[chainId] ?? `Chain ${chainId}`,
            connectedWalletName: null, isConnected: true,
          })
          setActiveProvider(eth)
        }
      })
      .catch(() => {})
  }, [])

  // ── Core connect logic (takes any EIP-1193 provider) ──────────────────────
  const connectProvider = useCallback(async (provider: any, walletName: string) => {
    setState(prev => ({ ...prev, isConnecting: true, error: null }))
    try {
      const accounts: string[] = await provider.request({ method: 'eth_requestAccounts' })
      if (!accounts?.length) throw new Error('No accounts returned')

      const address = accounts[0]
      const chainIdHex: string = await provider.request({ method: 'eth_chainId' })
      const chainId = parseInt(chainIdHex, 16)
      const balance = await getEthBalance(address, provider)

      setActiveProvider(provider)
      setState({
        address, shortAddress: shortAddr(address), balance,
        chainId, chainName: CHAIN_NAMES[chainId] ?? `Chain ${chainId}`,
        connectedWalletName: walletName,
        isConnecting: false, isConnected: true, error: null,
      })
    } catch (err: any) {
      const msg =
        err?.code === 4001 ? 'Connection rejected.' :
        err?.message ?? 'Connection failed.'
      setState(prev => ({ ...prev, isConnecting: false, error: msg }))
    }
  }, [])

  // ── Legacy connect by wallet type ─────────────────────────────────────────
  const connect = useCallback(async (walletType: WalletType) => {
    if (walletType === 'walletconnect') {
      setState(prev => ({
        ...prev,
        error: 'WalletConnect coming soon. Use a browser wallet for now.',
      }))
      return
    }

    const win = window as any
    let provider: any = win.ethereum

    // For specific wallet types try to pick the right provider from the array
    if (walletType === 'metamask' && win.ethereum?.providers) {
      provider = win.ethereum.providers.find((p: any) => p.isMetaMask && !p.isBraveWallet) ?? win.ethereum
    }
    if (walletType === 'coinbase' && win.ethereum?.providers) {
      provider = win.ethereum.providers.find((p: any) => p.isCoinbaseWallet) ?? win.ethereum
    }

    if (!provider) {
      const urls: Record<string, string> = {
        metamask: 'https://metamask.io/download/',
        coinbase: 'https://www.coinbase.com/wallet',
        injected: 'https://metamask.io/download/',
      }
      if (walletType !== 'injected') window.open(urls[walletType] ?? urls.metamask, '_blank')
      setState(prev => ({
        ...prev,
        error: 'No wallet detected. Please install a Web3 browser extension.',
      }))
      return
    }

    const nameMap: Record<string, string> = {
      metamask: 'MetaMask', coinbase: 'Coinbase Wallet', injected: 'Browser Wallet',
    }
    await connectProvider(provider, nameMap[walletType] ?? 'Wallet')
  }, [connectProvider])

  const disconnect = useCallback(() => {
    setActiveProvider(null)
    setState(EMPTY_STATE)
  }, [])

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }))
  }, [])

  return (
    <WalletContext.Provider value={{ ...state, connect, connectProvider, disconnect, clearError }}>
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet() {
  const ctx = useContext(WalletContext)
  if (!ctx) throw new Error('useWallet must be inside <WalletProvider>')
  return ctx
}
