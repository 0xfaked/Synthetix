#!/usr/bin/env node
/**
 * get-prices.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Queries Flare Coston2 FTSOv2 for crypto + forex price feeds.
 *
 * Feed ID derivation (per Flare docs):
 *   bytes21 = 0x + category(2 hex) + hex(feedName) + zeroPad to 42 hex chars
 *   Categories: 01=Crypto  02=Forex  03=Commodity  04=Stock  21=Custom
 *
 * NOTE: Forex feeds (EUR/USD, GBP/USD, JPY/USD) are PLANNED on Coston2 testnet.
 *       They will show "NOT YET LIVE" until Flare deploys them to Coston2.
 *       On Flare Mainnet they ARE live — change RPC_URL to mainnet to test them.
 *
 * Run:
 *   node script/get-prices.js
 *   node script/get-prices.js --mainnet     (use mainnet RPC)
 *   node script/get-prices.js --rpc <url>   (custom RPC)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

"use strict";

const { JsonRpcProvider, Contract } = require("ethers");

// ── RPC config ───────────────────────────────────────────────────────────────
const COSTON2_RPC  = "https://coston2-api.flare.network/ext/C/rpc";
const MAINNET_RPC  = "https://flare-api.flare.network/ext/C/rpc";

const args     = process.argv.slice(2);
const useMain  = args.includes("--mainnet");
const rpcIdx   = args.indexOf("--rpc");
const RPC_URL  = rpcIdx !== -1 ? args[rpcIdx + 1] : (useMain ? MAINNET_RPC : COSTON2_RPC);
const NETWORK  = useMain ? "Flare Mainnet" : "Coston2 Testnet";

// ── Contract addresses ────────────────────────────────────────────────────────
// Both Coston2 and Mainnet share the same registry address
const REGISTRY_ADDRESS = "0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019";

const REGISTRY_ABI = [
  "function getContractAddressByName(string name) external view returns (address)",
];

const FTSO_ABI = [
  "function getFeedById(bytes21 feedId) external payable returns (uint256 value, int8 decimals, uint64 timestamp)",
  "function calculateFeeById(bytes21 feedId) external view returns (uint256 fee)",
  "function getFeedsById(bytes21[] feedIds) external payable returns (uint256[] values, int8[] decimals, uint64[] timestamps)",
  "function calculateFeeByIds(bytes21[] feedIds) external view returns (uint256 fee)",
];

// ── Feed ID helper (from Flare docs) ─────────────────────────────────────────
/**
 * Computes a FTSOv2 bytes21 feed ID.
 * @param {string} category  Two-char hex category, e.g. "01" (Crypto) or "02" (Forex)
 * @param {string} feedName  Human-readable name, e.g. "FLR/USD" or "EUR/USD"
 * @returns {string}  "0x" + 42 hex chars (21 bytes)
 */
function getFeedId(category, feedName) {
  const hexFeedName = Array.from(feedName)
    .map((c) => c.charCodeAt(0).toString(16).padStart(2, "0"))
    .join("");
  const combined = category + hexFeedName;
  if (combined.length > 42) {
    throw new Error(`Feed name "${feedName}" is too long to encode as bytes21`);
  }
  return "0x" + combined.padEnd(42, "0");
}

// ── Feed definitions ──────────────────────────────────────────────────────────
//
// IMPORTANT: Feed names must match EXACTLY what Flare registers on-chain.
//   - Crypto:  FLR/USD, BTC/USD, ETH/USD, XRP/USD  (category 01)
//   - Forex:   EUR/USD, GBP/USD, JPY/USD            (category 02)
//              Note: it is JPY/USD (not USD/JPY) per Flare's feed registry.
//
const FEEDS = [
  // ── Crypto feeds (live on Coston2) ──────────────────────────────────────
  { category: "01", name: "FLR/USD",  label: "FLR/USD  [Crypto]",  group: "crypto" },
  { category: "01", name: "BTC/USD",  label: "BTC/USD  [Crypto]",  group: "crypto" },
  { category: "01", name: "ETH/USD",  label: "ETH/USD  [Crypto]",  group: "crypto" },
  { category: "01", name: "XRP/USD",  label: "XRP/USD  [Crypto]",  group: "crypto" },
  { category: "01", name: "SOL/USD",  label: "SOL/USD  [Crypto]",  group: "crypto" },
  // ── Forex feeds (planned on Coston2 / live on Mainnet) ──────────────────
  { category: "02", name: "EUR/USD",  label: "EUR/USD  [Forex]",   group: "forex"  },
  { category: "02", name: "GBP/USD",  label: "GBP/USD  [Forex]",   group: "forex"  },
  { category: "02", name: "JPY/USD",  label: "JPY/USD  [Forex]",   group: "forex"  },
];

