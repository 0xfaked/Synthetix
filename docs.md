# SynthX Documentation

## Overview
SynthX is a decentralized synthetic asset issuance and trading protocol built on the **Flare Testnet Coston2**. It allows users to mint, burn, and trade synthetic assets (Synths) that track real-world prices. The platform leverages Flare's decentralized oracle networks alongside real-time APIs to ensure accurate, up-to-the-second pricing for all supported assets.

## Key Features
- **Minting & Burning**: Users can mint synthetic assets by locking up supported crypto collateral. Conversely, users can burn their Synths to unlock their underlying collateral.
- **Real-World Price Tracking**: Synths track real-world assets such as fiat currencies (Forex) and commodities (Gold, Silver).
- **Dynamic Charting**: Built-in charting interface allowing users to view price action (line and candlestick charts) with a full-screen analysis mode.
- **Market Protection**: The minting and burning functions are safeguarded against stale data; transactions are disabled if live real-world prices are unavailable (Market Closed).
- **Minimalist UX**: A refined, responsive user interface featuring seamless wallet integration (via Wagmi) and optimized asset selectors.

## Supported Assets

### Collateral (Crypto Tokens)
Users can provide the following tokens as collateral to mint Synths:
- **C2FLR** (Coston2 Flare)
- **USDT0** (Tether Testnet)
- **FXRP** (Flare XRP)

### Synthetic Assets (Synths)
Synths are tokenized representations of real-world assets. Supported categories include:
1. **Forex (Fiat Currencies)**:
   - `sEUR/USD` (Euro)
   - `sGBP/USD` (British Pound)
   - `sJPY/USD` (Japanese Yen)
   - `sCHF/USD` (Swiss Franc)
   - `sAUD/USD` (Australian Dollar)
   - `sCAD/USD` (Canadian Dollar)
   - *And many other global fiat pairs (NZD, CNY, INR, MXN, TRY, ZAR, KRW, BRL).*
2. **Commodities**:
   - `sXAU/USD` (Gold)
   - `sXAG/USD` (Silver)

## Price Feeds & Oracles
SynthX ensures price accuracy through a dual-feed system:
1. **Coinbase API Integration**: The frontend polls the Coinbase Exchange Rates API (`https://api.coinbase.com/v2/exchange-rates?currency=USD`) every 10 seconds to fetch live USD prices for all supported fiat, commodities, and crypto collateral.
2. **Flare Time Series Oracle (FTSO)**: The protocol utilizes Flare's native FTSO system to provide decentralized, on-chain price data for assets like FLR and XRP.

## Technical Stack
- **Frontend Framework**: React 18, Vite
- **Web3 Integration**: Wagmi, Viem (for contract reads/writes and wallet connection)
- **Routing**: React Router (`react-router-dom`)
- **Styling**: Pure CSS with CSS variables for dynamic theming and layout management.
- **Icons**: Lucide React

## Smart Contract Architecture
SynthX interacts with core smart contracts deployed on Coston2:
- **`SYNTHX_CONTRACT_ADDRESS`**: The primary orchestrator contract responsible for handling `mintSynth()`, `burnSynth()`, liquidity checks (`getLiquidity`, `getRequiredLiquidity`), and reserve funding (`provideReserve`).
- **`ERC20_ABI`**: Standard token ABI used to interact with the underlying minted Synth tokens (e.g., checking user balances via `balanceOf`).

## Project Structure
- `src/components/`: Core UI components (e.g., `SwapBox.tsx` for trading, `PriceChart.tsx` for charting, `AssetModal.tsx` for selection).
- `src/data/assets.ts`: Static asset definitions, fallback prices, and configuration for all Synths and Crypto Tokens.
- `src/hooks/`: Custom React hooks (e.g., `useForexPrices.ts` for FTSO integration).
- `src/config/contracts.ts`: ABI definitions and contract addresses.

## Operational Constraints
- **Liquidity Requirements**: Burning Synths requires the protocol to have sufficient collateral liquidity. If the contract is underfunded, users are prompted to fund the reserve.
- **Market Hours**: Minting and burning operations are dynamically disabled if the price feed for either the collateral or the target synthetic asset goes offline.

## Running Locally
To run the SynthX frontend locally:
1. Ensure dependencies are installed: `npm install`
2. Start the development server: `npm run dev`
3. Connect a Web3 wallet (e.g., MetaMask) configured for the **Flare Testnet Coston2** network.
