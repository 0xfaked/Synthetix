import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { useAccount, useConnect, useDisconnect, useBalance } from 'wagmi'

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

// ─── Context ──────────────────────────────────────────────────────────────────

const WalletContext = createContext<WalletContextValue | null>(null)

export function WalletProvider({ children }: { children: ReactNode }) {
  const { address, isConnected, isConnecting: isAccountConnecting, chainId, connector } = useAccount()
  const { disconnect: wagmiDisconnect } = useDisconnect()
  const { connectAsync, connectors, isPending: isConnectPending } = useConnect()
  
  // Fetch balance using wagmi hook
  const { data: balanceData } = useBalance({
    address: address ?? undefined,
  })

  const [error, setError] = useState<string | null>(null)

  const isConnecting = isAccountConnecting || isConnectPending
  const shortAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : null
  const balance = balanceData ? Number(balanceData.formatted).toFixed(4) : null
  
  // Fallback map for common chain names
  const chainName = chainId === 114 ? 'Flare Coston2' : 
                    chainId === 1 ? 'Ethereum' : 
                    chainId === 137 ? 'Polygon' : 
                    chainId === 10 ? 'Optimism' : 
                    chainId === 42161 ? 'Arbitrum' : 
                    useAccount().chain?.name ?? null

  const connectedWalletName = connector ? connector.name : null

  // ── Core connect logic (takes any EIP-1193 provider) ──────────────────────
  const connectProvider = useCallback(async (provider: any, walletName: string) => {
    setError(null)
    // Find the Wagmi connector that matches the EIP-6963 wallet name or falls back to injected
    const targetConnector = connectors.find(
      c => c.name.toLowerCase() === walletName.toLowerCase()
    ) ?? connectors.find(c => c.id === 'injected')

    if (targetConnector) {
      try {
        await connectAsync({ connector: targetConnector })
      } catch (err: any) {
        const msg =
          err?.code === 4001 ? 'Connection rejected.' :
          err?.message ?? 'Connection failed.'
        setError(msg)
      }
    } else {
      setError('No matching wallet connector found.')
    }
  }, [connectAsync, connectors])

  // ── Legacy connect by wallet type ─────────────────────────────────────────
  const connect = useCallback(async (walletType: WalletType) => {
    setError(null)
    if (walletType === 'walletconnect') {
      setError('WalletConnect coming soon. Use a browser wallet for now.')
      return
    }

    let targetConnector = connectors.find(c => {
      const id = c.id.toLowerCase()
      const name = c.name.toLowerCase()
      if (walletType === 'metamask') {
        return id.includes('metamask') || name.includes('metamask')
      }
      if (walletType === 'coinbase') {
        return id.includes('coinbase') || name.includes('coinbase')
      }
      return false
    })

    if (!targetConnector && walletType === 'injected') {
      targetConnector = connectors.find(c => c.id === 'injected')
    }

    // Fallback to injected if specific connector not configured/available
    if (!targetConnector) {
      targetConnector = connectors.find(c => c.id === 'injected')
    }

    if (!targetConnector) {
      const urls: Record<string, string> = {
        metamask: 'https://metamask.io/download/',
        coinbase: 'https://www.coinbase.com/wallet',
        injected: 'https://metamask.io/download/',
      }
      if (walletType !== 'injected') window.open(urls[walletType] ?? urls.metamask, '_blank')
      setError('No wallet detected. Please install a Web3 browser extension.')
      return
    }

    try {
      await connectAsync({ connector: targetConnector })
    } catch (err: any) {
      const msg =
        err?.code === 4001 ? 'Connection rejected.' :
        err?.message ?? 'Connection failed.'
      setError(msg)
    }
  }, [connectAsync, connectors])

  const disconnect = useCallback(() => {
    wagmiDisconnect()
    setError(null)
  }, [wagmiDisconnect])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return (
    <WalletContext.Provider value={{
      address: address ?? null,
      shortAddress,
      balance,
      chainId: chainId ?? null,
      chainName,
      connectedWalletName,
      isConnecting,
      isConnected,
      error,
      connect,
      connectProvider,
      disconnect,
      clearError
    }}>
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet() {
  const ctx = useContext(WalletContext)
  if (!ctx) throw new Error('useWallet must be inside <WalletProvider>')
  return ctx
}
