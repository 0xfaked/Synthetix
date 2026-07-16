#!/usr/bin/env node
/**
 * get-eur-price.js
 * Queries the Flare Coston2 FTSOv2 for EUR/USD price.
 *
 * Run: node script/get-eur-price.js
 *
 * NOTE: Coston2 is a testnet. If EUR/USD (forex) feed is not deployed,
 *       the script will show available crypto feeds as fallback.
 */

const { JsonRpcProvider, Contract } = require("ethers");

const RPC_URL = "https://coston2-api.flare.network/ext/C/rpc";

// Flare Contract Registry on Coston2
const REGISTRY_ADDRESS = "0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019";

const REGISTRY_ABI = [
  "function getContractAddressByName(string name) external view returns (address)",
  "function getContractAddressByHash(bytes32 nameHash) external view returns (address)"
];

const FTSO_ABI = [
  "function getFeedById(bytes21 feedId) external payable returns (uint256 value, int8 decimals, uint64 timestamp)",
  "function getFeedsById(bytes21[] feedIds) external payable returns (uint256[] values, int8[] decimals, uint64[] timestamps)",
  "function calculateFeeById(bytes21 feedId) external view returns (uint256 fee)",
  "function calculateFeeByIds(bytes21[] feedIds) external view returns (uint256 fee)"
];

// Feed ID encoding: category (1 byte) + hex(name) + zero-pad to 21 bytes
function encodeFeedId(category, name) {
  const catHex = category.toString(16).padStart(2, "0");
  const nameHex = Buffer.from(name, "utf8").toString("hex");
  const combined = catHex + nameHex;
  return "0x" + combined.padEnd(42, "0");
}

// Known feeds to try on Coston2
const FEEDS = [
  { name: "EUR/USD", category: 2, label: "EUR/USD (Forex)" },
  { name: "FLR/USD", category: 1, label: "FLR/USD (Crypto)" },
  { name: "BTC/USD", category: 1, label: "BTC/USD (Crypto)" },
  { name: "ETH/USD", category: 1, label: "ETH/USD (Crypto)" },
  { name: "XRP/USD", category: 1, label: "XRP/USD (Crypto)" },
];

async function main() {
  console.log("=========================================");
  console.log(" Coston2 FTSOv2 Price Feed Checker");
  console.log("=========================================\n");

  const provider = new JsonRpcProvider(RPC_URL);
  const block = await provider.getBlock("latest");
  console.log("Connected to Coston2. Block #" + block.number + "\n");

  // Resolve FtsoV2 address from registry
  const registry = new Contract(REGISTRY_ADDRESS, REGISTRY_ABI, provider);
  const ftsoAddress = await registry.getContractAddressByName("FtsoV2");
  console.log("FtsoV2 contract  :", ftsoAddress);
  console.log("");

  const ftso = new Contract(ftsoAddress, FTSO_ABI, provider);

  // Try each feed
  for (const feed of FEEDS) {
    const feedId = encodeFeedId(feed.category, feed.name);
    process.stdout.write("Checking " + feed.label.padEnd(20) + " (feedId: " + feedId + ") ... ");

    try {
      // Check fee first (this will revert if feed doesn't exist)
      const fee = await ftso.calculateFeeById(feedId);

      // Query price
      const result = await ftso.getFeedById.staticCall(feedId, { value: fee });
      const price = BigInt(result[0]);
      const decimals = Number(result[1]);
      const timestamp = Number(result[2]);

      const scale = 10n ** BigInt(decimals);
      const intPart = price / scale;
      const fracPart = price % scale;
      const age = Math.floor(Date.now() / 1000) - timestamp;

      console.log("OK");
      console.log(
        "  Price  : " + intPart.toString() + "." + fracPart.toString().padStart(decimals, "0") + " USD"
      );
      console.log("  Raw    : " + price.toString() + " (decimals=" + decimals + ")");
      console.log("  Age    : " + age + " seconds " + (age < 120 ? "[FRESH]" : "[STALE]"));
      console.log("  Time   : " + new Date(timestamp * 1000).toISOString());
      console.log("");
    } catch (err) {
      const msg = err.message || String(err);
      if (msg.includes("feed does not exist") || msg.includes("CALL_EXCEPTION")) {
        console.log("NOT AVAILABLE on Coston2 testnet");
      } else {
        console.log("ERROR: " + msg.split("\n")[0]);
      }
    }
  }

  console.log("=========================================");
  console.log(" NOTE: Coston2 is a testnet.");
  console.log(" EUR/USD (forex) feeds may only be live on");
  console.log(" Flare Mainnet (RPC: https://flare-api.flare.network/ext/C/rpc)");
  console.log("=========================================");
}

main().catch((e) => {
  console.error("Fatal error:", e.message);
  process.exit(1);
});
