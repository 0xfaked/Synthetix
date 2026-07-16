import { http, createConfig } from 'wagmi'
import { injected, coinbaseWallet } from 'wagmi/connectors'
import { defineChain } from 'viem'

export const flareCoston2 = defineChain({
  id: 114,
  name: 'Flare Testnet Coston2',
  nativeCurrency: {
    name: 'Coston2 Flare',
    symbol: 'C2FLR',
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ['https://coston2-api.flare.network/ext/C/rpc'] },
  },
  blockExplorers: {
    default: {
      name: 'Coston2 Explorer',
      url: 'https://coston2-explorer.flare.network',
    },
  },
  testnet: true,
})

export const config = createConfig({
  chains: [flareCoston2],
  connectors: [
    injected(),
    coinbaseWallet({ appName: 'SynthX' }),
  ],
  transports: {
    [flareCoston2.id]: http(),
  },
})
