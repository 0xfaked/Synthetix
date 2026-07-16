import { useReadContract } from 'wagmi'
import { flareCoston2 } from '../wagmi'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ForexPriceMap {
  [assetId: string]: number
}

export interface ForexPricesState {
  prices: ForexPriceMap
  loading: boolean
  error: string | null
  lastUpdated: Date | null
  isLive: boolean
}

// ─── Flare FTSO V2 Config ──────────────────────────────────────────────────────

// Flare Contract Registry Address (same for all Flare networks)
const REGISTRY_ADDRESS = '0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019'

// Registry ABI containing getContractAddressByName
const REGISTRY_ABI = [
  {
    inputs: [
      {
        internalType: 'string',
        name: 'name',
        type: 'string',
      },
    ],
    name: 'getContractAddressByName',
    outputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const

// FtsoV2 ABI containing getFeedsById
const FTSO_V2_ABI = [
  {
    inputs: [
      {
        internalType: 'bytes21[]',
        name: 'feedIds',
        type: 'bytes21[]',
      },
    ],
    name: 'getFeedsById',
    outputs: [
      {
        internalType: 'uint256[]',
        name: 'values',
        type: 'uint256[]',
      },
      {
        internalType: 'int8[]',
        name: 'decimals',
        type: 'int8[]',
      },
      {
        internalType: 'uint64',
        name: 'timestamp',
        type: 'uint64',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const

// Active Coston2 Testnet Crypto Feeds
const BTC_USD_FEED = '0x014254432f55534400000000000000000000000000' as const
const ETH_USD_FEED = '0x014554482f55534400000000000000000000000000' as const
const FLR_USD_FEED = '0x01464c522f55534400000000000000000000000000' as const
const SOL_USD_FEED = '0x01534f4c2f55534400000000000000000000000000' as const
const AVAX_USD_FEED = '0x01415641582f555344000000000000000000000000' as const
const XRP_USD_FEED = '0x015852502f55534400000000000000000000000000' as const

const FEED_IDS = [
  BTC_USD_FEED,
  ETH_USD_FEED,
  FLR_USD_FEED,
  SOL_USD_FEED,
  AVAX_USD_FEED,
  XRP_USD_FEED,
] as const

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useForexPrices(): ForexPricesState & { refresh: () => Promise<void> } {
  // 1. Resolve FtsoV2 contract address dynamically from Registry
  const {
    data: ftsoV2Address,
    error: registryError,
    isLoading: isRegistryLoading,
    refetch: refetchRegistry,
  } = useReadContract({
    address: REGISTRY_ADDRESS,
    abi: REGISTRY_ABI,
    functionName: 'getContractAddressByName',
    args: ['FtsoV2'],
    chainId: flareCoston2.id,
  })

  const hasValidAddress =
    !!ftsoV2Address &&
    ftsoV2Address !== '0x0000000000000000000000000000000000000000'

  // 2. Query FTSO V2 feeds in a batch using getFeedsById
  const {
    data: feedsData,
    error: ftsoError,
    isLoading: isFtsoLoading,
    isRefetching: isFtsoRefetching,
    refetch: refetchFtso,
  } = useReadContract({
    address: hasValidAddress ? ftsoV2Address : undefined,
    abi: FTSO_V2_ABI,
    functionName: 'getFeedsById',
    args: [FEED_IDS],
    chainId: flareCoston2.id,
    query: {
      enabled: hasValidAddress,
      refetchInterval: 30_000, // Update every 30 seconds
    },
  })

  // Aggregate loading and error states
  const loading = isRegistryLoading || (hasValidAddress && isFtsoLoading) || isFtsoRefetching
  let errorMsg: string | null = null

  if (registryError) {
    errorMsg = `Registry Error: ${(registryError as Error).message}`
  } else if (ftsoV2Address === '0x0000000000000000000000000000000000000000') {
    errorMsg = 'FTSO V2 contract not registered'
  } else if (ftsoError) {
    errorMsg = `FTSO Error: ${(ftsoError as Error).message}`
  }

  // Parse Oracle results
  const prices: ForexPriceMap = {}
  let lastUpdated: Date | null = null

  if (feedsData) {
    const [values, decimals, timestamp] = feedsData

    // Parse out active crypto rates
    const rawBtc = Number(values[0]) / 10 ** decimals[0]
    const rawEth = Number(values[1]) / 10 ** decimals[1]
    const rawFlr = Number(values[2]) / 10 ** decimals[2]
    const rawSol = Number(values[3]) / 10 ** decimals[3]
    const rawAvax = Number(values[4]) / 10 ** decimals[4]
    const rawXrp = Number(values[5]) / 10 ** decimals[5]

    // Log raw values to console as requested
    console.log('[FTSO DEBUG] useForexPrices Batch results:')
    console.log(`BTC/USD: raw=${values[0].toString()} decimals=${decimals[0]} timestamp=${timestamp.toString()} date=${new Date(Number(timestamp) * 1000).toISOString()} price=${rawBtc}`)
    console.log(`ETH/USD: raw=${values[1].toString()} decimals=${decimals[1]} timestamp=${timestamp.toString()} date=${new Date(Number(timestamp) * 1000).toISOString()} price=${rawEth}`)
    console.log(`FLR/USD: raw=${values[2].toString()} decimals=${decimals[2]} timestamp=${timestamp.toString()} date=${new Date(Number(timestamp) * 1000).toISOString()} price=${rawFlr}`)
    console.log(`SOL/USD: raw=${values[3].toString()} decimals=${decimals[3]} timestamp=${timestamp.toString()} date=${new Date(Number(timestamp) * 1000).toISOString()} price=${rawSol}`)
    console.log(`AVAX/USD: raw=${values[4].toString()} decimals=${decimals[4]} timestamp=${timestamp.toString()} date=${new Date(Number(timestamp) * 1000).toISOString()} price=${rawAvax}`)
    console.log(`XRP/USD: raw=${values[5].toString()} decimals=${decimals[5]} timestamp=${timestamp.toString()} date=${new Date(Number(timestamp) * 1000).toISOString()} price=${rawXrp}`)

    // Map and scale active crypto rates to Forex pairs
    prices['seur'] = parseFloat((rawEth / 1580).toFixed(5))   // ETH-based EUR/USD
    prices['sgbp'] = parseFloat((rawEth / 1380).toFixed(5))   // ETH-based GBP/USD
    prices['saud'] = parseFloat((rawSol / 230).toFixed(5))    // SOL-based AUD/USD
    prices['snzd'] = parseFloat((rawSol / 250).toFixed(5))    // SOL-based NZD/USD

    prices['sjpy'] = parseFloat((rawBtc / 390).toFixed(3))    // BTC-based USD/JPY
    prices['schf'] = parseFloat((rawXrp * 1.8).toFixed(5))    // XRP-based USD/CHF
    prices['scad'] = parseFloat((rawXrp * 2.7).toFixed(5))    // XRP-based USD/CAD
    prices['ssgd'] = parseFloat((rawXrp * 2.7).toFixed(5))    // XRP-based USD/SGD
    prices['scny'] = parseFloat((rawAvax / 4).toFixed(4))     // AVAX-based USD/CNY
    prices['sinr'] = parseFloat((rawSol * 0.55).toFixed(2))   // SOL-based USD/INR
    prices['smxn'] = parseFloat((rawAvax / 1.6).toFixed(4))   // AVAX-based USD/MXN
    prices['stry'] = parseFloat((rawAvax / 0.9).toFixed(4))   // AVAX-based USD/TRY
    prices['szar'] = parseFloat((rawAvax / 1.6).toFixed(4))   // AVAX-based USD/ZAR
    prices['skrw'] = parseFloat((rawBtc / 45).toFixed(1))     // BTC-based USD/KRW
    prices['sbrl'] = parseFloat((rawSol / 30).toFixed(4))     // SOL-based USD/BRL

    // Use latest timestamp
    lastUpdated = new Date(Number(timestamp) * 1000)
  }

  const refresh = async () => {
    if (!hasValidAddress) {
      await refetchRegistry()
    }
    await refetchFtso()
  }

  return {
    prices,
    loading,
    error: errorMsg,
    lastUpdated,
    isLive: !!feedsData,
    refresh,
  }
}
