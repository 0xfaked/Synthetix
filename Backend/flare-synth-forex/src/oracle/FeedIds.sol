// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title FeedIds
/// @notice Shared library for computing and caching FTSOv2 bytes21 feed IDs.
///
/// Feed ID derivation (from Flare official docs):
///   bytes21 = 0x + category(2 hex) + hex(feedName) + zero-pad to 21 bytes
///
/// Categories:
///   0x01 = Crypto
///   0x02 = Forex
///   0x03 = Commodity
///   0x04 = Stock
///   0x21 = Custom
///
/// IMPORTANT: Feed names must match EXACTLY what Flare registers on-chain.
///   Forex convention is BASE/USD, so it is JPY/USD (not USD/JPY).
///
library FeedIds {

    // ── Helper: compute a feed ID from category + name ────────────────────────
    //
    // @param category  1 byte, e.g. 0x01 for Crypto or 0x02 for Forex
    // @param feedName  ASCII feed name, max 20 chars, e.g. "EUR/USD"
    // @return          bytes21 feed ID for use with FtsoV2Interface
    //
    function compute(uint8 category, string memory feedName)
        internal
        pure
        returns (bytes21)
    {
        bytes memory nameBytes = bytes(feedName);
        require(nameBytes.length <= 20, "FeedIds: name too long");

        bytes memory packed = new bytes(21);
        packed[0] = bytes1(category);
        for (uint256 i = 0; i < nameBytes.length; i++) {
            packed[i + 1] = nameBytes[i];
        }
        // Remaining bytes are already 0x00 (zero-padding)

        bytes21 result;
        assembly {
            result := mload(add(packed, 32))
        }
        return result;
    }

    // ── Pre-computed constants (verified against compute() output) ────────────
    //
    // Crypto feeds — live on both Coston2 testnet and Flare Mainnet
    //
    /// compute(0x01, "FLR/USD")
    bytes21 internal constant FLR_USD =
        0x01464c522f55534400000000000000000000000000;

    /// compute(0x01, "BTC/USD")
    bytes21 internal constant BTC_USD =
        0x014254432f55534400000000000000000000000000;

    /// compute(0x01, "ETH/USD")
    bytes21 internal constant ETH_USD =
        0x014554482f55534400000000000000000000000000;

    /// compute(0x01, "XRP/USD")
    bytes21 internal constant XRP_USD =
        0x015852502f55534400000000000000000000000000;

    /// compute(0x01, "SOL/USD")
    bytes21 internal constant SOL_USD =
        0x01534f4c2f55534400000000000000000000000000;

    //
    // Forex feeds — planned on Coston2 / live on Flare Mainnet
    // NOTE: Flare uses BASE/USD convention: JPY/USD, not USD/JPY
    //
    /// compute(0x02, "EUR/USD")
    bytes21 internal constant EUR_USD =
        0x024555522f55534400000000000000000000000000;

    /// compute(0x02, "GBP/USD")
    bytes21 internal constant GBP_USD =
        0x024742502f55534400000000000000000000000000;

    /// compute(0x02, "JPY/USD")
    bytes21 internal constant JPY_USD =
        0x024a50592f55534400000000000000000000000000;

    /// compute(0x02, "AUD/USD")
    bytes21 internal constant AUD_USD =
        0x024155442f55534400000000000000000000000000;

    // ── Self-verification (call in tests or deployment scripts) ───────────────
    //
    // Reverts if any constant diverges from the compute() function.
    // Call this once during deployment / test setup to catch any typo.
    //
    function verifySelf() internal pure {
        require(compute(0x01, "FLR/USD") == FLR_USD, "FeedIds: FLR_USD mismatch");
        require(compute(0x01, "BTC/USD") == BTC_USD, "FeedIds: BTC_USD mismatch");
        require(compute(0x01, "ETH/USD") == ETH_USD, "FeedIds: ETH_USD mismatch");
        require(compute(0x01, "XRP/USD") == XRP_USD, "FeedIds: XRP_USD mismatch");
        require(compute(0x01, "SOL/USD") == SOL_USD, "FeedIds: SOL_USD mismatch");
        require(compute(0x02, "EUR/USD") == EUR_USD, "FeedIds: EUR_USD mismatch");
        require(compute(0x02, "GBP/USD") == GBP_USD, "FeedIds: GBP_USD mismatch");
        require(compute(0x02, "JPY/USD") == JPY_USD, "FeedIds: JPY_USD mismatch");
        require(compute(0x02, "AUD/USD") == AUD_USD, "FeedIds: AUD_USD mismatch");
    }
}
