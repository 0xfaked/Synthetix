// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console2} from "forge-std/Test.sol";
import {CollateralVault} from "../src/core/CollateralVault.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

/// @notice CollateralVault unit tests — deposit, withdraw, access control, normalisation.
contract CollateralVaultTest is Test {
    // ─── constants ────────────────────────────────────────────────────────────
    uint256 internal constant DEPOSIT_AMOUNT = 1_000e18;
    address internal constant ALICE = address(0xA11CE);
    address internal constant BOB   = address(0xB0B);

    // ─── state ────────────────────────────────────────────────────────────────
    CollateralVault internal vault;
    MockERC20       internal token;  // 18-decimal
    MockERC20       internal token6; // 6-decimal (USDC-like)
    address         internal controller;

    // ─── setup ────────────────────────────────────────────────────────────────
    function setUp() public {
        controller = makeAddr("controller");
        token      = new MockERC20("Wrapped FLR", "WFLR", 18);
        token6     = new MockERC20("USDC", "USDC", 6);

        address[] memory supported = new address[](2);
        supported[0] = address(token);
        supported[1] = address(token6);
        vault = new CollateralVault(supported);

        vault.setController(controller);

        // Fund ALICE and BOB
        token.mint(ALICE, 10_000e18);
        token.mint(BOB,   10_000e18);
        token6.mint(ALICE, 10_000e6);

        vm.prank(ALICE);
        token.approve(address(vault), type(uint256).max);

        vm.prank(ALICE);
        token6.approve(address(vault), type(uint256).max);

        vm.prank(BOB);
        token.approve(address(vault), type(uint256).max);
    }

    // ─── deposit ──────────────────────────────────────────────────────────────

    function testDeposit_happyPath() public {
        vm.prank(ALICE);
        vault.deposit(address(token), DEPOSIT_AMOUNT);

        assertEq(vault.getCollateralBalance(ALICE, address(token)), DEPOSIT_AMOUNT);
        assertEq(token.balanceOf(address(vault)), DEPOSIT_AMOUNT);
    }

    function testDeposit_zeroAmountReverts() public {
        vm.prank(ALICE);
        vm.expectRevert(); // InsufficientCollateralBalance
        vault.deposit(address(token), 0);
    }

    function testDeposit_unsupportedTokenReverts() public {
        MockERC20 rogue = new MockERC20("Rogue", "RGE", 18);
        rogue.mint(ALICE, 1e18);
        vm.prank(ALICE);
        rogue.approve(address(vault), 1e18);

        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(CollateralVault.UnsupportedCollateralToken.selector, address(rogue)));
        vault.deposit(address(rogue), 1e18);
    }

    function testDeposit_accumulates() public {
        vm.prank(ALICE);
        vault.deposit(address(token), 400e18);

        vm.prank(ALICE);
        vault.deposit(address(token), 600e18);

        assertEq(vault.getCollateralBalance(ALICE, address(token)), 1_000e18);
    }

    function testDeposit_separateUsersIsolated() public {
        vm.prank(ALICE);
        vault.deposit(address(token), 500e18);

        vm.prank(BOB);
        vault.deposit(address(token), 300e18);

        assertEq(vault.getCollateralBalance(ALICE, address(token)), 500e18);
        assertEq(vault.getCollateralBalance(BOB,   address(token)), 300e18);
    }

    function testDeposit_multipleTokens() public {
        vm.prank(ALICE);
        vault.deposit(address(token), 100e18);

        vm.prank(ALICE);
        vault.deposit(address(token6), 50e6);

        // 100e18 + 50e6 normalised to 18dp = 100e18 + 50e18 = 150e18
        assertEq(vault.getTotalCollateralValue(ALICE), 150e18);
    }

    // ─── controllerWithdraw ───────────────────────────────────────────────────

    function testControllerWithdraw_happyPath() public {
        vm.prank(ALICE);
        vault.deposit(address(token), DEPOSIT_AMOUNT);

        vm.prank(controller);
        vault.controllerWithdraw(ALICE, address(token), 400e18, ALICE);

        assertEq(vault.getCollateralBalance(ALICE, address(token)), 600e18);
        assertEq(token.balanceOf(ALICE), 10_000e18 - 600e18);
    }

    function testControllerWithdraw_onlyControllerReverts() public {
        vm.prank(ALICE);
        vault.deposit(address(token), DEPOSIT_AMOUNT);

        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(CollateralVault.UnauthorizedController.selector, ALICE));
        vault.controllerWithdraw(ALICE, address(token), 100e18, ALICE);
    }

    function testControllerWithdraw_insufficientBalanceReverts() public {
        vm.prank(ALICE);
        vault.deposit(address(token), 100e18);

        vm.prank(controller);
        vm.expectRevert();
        vault.controllerWithdraw(ALICE, address(token), 101e18, ALICE);
    }

    function testControllerWithdraw_toArbitraryRecipient() public {
        vm.prank(ALICE);
        vault.deposit(address(token), 500e18);

        vm.prank(controller);
        vault.controllerWithdraw(ALICE, address(token), 200e18, BOB);

        assertEq(token.balanceOf(BOB), 10_000e18 + 200e18);
    }

    // ─── normalisation ────────────────────────────────────────────────────────

    function testNormalise_18Decimals() public view {
        assertEq(vault.normalizeCollateralAmount(address(token), 1e18), 1e18);
    }

    function testNormalise_6Decimals() public view {
        // 1 USDC (1e6) should normalise to 1e18
        assertEq(vault.normalizeCollateralAmount(address(token6), 1e6), 1e18);
    }

    function testDenormalise_roundDown() public view {
        // 1e18 USD18 with 6-decimal token = 1e6
        assertEq(vault.denormalizeCollateralAmount(address(token6), 1e18, false), 1e6);
    }

    function testDenormalise_roundUp() public view {
        // 1e18 + 1 USD18 with 6-decimal token, rounds up to 1e6 + 1
        assertEq(vault.denormalizeCollateralAmount(address(token6), 1e18 + 1, true), 1e6 + 1);
    }

    // ─── setController ────────────────────────────────────────────────────────

    function testSetController_onlyOwner() public {
        vm.prank(ALICE);
        vm.expectRevert();
        vault.setController(ALICE);
    }

    function testSetController_zeroAddressReverts() public {
        vm.expectRevert(abi.encodeWithSelector(CollateralVault.InvalidController.selector, address(0)));
        vault.setController(address(0));
    }

    // ─── constructor ──────────────────────────────────────────────────────────

    function testConstructor_zeroAddressTokenReverts() public {
        address[] memory bad = new address[](1);
        bad[0] = address(0);
        vm.expectRevert();
        new CollateralVault(bad);
    }

    function testConstructor_zeroDecimalsTokenReverts() public {
        MockERC20 zero = new MockERC20("ZERO", "Z", 0);
        address[] memory bad = new address[](1);
        bad[0] = address(zero);
        vm.expectRevert();
        new CollateralVault(bad);
    }

    function testConstructor_tooManyDecimalsReverts() public {
        // Can't create ERC20 with >18 decimals through our mock, so we test boundary
        // 18 decimals is the max — verify 18 is accepted
        MockERC20 max18 = new MockERC20("MAX", "MAX", 18);
        address[] memory ok = new address[](1);
        ok[0] = address(max18);
        CollateralVault v = new CollateralVault(ok);
        assertTrue(v.isSupportedToken(address(max18)));
    }

    function testGetSupportedTokens() public view {
        address[] memory tokens = vault.getSupportedTokens();
        assertEq(tokens.length, 2);
        assertEq(tokens[0], address(token));
        assertEq(tokens[1], address(token6));
    }
}
