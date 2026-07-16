// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IPriceOracle {
    function getPrice()
        external
        payable
        returns (uint256 price, int8 decimals, uint64 timestamp);
}
