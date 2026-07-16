// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {IPriceOracle} from "./IPriceOracle.sol";

contract MockPriceOracle is IPriceOracle, Ownable {
    using Address for address payable;

    uint256 public stalenessThreshold;
    uint256 private latestPrice;
    int8 private latestDecimals;
    uint64 private latestTimestamp;

    error InvalidOraclePrice(uint256 price);
    error InvalidOracleTimestamp(uint64 timestamp, uint256 currentTimestamp);
    error StalePrice(uint64 timestamp, uint256 currentTimestamp, uint256 threshold);
    error InvalidStalenessThreshold();
    error InvalidRecipient();

    event MockPriceUpdated(uint256 price, int8 decimals, uint64 timestamp);
    event StalenessThresholdUpdated(uint256 previousThreshold, uint256 newThreshold);
    event NativeRecovered(address indexed recipient, uint256 amount);

    constructor(
        uint256 initialPrice,
        int8 initialDecimals,
        uint64 initialTimestamp,
        uint256 initialStalenessThreshold
    ) Ownable(msg.sender) {
        if (initialPrice == 0) {
            revert InvalidOraclePrice(initialPrice);
        }
        if (
            initialTimestamp == 0 ||
            uint256(initialTimestamp) > block.timestamp
        ) {
            revert InvalidOracleTimestamp(initialTimestamp, block.timestamp);
        }
        // M5: zero threshold disables staleness protection entirely
        if (initialStalenessThreshold == 0) revert InvalidStalenessThreshold();
        latestPrice = initialPrice;
        latestDecimals = initialDecimals;
        latestTimestamp = initialTimestamp;
        stalenessThreshold = initialStalenessThreshold;
    }

    function setPrice(
        uint256 newPrice,
        int8 newDecimals,
        uint64 newTimestamp
    ) external onlyOwner {
        if (newPrice == 0) {
            revert InvalidOraclePrice(newPrice);
        }
        if (newTimestamp == 0 || uint256(newTimestamp) > block.timestamp) {
            revert InvalidOracleTimestamp(newTimestamp, block.timestamp);
        }

        latestPrice = newPrice;
        latestDecimals = newDecimals;
        latestTimestamp = newTimestamp;

        emit MockPriceUpdated(newPrice, newDecimals, newTimestamp);
    }

    function setCurrentPrice(uint256 newPrice, int8 newDecimals) external onlyOwner {
        if (newPrice == 0) {
            revert InvalidOraclePrice(newPrice);
        }

        latestPrice = newPrice;
        latestDecimals = newDecimals;
        latestTimestamp = uint64(block.timestamp);

        emit MockPriceUpdated(newPrice, newDecimals, latestTimestamp);
    }

    function setStalenessThreshold(uint256 newThreshold) external onlyOwner {
        // M5: zero threshold disables staleness protection entirely
        if (newThreshold == 0) revert InvalidStalenessThreshold();
        emit StalenessThresholdUpdated(stalenessThreshold, newThreshold);
        stalenessThreshold = newThreshold;
    }

    function getPrice()
        external
        payable
        override
        returns (uint256 price, int8 decimals, uint64 timestamp)
    {
        price = latestPrice;
        decimals = latestDecimals;
        timestamp = latestTimestamp;

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

    function recoverNative(address payable recipient) external onlyOwner {
        // L5: zero-address guard
        if (recipient == address(0)) revert InvalidRecipient();
        uint256 balance = address(this).balance;
        if (balance != 0) {
            recipient.sendValue(balance);
            emit NativeRecovered(recipient, balance);
        }
    }
}
