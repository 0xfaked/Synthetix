// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console2} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {CollateralVault} from "../src/core/CollateralVault.sol";
import {SyntheticAsset}  from "../src/core/SyntheticAsset.sol";
import {SynthController}  from "../src/core/SynthController.sol";
import {MockPriceOracle}  from "../src/oracle/MockPriceOracle.sol";
import {MockERC20}        from "./mocks/MockERC20.sol";

/// @notice SynthController unit tests — mint, burn, withdrawCollateral, oracle math.
///
/// Price constants:
///   EUR/USD = 1.08  →  price = 1_080_000, decimals = 6, scale = 1e6
///
/// Collateral ratio formula:
///   debtValueUsd18  = debtAmount * price / scale
///   crBps           = collateralValueUsd18 * BASIS_POINTS / debtValueUsd18
///
/// To mint 100e18 fxEUR at 150% CR:
///   debtValueUsd18  = 100e18 * 1_080_000 / 1e6 = 108e18
///   collateral needed = 108e18 * 15000 / 10000 = 162e18   (18-decimal token)
contract SynthControllerTest is Test {
    // ─── price constants ─────────────────────────────────────────────────────
    uint256 internal constant PRICE     = 1_080_000; // 1.08 USD/EUR
    int8    internal constant DEC       = 6;
    uint256 internal constant STALENESS = 3_600;
    uint256 internal constant MAX_AGE   = 3_600;

    // ─── controller params ───────────────────────────────────────────────────
    uint256 internal constant MIN_CR_BPS    = 15_000; // 150%
    uint256 internal constant LIQ_BONUS_BPS = 1_000;  // 10%
    uint256 internal constant BASIS_POINTS  = 10_000;

    // ─── collateral shortcuts ────────────────────────────────────────────────
    /// @dev collateral (18-decimal) required to mint `debt` fxEUR at exactly 150% CR.
    function _collatFor(uint256 debt) internal pure returns (uint256) {
        // collat = debt * price/scale * minCR/BASIS  =  debt * 1.08 * 1.5  =  debt * 1.62
        return (debt * PRICE * MIN_CR_BPS) / (1e6 * BASIS_POINTS);
    }

    address internal constant ALICE = address(0xA11CE);
    address internal constant BOB   = address(0xB0B);

    // ─── state ────────────────────────────────────────────────────────────────
    MockERC20        internal token;
    CollateralVault  internal vault;
    SyntheticAsset   internal synth;
    MockPriceOracle  internal oracle;
    SynthController  internal controller;

    // ─── setup ────────────────────────────────────────────────────────────────
    function setUp() public {
        // Warp so oracle timestamp can equal block.timestamp
        vm.warp(10_000);

        token  = new MockERC20("WFLR", "WFLR", 18);

        address[] memory supported = new address[](1);
        supported[0] = address(token);
        vault  = new CollateralVault(supported);

        synth  = new SyntheticAsset(address(this));

        oracle = new MockPriceOracle(
            PRICE,
            DEC,
            uint64(block.timestamp),
            STALENESS
        );

        controller = new SynthController(
            address(vault),
            address(synth),
            address(oracle),
            MIN_CR_BPS,
            LIQ_BONUS_BPS,
            MAX_AGE
        );

        // Wire up
        vault.setController(address(controller));
        synth.grantRole(synth.MINTER_ROLE(), address(controller));

        // Fund users
        token.mint(ALICE, 100_000e18);
        token.mint(BOB,   100_000e18);

        vm.prank(ALICE);
        token.approve(address(vault), type(uint256).max);

        vm.prank(ALICE);
        IERC20(address(synth)).approve(address(controller), type(uint256).max);

        vm.prank(BOB);
        token.approve(address(vault), type(uint256).max);

        vm.prank(BOB);
        IERC20(address(synth)).approve(address(controller), type(uint256).max);
    }

    // ─── helpers ─────────────────────────────────────────────────────────────
    function _deposit(address user, uint256 amount) internal {
        vm.prank(user);
        vault.deposit(address(token), amount);
    }

    function _mint(address user, uint256 debt) internal {
        vm.prank(user);
        controller.mint(debt);
    }

    // ─── mint ─────────────────────────────────────────────────────────────────

    function testMint_happyPath() public {
        uint256 debt   = 100e18;
        uint256 collat = _collatFor(debt); // exactly 150%
        _deposit(ALICE, collat);

        _mint(ALICE, debt);

        assertEq(synth.balanceOf(ALICE), debt);
        assertEq(controller.debtPositions(ALICE), debt);
    }

    function testMint_zeroAmountReverts() public {
        _deposit(ALICE, 200e18);
        vm.prank(ALICE);
        vm.expectRevert(SynthController.ZeroAmount.selector);
        controller.mint(0);
    }

    function testMint_noCollateralReverts() public {
        vm.prank(ALICE);
        vm.expectRevert(); // InsufficientCollateralization
        controller.mint(1e18);
    }

    function testMint_undercollateralizedReverts() public {
        uint256 debt   = 100e18;
        uint256 collat = _collatFor(debt) - 1; // 1 wei below threshold
        _deposit(ALICE, collat);

        vm.prank(ALICE);
        vm.expectRevert(); // InsufficientCollateralization
        controller.mint(debt);
    }

    function testMint_accumulatesDebt() public {
        uint256 collat = _collatFor(200e18);
        _deposit(ALICE, collat);

        _mint(ALICE, 100e18);
        _mint(ALICE, 100e18);

        assertEq(controller.debtPositions(ALICE), 200e18);
        assertEq(synth.balanceOf(ALICE), 200e18);
    }

    function testMint_separateUsers() public {
        _deposit(ALICE, _collatFor(100e18));
        _deposit(BOB,   _collatFor(50e18));

        _mint(ALICE, 100e18);
        _mint(BOB,   50e18);

        assertEq(controller.debtPositions(ALICE), 100e18);
        assertEq(controller.debtPositions(BOB),   50e18);
    }

    // ─── burn ─────────────────────────────────────────────────────────────────

    function testBurn_happyPath() public {
        uint256 debt = 100e18;
        _deposit(ALICE, _collatFor(debt));
        _mint(ALICE, debt);

        vm.prank(ALICE);
        controller.burn(debt);

        assertEq(synth.balanceOf(ALICE), 0);
        assertEq(controller.debtPositions(ALICE), 0);
    }

    function testBurn_partial() public {
        uint256 debt = 100e18;
        _deposit(ALICE, _collatFor(debt));
        _mint(ALICE, debt);

        vm.prank(ALICE);
        controller.burn(60e18);

        assertEq(controller.debtPositions(ALICE), 40e18);
        assertEq(synth.totalSupply(), 40e18);
    }

    function testBurn_zeroReverts() public {
        vm.prank(ALICE);
        vm.expectRevert(SynthController.ZeroAmount.selector);
        controller.burn(0);
    }

    function testBurn_moreThanDebtReverts() public {
        uint256 debt = 50e18;
        _deposit(ALICE, _collatFor(debt));
        _mint(ALICE, debt);

        vm.prank(ALICE);
        vm.expectRevert(); // InsufficientDebt
        controller.burn(51e18);
    }

    // ─── withdrawCollateral ───────────────────────────────────────────────────

    function testWithdraw_afterFullBurn() public {
        uint256 collat = _collatFor(100e18);
        _deposit(ALICE, collat);
        _mint(ALICE, 100e18);

        vm.prank(ALICE);
        controller.burn(100e18);

        uint256 balBefore = token.balanceOf(ALICE);

        vm.prank(ALICE);
        controller.withdrawCollateral(address(token), collat);

        assertEq(token.balanceOf(ALICE), balBefore + collat);
        assertEq(vault.getCollateralBalance(ALICE, address(token)), 0);
    }

    function testWithdraw_partialWhenOvercollateralized() public {
        // Deposit 2x needed collateral, mint, then withdraw the surplus
        uint256 debt      = 100e18;
        uint256 minCollat = _collatFor(debt);
        _deposit(ALICE, minCollat * 2);
        _mint(ALICE, debt);

        // Should be able to withdraw half (still above 150%)
        vm.prank(ALICE);
        controller.withdrawCollateral(address(token), minCollat);

        assertEq(vault.getCollateralBalance(ALICE, address(token)), minCollat);
    }

    function testWithdraw_breaksCRReverts() public {
        uint256 debt   = 100e18;
        uint256 collat = _collatFor(debt); // exactly 150%
        _deposit(ALICE, collat);
        _mint(ALICE, debt);

        // Any withdrawal would drop below 150%
        vm.prank(ALICE);
        vm.expectRevert(); // InsufficientCollateralization or InsufficientCollateralValue
        controller.withdrawCollateral(address(token), 1e18);
    }

    function testWithdraw_moreCollateralThanExistsReverts() public {
        _deposit(ALICE, 100e18);

        vm.prank(ALICE);
        vm.expectRevert(); // InsufficientCollateralValue
        controller.withdrawCollateral(address(token), 200e18);
    }

    function testWithdraw_zeroAmountReverts() public {
        _deposit(ALICE, 100e18);
        vm.prank(ALICE);
        vm.expectRevert(SynthController.ZeroAmount.selector);
        controller.withdrawCollateral(address(token), 0);
    }

    // ─── collateral ratio at various prices ───────────────────────────────────

    function testCollateralRatio_atExactThreshold() public {
        uint256 debt   = 100e18;
        uint256 collat = _collatFor(debt); // 162e18 = exactly 150%
        _deposit(ALICE, collat);
        _mint(ALICE, debt);

        uint256 ratio = controller.getCollateralRatio(ALICE);
        assertEq(ratio, MIN_CR_BPS);
    }

    function testCollateralRatio_200Percent() public {
        uint256 debt   = 100e18;
        // 108e18 * 2 = 216e18 collateral → 200%
        _deposit(ALICE, 216e18);
        _mint(ALICE, debt);

        uint256 ratio = controller.getCollateralRatio(ALICE);
        assertEq(ratio, 20_000); // 200%
    }

    function testCollateralRatio_withPriceIncrease() public {
        // Mint at 1.08, then price rises to 1.50 → CR should fall
        _deposit(ALICE, _collatFor(100e18));
        _mint(ALICE, 100e18);

        // Price → 1.50 USD/EUR
        oracle.setCurrentPrice(1_500_000, 6);

        // debtValue = 100e18 * 1_500_000 / 1e6 = 150e18
        // CR = 162e18 * 10000 / 150e18 = 10800 (108%)
        uint256 ratio = controller.getCollateralRatio(ALICE);
        assertEq(ratio, 10_800);
    }

    function testCollateralRatio_withPriceDecrease() public {
        _deposit(ALICE, _collatFor(100e18));
        _mint(ALICE, 100e18);

        // Price → 0.90 USD/EUR (EUR weakens)
        oracle.setCurrentPrice(900_000, 6);

        // debtValue = 100e18 * 900_000 / 1e6 = 90e18
        // CR = 162e18 * 10000 / 90e18 = 18000 (180%)
        uint256 ratio = controller.getCollateralRatio(ALICE);
        assertEq(ratio, 18_000);
    }

    function testCollateralRatio_noDebtIsMaxUint() public view {
        uint256 ratio = controller.getCollateralRatio(ALICE);
        assertEq(ratio, type(uint256).max);
    }

    // ─── admin functions ──────────────────────────────────────────────────────

    function testSetOracle_onlyOwner() public {
        vm.prank(ALICE);
        vm.expectRevert();
        controller.setPriceOracle(address(oracle));
    }

    function testSetMinCR_onlyOwner() public {
        vm.prank(ALICE);
        vm.expectRevert();
        controller.setMinimumCollateralRatioBps(15_000);
    }

    function testSetMinCR_belowBasisReverts() public {
        vm.expectRevert();
        controller.setMinimumCollateralRatioBps(9_999);
    }

    function testSetLiqBonus_aboveBasisReverts() public {
        vm.expectRevert();
        controller.setLiquidationBonusBps(10_000);
    }

    function testSetMaxPriceAge_zeroReverts() public {
        vm.expectRevert();
        controller.setMaxPriceAge(0);
    }
}
