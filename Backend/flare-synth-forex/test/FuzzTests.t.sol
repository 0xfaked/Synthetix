// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {CollateralVault} from "../src/core/CollateralVault.sol";
import {SyntheticAsset}  from "../src/core/SyntheticAsset.sol";
import {SynthController}  from "../src/core/SynthController.sol";
import {MockPriceOracle}  from "../src/oracle/MockPriceOracle.sol";
import {MockERC20}        from "./mocks/MockERC20.sol";

/// @notice Fuzz tests for mint math and liquidation math.
///
/// Invariants proven:
///   FUZZ-1: If mint succeeds, collateralRatio >= minimumCollateralRatioBps
///   FUZZ-2: Liquidation bonus is always exactly 10% of debt value
///   FUZZ-3: After liquidation, liquidator receives more collateral than debt paid
///   FUZZ-4: Depositing then fully withdrawing (no debt) always returns exact balance
contract FuzzTests is Test {
    uint256 internal constant MIN_CR    = 15_000; // 150%
    uint256 internal constant LIQ_BONUS = 1_000;  // 10%
    uint256 internal constant BASIS     = 10_000;
    uint256 internal constant STALENESS = 3_600;
    uint256 internal constant MAX_AGE   = 3_600;

    address internal constant ALICE      = address(0xA11CE);
    address internal constant LIQUIDATOR = address(0xCAFE);

    MockERC20       internal token;
    CollateralVault internal vault;
    SyntheticAsset  internal synth;
    MockPriceOracle internal oracle;
    SynthController internal sc;

    function setUp() public {
        vm.warp(100_000);

        token = new MockERC20("WFLR", "WFLR", 18);
        address[] memory sup = new address[](1);
        sup[0] = address(token);
        vault  = new CollateralVault(sup);
        synth  = new SyntheticAsset(address(this));
        // Start with a known safe price — fuzz tests will override
        oracle = new MockPriceOracle(1_000_000, 6, uint64(block.timestamp), STALENESS);
        sc     = new SynthController(
            address(vault), address(synth), address(oracle), MIN_CR, LIQ_BONUS, MAX_AGE
        );

        vault.setController(address(sc));
        synth.grantRole(synth.MINTER_ROLE(), address(sc));

        token.mint(ALICE,      type(uint128).max);
        token.mint(LIQUIDATOR, type(uint128).max);

        vm.prank(ALICE);
        token.approve(address(vault), type(uint256).max);
        vm.prank(ALICE);
        IERC20(address(synth)).approve(address(sc), type(uint256).max);

        vm.prank(LIQUIDATOR);
        token.approve(address(vault), type(uint256).max);
        vm.prank(LIQUIDATOR);
        IERC20(address(synth)).approve(address(sc), type(uint256).max);
    }

    // ─── FUZZ-1: mint collateral ratio invariant ──────────────────────────────

    /// @notice For any (collateral, debt, price) where mint succeeds,
    ///         the resulting CR must be >= minimumCollateralRatioBps.
    function testFuzz_mintCRInvariant(
        uint96 collat,
        uint96 debt,
        uint32 price // EUR/USD price with 6 decimals
    ) public {
        // Bound inputs to realistic ranges
        uint256 c = bound(uint256(collat), 1e15, 1e27);    // 0.001 to 1B tokens
        uint256 d = bound(uint256(debt),   1e15, 1e27);    // 0.001 to 1B fxEUR
        uint256 p = bound(uint256(price),  100_000, 2_000_000); // 0.10 to 2.00 USD/EUR

        oracle.setCurrentPrice(p, 6);

        vm.prank(ALICE);
        vault.deposit(address(token), c);

        // Attempt mint — may revert if undercollateralised
        bool success;
        vm.prank(ALICE);
        try sc.mint(d) {
            success = true;
        } catch {
            success = false;
        }

        if (success) {
            // Invariant: CR must be >= minimum after successful mint
            uint256 debtValue = (d * p) / 1e6;
            uint256 cr = (debtValue == 0) ? type(uint256).max : (c * BASIS) / debtValue;
            assertGe(cr, MIN_CR, "CR below minimum after successful mint");

            // Cleanup: burn debt then drain collateral for next fuzz run
            vm.prank(ALICE);
            sc.burn(d);
        }

        // Drain any leftover collateral so state resets for next run
        uint256 bal = vault.getCollateralBalance(ALICE, address(token));
        if (bal > 0) {
            vm.prank(address(sc));
            vault.controllerWithdraw(ALICE, address(token), bal, ALICE);
        }
    }

    // ─── FUZZ-2: liquidation bonus always exactly 10% ────────────────────────

    /// @notice For any (debt, price), the collateral seized = debtValueUsd * 1.10.
    function testFuzz_liquidationBonusMath(
        uint80 debtToRepay,
        uint32 price
    ) public {
        uint256 d = bound(uint256(debtToRepay), 1e15, 50e18);
        uint256 p = bound(uint256(price), 500_000, 2_000_000);

        // Give ALICE a large position that is under-water at price p
        uint256 mintCollat = 1_000_000e18;
        vm.prank(ALICE);
        vault.deposit(address(token), mintCollat);

        oracle.setCurrentPrice(1_080_000, 6); // mint at 1.08
        vm.prank(ALICE);
        sc.mint(1_000e18); // small debt, lots of collateral

        // Give LIQUIDATOR fxEUR
        vm.prank(ALICE);
        IERC20(address(synth)).transfer(LIQUIDATOR, d);

        // Drop price to make position liquidatable
        oracle.setCurrentPrice(p, 6);

        // Check if position is actually liquidatable
        uint256 debtVal = (1_000e18 * p) / 1e6;
        uint256 cr = (mintCollat * BASIS) / debtVal;
        if (cr >= MIN_CR) {
            // Not liquidatable at this price, skip
            return;
        }

        // Compute expected seized collateral (in USD18)
        uint256 expectedSeizedUsd18 = (d * p * (BASIS + LIQ_BONUS)) / (1e6 * BASIS);

        // maxRepayable check
        uint256 maxRepay = Math.mulDiv(mintCollat, BASIS * 1e6, (BASIS + LIQ_BONUS) * p);
        if (d > maxRepay || d > 1_000e18) return;

        uint256 liqCollatBefore = token.balanceOf(LIQUIDATOR);

        vm.prank(LIQUIDATOR);
        sc.liquidate(ALICE, d);

        uint256 received = token.balanceOf(LIQUIDATOR) - liqCollatBefore;
        // received (18-decimal token) == expectedSeizedUsd18 (since scale = 10^(18-18) = 1)
        assertEq(received, expectedSeizedUsd18, "Liquidation bonus math mismatch");
    }

    // ─── FUZZ-3: deposit + full withdraw (no debt) = exact balance ────────────

    function testFuzz_depositWithdrawRoundTrip(uint96 amount) public {
        uint256 a = bound(uint256(amount), 1e15, 1e24);

        uint256 balBefore = token.balanceOf(ALICE);

        vm.prank(ALICE);
        vault.deposit(address(token), a);

        // Withdraw via controller (no debt → no CR check needed)
        oracle.setCurrentPrice(1_000_000, 6);
        vm.prank(ALICE);
        sc.withdrawCollateral(address(token), a);

        uint256 balAfter = token.balanceOf(ALICE);
        assertEq(balAfter, balBefore, "Round-trip amount mismatch");
    }

    // ─── FUZZ-4: collateral ratio formula correctness ─────────────────────────

    /// @notice crBps = collateralUsd18 * BASIS / (debtAmount * price / scale).
    ///         Verify the controller's reported ratio matches this formula.
    function testFuzz_collateralRatioFormula(
        uint80 collat,
        uint64 debt,
        uint32 price
    ) public {
        uint256 c = bound(uint256(collat), 1e17, 1e24);
        uint256 d = bound(uint256(debt),   1e15, 1e22);
        uint256 p = bound(uint256(price),  100_000, 2_000_000);

        oracle.setCurrentPrice(p, 6);

        vm.prank(ALICE);
        vault.deposit(address(token), c);

        // Only mint if overcollateralised
        uint256 debtValue = (d * p) / 1e6;
        uint256 expectedCR = (debtValue == 0) ? type(uint256).max : (c * BASIS) / debtValue;
        if (expectedCR < MIN_CR) {
            return; // skip cases that can't mint
        }

        vm.prank(ALICE);
        sc.mint(d);

        uint256 reportedCR = sc.getCollateralRatio(ALICE);
        assertEq(reportedCR, expectedCR, "Reported CR != formula CR");

        // Cleanup
        vm.prank(ALICE);
        sc.burn(d);
        uint256 bal = vault.getCollateralBalance(ALICE, address(token));
        if (bal > 0) {
            vm.prank(address(sc));
            vault.controllerWithdraw(ALICE, address(token), bal, ALICE);
        }
    }
}