// Pre-compute and attach feed IDs
for (const f of FEEDS) {
  f.feedId = getFeedId(f.category, f.name);
}

// ── Formatting helpers ────────────────────────────────────────────────────────
function formatPrice(rawPrice, decimals) {
  const p      = BigInt(rawPrice.toString());
  const scale  = 10n ** BigInt(decimals);
  const intPart  = p / scale;
  const fracPart = p % scale;
  return intPart.toString() + "." + fracPart.toString().padStart(decimals, "0");
}

function ageLabel(seconds) {
  if (seconds < 60)  return `${seconds}s  [FRESH]`;
  if (seconds < 120) return `${seconds}s  [AGING]`;
  return `${seconds}s  [STALE]`;
}

function printSeparator(char = "-", len = 70) {
  console.log(char.repeat(len));
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  printSeparator("=");
  console.log(` Flare FTSOv2 Price Feed Checker  |  ${NETWORK}`);
  console.log(` RPC: ${RPC_URL}`);
  printSeparator("=");
  console.log();

  // -- Show computed feed IDs --
  console.log("Feed ID Table (computed with getFeedId helper):");
  printSeparator();
  console.log("  Category  Feed Name  Feed ID (bytes21)");
  printSeparator();
  for (const f of FEEDS) {
    console.log(`  ${f.category}        ${f.name.padEnd(10)} ${f.feedId}`);
  }
  printSeparator();
  console.log();

  const provider = new JsonRpcProvider(RPC_URL);
  const block    = await provider.getBlock("latest");
  console.log(`Connected. Latest block: #${block.number}`);
  console.log();

  // Resolve FtsoV2 from registry
  const registry   = new Contract(REGISTRY_ADDRESS, REGISTRY_ABI, provider);
  const ftsoAddress = await registry.getContractAddressByName("FtsoV2");
  console.log(`FtsoV2 contract : ${ftsoAddress}`);
  console.log();

  const ftso = new Contract(ftsoAddress, FTSO_ABI, provider);

  // -- Query each feed individually --
  const now = Math.floor(Date.now() / 1000);
  let cryptoCount = 0, forexCount = 0, failCount = 0;

  for (const feed of FEEDS) {
    const prefix = feed.label.padEnd(22);
    process.stdout.write(`  ${prefix} `);

    try {
      const fee    = await ftso.calculateFeeById(feed.feedId);
      const result = await ftso.getFeedById.staticCall(feed.feedId, { value: fee });

      const rawPrice = BigInt(result[0].toString());
      const decimals = Number(result[1]);
      const timestamp = Number(result[2]);
      const age      = now - timestamp;
      const price    = formatPrice(rawPrice, decimals);

      console.log(`${price.padEnd(18)} age=${ageLabel(age)}`);

      if (feed.group === "crypto") cryptoCount++;
      else forexCount++;

    } catch (err) {
      const msg = err.message || String(err);
      if (msg.includes("feed does not exist") || msg.includes("CALL_EXCEPTION")) {
        console.log(`NOT YET LIVE on ${NETWORK}`);
      } else {
        console.log(`ERROR - ${msg.split("\n")[0].slice(0, 60)}`);
      }
      failCount++;
    }
  }

  console.log();
  printSeparator("=");
  console.log(` Results: ${cryptoCount} crypto OK  |  ${forexCount} forex OK  |  ${failCount} not available`);
  if (failCount > 0 && !useMain) {
    console.log();
    console.log(" Tip: Forex feeds are planned on Coston2 but live on Mainnet.");
    console.log(" Run with --mainnet to query live EUR/USD, GBP/USD, JPY/USD:");
    console.log("   node script/get-prices.js --mainnet");
  }
  printSeparator("=");
}

main().catch((err) => {
  console.error("\nFatal error:", err.message);
  process.exit(1);
});
