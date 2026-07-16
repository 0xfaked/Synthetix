// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Script, console2} from "forge-std/Script.sol";
import {FtsoV2Interface} from "@flarenetwork/flare-periphery-contracts/coston2/FtsoV2Interface.sol";

interface IFlareContractRegistryLite {
    function getContractAddressByName(string calldata name) external view returns (address);
}

/// @title VerifyFeeds
/// @notice Read-only Foundry script that queries all supported FTSOv2 feeds on
///         Coston2 — both crypto and forex — and prints their live prices.
///
///         Feed ID derivation (per Flare docs):
///           bytes21 = 0x + category(2 hex) + hex(feedName) + zeroPad to 21 bytes
///           Categories: 01=Crypto  02=Forex  03=Commodity  04=Stock  21=Custom
///
///         NOTE: Forex feeds (EUR/USD, GBP/USD, JPY/USD) may not yet be deployed
///               on Coston2. If they revert with "feed does not exist", use mainnet
///               RPC: https://flare-api.flare.network/ext/C/rpc
///
/// Run (Coston2 testnet):
///   forge script script/VerifyFeed.s.sol \
///     --rpc-url https://coston2-api.flare.network/ext/C/rpc \
///     -vvvv
///
/// Run (Flare Mainnet - forex feeds live):
///   forge script script/VerifyFeed.s.sol \
///     --rpc-url https://flare-api.flare.network/ext/C/rpc \
///     -vvvv
contract VerifyFeed is Script {

    // Flare Contract Registry - same address on both Coston2 and Mainnet
    address internal constant FLARE_REGISTRY =
        0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019;

    // Staleness threshold for FRESH/STALE classification
    uint256 internal constant MAX_AGE_SECS = 120;

    // ── Feed ID Helper ────────────────────────────────────────────────────────
    //
    // Replicates Flare's documented getFeedId logic in Solidity:
    //   bytes21 = 0x + category(2 hex) + hex(feedName) + zeroPad to 21 bytes
    //
    // @param category  1 byte: 0x01=Crypto, 0x02=Forex, 0x03=Commodity, 0x04=Stock
    // @param feedName  ASCII feed name, e.g. "FLR/USD" or "EUR/USD"
    // @return feedId   bytes21 value usable with FtsoV2Interface.getFeedById()
    //
    function computeFeedId(uint8 category, string memory feedName)
        internal
        pure
        returns (bytes21)
    {
        bytes memory nameBytes = bytes(feedName);
        require(nameBytes.length <= 20, "Feed name too long for bytes21");

        bytes memory packed = new bytes(21);
        packed[0] = bytes1(category);
        for (uint256 i = 0; i < nameBytes.length; i++) {
            packed[i + 1] = nameBytes[i];
        }
        // Remaining bytes default to 0x00 (zero-padding)

        bytes21 result;
        assembly {
            result := mload(add(packed, 32))
        }
        return result;
    }

    // ── Feed definitions ──────────────────────────────────────────────────────
    struct FeedInfo {
        bytes21 feedId;
        string  label;
    }

    function buildFeeds() internal pure returns (FeedInfo[] memory feeds) {
        feeds = new FeedInfo[](8);

        // -- Crypto feeds (01) - live on Coston2 --
        feeds[0] = FeedInfo(
            0x01464c522f55534400000000000000000000000000,
            "FLR/USD [Crypto]"
        );
        feeds[1] = FeedInfo(
            0x014254432f55534400000000000000000000000000,
            "BTC/USD [Crypto]"
        );
        feeds[2] = FeedInfo(
            0x014554482f55534400000000000000000000000000,
            "ETH/USD [Crypto]"
        );
        feeds[3] = FeedInfo(
            0x015852502f55534400000000000000000000000000,
            "XRP/USD [Crypto]"
        );

        // -- Forex feeds (02) - planned on Coston2 / live on Mainnet --
        // Feed names MUST match exactly what Flare registers:
        //   EUR/USD, GBP/USD, JPY/USD (note: JPY/USD not USD/JPY)
        //
        // These are computed with computeFeedId(0x02, "EUR/USD") etc.
        // Shown explicitly to make the values verifiable at a glance:
        //   EUR/USD -> 02 4555522f555344 + padding
        feeds[4] = FeedInfo(
            0x024555522f55534400000000000000000000000000,
            "EUR/USD [Forex]"
        );
        //   GBP/USD -> 02 4742502f555344 + padding
        feeds[5] = FeedInfo(
            0x024742502f55534400000000000000000000000000,
            "GBP/USD [Forex]"
        );
        //   JPY/USD -> 02 4a50592f555344 + padding
        feeds[6] = FeedInfo(
            0x024a50592f55534400000000000000000000000000,
            "JPY/USD [Forex]"
        );
        //   AUD/USD -> 02 4155442f555344 + padding (bonus)
        feeds[7] = FeedInfo(
            0x024155442f55534400000000000000000000000000,
            "AUD/USD [Forex]"
        );
    }

    // ── Verification that computeFeedId matches hardcoded values ─────────────
    function verifyFeedIdHelper() internal pure {
        // Spot-check that computeFeedId() produces the same IDs as the
        // hardcoded values above (acts as an on-chain unit test).
        bytes21 eur = computeFeedId(0x02, "EUR/USD");
        require(
            eur == bytes21(0x024555522f55534400000000000000000000000000),
            "computeFeedId: EUR/USD mismatch"
        );
        bytes21 flr = computeFeedId(0x01, "FLR/USD");
        require(
            flr == bytes21(0x01464c522f55534400000000000000000000000000),
            "computeFeedId: FLR/USD mismatch"
        );
    }

    // ── Main run() ────────────────────────────────────────────────────────────
    function run() external {
        console2.log("======================================================================");
        console2.log(" Flare FTSOv2 - Crypto + Forex Feed Verification");
        console2.log("======================================================================");
        console2.log("");

        // Verify computeFeedId() helper is correct before using it
        verifyFeedIdHelper();
        console2.log("[OK] computeFeedId() helper verified against known IDs");
        console2.log("");

        // Resolve FtsoV2 from registry (works on both Coston2 and Mainnet)
        address ftsoAddr = IFlareContractRegistryLite(FLARE_REGISTRY)
            .getContractAddressByName("FtsoV2");
        FtsoV2Interface ftso = FtsoV2Interface(ftsoAddr);
        console2.log("FtsoV2 address :", ftsoAddr);
        console2.log("");

        // Print feed ID table
        console2.log("Feed ID Table (category + hex(name) + zero-pad to 21 bytes):");
        console2.log("----------------------------------------------------------------------");

        FeedInfo[] memory feeds = buildFeeds();

        // Also show computed IDs for the forex feeds using the helper
        bytes21 eurId = computeFeedId(0x02, "EUR/USD");
        bytes21 gbpId = computeFeedId(0x02, "GBP/USD");
        bytes21 jpyId = computeFeedId(0x02, "JPY/USD");
        console2.log("EUR/USD computed feed ID :", uint168(bytes21(eurId)));
        console2.log("GBP/USD computed feed ID :", uint168(bytes21(gbpId)));
        console2.log("JPY/USD computed feed ID :", uint168(bytes21(jpyId)));
        console2.log("");

        // Query each feed
        console2.log("----------------------------------------------------------------------");
        console2.log(" Feed               Price (raw)   Decimals  Age(s)  Status");
        console2.log("----------------------------------------------------------------------");

        uint256 nowTs = block.timestamp;
        uint256 liveCount = 0;
        uint256 skipCount = 0;

        for (uint256 i = 0; i < feeds.length; i++) {
            FeedInfo memory f = feeds[i];

            // Get required fee for this feed (0 for most, non-zero for some)
            uint256 fee = 0;
            try ftso.calculateFeeById(f.feedId) returns (uint256 _fee) {
                fee = _fee;
            } catch {
                // Feed not found on this network
                console2.log(f.label, ": NOT YET LIVE on this network");
                skipCount++;
                continue;
            }

            // Query the price
            try ftso.getFeedById{value: fee}(f.feedId) returns (
                uint256 price,
                int8    decimals,
                uint64  timestamp
            ) {
                uint256 age = nowTs > uint256(timestamp)
                    ? nowTs - uint256(timestamp)
                    : 0;
                string memory freshness = age <= MAX_AGE_SECS ? "FRESH" : "STALE";

                // Human-readable display (integer + decimal part)
                if (decimals >= 0 && uint8(decimals) <= 18) {
                    uint256 scale     = 10 ** uint256(int256(decimals));
                    uint256 intPart   = price / scale;
                    uint256 fracPart  = price % scale;
                    console2.log(
                        f.label,
                        ": raw=", price,
                        " => ", intPart, ".", fracPart,
                        " USD  age=", age, "s  status=", freshness
                    );
                } else {
                    console2.log(f.label, ": raw=", price, " age=", age, "s");
                }

                liveCount++;
            } catch {
                console2.log(f.label, ": QUERY FAILED (may not be live)");
                skipCount++;
            }
        }

        console2.log("----------------------------------------------------------------------");
        console2.log("Live feeds:", liveCount, " | Skipped (not deployed):", skipCount);
        console2.log("");

        if (skipCount > 0) {
            console2.log("TIP: Forex feeds are planned on Coston2 but currently live only on");
            console2.log("     Flare Mainnet. Re-run with mainnet RPC to see EUR/USD etc:");
            console2.log("     --rpc-url https://flare-api.flare.network/ext/C/rpc");
        }
        console2.log("======================================================================");
    }
}
