import { useReadContract } from 'wagmi'
import { flareCoston2 } from '../wagmi'

// Flare Contract Registry Address (same for all Flare networks)
const REGISTRY_ADDRESS = '0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019'

// Registry ABI containing only getContractAddressByName
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

// FtsoV2 ABI containing getFeedById
const FTSO_V2_ABI = [
  {
    inputs: [
      {
        internalType: 'bytes21',
        name: 'feedId',
        type: 'bytes21',
      },
    ],
    name: 'getFeedById',
    outputs: [
      {
        internalType: 'uint256',
        name: 'value',
        type: 'uint256',
      },
      {
        internalType: 'int8',
        name: 'decimals',
        type: 'int8',
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

// FLR/USD Feed ID: Category 01 (Crypto), Name "FLR/USD" (hex: 464c522f555344), padded to 21 bytes
const FLR_USD_FEED_ID = '0x01464c522f55534400000000000000000000000000' as const

export interface FtsoPriceState {
  price: number | null
  loading: boolean
  error: string | null
  lastUpdated: Date | null
  refresh: () => Promise<void>
}

/**
 * Custom hook to fetch FLR/USD price feed dynamically from Flare's FTSO V2 oracle
 * on Coston2 testnet by first querying the Flare Contract Registry.
 */
export function useFtsoPrice(): FtsoPriceState {
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

  // 2. Query FTSO V2 feed value using the resolved address
  const {
    data: feedData,
    error: ftsoError,
    isLoading: isFtsoLoading,
    isRefetching: isFtsoRefetching,
    refetch: refetchFtso,
  } = useReadContract({
    address: hasValidAddress ? ftsoV2Address : undefined,
    abi: FTSO_V2_ABI,
    functionName: 'getFeedById',
    args: [FLR_USD_FEED_ID],
    chainId: flareCoston2.id,
    query: {
      enabled: hasValidAddress,
      refetchInterval: 30_000, // Update feed value every 30 seconds
    },
  })

  // Query EUR/USD feed value
  const {
    data: eurUsdFeedData,
  } = useReadContract({
    address: hasValidAddress ? ftsoV2Address : undefined,
    abi: FTSO_V2_ABI,
    functionName: 'getFeedById',
    args: ['0x024555522f55534400000000000000000000000000'],
    chainId: flareCoston2.id,
    query: {
      enabled: hasValidAddress,
    },
  })

  // Query USD/JPY feed value
  const {
    data: usdJpyFeedData,
  } = useReadContract({
    address: hasValidAddress ? ftsoV2Address : undefined,
    abi: FTSO_V2_ABI,
    functionName: 'getFeedById',
    args: ['0x025553442f4a505900000000000000000000000000'],
    chainId: flareCoston2.id,
    query: {
      enabled: hasValidAddress,
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
  let price: number | null = null
  let lastUpdated: Date | null = null

  if (feedData) {
    const [value, decimals, timestamp] = feedData
    console.log('[FTSO DEBUG] Raw feedData: value=' + value.toString() + ' decimals=' + decimals + ' timestamp=' + timestamp.toString())
    price = Number(value) / 10 ** decimals
    lastUpdated = new Date(Number(timestamp) * 1000)
  }

  if (eurUsdFeedData) {
    const [value, decimals, timestamp] = eurUsdFeedData
    const readableDate = new Date(Number(timestamp) * 1000).toISOString()
    console.log('[FTSO DEBUG] EUR/USD raw feed: value=' + value.toString() + ' decimals=' + decimals + ' timestamp=' + timestamp.toString() + ' date=' + readableDate)
  }

  if (usdJpyFeedData) {
    const [value, decimals, timestamp] = usdJpyFeedData
    const readableDate = new Date(Number(timestamp) * 1000).toISOString()
    console.log('[FTSO DEBUG] USD/JPY raw feed: value=' + value.toString() + ' decimals=' + decimals + ' timestamp=' + timestamp.toString() + ' date=' + readableDate)
  }

  const refresh = async () => {
    // If we don't have the address yet or it failed, refetch registry first
    if (!hasValidAddress) {
      await refetchRegistry()
    }
    await refetchFtso()
  }

  return {
    price,
    loading,
    error: errorMsg,
    lastUpdated,
    refresh,
  }
}
