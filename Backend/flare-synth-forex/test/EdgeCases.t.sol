// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {CollateralVault} from "../src/core/CollateralVault.sol";
import {SyntheticAsset}  from "../src/core/SyntheticAsset.sol";
import {SynthController}  from "../src/core/SynthController.sol";
import {MockPriceOracle}  from "../src/oracle/MockPriceOracle.sol";
import {MockERC20}        from "./mocks/MockERC20.sol";

/// @notice Edge-case test file:
///   1. Zero collateral → mint reverts
///   2. Exact threshold boundary (just below fails, exact passes)
///   3. Paused contract — mint/burn/withdraw/liquidate all revert
///   4. Stale oracle price reverts
///   5. Future oracle timestamp reverts
contract EdgeCasesTest is Test {
    uint256 internal constant PRICE     = 1_080_000;
    int8    internal constant DEC       = 6;
    uint256 internal constant STALENESS = 3_600;
    uint256 internal constant MAX_AGE   = 3_600;
    uint256 internal constant MIN_CR    = 15_000;
    uint256 internal constant LIQ_BONUS = 1_000;
    uint256 internal constant BASIS     = 10_000;

    address internal constant ALICE = address(0xA11CE);
    address internal constant BOB   = address(0xB0B);

    MockERC20       internal token;
    CollateralVault internal vault;
    SyntheticAsset  internal synth;
    MockPriceOracle internal oracle;
    SynthController internal sc;

    function setUp() public {
        vm.warp(10_000);

        token = new MockERC20("WFLR", "WFLR", 18);
        address[] memory sup = new address[](1);
        sup[0] = address(token);
        vault  = new CollateralVault(sup);
        synth  = new SyntheticAsset(address(this));
        oracle = new MockPriceOracle(PRICE, DEC, uint64(block.timestamp), STALENESS);
        sc     = new SynthController(
            address(vault), address(synth), address(oracle), MIN_CR, LIQ_BONUS, MAX_AGE
        );

        vault.setController(address(sc));
        synth.grantRole(synth.MINTER_ROLE(), address(sc));

        token.mint(ALICE, 1_000_000e18);
        token.mint(BOB,   1_000_000e18);

        vm.prank(ALICE);
        token.approve(address(vault), type(uint256).max);
        vm.prank(ALICE);
        IERC20(address(synth)).approve(address(sc), type(uint256).max);

        vm.prank(BOB);
        token.approve(address(vault), type(uint256).max);
        vm.prank(BOB);
        IERC20(address(synth)).approve(address(sc), type(uint256).max);
    }

    // ─── 1. Zero collateral ───────────────────────────────────────────────────

    function testEdge_zeroCollateral_mintReverts() public {
        // ALICE has zero collateral deposited
        vm.prank(ALICE);
        vm.expectRevert(); // InsufficientCollateralization
        sc.mint(1e18);
    }

    // ─── 2. Exact threshold boundary ──────────────────────────────────────────

    /// @dev One wei below minimum collateral → must revert.
    function testEdge_oneBelowThreshold_reverts() public {
        uint256 debt = 100e18;
        // collat = debt * price * minCR / (scale * basis)
        uint256 minCollat = (debt * PRICE * MIN_CR) / (1e6 * BASIS);
        // deposit 1 wei less than minimum
        vm.prank(ALICE);
        vault.deposit(address(token), minCollat - 1);

        vm.prank(ALICE);
        vm.expectRevert(); // InsufficientCollateralization
        sc.mint(debt);
    }

    /// @dev Exactly at minimum collateral → must succeed.
    function testEdge_exactThreshold_succeeds() public {
        uint256 debt = 100e18;
        uint256 minCollat = (debt * PRICE * MIN_CR) / (1e6 * BASIS);

        vm.prank(ALICE);
        vault.deposit(address(token), minCollat);

        vm.prank(ALICE);
        sc.mint(debt); // must not revert

        assertEq(sc.debtPositions(ALICE), debt);
    }

    // ─── 3. Paused state ──────────────────────────────────────────────────────

    function testEdge_pausedMint_reverts() public {
        vm.prank(ALICE);
        vault.deposit(address(token), 500e18);

        sc.pause();

        vm.prank(ALICE);
        vm.expectRevert(); // Pausable: paused
        sc.mint(10e18);
    }

    function testEdge_pausedBurn_reverts() public {
        // Set up position first (unpause not needed, we'll pause after)
        vm.prank(ALICE);
        vault.deposit(address(token), 162e18);
        vm.prank(ALICE);
        sc.mint(100e18);

        sc.pause();

        vm.prank(ALICE);
        vm.expectRevert();
        sc.burn(50e18);
    }

    function testEdge_pausedWithdraw_reverts() public {
        vm.prank(ALICE);
        vault.deposit(address(token), 200e18);
        vm.prank(ALICE);
        sc.mint(100e18);

        sc.pause();

        vm.prank(ALICE);
        vm.expectRevert();
        sc.withdrawCollateral(address(token), 10e18);
    }

    function testEdge_pausedLiquidate_reverts() public {
        vm.prank(ALICE);
        vault.deposit(address(token), 162e18);
        vm.prank(ALICE);
        sc.mint(100e18);

        sc.pause();

        vm.prank(BOB);
        vm.expectRevert();
        sc.liquidate(ALICE, 10e18);
    }

    function testEdge_unpause_restoresMint() public {
        vm.prank(ALICE);
        vault.deposit(address(token), 162e18);

        sc.pause();
        sc.unpause();

        vm.prank(ALICE);
        sc.mint(100e18); // must succeed after unpause
        assertEq(sc.debtPositions(ALICE), 100e18);
    }

    // ─── 4. Stale oracle price ────────────────────────────────────────────────

    function testEdge_stalePriceOnMint_reverts() public {
        // Advance time past staleness window without updating oracle
        vm.warp(block.timestamp + STALENESS + 1);

        vm.prank(ALICE);
        vault.deposit(address(token), 200e18);

        vm.prank(ALICE);
        vm.expectRevert(); // StalePrice or StalePriceData
        sc.mint(100e18);
    }

    function testEdge_stalePriceOnWithdraw_reverts() public {
        // Set up a position
        vm.prank(ALICE);
        vault.deposit(address(token), 162e18);
        vm.prank(ALICE);
        sc.mint(100e18);

        // Advance past staleness
        vm.warp(block.timestamp + STALENESS + 1);

        vm.prank(ALICE);
        vm.expectRevert();
        sc.withdrawCollateral(address(token), 10e18);
    }

    function testEdge_stalePriceOnLiquidate_reverts() public {
        vm.prank(ALICE);
        vault.deposit(address(token), 162e18);
        vm.prank(ALICE);
        sc.mint(100e18);

        // Price rises, making position under-collateralised
        oracle.setCurrentPrice(1_500_000, DEC);

        // Wait past staleness window (oracle not refreshed)
        vm.warp(block.timestamp + STALENESS + 1);

        // Give BOB some fxEUR
        vm.prank(ALICE);
        IERC20(address(synth)).transfer(BOB, 50e18);
        vm.prank(BOB);
        IERC20(address(synth)).approve(address(sc), type(uint256).max);

        vm.prank(BOB);
        vm.expectRevert();
        sc.liquidate(ALICE, 10e18);
    }

    // ─── 5. Future oracle timestamp ───────────────────────────────────────────

    function testEdge_futurePriceTimestamp_reverts() public {
        // MockPriceOracle.setPrice validates timestamp <= block.timestamp,
        // so we can't set a future timestamp directly.
        // But we can test the controller catches it by manipulating time backward.

        // Set oracle at t=10000, then warp backward (simulate scenario)
        // Instead: set oracle at block.timestamp, then verify it works
        // and separately verify the constructor validation
        vm.expectRevert(); // InvalidOracleTimestamp
        new MockPriceOracle(
            PRICE,
            DEC,
            uint64(block.timestamp + 1), // future timestamp
            STALENESS
        );
    }

    // ─── 6. Oracle price = 0 ─────────────────────────────────────────────────

    function testEdge_zeroPriceRevert_inOracle() public {
        vm.expectRevert(); // InvalidOraclePrice
        new MockPriceOracle(0, DEC, uint64(block.timestamp), STALENESS);
    }

    // ─── 7. StalenessThreshold = 0 ───────────────────────────────────────────

    function testEdge_zeroStalenessThreshold_reverts() public {
        vm.expectRevert(); // InvalidStalenessThreshold
        new MockPriceOracle(PRICE, DEC, uint64(block.timestamp), 0);
    }

    function testEdge_setStalenessToZero_reverts() public {
        vm.expectRevert();
        oracle.setStalenessThreshold(0);
    }

    // ─── 8. maxPriceAge = 0 in constructor ───────────────────────────────────

    function testEdge_zeroMaxPriceAge_reverts() public {
        vm.expectRevert();
        new SynthController(
            address(vault), address(synth), address(oracle), MIN_CR, LIQ_BONUS, 0
        );
    }
}
