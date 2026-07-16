// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ContractRegistry} from "@flarenetwork/flare-periphery-contracts/coston2/ContractRegistry.sol";
import {IPriceOracle} from "./IPriceOracle.sol";
import {FeedIds} from "./FeedIds.sol";

/// @title PriceOracleAdapter
/// @notice Wraps Flare FTSOv2 to expose the EUR/USD price feed to SynthController.
///         Feed IDs are computed using the FeedIds library, which implements the
///         Flare-documented encoding: category byte + hex(name) + zero-pad to 21 bytes.
///
///         Current feed: EUR/USD (Forex, category 0x02)
///           feed ID = FeedIds.EUR_USD = FeedIds.compute(0x02, "EUR/USD")
///                   = 0x024555522f55534400000000000000000000000000
///
///         NOTE: The EUR/USD forex feed is planned for Coston2 testnet and live on
///               Flare Mainnet. Until it is deployed on Coston2, use the mock oracle
///               (MockPriceOracle.sol) for local testing.
///
contract PriceOracleAdapter is IPriceOracle, Ownable {
    using FeedIds for uint8;

    // ── Active feed ───────────────────────────────────────────────────────────
    //
    // EUR/USD feed ID computed by FeedIds.compute(0x02, "EUR/USD").
    // The constant is pre-verified in FeedIds.verifySelf().
    //
    bytes21 public constant EUR_USD_FEED_ID = FeedIds.EUR_USD;

    // Additional forex feeds available for reference / multi-feed extensions:
    //   FeedIds.GBP_USD  →  GBP/USD
    //   FeedIds.JPY_USD  →  JPY/USD  (note: JPY/USD not USD/JPY)
    //   FeedIds.AUD_USD  →  AUD/USD

    // ── Config ────────────────────────────────────────────────────────────────
    uint256 public stalenessThreshold;

    // ── Errors ────────────────────────────────────────────────────────────────
    error InvalidOraclePrice(uint256 price);
    error InvalidOracleTimestamp(uint64 timestamp, uint256 currentTimestamp);
    error StalePrice(uint64 timestamp, uint256 currentTimestamp, uint256 threshold);
    error InvalidStalenessThreshold();

    // ── Events ────────────────────────────────────────────────────────────────
    event StalenessThresholdUpdated(uint256 previousThreshold, uint256 newThreshold);

    // ── Constructor ───────────────────────────────────────────────────────────
    constructor(uint256 initialStalenessThreshold) Ownable(msg.sender) {
        if (initialStalenessThreshold == 0) revert InvalidStalenessThreshold();
        stalenessThreshold = initialStalenessThreshold;

        // Verify that FeedIds constants match the compute() function.
        // This is a one-time deployment-time check — gas is paid only once.
        FeedIds.verifySelf();
    }

    // ── Owner functions ───────────────────────────────────────────────────────
    function setStalenessThreshold(uint256 newThreshold) external onlyOwner {
        if (newThreshold == 0) revert InvalidStalenessThreshold();
        emit StalenessThresholdUpdated(stalenessThreshold, newThreshold);
        stalenessThreshold = newThreshold;
    }

    // ── IPriceOracle ──────────────────────────────────────────────────────────
    /// @notice Returns the current EUR/USD price from FTSOv2.
    /// @return price      Raw price value
    /// @return decimals   Number of decimal places (price = value / 10^decimals)
    /// @return timestamp  Unix timestamp of the price observation
    function getPrice()
        external
        payable
        override
        returns (uint256 price, int8 decimals, uint64 timestamp)
    {
        (price, decimals, timestamp) = ContractRegistry.getFtsoV2().getFeedById{
            value: msg.value
        }(EUR_USD_FEED_ID);

        if (price == 0) {
            revert InvalidOraclePrice(price);
        }
        if (timestamp == 0 || uint256(timestamp) > block.timestamp) {
            revert InvalidOracleTimestamp(timestamp, block.timestamp);
        }
        if (uint256(timestamp) + stalenessThreshold < block.timestamp) {
            revert StalePrice(timestamp, block.timestamp, stalenessThreshold);
        }
    }

    // ── Utility: view multiple feeds at once ──────────────────────────────────
    /// @notice Returns feed IDs for all supported forex pairs.
    ///         Useful for UIs and multi-feed integrations.
    function getForexFeedIds()
        external
        pure
        returns (
            bytes21 eurUsd,
            bytes21 gbpUsd,
            bytes21 jpyUsd,
            bytes21 audUsd
        )
    {
        return (FeedIds.EUR_USD, FeedIds.GBP_USD, FeedIds.JPY_USD, FeedIds.AUD_USD);
    }

    /// @notice Returns feed IDs for all supported crypto pairs.
    function getCryptoFeedIds()
        external
        pure
        returns (
            bytes21 flrUsd,
            bytes21 btcUsd,
            bytes21 ethUsd,
            bytes21 xrpUsd,
            bytes21 solUsd
        )
    {
        return (FeedIds.FLR_USD, FeedIds.BTC_USD, FeedIds.ETH_USD, FeedIds.XRP_USD, FeedIds.SOL_USD);
    }
}
