export type AssetCategory = 'forex';

export interface Asset {
  id: string;
  symbol: string;
  name: string;
  category: AssetCategory;
  price: number;
  change24h: number;
  changePercent24h: number;
  volume24h: number;
  marketCap: number;
  icon: string;
  color: string;
  sparkline: number[];
  unit?: string;
  description?: string;
}

function generateSparkline(base: number, volatility: number, points = 20): number[] {
  const data: number[] = [];
  let current = base;
  for (let i = 0; i < points; i++) {
    current = current + (Math.random() - 0.48) * volatility;
    data.push(parseFloat(current.toFixed(4)));
  }
  return data;
}

export const ASSETS: Asset[] = [
  {
    id: 'seur',
    symbol: 'sEUR/USD',
    name: 'Euro / US Dollar',
    category: 'forex',
    price: 1.0842,
    change24h: 0.0023,
    changePercent24h: 0.21,
    volume24h: 4_200_000,
    marketCap: 62_000_000,
    icon: '🇪🇺',
    color: '#003399',
    sparkline: generateSparkline(1.0842, 0.003),
    description: 'Most traded currency pair globally',
  },
  {
    id: 'sgbp',
    symbol: 'sGBP/USD',
    name: 'British Pound / US Dollar',
    category: 'forex',
    price: 1.2701,
    change24h: -0.0015,
    changePercent24h: -0.12,
    volume24h: 3_800_000,
    marketCap: 48_000_000,
    icon: '🇬🇧',
    color: '#012169',
    sparkline: generateSparkline(1.2701, 0.004),
    description: 'Sterling — the cable pair',
  },
  {
    id: 'sjpy',
    symbol: 'sUSD/JPY',
    name: 'US Dollar / Japanese Yen',
    category: 'forex',
    price: 157.42,
    change24h: 0.18,
    changePercent24h: 0.11,
    volume24h: 5_100_000,
    marketCap: 71_000_000,
    icon: '🇯🇵',
    color: '#BC002D',
    sparkline: generateSparkline(157.42, 0.4),
    description: 'Dollar-Yen — high-volume Asia pair',
  },
  {
    id: 'schf',
    symbol: 'sUSD/CHF',
    name: 'US Dollar / Swiss Franc',
    category: 'forex',
    price: 0.9012,
    change24h: 0.0011,
    changePercent24h: 0.12,
    volume24h: 2_100_000,
    marketCap: 31_000_000,
    icon: '🇨🇭',
    color: '#FF0000',
    sparkline: generateSparkline(0.9012, 0.003),
    description: 'Safe-haven Swiss Franc pair',
  },
  {
    id: 'saud',
    symbol: 'sAUD/USD',
    name: 'Australian Dollar / US Dollar',
    category: 'forex',
    price: 0.6578,
    change24h: -0.0022,
    changePercent24h: -0.33,
    volume24h: 1_900_000,
    marketCap: 27_000_000,
    icon: '🇦🇺',
    color: '#00008B',
    sparkline: generateSparkline(0.6578, 0.004),
    description: 'Aussie dollar commodity currency',
  },
  {
    id: 'scad',
    symbol: 'sUSD/CAD',
    name: 'US Dollar / Canadian Dollar',
    category: 'forex',
    price: 1.3612,
    change24h: 0.0031,
    changePercent24h: 0.23,
    volume24h: 2_600_000,
    marketCap: 38_000_000,
    icon: '🇨🇦',
    color: '#FF0000',
    sparkline: generateSparkline(1.3612, 0.004),
    description: 'Loonie — oil-correlated pair',
  },
  {
    id: 'snzd',
    symbol: 'sNZD/USD',
    name: 'New Zealand Dollar / US Dollar',
    category: 'forex',
    price: 0.6103,
    change24h: -0.0018,
    changePercent24h: -0.29,
    volume24h: 1_400_000,
    marketCap: 19_000_000,
    icon: '🇳🇿',
    color: '#00247D',
    sparkline: generateSparkline(0.6103, 0.003),
    description: 'Kiwi dollar Pacific pair',
  },
  {
    id: 'scny',
    symbol: 'sUSD/CNY',
    name: 'US Dollar / Chinese Yuan',
    category: 'forex',
    price: 7.2541,
    change24h: 0.0021,
    changePercent24h: 0.03,
    volume24h: 3_700_000,
    marketCap: 55_000_000,
    icon: '🇨🇳',
    color: '#DE2910',
    sparkline: generateSparkline(7.2541, 0.01),
    description: 'Renminbi — key emerging market pair',
  }
];

export const CRYPTO_TOKENS = [
  { symbol: 'FLR', name: 'Flare (Collateral)', icon: '☀️', price: 1.00 },
  { symbol: 'USDT', name: 'Tether', icon: '💚', price: 1.00 },
  { symbol: 'ETH', name: 'Ethereum', icon: '🔷', price: 3821.45 },
  { symbol: 'WBTC', name: 'Wrapped Bitcoin', icon: '🟠', price: 67420.00 },
  { symbol: 'SNX', name: 'Synthetix Token', icon: '🟣', price: 3.24 },
];

export const CATEGORIES: { id: AssetCategory | 'all'; label: string; icon: string }[] = [
  { id: 'all', label: 'All Assets', icon: '🌐' },
  { id: 'forex', label: 'Forex', icon: '💱' },
];

export const PLATFORM_STATS = {
  tvl: 2_840_000_000,
  volume24h: 486_000_000,
  totalAssets: ASSETS.length,
  totalUsers: 147_832,
};
