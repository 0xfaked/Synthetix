import { useState, useEffect } from 'react'
import { Settings, ChevronDown, ArrowDownUp } from 'lucide-react'
import { useAccount, useWriteContract, useReadContract, useWalletClient, useBalance } from 'wagmi'
import { parseEther, formatEther } from 'viem'
import { SYNTHX_CONTRACT_ADDRESS, SYNTHX_ABI, ERC20_ABI } from '../config/contracts'
import type { Asset } from '../data/assets'
import { CRYPTO_TOKENS, ASSETS } from '../data/assets'
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
  const { isConnected } = useAccount()
  const { data: walletClient } = useWalletClient()
  const { writeContract, isPending } = useWriteContract()

  // Hardcode FLR for 'You pay'
  const [payToken] = useState<TokenType>(CRYPTO_TOKENS.find(t => t.symbol === 'FLR') || CRYPTO_TOKENS[0])
  const [receiveToken, setReceiveToken] = useState<TokenType>(defaultReceive ?? ASSETS.find(a => a.id === 'seur') ?? ASSETS[0])

  // Fetch the ERC20 address of the currently selected receiveToken
  const { data: receiveTokenAddress } = useReadContract({
    address: SYNTHX_CONTRACT_ADDRESS as `0x${string}`,
    abi: SYNTHX_ABI,
    functionName: 'synthTokens',
    args: [receiveToken.id]
  })

  // Fetch actual user balance for the Synth asset
  const { data: synthBalance } = useReadContract({
    address: (receiveTokenAddress as `0x${string}`) || '0x0000000000000000000000000000000000000000',
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [useAccount().address]
  })
  
  // Fetch actual user FLR balance
  const { data: flrBalance } = useBalance({
    address: useAccount().address
  })
  
  // Fetch contract FLR liquidity
  const { data: contractLiquidity } = useReadContract({
    address: SYNTHX_CONTRACT_ADDRESS as `0x${string}`,
    abi: SYNTHX_ABI,
    functionName: 'getLiquidity',
  })

  const { data: requiredLiquidity } = useReadContract({
    address: SYNTHX_CONTRACT_ADDRESS as `0x${string}`,
    abi: SYNTHX_ABI,
    functionName: 'getRequiredLiquidity',
  })
  
  // Default to 1 for FLR
  const [payAmount, setPayAmount] = useState('1')
  const [showReceiveModal, setShowReceiveModal] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [slippage, setSlippage] = useState('0.5')
  const [isMinting, setIsMinting] = useState(true)
  
  const [livePrices, setLivePrices] = useState<Record<string, number>>({})

  // Fetch real-time live prices using the Coinbase API (free, no API key, real-time updates)
  useEffect(() => {
    let isMounted = true

    const fetchRealTimePrices = async () => {
      try {
        const url = 'https://api.coinbase.com/v2/exchange-rates?currency=USD'
        const response = await fetch(url)
        const data = await response.json()
        
        if (data && data.data && data.data.rates && isMounted) {
          const rates = data.data.rates
          // Coinbase returns how much 1 USD is in the target currency (e.g. 1 USD = 0.92 EUR)
          // We store the USD price of 1 unit of that currency (e.g. 1 EUR = 1 / 0.92 USD)
          setLivePrices({
            seur: 1 / parseFloat(rates.EUR),
            sgbp: 1 / parseFloat(rates.GBP),
            sjpy: 1 / parseFloat(rates.JPY),
            schf: 1 / parseFloat(rates.CHF),
            saud: 1 / parseFloat(rates.AUD),
            scad: 1 / parseFloat(rates.CAD),
            snzd: 1 / parseFloat(rates.NZD),
            scny: 1 / parseFloat(rates.CNY)
          })
        }
      } catch (error) {
        console.error('Failed to fetch real-time prices from Coinbase:', error)
      }
    }

    // Fetch immediately on mount
    fetchRealTimePrices()

    // Poll every 10 seconds for real-time tick updates
    const interval = setInterval(fetchRealTimePrices, 10000)

    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [])

  // Use live price if available, else use the static asset price
  // Type casting receiveToken to any to check id safely
  const currentTokenId = (receiveToken as any).id
  const effectiveReceivePrice = (currentTokenId && livePrices[currentTokenId]) 
    ? livePrices[currentTokenId] 
    : receiveToken.price

  useEffect(() => {
    if (defaultReceive) {
      setReceiveToken(defaultReceive)
    }
  }, [defaultReceive])

  // When minting, we pay FLR and receive Synth. 
  // When burning, we pay Synth and receive FLR.
  const topToken = isMinting ? payToken : receiveToken
  const bottomToken = isMinting ? receiveToken : payToken

  const userTopBalance = isMinting 
    ? (flrBalance ? parseFloat(formatEther(flrBalance.value)) : 0)
    : (synthBalance ? parseFloat(formatEther(synthBalance as bigint)) : 0)

  const topPrice = isMinting ? payToken.price : effectiveReceivePrice
  const bottomPrice = isMinting ? effectiveReceivePrice : payToken.price

  const receiveAmount = payAmount
    ? ((parseFloat(payAmount) * topPrice) / bottomPrice).toFixed(6)
    : ''

  const usdValue = payAmount
    ? `≈ $${(parseFloat(payAmount) * topPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : ''

  const exchangeRate = `1 ${topToken.symbol} = ${(topPrice / bottomPrice).toFixed(6)} ${bottomToken.symbol}`

  const parsedSlippage = parseFloat(slippage) || 0.5
  const minReceivedVal = receiveAmount
    ? (parseFloat(receiveAmount) * (1 - parsedSlippage / 100)).toFixed(4)
    : '0.0000'

  const protocolFeeVal = payAmount
    ? (parseFloat(payAmount) * 0.003).toFixed(4)
    : '0.0000'

  const hasInsufficientBurnLiquidity = Boolean(
    !isMinting &&
    contractLiquidity !== undefined &&
    requiredLiquidity !== undefined &&
    contractLiquidity < requiredLiquidity
  )

  return (
    <div className="swap-container">
      <div className="swap-box" style={{ padding: '16px' }}>
        {/* Header */}
        <div className="swap-header" style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="swap-title" style={{ fontSize: '1rem', fontWeight: 600 }}>Swap / Mint</span>
          {/* Settings and Fund Buttons */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="swap-settings-btn"
              onClick={() => setShowSettings(!showSettings)}
              id="swap-settings-btn"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: showSettings ? 'rgba(124,58,237,0.15)' : 'var(--bg-elevated)',
                color: showSettings ? 'var(--accent-secondary)' : 'var(--text-muted)',
                border: `1px solid ${showSettings ? 'var(--border-accent)' : 'var(--border-subtle)'}`,
              }}
            >
              <Settings size={15} />
            </button>
            {/* Fund Reserve Button */}
            <button
              style={{
                padding: '6px 12px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                color: 'var(--text-primary)',
              }}
              onClick={() => {
                const amt = prompt('Enter amount of FLR to add to the reserve pool (e.g., 0.5)');
                if (amt && !isNaN(parseFloat(amt))) {
                  writeContract({
                    address: SYNTHX_CONTRACT_ADDRESS as `0x${string}`,
                    abi: SYNTHX_ABI,
                    functionName: 'provideReserve',
                    value: parseEther(amt),
                  }, {
                    onSuccess: () => alert(`✅ Contract funded with ${amt} FLR`),
                    onError: (e) => alert('❌ Funding failed: ' + e.message),
                  });
                }
              }}
            >
              Fund Reserve
            </button>
          </div>
        </div>

        {/* Stacked Inputs Area */}
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {/* You Pay Box */}
          <div className="swap-field" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '14px 18px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                You pay (Balance: {userTopBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })})
              </span>
              <span className="swap-max-btn" onClick={() => {
                // If minting (FLR), leave a little for gas. If burning (Synth), max is the exact balance
                if (isMinting) {
                  const maxFlr = userTopBalance > 0.05 ? userTopBalance - 0.05 : 0
                  setPayAmount(maxFlr.toFixed(4))
                } else {
                  // Important: set exactly the full balance (as a string) to avoid precision reverts!
                  if (synthBalance) {
                     setPayAmount(formatEther(synthBalance as bigint))
                  }
                }
              }} style={{ cursor: 'pointer' }}>MAX</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <input
                className="swap-amount-input"
                placeholder="0"
                value={payAmount}
                onChange={e => setPayAmount(e.target.value)}
                type="number"
                id="pay-amount-input"
                style={{ fontSize: '1.8rem', fontWeight: 600, flex: 1, border: 'none', background: 'none', outline: 'none', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}
              />
              {/* Token Selector */}
              <button
                className="token-selector"
                onClick={() => { if (!isMinting) setShowReceiveModal(true) }}
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-pill)', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: isMinting ? 'default' : 'pointer', opacity: isMinting ? 0.9 : 1 }}
              >
                <span style={{ fontSize: '1.1rem' }}>{topToken.icon}</span>
                <span style={{ fontWeight: 700, fontSize: '0.85rem', fontFamily: 'var(--font-display)' }}>{topToken.symbol}</span>
                <ChevronDown size={14} style={{ color: 'var(--text-muted)', visibility: isMinting ? 'hidden' : 'visible' }} />
              </button>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {usdValue || '≈ $0.00'}
            </div>
          </div>

          {/* Swap Arrow */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 10,
          }}>
            <button
              onClick={() => {
                setIsMinting(!isMinting)
                setPayAmount(receiveAmount || '')
              }}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'var(--bg-elevated)',
                border: '4px solid var(--bg-surface)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-primary)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
            >
              <ArrowDownUp size={16} />
            </button>
          </div>

          {/* You Receive Box */}
          <div className="swap-field" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '14px 18px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>You receive</span>
              {isAsset(bottomToken) && (
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  color: bottomToken.changePercent24h >= 0 ? 'var(--green)' : 'var(--red)',
                }}>
                  {bottomToken.changePercent24h >= 0 ? '▲' : '▼'} {Math.abs(bottomToken.changePercent24h).toFixed(2)}%
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <input
                className="swap-amount-input"
                placeholder="0"
                value={receiveAmount}
                readOnly
                style={{ fontSize: '1.8rem', fontWeight: 600, flex: 1, border: 'none', background: 'none', outline: 'none', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}
              />
              <button
                className="token-selector"
                onClick={() => { if (isMinting) setShowReceiveModal(true) }}
                id="receive-token-selector"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-pill)', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: isMinting ? 'pointer' : 'default' }}
              >
                <span style={{ fontSize: '1.1rem' }}>{bottomToken.icon}</span>
                <span style={{ fontWeight: 700, fontSize: '0.85rem', fontFamily: 'var(--font-display)' }}>{bottomToken.symbol}</span>
                <ChevronDown size={14} style={{ color: 'var(--text-muted)', visibility: isMinting ? 'visible' : 'hidden' }} />
              </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              <span>{receiveAmount ? `≈ $${(parseFloat(receiveAmount) * bottomPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '≈ $0.00'}</span>
              <span>{formatPrice(bottomPrice)}</span>
            </div>
          </div>
        </div>

        {/* Embedded Slippage Presets Row */}
        {showSettings && (
          <div style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 14px',
            marginTop: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Slippage Tolerance</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--accent-secondary)', fontWeight: 700 }}>{slippage}%</span>
            </div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {['0.1', '0.5', '1.0'].map(s => (
                <button
                  key={s}
                  style={{
                    flex: 1,
                    padding: '6px',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    background: slippage === s ? 'var(--accent-primary)' : 'rgba(255,255,255,0.03)',
                    color: slippage === s ? 'var(--text-primary)' : 'var(--text-secondary)',
                    border: `1px solid ${slippage === s ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
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
                  width: '70px',
                  padding: '6px 8px',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  fontSize: '0.72rem',
                  outline: 'none',
                  textAlign: 'right'
                }}
              />
            </div>
          </div>
        )}

        {/* Swap Info Details Section */}
        <div style={{
          marginTop: '12px',
          padding: '8px 4px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          fontSize: '0.75rem',
          color: 'var(--text-secondary)',
        }}>
          {payAmount && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Rate</span>
              <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{exchangeRate}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)' }}>Price Impact</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>&lt; 0.05%</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)' }}>Fee (0.3%)</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 500, fontFamily: 'var(--font-mono)' }}>
              {payAmount ? `${parseFloat(protocolFeeVal).toFixed(4)} ${topToken.symbol}` : '—'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)' }}>Slippage Tolerance</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{slippage}%</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)' }}>Minimum Received</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 500, fontFamily: 'var(--font-mono)' }}>
              {receiveAmount ? `${parseFloat(minReceivedVal).toFixed(4)} ${bottomToken.symbol}` : '—'}
            </span>
          </div>
          {hasInsufficientBurnLiquidity && (
            <p style={{ color: 'var(--red)', fontSize: '0.7rem', marginTop: '8px' }}>
              ⚠️ Contract has insufficient FLR liquidity for this burn. Please fund the contract.
            </p>
          ) }
        </div>

        <button
          className="btn btn-primary btn-full btn-lg"
          style={{ marginTop: '14px', borderRadius: 'var(--radius-lg)' }}
          id="mint-btn"
          disabled={isPending || hasInsufficientBurnLiquidity}
          onClick={() => {
            if (!isConnected) {
              alert('Please connect your wallet first via the top right button!')
              return
            }
            if (!payAmount || parseFloat(payAmount) <= 0) return

            if (isMinting) {
              writeContract({
                address: SYNTHX_CONTRACT_ADDRESS,
                abi: SYNTHX_ABI,
                functionName: 'mintSynth',
                args: [
                  receiveToken.id, 
                  parseEther(payAmount) 
                ],
                value: parseEther(payAmount)
              }, {
                onSuccess: () => {
                  alert('✅ Mint successful! The transaction was sent to the blockchain.')
                  if (window.ethereum && receiveTokenAddress) {
                    const providers = window.ethereum.providers || [window.ethereum];
                    const metaMaskProvider = providers.find((p: any) => p.isMetaMask && !p.isTrust && !p.isTrustWallet) || window.ethereum;

                    const tokenSymbol = receiveToken.id === 'seur' ? 'sEUR' : 
                                        receiveToken.id === 'sgbp' ? 'sGBP' : 
                                        receiveToken.id === 'sjpy' ? 'sJPY' : 
                                        receiveToken.id.toUpperCase();

                    metaMaskProvider.request({
                      method: 'wallet_watchAsset',
                      params: {
                        type: 'ERC20',
                        options: {
                          address: receiveTokenAddress as string,
                          symbol: tokenSymbol, 
                          decimals: 18
                        },
                      },
                    }).catch((err: any) => alert('Failed to open MetaMask: ' + err.message));
                  }
                },
                onError: (error) => alert('❌ Mint failed: ' + error.message)
              })
            } else {
              // BURNING
              writeContract({
                address: SYNTHX_CONTRACT_ADDRESS,
                abi: SYNTHX_ABI,
                functionName: 'burnSynth',
                args: [
                  receiveToken.id, 
                  parseEther(payAmount) 
                ],
              }, {
                onSuccess: () => {
                  alert(`✅ Burn successful! The synth was removed from your wallet and the FLR was sent back to the same wallet.`)
                },
                onError: (error) => alert('❌ Burn failed: ' + error.message)
              })
            }
          }}
        >
          {isPending 
            ? 'Confirm in MetaMask...'
            : (payAmount && parseFloat(payAmount) > 0
              ? (isMinting
                ? `Mint ${receiveAmount ? parseFloat(receiveAmount).toFixed(4) : '0'} ${bottomToken.symbol}`
                : `Burn ${parseFloat(payAmount).toFixed(4)} ${topToken.symbol}`)
              : 'Enter an Amount')}
        </button>

        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '10px', lineHeight: 1.4 }}>
          Synthetic assets are backed by crypto collateral and track real-world prices via Flare FTSO.
        </p>
      </div>

      {/* Modals */}
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
