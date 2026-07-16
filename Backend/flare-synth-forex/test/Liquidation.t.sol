// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console2} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {CollateralVault} from "../src/core/CollateralVault.sol";
import {SyntheticAsset}  from "../src/core/SyntheticAsset.sol";
import {SynthController}  from "../src/core/SynthController.sol";
import {MockPriceOracle}  from "../src/oracle/MockPriceOracle.sol";
import {MockERC20}        from "./mocks/MockERC20.sol";

/// @notice Liquidation tests — trigger, bonus math, healthy position guard, partial repay.
///
/// Setup:
///   EUR/USD = 1.08  (price = 1_080_000, decimals = 6)
///   MIN_CR  = 150%
///   LIQ_BONUS = 10%
///
/// ALICE mints 100e18 fxEUR with exactly 162e18 collateral (150% CR).
/// Price rises to 1.20 → debtValue = 120e18 → CR = 162*10000/120 = 13500 → liquidatable.
///
/// maxRepayable = collat * BASIS * scale / ((BASIS + bonus) * price)
///             = 162e18 * 10000 * 1e6 / (11000 * 1_200_000)
///             = 162e18 * 1e10 / 1.32e10
///             = 122.727...e18  (Math.mulDiv, rounds down)
contract LiquidationTest is Test {
    // ─── price constants ─────────────────────────────────────────────────────
    uint256 internal constant PRICE_MINT  = 1_080_000; // 1.08 USD/EUR
    uint256 internal constant PRICE_DROP  = 1_200_000; // 1.20 USD/EUR (EUR stronger → debt worth more)
    int8    internal constant DEC         = 6;
    uint256 internal constant STALENESS   = 3_600;
    uint256 internal constant MAX_AGE     = 3_600;

    uint256 internal constant MIN_CR_BPS    = 15_000;
    uint256 internal constant LIQ_BONUS_BPS = 1_000;
    uint256 internal constant BASIS_POINTS  = 10_000;

    // ALICE's position
    uint256 internal constant DEBT   = 100e18;
    uint256 internal constant COLLAT = 162e18; // exact 150% at PRICE_MINT

    address internal constant ALICE      = address(0xA11CE);
    address internal constant LIQUIDATOR = address(0xCAFE);

    MockERC20       internal token;
    CollateralVault internal vault;
    SyntheticAsset  internal synth;
    MockPriceOracle internal oracle;
    SynthController internal sc;

    function setUp() public {
        vm.warp(10_000);

        token = new MockERC20("WFLR", "WFLR", 18);
        address[] memory supported = new address[](1);
        supported[0] = address(token);
        vault  = new CollateralVault(supported);
        synth  = new SyntheticAsset(address(this));
        oracle = new MockPriceOracle(PRICE_MINT, DEC, uint64(block.timestamp), STALENESS);
        sc     = new SynthController(
            address(vault), address(synth), address(oracle),
            MIN_CR_BPS, LIQ_BONUS_BPS, MAX_AGE
        );

        vault.setController(address(sc));
        synth.grantRole(synth.MINTER_ROLE(), address(sc));

        // Fund ALICE
        token.mint(ALICE, 100_000e18);
        vm.prank(ALICE);
        token.approve(address(vault), type(uint256).max);
        vm.prank(ALICE);
        IERC20(address(synth)).approve(address(sc), type(uint256).max);

        // Fund LIQUIDATOR with fxEUR (they need it to repay)
        token.mint(LIQUIDATOR, 100_000e18);
        vm.prank(LIQUIDATOR);
        token.approve(address(vault), type(uint256).max);
        vm.prank(LIQUIDATOR);
        IERC20(address(synth)).approve(address(sc), type(uint256).max);

        // ALICE opens position at 150%
        vm.prank(ALICE);
        vault.deposit(address(token), COLLAT);
        vm.prank(ALICE);
        sc.mint(DEBT);

        // Transfer ALICE's fxEUR to LIQUIDATOR so they can repay
        vm.prank(ALICE);
        IERC20(address(synth)).transfer(LIQUIDATOR, DEBT);

        // Price rises to 1.20 → ALICE's position becomes under-collateralised
        oracle.setCurrentPrice(PRICE_DROP, DEC);
    }

    // ─── liquidation triggers ─────────────────────────────────────────────────

    function testLiquidate_happyPath() public {
        uint256 toRepay = 50e18;

        uint256 liqTokenBefore = token.balanceOf(LIQUIDATOR);

        vm.prank(LIQUIDATOR);
        sc.liquidate(ALICE, toRepay);

        // Debt reduced
        assertEq(sc.debtPositions(ALICE), DEBT - toRepay);
        // LIQUIDATOR's fxEUR balance reduced
        assertEq(synth.balanceOf(LIQUIDATOR), DEBT - toRepay);
        // LIQUIDATOR received collateral
        assertGt(token.balanceOf(LIQUIDATOR), liqTokenBefore);
    }

    function testLiquidate_bonusMath() public {
        uint256 toRepay = 50e18;

        // debtValueUsd18 = 50e18 * 1_200_000 / 1e6 = 60e18
        // collateralToSeize = 60e18 * 11000 / 10000 = 66e18
        uint256 expectedSeized = 66e18;

        uint256 liqBefore = token.balanceOf(LIQUIDATOR);
        vm.prank(LIQUIDATOR);
        sc.liquidate(ALICE, toRepay);

        uint256 received = token.balanceOf(LIQUIDATOR) - liqBefore;
        assertEq(received, expectedSeized);
    }

    function testLiquidate_cannotLiquidateHealthyPosition() public {
        // Reset price to 1.08 → ALICE is at exactly 150% (healthy)
        oracle.setCurrentPrice(PRICE_MINT, DEC);

        vm.prank(LIQUIDATOR);
        vm.expectRevert(); // PositionHealthy
        sc.liquidate(ALICE, 10e18);
    }

    function testLiquidate_zeroRepayReverts() public {
        vm.prank(LIQUIDATOR);
        vm.expectRevert(SynthController.ZeroAmount.selector);
        sc.liquidate(ALICE, 0);
    }

    function testLiquidate_cannotRepayMoreThanMaxRepayable() public {
        // maxRepayable ≈ 122.727e18 at current state
        // Trying to repay 130e18 should revert
        vm.prank(LIQUIDATOR);
        vm.expectRevert(); // ExcessiveLiquidationRepayment
        sc.liquidate(ALICE, 130e18);
    }

    function testLiquidate_cannotRepayMoreThanDebt() public {
        vm.prank(LIQUIDATOR);
        vm.expectRevert(); // InsufficientDebt
        sc.liquidate(ALICE, DEBT + 1);
    }

    function testLiquidate_collateralTransferredToLiquidator() public {
        uint256 toRepay = 50e18;
        uint256 aliceCollatBefore = vault.getCollateralBalance(ALICE, address(token));

        vm.prank(LIQUIDATOR);
        sc.liquidate(ALICE, toRepay);

        uint256 aliceCollatAfter = vault.getCollateralBalance(ALICE, address(token));
        assertLt(aliceCollatAfter, aliceCollatBefore);
    }

    function testLiquidate_debtBurned() public {
        uint256 supplyBefore = synth.totalSupply();
        vm.prank(LIQUIDATOR);
        sc.liquidate(ALICE, 50e18);
        assertEq(synth.totalSupply(), supplyBefore - 50e18);
    }

    function testLiquidate_emitsEvent() public {
        vm.prank(LIQUIDATOR);
        vm.expectEmit(true, true, false, false, address(sc));
        emit SynthController.PositionLiquidated(LIQUIDATOR, ALICE, 50e18, 0);
        sc.liquidate(ALICE, 50e18);
    }

    function testLiquidate_whenPausedReverts() public {
        sc.pause();
        vm.prank(LIQUIDATOR);
        vm.expectRevert();
        sc.liquidate(ALICE, 10e18);
    }
}
